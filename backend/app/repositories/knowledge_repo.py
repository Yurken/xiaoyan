"""
Data access layer for knowledge base: research interests and notes.
"""
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, or_
from sqlalchemy.orm import selectinload
from app.models.knowledge import ResearchInterest, KnowledgeNote


class ResearchInterestRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, **kwargs) -> ResearchInterest:
        obj = ResearchInterest(**kwargs)
        self.db.add(obj)
        await self.db.flush()
        return obj

    async def get(self, interest_id: uuid.UUID) -> ResearchInterest | None:
        result = await self.db.execute(select(ResearchInterest).where(ResearchInterest.id == interest_id))
        return result.scalar_one_or_none()

    async def list(self) -> list[ResearchInterest]:
        result = await self.db.execute(select(ResearchInterest).order_by(ResearchInterest.created_at.desc()))
        return list(result.scalars().all())

    async def update(self, interest_id: uuid.UUID, **kwargs) -> ResearchInterest | None:
        await self.db.execute(update(ResearchInterest).where(ResearchInterest.id == interest_id).values(**kwargs))
        return await self.get(interest_id)


class KnowledgeNoteRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, **kwargs) -> KnowledgeNote:
        obj = KnowledgeNote(**kwargs)
        self.db.add(obj)
        await self.db.flush()
        return obj

    async def get(self, note_id: uuid.UUID) -> KnowledgeNote | None:
        result = await self.db.execute(select(KnowledgeNote).where(KnowledgeNote.id == note_id))
        return result.scalar_one_or_none()

    async def list(self, search: str | None = None, limit: int = 50) -> list[KnowledgeNote]:
        query = select(KnowledgeNote).order_by(KnowledgeNote.created_at.desc()).limit(limit)
        if search:
            query = query.where(
                or_(
                    KnowledgeNote.title.ilike(f"%{search}%"),
                    KnowledgeNote.content.ilike(f"%{search}%"),
                )
            )
        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def update(self, note_id: uuid.UUID, **kwargs) -> KnowledgeNote | None:
        await self.db.execute(update(KnowledgeNote).where(KnowledgeNote.id == note_id).values(**kwargs))
        return await self.get(note_id)

    async def delete(self, note_id: uuid.UUID):
        await self.db.execute(delete(KnowledgeNote).where(KnowledgeNote.id == note_id))
