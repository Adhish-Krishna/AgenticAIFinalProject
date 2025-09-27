from __future__ import annotations

import asyncio
import logging
from functools import lru_cache
from typing import Optional

from minio import Minio

from agent.teachAssist import TeachAssistAgent
from agent.services import ChatService
from agent.services.vectorService import VectorService
from agent.services.checkpointService import CheckpointService
from envconfig import (
    MINIO_ACCESS_KEY,
    MINIO_BUCKET_NAME,
    MINIO_SECRET_KEY,
    MINIO_URL,
    USER_ID,
)

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_minio_client() -> Minio:
    """Returns a cached MinIO client instance."""

    endpoint = str(MINIO_URL).replace("http://", "").replace("https://", "")
    client = Minio(
        endpoint=endpoint,
        access_key=MINIO_ACCESS_KEY,
        secret_key=MINIO_SECRET_KEY,
        secure=MINIO_URL.startswith("https"),
    )
    logger.debug("Initialised MinIO client for endpoint %s", endpoint)

    # Ensure bucket exists
    if not client.bucket_exists(MINIO_BUCKET_NAME):
        logger.info("Bucket %s missing; creating it now", MINIO_BUCKET_NAME)
        client.make_bucket(MINIO_BUCKET_NAME)

    return client


@lru_cache(maxsize=1)
def get_chat_service() -> ChatService:
    return ChatService(db_name="SUDAR", collection_name="chat_history")


@lru_cache(maxsize=1)
def get_vector_service() -> VectorService:
    return VectorService()


@lru_cache(maxsize=1)
def get_checkpoint_service() -> CheckpointService:
    return CheckpointService(db_name="SUDAR")


@lru_cache(maxsize=1)
def get_compiled_agent():
    agent = TeachAssistAgent()
    compiled = agent.get_agent()
    logger.info("Compiled Sudar agent ready for serving.")
    return compiled


def get_compiled_agent_with_model(model_provider: str = None, model_name: str = None):
    """Create a compiled agent with specific model configuration."""
    agent = TeachAssistAgent(model_provider=model_provider, model_name=model_name)
    compiled = agent.get_agent()
    logger.info(f"Compiled Sudar agent with provider: {model_provider}, model: {model_name}")
    return compiled


_agent_lock: Optional[asyncio.Lock] = None


def get_agent_lock() -> asyncio.Lock:
    global _agent_lock
    if _agent_lock is None:
        _agent_lock = asyncio.Lock()
    return _agent_lock


def get_default_user_id() -> str:
    return str(USER_ID)
