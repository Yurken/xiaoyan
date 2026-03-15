"""
Paper upload, parsing, analysis, and reproduction guide API endpoints.
"""
import os
import uuid
import json
from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.config import settings
from app.repositories.paper_repo import PaperRepository
from app.repositories.knowledge_repo import KnowledgeNoteRepository
from app.services.pdf_parser import extract_text_from_pdf, chunk_text, extract_metadata_from_text
from app.services.embedding_service import embed_texts
from app.services.paper_analyzer import analyze_paper, generate_reproduction_guide
from app.schemas.paper import PaperOut, PaperListItem

router = APIRouter(prefix="/api/papers", tags=["papers"])


@router.get("", response_model=list[PaperListItem])
async def list_papers(offset: int = 0, limit: int = 20, db: AsyncSession = Depends(get_db)):
    repo = PaperRepository(db)
    return await repo.list(offset=offset, limit=limit)


@router.get("/{paper_id}", response_model=PaperOut)
async def get_paper(paper_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    repo = PaperRepository(db)
    paper = await repo.get(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    return paper


@router.post("/upload")
async def upload_paper(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Upload a PDF paper, extract text, and kick off async processing."""
    if not file.filename or not file.filename.endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    # Save file to disk
    upload_dir = Path(settings.upload_dir)
    upload_dir.mkdir(parents=True, exist_ok=True)
    file_id = str(uuid.uuid4())
    file_path = upload_dir / f"{file_id}.pdf"

    content = await file.read()
    if len(content) > settings.max_file_size_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File too large (max {settings.max_file_size_mb}MB)")

    with open(file_path, "wb") as f:
        f.write(content)

    # Extract text synchronously (fast enough for MVP)
    try:
        text = extract_text_from_pdf(str(file_path))
    except Exception as e:
        os.unlink(file_path)
        raise HTTPException(status_code=422, detail=f"Failed to extract PDF text: {str(e)}")

    metadata = extract_metadata_from_text(text)
    title = metadata.get("title") or file.filename.replace(".pdf", "")

    # Create paper record
    repo = PaperRepository(db)
    paper = await repo.create(
        title=title,
        file_path=str(file_path),
        full_text=text,
        status="parsed",
    )
    await db.commit()

    # Process in background: chunk + embed
    background_tasks.add_task(_process_paper_chunks, str(paper.id), text)

    return {"success": True, "paper_id": str(paper.id), "title": title, "status": "parsed"}


@router.post("/{paper_id}/analyze")
async def analyze(paper_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Run AI analysis on a paper (blocking, may take ~30s)."""
    repo = PaperRepository(db)
    paper = await repo.get(paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")
    if not paper.full_text:
        raise HTTPException(status_code=422, detail="Paper has no extracted text")

    try:
        raw = await analyze_paper(paper.full_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")

    # Map to model fields
    analysis_data = {
        "research_question": raw.get("research_question", ""),
        "core_method": raw.get("core_method", ""),
        "experiment_design": raw.get("experiment_design", ""),
        "innovations": json.dumps(raw.get("innovations", []), ensure_ascii=False),
        "limitations": json.dumps(raw.get("limitations", []), ensure_ascii=False),
        "key_conclusions": raw.get("key_conclusions", ""),
        "raw_analysis": raw,
    }
    analysis = await repo.upsert_analysis(paper_id, analysis_data)

    # Update title if extracted
    if raw.get("title") and paper.title.endswith(".pdf"):
        await repo.update(paper_id, title=raw["title"], status="analyzed")
    else:
        await repo.update(paper_id, status="analyzed")

    # Auto-save to knowledge base
    note_repo = KnowledgeNoteRepository(db)
    note_content = f"# {paper.title}\n\n**研究问题**\n{raw.get('research_question','')}\n\n**核心方法**\n{raw.get('core_method','')}\n\n**创新点**\n{raw.get('innovations','')}\n\n**主要结论**\n{raw.get('key_conclusions','')}"
    await note_repo.create(
        title=f"论文精读: {paper.title}",
        content=note_content,
        source_type="paper_analysis",
        source_id=str(paper_id),
    )
    await db.commit()

    return {"success": True, "analysis": analysis_data}


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


async def _process_paper_chunks(paper_id: str, text: str):
    """Background task: chunk text, compute embeddings, store in DB."""
    from app.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        try:
            chunks = chunk_text(text)
            texts = [c["content"] for c in chunks]
            embeddings = await embed_texts(texts)
            for chunk, emb in zip(chunks, embeddings):
                chunk["embedding"] = emb
            repo = PaperRepository(db)
            pid = uuid.UUID(paper_id)
            await repo.delete_chunks(pid)
            await repo.add_chunks(pid, chunks)
            await db.commit()
            print(f"[papers] Processed {len(chunks)} chunks for paper {paper_id}")
        except Exception as e:
            print(f"[papers] Chunk processing failed for {paper_id}: {e}")
