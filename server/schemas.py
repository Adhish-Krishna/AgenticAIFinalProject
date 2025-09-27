from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class ChatMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, description="User message to send to the agent")


class AgentMessage(BaseModel):
    role: str
    content: str
    agent: Optional[str] = None
    timestamp: datetime


class ChatMessageResponse(BaseModel):
    messages: List[AgentMessage]


class ChatSummary(BaseModel):
    chat_id: str
    chat_name: Optional[str] = None
    message_count: int
    first_message_time: Optional[datetime] = None
    last_message_time: Optional[datetime] = None


class FileMetadata(BaseModel):
    object_key: str
    file_name: str
    last_modified: Optional[datetime]
    size: Optional[int]
    download_url: str
    tags: dict
    status: Optional[str] = None


class UploadResponse(BaseModel):
    object_key: str
    message: str
    status: Optional[str] = None


class NextChatIdResponse(BaseModel):
    next_chat_id: str


class UpdateChatNameRequest(BaseModel):
    chat_name: str = Field(..., min_length=1, max_length=100, description="New name for the chat")


class DeleteChatResponse(BaseModel):
    success: bool
    message: str
    deleted_files_count: int = 0
    deleted_messages_count: int = 0
    deleted_embeddings_count: int = 0
    deleted_checkpoints_count: int = 0


class UpdateChatNameResponse(BaseModel):
    success: bool
    message: str
    chat_id: str
    chat_name: str
