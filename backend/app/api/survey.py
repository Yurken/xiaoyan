"""
Literature survey API endpoints.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.survey_service import generate_survey
from app.services.literature_search import search_papers

router = APIRouter(prefix="/api/survey", tags=["survey"])


class SurveyRequest(BaseModel):
    query: str
    max_papers: int = 20


@router.post("/generate")
async def create_survey(req: SurveyRequest):
    """Generate a structured literature survey for a research query."""
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    try:
        result = await generate_survey(req.query, req.max_papers)
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate survey: {str(e)}")


@router.get("/search")
async def search(query: str, limit: int = 20):
    """Search for papers by keyword (Semantic Scholar)."""
    if not query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
    papers = await search_papers(query, limit=limit)
    return {"success": True, "papers": papers, "total": len(papers)}
