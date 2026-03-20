"""
ARQ worker entry point.
Run with: python worker.py
"""
import asyncio
from arq import run_worker
from app.services.jobs.tasks import WorkerSettings
from app.services.jobs import _redis_settings


if __name__ == "__main__":
    run_worker(WorkerSettings, redis_settings=_redis_settings())
