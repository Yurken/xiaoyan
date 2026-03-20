"""
Settings API: read / write runtime configuration stored in the database.
DB values override .env at startup; PUT applies changes immediately in-memory.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db as get_session
from app.config import settings as _cfg
from app.repositories.settings_repo import (
    SettingsRepository,
    EXPOSED_KEYS,
    SENSITIVE_KEYS,
)
from app.services.llm.factory import invalidate_provider_cache

router = APIRouter(prefix="/api/settings", tags=["settings"])

MASK = "***"


def _env_default(key: str) -> str:
    """Return the current in-memory (env-loaded) value for a key."""
    val = getattr(_cfg, key, "")
    if isinstance(val, bool):
        return "true" if val else "false"
    return str(val) if val is not None else ""


def _mask(key: str, value: str) -> str:
    if key in SENSITIVE_KEYS:
        return MASK if value else ""
    return value


def _apply_to_runtime(data: dict[str, str]) -> None:
    """Best-effort: push saved values into the in-memory settings object."""
    for key, raw in data.items():
        if not hasattr(_cfg, key):
            continue
        current = getattr(_cfg, key)
        try:
            if isinstance(current, bool):
                setattr(_cfg, key, raw.lower() in ("true", "1", "yes"))
            elif isinstance(current, int):
                setattr(_cfg, key, int(raw))
            elif isinstance(current, float):
                setattr(_cfg, key, float(raw))
            else:
                setattr(_cfg, key, raw)
        except Exception:
            pass


@router.get("")
async def get_settings(session: AsyncSession = Depends(get_session)):
    """Return all exposed settings; sensitive values are masked."""
    repo = SettingsRepository(session)
    db = await repo.get_all()

    result: dict[str, str] = {}
    for key in EXPOSED_KEYS:
        value = db.get(key, _env_default(key))
        result[key] = _mask(key, value)
    return result


@router.put("")
async def update_settings(
    data: dict,
    session: AsyncSession = Depends(get_session),
):
    """
    Save settings to DB and apply immediately in-memory.
    Sensitive keys with value '***' are skipped (not overwritten).
    """
    repo = SettingsRepository(session)

    to_save: dict[str, str] = {}
    for key, raw_value in data.items():
        if key not in EXPOSED_KEYS:
            continue
        value = str(raw_value).strip()
        # Skip masked placeholder – user didn't change this field
        if key in SENSITIVE_KEYS and value == MASK:
            continue
        to_save[key] = value

    if to_save:
        await repo.upsert_many(to_save)
        _apply_to_runtime(to_save)
        invalidate_provider_cache()

    return {"ok": True, "updated": list(to_save.keys())}
