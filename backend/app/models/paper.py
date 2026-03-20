"""
Paper-related SQLAlchemy models.
"""
import uuid
from datetime import datetime
from sqlalchemy import String, Text, DateTime, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from pgvector.sqlalchemy import Vector
from app.database import Base


class Paper(Base):
    __tablename__ = "papers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    authors: Mapped[str | None] = mapped_column(Text)
    abstract: Mapped[str | None] = mapped_column(Text)
    year: Mapped[int | None] = mapped_column(Integer)
    venue: Mapped[str | None] = mapped_column(String(300))
    doi: Mapped[str | None] = mapped_column(String(200))
    file_path: Mapped[str | None] = mapped_column(String(500))  # stored PDF path
    full_text: Mapped[str | None] = mapped_column(Text)         # extracted text
    tags: Mapped[list | None] = mapped_column(JSONB, default=list)
    status: Mapped[str] = mapped_column(String(50), default="uploaded")  # uploaded/parsed/analyzed
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    chunks: Mapped[list["PaperChunk"]] = relationship("PaperChunk", back_populates="paper", cascade="all, delete-orphan")
    analysis: Mapped["PaperAnalysis | None"] = relationship("PaperAnalysis", back_populates="paper", uselist=False, cascade="all, delete-orphan")
    reproduction_guide: Mapped["ReproductionGuide | None"] = relationship("ReproductionGuide", back_populates="paper", uselist=False, cascade="all, delete-orphan")


class PaperChunk(Base):
    __tablename__ = "paper_chunks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    paper_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("papers.id", ondelete="CASCADE"), nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    embedding: Mapped[list[float] | None] = mapped_column(Vector(1536))  # default for text-embedding-3-small
    token_count: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    paper: Mapped["Paper"] = relationship("Paper", back_populates="chunks")


class PaperAnalysis(Base):
    __tablename__ = "paper_analyses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    paper_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("papers.id", ondelete="CASCADE"), unique=True, nullable=False)
    research_question: Mapped[str | None] = mapped_column(Text)
    core_method: Mapped[str | None] = mapped_column(Text)
    experiment_design: Mapped[str | None] = mapped_column(Text)
    innovations: Mapped[str | None] = mapped_column(Text)
    limitations: Mapped[str | None] = mapped_column(Text)
    key_conclusions: Mapped[str | None] = mapped_column(Text)
    raw_analysis: Mapped[dict | None] = mapped_column(JSONB)   # full structured JSON
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    paper: Mapped["Paper"] = relationship("Paper", back_populates="analysis")


class ReproductionGuide(Base):
    __tablename__ = "reproduction_guides"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    paper_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("papers.id", ondelete="CASCADE"), unique=True, nullable=False)
    environment_setup: Mapped[str | None] = mapped_column(Text)
    dependencies: Mapped[str | None] = mapped_column(Text)
    dataset_preparation: Mapped[str | None] = mapped_column(Text)
    training_process: Mapped[str | None] = mapped_column(Text)
    inference_process: Mapped[str | None] = mapped_column(Text)
    evaluation_metrics: Mapped[str | None] = mapped_column(Text)
    risks_and_notes: Mapped[str | None] = mapped_column(Text)
    raw_guide: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    paper: Mapped["Paper"] = relationship("Paper", back_populates="reproduction_guide")
