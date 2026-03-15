"""
Knowledge base models: research interests and notes.
"""
import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from pgvector.sqlalchemy import Vector
from app.database import Base


class ResearchInterest(Base):
    __tablename__ = "research_interests"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    topic: Mapped[str] = mapped_column(String(300), nullable=False)
    keywords: Mapped[list | None] = mapped_column(JSONB, default=list)
    learning_path: Mapped[dict | None] = mapped_column(JSONB)   # generated structured plan
    status: Mapped[str] = mapped_column(String(50), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    notes: Mapped[list["KnowledgeNote"]] = relationship("KnowledgeNote", back_populates="research_interest", cascade="all, delete-orphan")


class KnowledgeNote(Base):
    __tablename__ = "knowledge_notes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    research_interest_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("research_interests.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    source_type: Mapped[str] = mapped_column(String(50), default="manual")  # manual/paper_analysis/survey/planner
    source_id: Mapped[str | None] = mapped_column(String(200))              # reference to originating record
    tags: Mapped[list | None] = mapped_column(JSONB, default=list)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(1536))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    research_interest: Mapped["ResearchInterest | None"] = relationship("ResearchInterest", back_populates="notes")
