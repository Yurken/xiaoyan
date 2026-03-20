"""
Persistence helpers for multi-agent runs and artifacts.
"""
import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.models.agent import AgentRun, AgentArtifact


class AgentRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_run(
        self,
        session_id: uuid.UUID,
        request_id: uuid.UUID,
        agent_name: str,
        step_name: str,
        order_index: int,
        status: str = "pending",
        input_payload: dict | None = None,
        parent_run_id: uuid.UUID | None = None,
    ) -> AgentRun:
        run = AgentRun(
            session_id=session_id,
            request_id=request_id,
            agent_name=agent_name,
            step_name=step_name,
            status=status,
            order_index=order_index,
            input_payload=input_payload,
            parent_run_id=parent_run_id,
        )
        self.db.add(run)
        await self.db.flush()
        return run

    async def update_run(self, run_id: uuid.UUID, **kwargs) -> AgentRun | None:
        run = await self.get_run(run_id)
        if not run:
            return None
        for key, value in kwargs.items():
            setattr(run, key, value)
        await self.db.flush()
        return run

    async def get_run(self, run_id: uuid.UUID) -> AgentRun | None:
        result = await self.db.execute(
            select(AgentRun)
            .options(selectinload(AgentRun.artifacts))
            .where(AgentRun.id == run_id)
        )
        return result.scalar_one_or_none()

    async def list_runs(
        self,
        session_id: uuid.UUID,
        request_id: uuid.UUID | None = None,
        limit: int = 40,
    ) -> list[AgentRun]:
        stmt = (
            select(AgentRun)
            .options(selectinload(AgentRun.artifacts))
            .where(AgentRun.session_id == session_id)
            .order_by(AgentRun.created_at.desc(), AgentRun.order_index.desc())
            .limit(limit)
        )
        if request_id:
            stmt = stmt.where(AgentRun.request_id == request_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def add_artifact(
        self,
        run_id: uuid.UUID,
        artifact_type: str,
        title: str,
        content: str,
    ) -> AgentArtifact:
        artifact = AgentArtifact(
            run_id=run_id,
            artifact_type=artifact_type,
            title=title,
            content=content,
        )
        self.db.add(artifact)
        await self.db.flush()
        return artifact
