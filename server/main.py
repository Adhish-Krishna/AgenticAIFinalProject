from __future__ import annotations

import io
import logging
import os
import re
from datetime import datetime, timedelta
from typing import Any, Iterable, List

from fastapi import BackgroundTasks, Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from minio.commonconfig import Tags
from minio.error import S3Error

from agent.tools.RAG.Chunking import ChunkDocument
from agent.utils import clear_user_chat_context, set_user_chat_context
from envconfig import CHAT_ID, MINIO_BUCKET_NAME

from .dependencies import (
    get_agent_lock,
    get_chat_service,
    get_checkpoint_service,
    get_compiled_agent,
    get_default_user_id,
    get_minio_client,
    get_vector_service,
)
from .schemas import (
    AgentMessage,
    AvailableModelsResponse,
    ChatMessageRequest,
    ChatMessageResponse,
    ChatSummary,
    DeleteChatResponse,
    FileMetadata,
    ModelInfo,
    NextChatIdResponse,
    UpdateChatNameRequest,
    UpdateChatNameResponse,
    UploadResponse,
)

logger = logging.getLogger("sudar-api")
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="SUDAR Agent API",
    version="1.0.0",
    description="API server that powers the Sudar AI agent and supporting utilities.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _sanitize_filename(filename: str) -> str:
    base_name = os.path.basename(filename)
    name, ext = os.path.splitext(base_name)
    safe_name = re.sub(r"[^0-9a-zA-Z._-]", "_", name).strip("._") or "document"
    return f"{safe_name}{ext or ''}"


def _schedule_ingestion(background_tasks: BackgroundTasks, object_key: str, user_id: str, chat_id: str) -> None:
    def ingest() -> None:
        set_user_chat_context(user_id, chat_id)
        minio_client = get_minio_client()
        status_value = "indexed"
        try:
            chunker = ChunkDocument(object_key)
            chunker.parseDocument()
            chunker.initializeEmbeddings()
            chunker.storeEmbeddings()
            logger.info("Completed ingestion for %s", object_key)
        except Exception:  # noqa: BLE001
            logger.exception("Failed to ingest %s", object_key)
            status_value = "error"
        finally:
            try:
                existing_tags = minio_client.get_object_tags(MINIO_BUCKET_NAME, object_key)
                tag_dict = existing_tags.to_dict() if hasattr(existing_tags, "to_dict") else dict(existing_tags)
                tag_dict["status"] = status_value
                tags = Tags(for_object=True)
                for key, value in tag_dict.items():
                    tags[key] = value
                minio_client.set_object_tags(MINIO_BUCKET_NAME, object_key, tags)
            except Exception:  # noqa: BLE001
                logger.exception("Failed to update ingestion status tags for %s", object_key)
            clear_user_chat_context()

    background_tasks.add_task(ingest)


def _stringify_content(content: Any) -> str:
    if isinstance(content, str):
        return content

    if isinstance(content, list):
        parts: List[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                text = item.get("text")
                if text is not None:
                    parts.append(str(text))
            else:
                text = getattr(item, "text", None)
                if text is not None:
                    parts.append(str(text))
                else:
                    parts.append(str(item))
        return "".join(parts)

    text = getattr(content, "text", None)
    if text is not None:
        return str(text)

    return str(content)


@app.on_event("startup")
async def warm_up() -> None:
    get_minio_client()
    get_chat_service()
    get_compiled_agent()
    logger.info("SUDAR Agent API ready")


@app.get("/api/chats", response_model=List[ChatSummary])
async def list_user_chats(
    user_id: str = Depends(get_default_user_id),
    chat_service=Depends(get_chat_service),
):
    chats = chat_service.getUserChatList(user_id)
    return [ChatSummary(**chat) for chat in chats]


@app.get("/api/chats/next-id", response_model=NextChatIdResponse)
async def get_next_chat_identifier(
    user_id: str = Depends(get_default_user_id),
    chat_service=Depends(get_chat_service),
):
    chats = chat_service.getUserChatList(user_id)
    numeric_ids = [int(chat["chat_id"]) for chat in chats if str(chat["chat_id"]).isdigit()]
    base_chat_id = int(CHAT_ID or "1")
    next_id = (max(numeric_ids) + 1) if numeric_ids else base_chat_id + 1
    return NextChatIdResponse(next_chat_id=str(next_id))


@app.get("/api/chats/{chat_id}", response_model=List[AgentMessage])
async def get_chat_history(
    chat_id: str,
    user_id: str = Depends(get_default_user_id),
    chat_service=Depends(get_chat_service),
):
    messages = chat_service.getUserChat(user_id, chat_id)
    normalized: List[AgentMessage] = []
    for message in messages:
        role = message.get("role", "").lower()
        normalized_role = "assistant" if role in {"ai", "assistant"} else "user"
        normalized.append(
            AgentMessage(
                role=normalized_role,
                content=_stringify_content(message.get("message", "")),
                agent=message.get("agent"),
                timestamp=message.get("timestamp"),
            )
        )
    return normalized


@app.post("/api/chats/{chat_id}/messages", response_model=ChatMessageResponse)
async def send_message_to_agent(
    chat_id: str,
    payload: ChatMessageRequest,
    user_id: str = Depends(get_default_user_id),
    chat_service=Depends(get_chat_service),
    agent_lock=Depends(get_agent_lock),
):
    user_message = payload.message.strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    # Get the appropriate agent based on model selection
    from .dependencies import get_compiled_agent_with_model
    if payload.model_provider and payload.model_name:
        compiled_agent = get_compiled_agent_with_model(payload.model_provider, payload.model_name)
    else:
        compiled_agent = get_compiled_agent()

    set_user_chat_context(user_id, chat_id)

    try:
        chat_service.insertHumanMessage(user_message, user_id, chat_id)
    except Exception as exc:  # noqa: BLE001
        clear_user_chat_context()
        logger.exception("Failed to persist user message")
        raise HTTPException(status_code=500, detail="Unable to store message.") from exc

    responses: List[AgentMessage] = []

    try:
        async with agent_lock:
            from asyncio import get_running_loop

            loop = get_running_loop()

            def run_agent_interaction() -> List[AgentMessage]:
                set_user_chat_context(user_id, chat_id)
                responses: List[AgentMessage] = []
                config = {"configurable": {"thread_id": f"{user_id}_{chat_id}"}}
                try:
                    for chunk in compiled_agent.stream(
                        {"messages": [{"role": "user", "content": user_message}]},
                        config=config,
                        stream_mode="updates",
                    ):
                        for agent_name in ("supervisor", "ContentResearcher", "WorksheetGenerator"):
                            if agent_name in chunk:
                                raw_content = chunk[agent_name]["messages"][-1].content
                                message_content = _stringify_content(raw_content)
                                chat_service.insertAIMessage(
                                    message=message_content,
                                    user_id=user_id,
                                    chat_id=chat_id,
                                    agent_name=agent_name,
                                )
                                responses.append(
                                    AgentMessage(
                                        role="assistant",
                                        content=message_content,
                                        agent=agent_name,
                                        timestamp=datetime.utcnow(),
                                    )
                                )
                                break
                    return responses
                except Exception as exc:  # noqa: BLE001
                    logger.exception("Agent interaction failed")
                    raise
                finally:
                    clear_user_chat_context()

            try:
                responses = await loop.run_in_executor(None, run_agent_interaction)
            except Exception as exc:  # noqa: BLE001
                raise HTTPException(status_code=500, detail="Agent failed to respond.") from exc
    finally:
        clear_user_chat_context()

    return ChatMessageResponse(messages=responses)


@app.put("/api/chats/{chat_id}/name", response_model=UpdateChatNameResponse)
async def update_chat_name(
    chat_id: str,
    payload: UpdateChatNameRequest,
    user_id: str = Depends(get_default_user_id),
    chat_service=Depends(get_chat_service),
):
    """Update the name of a specific chat"""
    success = chat_service.updateChatName(user_id, chat_id, payload.chat_name)
    
    if not success:
        raise HTTPException(status_code=404, detail="Chat not found or no changes made")
    
    return UpdateChatNameResponse(
        success=True,
        message="Chat name updated successfully",
        chat_id=chat_id,
        chat_name=payload.chat_name
    )


@app.delete("/api/chats/{chat_id}", response_model=DeleteChatResponse)
async def delete_chat(
    chat_id: str,
    user_id: str = Depends(get_default_user_id),
    chat_service=Depends(get_chat_service),
    minio_client=Depends(get_minio_client),
    vector_service=Depends(get_vector_service),
    checkpoint_service=Depends(get_checkpoint_service),
):
    """Delete a chat and all associated files, messages, embeddings, and checkpoints"""
    
    # First, get count of files and messages for response
    prefix = f"{user_id}/{chat_id}/"
    files_to_delete = list(minio_client.list_objects(MINIO_BUCKET_NAME, prefix=prefix, recursive=True))
    files_count = len(files_to_delete)
    
    # Get message count before deletion
    chat_messages = chat_service.getUserChat(user_id, chat_id)
    messages_count = len(chat_messages)
    
    if messages_count == 0:
        raise HTTPException(status_code=404, detail="Chat not found")
    
    try:
        # Delete all files associated with this chat from MinIO
        for file_obj in files_to_delete:
            try:
                minio_client.remove_object(MINIO_BUCKET_NAME, file_obj.object_name)
            except S3Error as e:
                logger.warning(f"Failed to delete file {file_obj.object_name}: {e}")
        
        # Delete vector embeddings from Qdrant
        embeddings_deleted = vector_service.delete_chat_embeddings(user_id, chat_id)
        
        # Delete LangGraph checkpoints from MongoDB
        checkpoints_deleted = checkpoint_service.delete_chat_checkpoints(user_id, chat_id)
        
        # Delete chat history from MongoDB
        chat_deleted = chat_service.deleteChatHistory(user_id, chat_id)
        
        if not chat_deleted:
            raise HTTPException(status_code=500, detail="Failed to delete chat history")
            
        return DeleteChatResponse(
            success=True,
            message=f"Chat deleted successfully. Removed {messages_count} messages, {files_count} files, {embeddings_deleted} embeddings, and {checkpoints_deleted} checkpoints.",
            deleted_files_count=files_count,
            deleted_messages_count=messages_count,
            deleted_embeddings_count=embeddings_deleted,
            deleted_checkpoints_count=checkpoints_deleted
        )
        
    except Exception as exc:
        logger.exception(f"Failed to delete chat {chat_id}")
        raise HTTPException(status_code=500, detail="Failed to delete chat") from exc


@app.post("/api/files/upload", response_model=UploadResponse)
async def upload_file(
    background_tasks: BackgroundTasks,
    chat_id: str = Form(...),
    file: UploadFile = File(...),
    user_id: str = Depends(get_default_user_id),
    minio_client=Depends(get_minio_client),
):
    if file.filename is None:
        raise HTTPException(status_code=400, detail="Uploaded file must have a filename.")

    sanitized_name = _sanitize_filename(file.filename)
    object_key = f"{user_id}/{chat_id}/{sanitized_name}"

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    data_stream = io.BytesIO(file_bytes)

    tags = Tags(for_object=True)
    tags["user_id"] = user_id
    tags["chat_id"] = chat_id
    tags["type"] = "UploadedDocument"
    tags["status"] = "processing"

    try:
        set_user_chat_context(user_id, chat_id)
        minio_client.put_object(
            bucket_name=MINIO_BUCKET_NAME,
            object_name=object_key,
            data=data_stream,
            length=len(file_bytes),
            content_type=file.content_type or "application/octet-stream",
            tags=tags,
        )
    except S3Error as exc:
        logger.exception("Failed to upload file to MinIO")
        raise HTTPException(status_code=500, detail="Could not store file in MinIO.") from exc
    finally:
        clear_user_chat_context()

    _schedule_ingestion(background_tasks, object_key, user_id, chat_id)

    return UploadResponse(object_key=object_key, message="Upload successful. Ingestion started.", status="processing")


def _filter_tagged_objects(
    objects: Iterable,
    minio_client,
    user_id: str,
    chat_id: str,
    expected_type: str,
) -> List[FileMetadata]:
    results: List[FileMetadata] = []
    for obj in objects:
        try:
            tags = minio_client.get_object_tags(MINIO_BUCKET_NAME, obj.object_name)
        except S3Error:
            logger.warning("Failed to fetch tags for %s", obj.object_name)
            continue

        tag_dict = tags.to_dict() if hasattr(tags, "to_dict") else dict(tags)
        if tag_dict.get("user_id") != user_id or tag_dict.get("chat_id") != chat_id:
            continue

        if tag_dict.get("type") != expected_type:
            continue

        try:
            download_url = minio_client.get_presigned_url(
                "GET", MINIO_BUCKET_NAME, obj.object_name, expires=timedelta(hours=1)
            )
        except S3Error:
            logger.exception("Failed to generate download URL for %s", obj.object_name)
            continue

        results.append(
            FileMetadata(
                object_key=obj.object_name,
                file_name=os.path.basename(obj.object_name),
                last_modified=obj.last_modified,
                size=obj.size,
                download_url=download_url,
                tags=tag_dict,
                status=tag_dict.get("status"),
            )
        )
    return results


@app.get("/api/files/generated/{chat_id}", response_model=List[FileMetadata])
async def list_generated_content(
    chat_id: str,
    user_id: str = Depends(get_default_user_id),
    minio_client=Depends(get_minio_client),
):
    prefix = f"{user_id}/{chat_id}/"
    objects = minio_client.list_objects(MINIO_BUCKET_NAME, prefix=prefix, recursive=True)
    return _filter_tagged_objects(objects, minio_client, user_id, chat_id, expected_type="GeneratedContent")


@app.get("/api/files/uploads/{chat_id}", response_model=List[FileMetadata])
async def list_uploaded_documents(
    chat_id: str,
    user_id: str = Depends(get_default_user_id),
    minio_client=Depends(get_minio_client),
):
    prefix = f"{user_id}/{chat_id}/"
    objects = minio_client.list_objects(MINIO_BUCKET_NAME, prefix=prefix, recursive=True)
    return _filter_tagged_objects(objects, minio_client, user_id, chat_id, expected_type="UploadedDocument")


@app.get("/api/models", response_model=AvailableModelsResponse)
async def get_available_models():
    """Get list of available AI models from different providers."""
    from envconfig import OLLAMA_MODEL, GROQ_MODEL_NAME, GOOGLE_MODEL_NAME
    
    models = [
        ModelInfo(
            provider="ollama",
            name=OLLAMA_MODEL or "llama3.2",
            display_name=f"Ollama - {OLLAMA_MODEL or 'llama3.2'}"
        ),
        ModelInfo(
            provider="groq",
            name=GROQ_MODEL_NAME or "llama-3.1-70b-versatile",
            display_name=f"Groq - {GROQ_MODEL_NAME or 'llama-3.1-70b-versatile'}"
        ),
        ModelInfo(
            provider="google",
            name=GOOGLE_MODEL_NAME or "gemini-pro",
            display_name=f"Google - {GOOGLE_MODEL_NAME or 'gemini-pro'}"
        ),
    ]
    
    return AvailableModelsResponse(models=models)
