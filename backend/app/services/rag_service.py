"""
RAG (Retrieval-Augmented Generation) service.
Handles vector similarity search over paper chunks and knowledge notes.
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.services.embedding_service import embed_one
from app.config import settings


async def search_paper_chunks(
    db: AsyncSession,
    query: str,
    paper_id: str | None = None,
    top_k: int | None = None,
) -> list[dict]:
    """
    Vector search over paper chunks.
    If paper_id is given, restrict to that paper.
    """
    top_k = top_k or settings.rag_top_k
    query_embedding = await embed_one(query)
    embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

    if paper_id:
        sql = text("""
            SELECT id, paper_id, chunk_index, content,
                   embedding <=> :embedding AS distance
            FROM paper_chunks
            WHERE paper_id = :paper_id AND embedding IS NOT NULL
            ORDER BY distance
            LIMIT :top_k
        """)
        result = await db.execute(sql, {"embedding": embedding_str, "paper_id": str(paper_id), "top_k": top_k})
    else:
        sql = text("""
            SELECT pc.id, pc.paper_id, pc.chunk_index, pc.content,
                   pc.embedding <=> :embedding AS distance,
                   p.title AS paper_title
            FROM paper_chunks pc
            JOIN papers p ON pc.paper_id = p.id
            WHERE pc.embedding IS NOT NULL
            ORDER BY distance
            LIMIT :top_k
        """)
        result = await db.execute(sql, {"embedding": embedding_str, "top_k": top_k})

    rows = result.fetchall()
    return [
        {
            "id": str(r[0]),
            "paper_id": str(r[1]),
            "chunk_index": r[2],
            "content": r[3],
            "distance": float(r[4]),
            "source": r[5] if not paper_id else f"paper_chunk_{r[2]}",
        }
        for r in rows
    ]


async def search_knowledge_notes(
    db: AsyncSession,
    query: str,
    top_k: int | None = None,
) -> list[dict]:
    """Vector search over knowledge base notes."""
    top_k = top_k or settings.rag_top_k
    query_embedding = await embed_one(query)
    embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

    sql = text("""
        SELECT id, title, content, source_type, source_id,
               embedding <=> :embedding AS distance
        FROM knowledge_notes
        WHERE embedding IS NOT NULL
        ORDER BY distance
        LIMIT :top_k
    """)
    result = await db.execute(sql, {"embedding": embedding_str, "top_k": top_k})
    rows = result.fetchall()
    return [
        {
            "id": str(r[0]),
            "title": r[1],
            "content": r[2],
            "source_type": r[3],
            "source_id": r[4],
            "distance": float(r[5]),
            "source": r[1],
        }
        for r in rows
    ]


async def combined_search(
    db: AsyncSession,
    query: str,
    top_k: int | None = None,
) -> list[dict]:
    """Search both paper chunks and knowledge notes, merge and rank."""
    top_k = top_k or settings.rag_top_k
    paper_results = await search_paper_chunks(db, query, top_k=top_k)
    note_results = await search_knowledge_notes(db, query, top_k=top_k)
    combined = paper_results + note_results
    combined.sort(key=lambda x: x["distance"])
    return combined[:top_k]
