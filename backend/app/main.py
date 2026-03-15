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
from app.api import planner, survey, papers, knowledge, chat


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    os.makedirs(settings.upload_dir, exist_ok=True)
    await init_db()
    yield
    # Shutdown (nothing to clean up for now)


app = FastAPI(
    title="Research Copilot API",
    description="AI-powered research assistant for students and researchers",
    version="0.1.0",
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
app.include_router(planner.router)
app.include_router(survey.router)
app.include_router(papers.router)
app.include_router(knowledge.router)
app.include_router(chat.router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
