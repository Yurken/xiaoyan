from datetime import datetime
from uuid import UUID
from pydantic import BaseModel


class ResearchInterestCreate(BaseModel):
    topic: str
    keywords: list[str] = []


class ResearchInterestOut(BaseModel):
    id: UUID
    topic: str
    keywords: list | None
    learning_path: dict | None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class KnowledgeNoteCreate(BaseModel):
    title: str
    content: str
    research_interest_id: UUID | None = None
    tags: list[str] = []
    source_type: str = "manual"
    source_id: str | None = None


class KnowledgeNoteUpdate(BaseModel):
    title: str | None = None
    content: str | None = None
    tags: list[str] | None = None


class KnowledgeNoteOut(BaseModel):
    id: UUID
    title: str
    content: str
    source_type: str
    source_id: str | None
    tags: list | None
    research_interest_id: UUID | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
