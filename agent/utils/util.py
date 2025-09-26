import os
from contextvars import ContextVar
from typing import Optional, Tuple
from envconfig import USER_ID, CHAT_ID

_user_chat_context: ContextVar[Optional[Tuple[str, str]]] = ContextVar(
    "user_chat_context", default=None
)

def sanitize_collection_name(name: str) -> str:
    """
    Sanitizes a string to be used as a ChromaDB collection name.
    Args:
        name (str): Input string to sanitize
    Returns:
        str: Sanitized string following ChromaDB collection name rules:
        - Contains only letters, numbers, underscores
        - Starts with letter
        - Length between 3-63 characters
        - Ends with alphanumeric character
    """
    # Remove all non-alphanumeric characters except underscores
    sanitized = ''.join(char if char.isalnum() or char == '_' else '_' for char in name)

    # Ensure starts with a letter
    if not sanitized[0].isalpha():
        sanitized = 'col_' + sanitized

    # Ensure ends with alphanumeric
    if not sanitized[-1].isalnum():
        sanitized = sanitized[:-1] + 'x'

    # Truncate if too long, preserving alphanumeric ending
    if len(sanitized) > 63:
        sanitized = sanitized[:62] + 'x'

    # Ensure minimum length
    if len(sanitized) < 3:
        sanitized = sanitized + '_col'

    return sanitized

def extract_filename(filepath: str) -> str:
    """
    Extracts the filename without extension from a given filepath
    Args:
        filepath (str): Full path to the file
    Returns:
        str: Filename without extension
    """
    return os.path.splitext(os.path.basename(filepath))[0]

def extract_extension(filepath: str) -> str:
    """
    Extracts the file extension from a given filepath
    Args:
        filepath (str): Full path to the file
    Returns:
        str: File extension including the dot (e.g. '.pdf')
    """
    return os.path.splitext(filepath)[1]

def set_user_chat_context(user_id: str, chat_id: str) -> None:
    """Sets the contextual user and chat identifiers for downstream tools."""

    _user_chat_context.set((str(user_id), str(chat_id)))


def clear_user_chat_context() -> None:
    """Clears the contextual user and chat identifiers."""

    _user_chat_context.set(None)


def getUserIdChatId():
    """Returns the active user/chat identifiers, falling back to environment defaults."""

    context_value = _user_chat_context.get()
    if context_value is not None:
        return context_value

    user_id = USER_ID
    chat_id = CHAT_ID
    return user_id, chat_id