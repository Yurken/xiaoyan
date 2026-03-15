"""
Chat / Copilot API endpoints with RAG support.
Supports streaming SSE responses.
"""
import uuid
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db, AsyncSessionLocal
from app.repositories.chat_repo import ChatRepository
from app.services.llm import get_llm_provider
from app.services.llm.base import ChatMessage as LLMMessage
from app.services.rag_service import combined_search, search_paper_chunks
from app.prompts.qa import SYSTEM, build_qa_prompt, build_paper_qa_prompt
from app.schemas.chat import ChatRequest, ChatSessionOut, ChatSessionListItem

router = APIRouter(prefix="/api/chat", tags=["chat"])


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


@router.post("/send")
async def send_message(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    """
    Send a message and receive a full (non-streaming) response.
    Creates a new session if session_id is not provided.
    """
    repo = ChatRepository(db)

    # Ensure session exists
    if req.session_id:
        session = await repo.get_session(req.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
    else:
        session = await repo.create_session(
            title=req.message[:60],
            context_type=req.context_type,
            context_id=req.context_id,
        )
        await db.commit()
        # Reload to get ID
        session = await repo.get_session(session.id)

    # Save user message
    await repo.add_message(session.id, "user", req.message)

    # RAG retrieval
    context_chunks = []
    try:
        if req.context_type == "paper" and req.context_id:
            context_chunks = await search_paper_chunks(db, req.message, paper_id=req.context_id)
        else:
            context_chunks = await combined_search(db, req.message)
    except Exception as e:
        print(f"[chat] RAG retrieval failed: {e}")

    # Build prompt
    history = session.messages[:-1]  # exclude the just-added user message
    llm_messages = [LLMMessage(role="system", content=SYSTEM)]
    for msg in history[-10:]:  # keep last 10 turns for context
        llm_messages.append(LLMMessage(role=msg.role, content=msg.content))

    if req.context_type == "paper" and req.context_id:
        from app.repositories.paper_repo import PaperRepository
        paper_repo = PaperRepository(db)
        try:
            paper_id = uuid.UUID(req.context_id)
            paper = await paper_repo.get(paper_id)
            paper_title = paper.title if paper else "Unknown Paper"
        except Exception:
            paper_title = "Unknown Paper"
        user_prompt = build_paper_qa_prompt(req.message, context_chunks, paper_title)
    else:
        user_prompt = build_qa_prompt(req.message, context_chunks)

    llm_messages.append(LLMMessage(role="user", content=user_prompt))

    # LLM call
    llm = get_llm_provider()
    try:
        response = await llm.chat(llm_messages, temperature=0.6, max_tokens=3000)
        answer = response.content
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM error: {str(e)}")

    # Save assistant message
    sources = [{"content": c["content"][:200], "source": c.get("source", "")} for c in context_chunks[:3]]
    await repo.add_message(session.id, "assistant", answer, sources=sources or None)
    await db.commit()

    return {
        "success": True,
        "session_id": str(session.id),
        "message": answer,
        "sources": sources,
    }


@router.post("/stream")
async def stream_message(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    """
    Send a message and receive a streaming SSE response.
    """
    repo = ChatRepository(db)

    if req.session_id:
        session = await repo.get_session(req.session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
    else:
        session = await repo.create_session(
            title=req.message[:60],
            context_type=req.context_type,
            context_id=req.context_id,
        )
        await db.commit()
        session = await repo.get_session(session.id)

    await repo.add_message(session.id, "user", req.message)
    await db.commit()

    # RAG
    context_chunks = []
    try:
        if req.context_type == "paper" and req.context_id:
            context_chunks = await search_paper_chunks(db, req.message, paper_id=req.context_id)
        else:
            context_chunks = await combined_search(db, req.message)
    except Exception:
        pass

    history = session.messages[:-1]
    llm_messages = [LLMMessage(role="system", content=SYSTEM)]
    for msg in history[-10:]:
        llm_messages.append(LLMMessage(role=msg.role, content=msg.content))

    user_prompt = build_qa_prompt(req.message, context_chunks)
    llm_messages.append(LLMMessage(role="user", content=user_prompt))

    session_id = str(session.id)
    sources = [{"content": c["content"][:200], "source": c.get("source", "")} for c in context_chunks[:3]]

    async def generate():
        llm = get_llm_provider()
        full_response = ""
        yield f"data: {{\"session_id\": \"{session_id}\"}}\n\n"
        try:
            async for delta in llm.stream_chat(llm_messages, temperature=0.6, max_tokens=3000):
                full_response += delta
                # Escape for SSE
                escaped = delta.replace("\n", "\\n").replace('"', '\\"')
                yield f'data: {{"delta": "{escaped}"}}\n\n'
        except Exception as e:
            yield f'data: {{"error": "{str(e)}"}}\n\n'
            return

        # Save to DB
        async with AsyncSessionLocal() as save_db:
            save_repo = ChatRepository(save_db)
            await save_repo.add_message(
                uuid.UUID(session_id), "assistant", full_response, sources=sources or None
            )
            await save_db.commit()

        yield 'data: {"done": true}\n\n'

    return StreamingResponse(generate(), media_type="text/event-stream")
