"""
Paper upload, parsing, analysis, and reproduction guide API endpoints.
"""
import os
import uuid
import json
from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.config import settings
from app.repositories.paper_repo import PaperRepository
from app.repositories.knowledge_repo import KnowledgeNoteRepository
from app.repositories.job_repo import JobRepository
from app.services.pdf_parser import extract_text_from_pdf, chunk_text, extract_metadata_from_text
from app.services.embedding_service import embed_texts
from app.services.paper_analyzer import analyze_paper, generate_reproduction_guide
from app.schemas.paper import PaperOut, PaperListItem

router = APIRouter(prefix="/api/papers", tags=["papers"])


@router.get("", response_model=list[PaperListItem])
async def list_papers(offset: int = 0, limit: int = 20, db: AsyncSession = Depends(get_db)):
    repo = PaperRepository(db)
    return await repo.list_all(offset=offset, limit=limit)


@router.get("/{paper_id}", response_model=PaperOut)
async def get_paper(paper_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    repo = PaperRepository(db)
    paper = await repo.get(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    return paper


@router.post("/upload")
async def upload_paper(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Upload a PDF paper, extract text, and enqueue chunk+embed job."""
    if not file.filename or not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_id = str(uuid.uuid4())
    file_path = upload_dir / f"{file_id}.pdf"

    content = await file.read()
    if len(content) > settings.max_file_size_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File too large (max {settings.max_file_size_mb}MB)")

    with open(file_path, "wb") as f:
        f.write(content)

    try:
        text = extract_text_from_pdf(str(file_path))
    except Exception as e:
        os.unlink(file_path)
        raise HTTPException(status_code=422, detail=f"Failed to extract PDF text: {str(e)}")

    metadata = extract_metadata_from_text(text)
    title = metadata.get("title") or file.filename.replace(".pdf", "")

    paper_repo = PaperRepository(db)
    paper = await paper_repo.create(
        title=title,
        file_path=str(file_path),
        full_text=text,
        status="parsed",
    )

    job_repo = JobRepository(db)
    job = await job_repo.create(
        type="process_paper",
        payload={"paper_id": str(paper.id)},
        paper_id=paper.id,
    )
    await db.commit()

    # Try ARQ; fall back to in-process background if Redis unavailable
    try:
        from app.services.jobs import get_arq_pool
        pool = await get_arq_pool()
        await pool.enqueue_job("process_paper_chunks",
                               job_id=str(job.id), paper_id=str(paper.id))
    except Exception:
        import asyncio
        from app.services.jobs.tasks import process_paper_chunks
        asyncio.create_task(process_paper_chunks(None, str(job.id), str(paper.id)))

    return {
        "success": True,
        "paper_id": str(paper.id),
        "job_id": str(job.id),
        "title": title,
        "status": "processing",
    }


@router.post("/{paper_id}/analyze")
async def analyze(paper_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Enqueue AI analysis job for a paper."""
    repo = PaperRepository(db)
    paper = await repo.get(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    if not paper.full_text:
        raise HTTPException(status_code=422, detail="Paper has no extracted text")

    job_repo = JobRepository(db)
    job = await job_repo.create(
        type="analyze_paper",
        payload={"paper_id": str(paper_id)},
        paper_id=paper_id,
    )
    await db.commit()

    try:
        from app.services.jobs import get_arq_pool
        pool = await get_arq_pool()
        await pool.enqueue_job("analyze_paper_task",
                               job_id=str(job.id), paper_id=str(paper_id))
    except Exception:
        import asyncio
        from app.services.jobs.tasks import analyze_paper_task
        asyncio.create_task(analyze_paper_task(None, str(job.id), str(paper_id)))

    return {"success": True, "job_id": str(job.id), "status": "processing"}


@router.post("/{paper_id}/reproduce")
async def reproduce(paper_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Generate reproduction guide for a paper."""
    repo = PaperRepository(db)
    paper = await repo.get(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    if not paper.full_text:
        raise HTTPException(status_code=422, detail="Paper has no extracted text")

    analysis_dict = None
    if paper.analysis and paper.analysis.raw_analysis:
        analysis_dict = paper.analysis.raw_analysis

    try:
        raw = await generate_reproduction_guide(paper.full_text, analysis_dict)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Guide generation failed: {str(e)}")

    import json

    def safe_json(val):
        if isinstance(val, (dict, list)):
            return json.dumps(val, ensure_ascii=False)
        return str(val) if val else ""

    guide_data = {
        "environment_setup": safe_json(raw.get("environment_setup", {})),
        "dependencies": safe_json(raw.get("dependencies", {})),
        "dataset_preparation": safe_json(raw.get("dataset_preparation", {})),
        "training_process": safe_json(raw.get("training_process", {})),
        "inference_process": safe_json(raw.get("inference_process", {})),
        "evaluation_metrics": safe_json(raw.get("evaluation_metrics", [])),
        "risks_and_notes": safe_json(raw.get("risks_and_notes", [])),
        "raw_guide": raw,
    }
    await repo.upsert_reproduction_guide(paper_id, guide_data)

    # Save to knowledge base
    note_repo = KnowledgeNoteRepository(db)
    repro_content = f"# 复现指导: {paper.title}\n\n**环境配置**\n{guide_data['environment_setup']}\n\n**依赖安装**\n{guide_data['dependencies']}\n\n**训练流程**\n{guide_data['training_process']}"
    await note_repo.create(
        title=f"复现指导: {paper.title}",
        content=repro_content,
        source_type="reproduction",
        source_id=str(paper_id),
    )
    await db.commit()

    return {"success": True, "guide": guide_data}


@router.delete("/{paper_id}")
async def delete_paper(paper_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    repo = PaperRepository(db)
    paper = await repo.get(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    # Remove file
    if paper.file_path and os.path.exists(paper.file_path):
        os.unlink(paper.file_path)
    await repo.delete(paper_id)
    await db.commit()
    return {"success": True}


