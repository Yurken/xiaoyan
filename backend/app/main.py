"""
FastAPI application entry point.
"""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.config import settings
from app.database import init_db
from app.api import planner, survey, papers, knowledge, chat, jobs, auth, settings as settings_api


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    os.makedirs(settings.upload_dir, exist_ok=True)
    await init_db()
    await _load_db_settings()
    yield
    # Shutdown (nothing to clean up for now)


async def _load_db_settings():
    """Load persisted settings from DB and apply to in-memory config."""
    try:
        from app.database import AsyncSessionLocal
        from app.repositories.settings_repo import SettingsRepository
        async with AsyncSessionLocal() as session:
            repo = SettingsRepository(session)
            db = await repo.get_all()
            from app.api.settings import _apply_to_runtime
            _apply_to_runtime(db)
    except Exception as e:
        print(f"[settings] Failed to load DB settings (non-fatal): {e}")


app = FastAPI(
    title="Research Copilot API",
    description="AI-powered research assistant for students and researchers",
    version="0.1.3",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount uploaded files as static
app.mount("/uploads", StaticFiles(directory=settings.upload_dir, check_dir=False), name="uploads")

# Routers
app.include_router(settings_api.router)
app.include_router(auth.router)
app.include_router(jobs.router)
app.include_router(planner.router)
app.include_router(survey.router)
app.include_router(papers.router)
app.include_router(knowledge.router)
app.include_router(chat.router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.3"}
