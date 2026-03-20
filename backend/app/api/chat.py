"""
Chat / Copilot API endpoints with RAG support.
Supports streaming SSE responses.
"""
import asyncio
import json
import uuid
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db, AsyncSessionLocal
from app.repositories.agent_repo import AgentRepository
from app.repositories.chat_repo import ChatRepository
from app.schemas.chat import ChatRequest, ChatSessionOut, ChatSessionListItem, AgentRunOut
from app.services.agentic_orchestrator import AgenticOrchestrator

router = APIRouter(prefix="/api/chat", tags=["chat"])


def _history_pairs(session) -> list[tuple[str, str]]:
    return [(message.role, message.content) for message in session.messages[-10:]]


def _encode_sse(event_type: str, value):
    payload_map = {
        "session_id": {"session_id": value},
        "request_id": {"request_id": value},
        "plan": {"plan": value},
        "agent_start": {"agent_start": value},
        "agent_complete": {"agent_complete": value},
        "agent_error": {"agent_error": value},
        "delta": {"delta": value},
        "sources": {"sources": value},
        "error": {"error": value},
        "done": {"done": True},
    }
    body = payload_map[event_type]
    return f"data: {json.dumps(body, ensure_ascii=False)}\n\n"


async def _ensure_session(repo: ChatRepository, req: ChatRequest):
    if req.session_id:
        session = await repo.get_session(req.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        return session

    session = await repo.create_session(
        title=req.message[:60],
        context_type=req.context_type,
        context_id=req.context_id,
    )
    await repo.db.flush()
    return await repo.get_session(session.id)


@router.get("/sessions", response_model=list[ChatSessionListItem])
async def list_sessions(db: AsyncSession = Depends(get_db)):
    repo = ChatRepository(db)
    return await repo.list_sessions()


@router.get("/sessions/{session_id}", response_model=ChatSessionOut)
async def get_session(session_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    repo = ChatRepository(db)
    session = await repo.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    repo = ChatRepository(db)
    await repo.delete_session(session_id)
    await db.commit()
    return {"success": True}


@router.get("/sessions/{session_id}/agent-runs", response_model=list[AgentRunOut])
async def list_agent_runs(
    session_id: uuid.UUID,
    request_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
):
    repo = AgentRepository(db)
    return await repo.list_runs(session_id, request_id=request_id)


@router.post("/send")
async def send_message(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    """
    Send a message and receive a full (non-streaming) response.
    Creates a new session if session_id is not provided.
    """
    repo = ChatRepository(db)
    session = await _ensure_session(repo, req)
    history = _history_pairs(session)

    # Save user message
    await repo.add_message(session.id, "user", req.message)
    await db.commit()

    try:
        orchestrator = AgenticOrchestrator(db)
        result = await orchestrator.run(
            session_id=session.id,
            message=req.message,
            context_type=req.context_type,
            context_id=req.context_id,
            history=history,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM error: {str(e)}")

    # Save assistant message
    await repo.add_message(session.id, "assistant", result.answer, sources=result.sources or None)
    await db.commit()

    return {
        "success": True,
        "session_id": str(session.id),
        "request_id": result.request_id,
        "message": result.answer,
        "sources": result.sources,
        "plan": result.plan,
        "agent_runs": result.runs,
    }


@router.post("/stream")
async def stream_message(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    """
    Send a message and receive a streaming SSE response.
    """
    repo = ChatRepository(db)
    session = await _ensure_session(repo, req)
    history = _history_pairs(session)

    await repo.add_message(session.id, "user", req.message)
    await db.commit()

    session_id = str(session.id)

    async def generate():
        queue: asyncio.Queue[dict] = asyncio.Queue()

        async def emit(event: dict):
            await queue.put(event)

        async def worker():
            async with AsyncSessionLocal() as stream_db:
                stream_repo = ChatRepository(stream_db)
                orchestrator = AgenticOrchestrator(stream_db)
                try:
                    result = await orchestrator.run(
                        session_id=uuid.UUID(session_id),
                        message=req.message,
                        context_type=req.context_type,
                        context_id=req.context_id,
                        history=history,
                        emit=emit,
                        stream_final=True,
                    )
                    await stream_repo.add_message(
                        uuid.UUID(session_id),
                        "assistant",
                        result.answer,
                        sources=result.sources or None,
                    )
                    await stream_db.commit()
                    await queue.put({"type": "sources", "value": result.sources})
                except Exception as exc:
                    await queue.put({"type": "error", "value": str(exc)})
                finally:
                    await queue.put({"type": "done", "value": True})

        task = asyncio.create_task(worker())
        yield _encode_sse("session_id", session_id)

        while True:
            event = await queue.get()
            if event["type"] == "done":
                yield _encode_sse("done", True)
                break
            yield _encode_sse(event["type"], event["value"])

        await task

    return StreamingResponse(generate(), media_type="text/event-stream")
