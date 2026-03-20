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


class AgentArtifactOut(BaseModel):
    id: UUID
    run_id: UUID
    artifact_type: str
    title: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class AgentRunOut(BaseModel):
    id: UUID
    session_id: UUID
    request_id: UUID
    parent_run_id: UUID | None = None
    agent_name: str
    step_name: str
    status: str
    order_index: int
    input_payload: dict | None = None
    output_payload: dict | None = None
    summary: str | None = None
    error: str | None = None
    created_at: datetime
    updated_at: datetime
    artifacts: list[AgentArtifactOut] = []

    class Config:
        from_attributes = True


class ChatRequest(BaseModel):
    session_id: UUID | None = None
    message: str
    context_type: str = "general"  # general/paper/knowledge
    context_id: str | None = None
