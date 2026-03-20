from datetime import datetime
from uuid import UUID
from pydantic import BaseModel


class ChatMessageOut(BaseModel):
    id: UUID
    role: str
    content: str
    sources: list | None
    created_at: datetime

    class Config:
        from_attributes = True


class ChatSessionOut(BaseModel):
    id: UUID
    title: str
    context_type: str
    context_id: str | None
    created_at: datetime
    updated_at: datetime | None
    messages: list[ChatMessageOut] = []

    class Config:
        from_attributes = True


class ChatSessionListItem(BaseModel):
    id: UUID
    title: str
    context_type: str
    created_at: datetime
    updated_at: datetime | None

    class Config:
        from_attributes = True


class ChatRequest(BaseModel):
    session_id: UUID | None = None
    message: str
    context_type: str = "general"  # general/paper/knowledge
    context_id: str | None = None
