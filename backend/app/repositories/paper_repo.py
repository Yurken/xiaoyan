"""
Data access layer for papers, chunks, analyses, and reproduction guides.
"""
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload
from app.models.paper import Paper, PaperChunk, PaperAnalysis, ReproductionGuide


class PaperRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, **kwargs) -> Paper:
        paper = Paper(**kwargs)
        self.db.add(paper)
        await self.db.flush()
        return paper

    async def get(self, paper_id: uuid.UUID) -> Paper | None:
        result = await self.db.execute(
            select(Paper)
            .options(selectinload(Paper.analysis), selectinload(Paper.reproduction_guide))
            .where(Paper.id == paper_id)
        )
        return result.scalar_one_or_none()

    async def list_all(self, offset: int = 0, limit: int = 20) -> list[Paper]:
        result = await self.db.execute(
            select(Paper).order_by(Paper.created_at.desc()).offset(offset).limit(limit)
        )
        return list(result.scalars().all())

    async def update(self, paper_id: uuid.UUID, **kwargs) -> Paper | None:
        await self.db.execute(update(Paper).where(Paper.id == paper_id).values(**kwargs))
        return await self.get(paper_id)

    async def delete(self, paper_id: uuid.UUID):
        await self.db.execute(delete(Paper).where(Paper.id == paper_id))

    async def add_chunks(self, paper_id: uuid.UUID, chunks: list[dict]):
        """Bulk insert chunks (with embeddings) for a paper."""
        objs = [
            PaperChunk(
                paper_id=paper_id,
                chunk_index=c["chunk_index"],
                content=c["content"],
                embedding=c.get("embedding"),
                token_count=c.get("token_count"),
            )
            for c in chunks
        ]
        self.db.add_all(objs)
        await self.db.flush()

    async def delete_chunks(self, paper_id: uuid.UUID):
        await self.db.execute(delete(PaperChunk).where(PaperChunk.paper_id == paper_id))

    async def upsert_analysis(self, paper_id: uuid.UUID, analysis_data: dict) -> PaperAnalysis:
        existing = await self.db.execute(
            select(PaperAnalysis).where(PaperAnalysis.paper_id == paper_id)
        )
        analysis = existing.scalar_one_or_none()
        if analysis:
            for k, v in analysis_data.items():
                setattr(analysis, k, v)
        else:
            analysis = PaperAnalysis(paper_id=paper_id, **analysis_data)
            self.db.add(analysis)
        await self.db.flush()
        return analysis

    async def upsert_reproduction_guide(self, paper_id: uuid.UUID, guide_data: dict) -> ReproductionGuide:
        existing = await self.db.execute(
            select(ReproductionGuide).where(ReproductionGuide.paper_id == paper_id)
        )
        guide = existing.scalar_one_or_none()
        if guide:
            for k, v in guide_data.items():
                setattr(guide, k, v)
        else:
            guide = ReproductionGuide(paper_id=paper_id, **guide_data)
            self.db.add(guide)
        await self.db.flush()
        return guide
