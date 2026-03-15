"""
Knowledge base API endpoints: research interests and notes.
"""
import uuid
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.repositories.knowledge_repo import ResearchInterestRepository, KnowledgeNoteRepository
from app.services.planner_service import generate_learning_path
from app.services.embedding_service import embed_one
from app.services.rag_service import search_knowledge_notes
from app.schemas.knowledge import (
    ResearchInterestCreate, ResearchInterestOut,
    KnowledgeNoteCreate, KnowledgeNoteUpdate, KnowledgeNoteOut,
)

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])


# ── Research Interests ──────────────────────────────────────────

@router.get("/interests", response_model=list[ResearchInterestOut])
async def list_interests(db: AsyncSession = Depends(get_db)):
    repo = ResearchInterestRepository(db)
    return await repo.list()


@router.post("/interests", response_model=ResearchInterestOut)
async def create_interest(req: ResearchInterestCreate, db: AsyncSession = Depends(get_db)):
    repo = ResearchInterestRepository(db)
    interest = await repo.create(topic=req.topic, keywords=req.keywords)
    await db.commit()
    return interest


@router.post("/interests/{interest_id}/plan")
async def generate_plan_for_interest(interest_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    """Generate and save a learning path for an existing research interest."""
    repo = ResearchInterestRepository(db)
    interest = await repo.get(interest_id)
    if not interest:
        raise HTTPException(status_code=404, detail="Research interest not found")
    plan = await generate_learning_path(interest.topic, interest.keywords or [])
    await repo.update(interest_id, learning_path=plan)
    # Save to knowledge notes
    note_repo = KnowledgeNoteRepository(db)
    note_content = f"# 学习路径: {interest.topic}\n\n**概述**\n{plan.get('overview','')}\n\n**学习阶段**\n{str(plan.get('learning_stages',''))}\n\n**经典论文**\n{str(plan.get('classic_papers',''))}"
    await note_repo.create(
        title=f"学习路径: {interest.topic}",
        content=note_content,
        research_interest_id=interest_id,
        source_type="planner",
        source_id=str(interest_id),
    )
    await db.commit()
    return {"success": True, "plan": plan}


# ── Knowledge Notes ─────────────────────────────────────────────

@router.get("/notes", response_model=list[KnowledgeNoteOut])
async def list_notes(search: str | None = None, db: AsyncSession = Depends(get_db)):
    repo = KnowledgeNoteRepository(db)
    return await repo.list(search=search)


@router.post("/notes", response_model=KnowledgeNoteOut)
async def create_note(req: KnowledgeNoteCreate, db: AsyncSession = Depends(get_db)):
    repo = KnowledgeNoteRepository(db)
    # Compute embedding
    try:
        embedding = await embed_one(req.content[:2000])
    except Exception:
        embedding = None
    note = await repo.create(
        title=req.title,
        content=req.content,
        research_interest_id=req.research_interest_id,
        tags=req.tags,
        source_type=req.source_type,
        source_id=req.source_id,
        embedding=embedding,
    )
    await db.commit()
    return note


@router.get("/notes/{note_id}", response_model=KnowledgeNoteOut)
async def get_note(note_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    repo = KnowledgeNoteRepository(db)
    note = await repo.get(note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note


@router.put("/notes/{note_id}", response_model=KnowledgeNoteOut)
async def update_note(note_id: uuid.UUID, req: KnowledgeNoteUpdate, db: AsyncSession = Depends(get_db)):
    repo = KnowledgeNoteRepository(db)
    update_data = req.model_dump(exclude_none=True)
    if "content" in update_data:
        try:
            update_data["embedding"] = await embed_one(update_data["content"][:2000])
        except Exception:
            pass
    note = await repo.update(note_id, **update_data)
    await db.commit()
    return note


@router.delete("/notes/{note_id}")
async def delete_note(note_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    repo = KnowledgeNoteRepository(db)
    await repo.delete(note_id)
    await db.commit()
    return {"success": True}


@router.get("/search")
async def vector_search(q: str, top_k: int = 5, db: AsyncSession = Depends(get_db)):
    """Semantic search over knowledge base using embeddings."""
    if not q.strip():
        raise HTTPException(status_code=400, detail="Query required")
    results = await search_knowledge_notes(db, q, top_k=top_k)
    return {"success": True, "results": results}
