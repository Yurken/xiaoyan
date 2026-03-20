import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.job import Job


class JobRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, type: str, payload: dict | None = None, paper_id: uuid.UUID | None = None) -> Job:
        job = Job(type=type, payload=payload, paper_id=paper_id)
        self.db.add(job)
        await self.db.flush()
        return job

    async def get(self, job_id: uuid.UUID) -> Job | None:
        result = await self.db.execute(select(Job).where(Job.id == job_id))
        return result.scalar_one_or_none()

    async def update_status(self, job_id: uuid.UUID, status: str, progress: int = 0,
                             result: dict | None = None, error: str | None = None) -> None:
        job = await self.get(job_id)
        if not job:
            return
        job.status = status
        job.progress = progress
        if status == "running" and not job.started_at:
            job.started_at = datetime.utcnow()
        if status in ("done", "failed"):
            job.finished_at = datetime.utcnow()
        if result is not None:
            job.result = result
        if error is not None:
            job.error = error
        await self.db.flush()
