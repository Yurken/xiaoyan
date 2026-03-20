"""
ARQ background tasks.
Each task updates the jobs table with progress/status.
"""
import uuid
from app.database import AsyncSessionLocal
from app.repositories.job_repo import JobRepository
from app.repositories.paper_repo import PaperRepository
from app.services.pdf_parser import chunk_text
from app.services.embedding_service import embed_texts
from app.services.paper_analyzer import analyze_paper, generate_reproduction_guide
from app.services.survey_service import generate_survey_report
import json


async def process_paper_chunks(ctx, job_id: str, paper_id: str):
    """Chunk and embed paper text. Replaces BackgroundTasks._process_paper_chunks."""
    job_uuid = uuid.UUID(job_id)
    paper_uuid = uuid.UUID(paper_id)

    async with AsyncSessionLocal() as db:
        job_repo = JobRepository(db)
        paper_repo = PaperRepository(db)

        await job_repo.update_status(job_uuid, "running", progress=5)
        await db.commit()

        try:
            paper = await paper_repo.get(paper_uuid)
            if not paper or not paper.full_text:
                raise ValueError("Paper or text not found")

            chunks = chunk_text(paper.full_text)
            await job_repo.update_status(job_uuid, "running", progress=30)
            await db.commit()

            texts = [c["content"] for c in chunks]
            embeddings = await embed_texts(texts)
            for chunk, emb in zip(chunks, embeddings):
                chunk["embedding"] = emb

            await job_repo.update_status(job_uuid, "running", progress=80)
            await db.commit()

            await paper_repo.delete_chunks(paper_uuid)
            await paper_repo.add_chunks(paper_uuid, chunks)

            await job_repo.update_status(job_uuid, "done", progress=100,
                                          result={"chunks": len(chunks)})
            await db.commit()
        except Exception as e:
            await job_repo.update_status(job_uuid, "failed", error=str(e))
            await db.commit()
            raise


async def analyze_paper_task(ctx, job_id: str, paper_id: str):
    """Run AI analysis on a paper."""
    job_uuid = uuid.UUID(job_id)
    paper_uuid = uuid.UUID(paper_id)

    async with AsyncSessionLocal() as db:
        job_repo = JobRepository(db)
        paper_repo = PaperRepository(db)

        await job_repo.update_status(job_uuid, "running", progress=10)
        await db.commit()

        try:
            paper = await paper_repo.get(paper_uuid)
            if not paper or not paper.full_text:
                raise ValueError("Paper or text not found")

            raw = await analyze_paper(paper.full_text)
            await job_repo.update_status(job_uuid, "running", progress=80)
            await db.commit()

            analysis_data = {
                "research_question": raw.get("research_question", ""),
                "core_method": raw.get("core_method", ""),
                "experiment_design": raw.get("experiment_design", ""),
                "innovations": json.dumps(raw.get("innovations", []), ensure_ascii=False),
                "limitations": json.dumps(raw.get("limitations", []), ensure_ascii=False),
                "key_conclusions": raw.get("key_conclusions", ""),
                "raw_analysis": raw,
            }
            await paper_repo.upsert_analysis(paper_uuid, analysis_data)

            if raw.get("title") and paper.title.endswith(".pdf"):
                await paper_repo.update(paper_uuid, title=raw["title"], status="analyzed")
            else:
                await paper_repo.update(paper_uuid, status="analyzed")

            await job_repo.update_status(job_uuid, "done", progress=100)
            await db.commit()
        except Exception as e:
            await job_repo.update_status(job_uuid, "failed", error=str(e))
            await db.commit()
            raise


async def generate_survey_task(ctx, job_id: str, query: str, max_papers: int):
    """Generate a survey report."""
    job_uuid = uuid.UUID(job_id)

    async with AsyncSessionLocal() as db:
        job_repo = JobRepository(db)
        await job_repo.update_status(job_uuid, "running", progress=10)
        await db.commit()

        try:
            result = await generate_survey_report(query, max_papers)
            await job_repo.update_status(job_uuid, "done", progress=100, result=result)
            await db.commit()
        except Exception as e:
            await job_repo.update_status(job_uuid, "failed", error=str(e))
            await db.commit()
            raise


# ARQ worker settings
class WorkerSettings:
    functions = [process_paper_chunks, analyze_paper_task, generate_survey_task]
    on_startup = None
    on_shutdown = None
    max_jobs = 4
    job_timeout = 600  # 10 minutes
