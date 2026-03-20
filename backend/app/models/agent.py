"""
Multi-agent orchestration models.
"""
import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, Text, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base


class AgentRun(Base):
    __tablename__ = "agent_runs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chat_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    request_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    parent_run_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("agent_runs.id", ondelete="SET NULL"),
        nullable=True,
    )
    agent_name: Mapped[str] = mapped_column(String(80), nullable=False)
    step_name: Mapped[str] = mapped_column(String(200), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="pending")
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    input_payload: Mapped[dict | None] = mapped_column(JSONB)
    output_payload: Mapped[dict | None] = mapped_column(JSONB)
    summary: Mapped[str | None] = mapped_column(Text)
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    artifacts: Mapped[list["AgentArtifact"]] = relationship(
        "AgentArtifact",
        back_populates="run",
        cascade="all, delete-orphan",
        order_by="AgentArtifact.created_at",
    )
    parent_run: Mapped["AgentRun | None"] = relationship("AgentRun", remote_side="AgentRun.id")


class AgentArtifact(Base):
    __tablename__ = "agent_artifacts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("agent_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    artifact_type: Mapped[str] = mapped_column(String(80), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    run: Mapped["AgentRun"] = relationship("AgentRun", back_populates="artifacts")
