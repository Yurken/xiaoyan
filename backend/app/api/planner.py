"""
Research direction planning API endpoints.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.planner_service import generate_learning_path

router = APIRouter(prefix="/api/planner", tags=["planner"])


class PlannerRequest(BaseModel):
    topic: str
    keywords: list[str] = []


@router.post("/generate")
async def generate_plan(req: PlannerRequest):
    """Generate a learning path and research plan for a given topic."""
    if not req.topic.strip():
        raise HTTPException(status_code=400, detail="Topic cannot be empty")
    try:
        result = await generate_learning_path(req.topic, req.keywords)
        return {"success": True, "data": result, "topic": req.topic}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate plan: {str(e)}")
