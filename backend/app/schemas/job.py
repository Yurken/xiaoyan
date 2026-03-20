from datetime import datetime
from uuid import UUID
from pydantic import BaseModel


class JobOut(BaseModel):
    id: UUID
    type: str
    status: str
    progress: int
    error: str | None = None
    result: dict | None = None
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None

    class Config:
        from_attributes = True
