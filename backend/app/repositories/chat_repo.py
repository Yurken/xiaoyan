"""
Data access layer for chat sessions and messages.
"""
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from sqlalchemy.orm import selectinload
from app.models.chat import ChatSession, ChatMessage


class ChatRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_session(self, **kwargs) -> ChatSession:
        session = ChatSession(**kwargs)
        self.db.add(session)
        await self.db.flush()
        return session

    async def get_session(self, session_id: uuid.UUID) -> ChatSession | None:
        result = await self.db.execute(
            select(ChatSession)
            .options(selectinload(ChatSession.messages))
            .where(ChatSession.id == session_id)
        )
        return result.scalar_one_or_none()

    async def list_sessions(self, limit: int = 30) -> list[ChatSession]:
        result = await self.db.execute(
            select(ChatSession).order_by(ChatSession.updated_at.desc()).limit(limit)
        )
        return list(result.scalars().all())

    async def delete_session(self, session_id: uuid.UUID):
        await self.db.execute(delete(ChatSession).where(ChatSession.id == session_id))

    async def add_message(self, session_id: uuid.UUID, role: str, content: str, sources: list | None = None) -> ChatMessage:
        msg = ChatMessage(session_id=session_id, role=role, content=content, sources=sources)
        self.db.add(msg)
        # Update session timestamp
        await self.db.execute(
            update(ChatSession)
            .where(ChatSession.id == session_id)
            .values(updated_at=msg.created_at)
        )
        await self.db.flush()
        return msg

    async def update_session_title(self, session_id: uuid.UUID, title: str):
        await self.db.execute(
            update(ChatSession).where(ChatSession.id == session_id).values(title=title)
        )
