"""
Literature search service using Semantic Scholar public API.
Falls back gracefully if the API is unavailable.
"""
import httpx
from app.config import settings

SEMANTIC_SCHOLAR_BASE = "https://api.semanticscholar.org/graph/v1"
FIELDS = "title,authors,year,abstract,venue,externalIds,citationCount,openAccessPdf"


async def search_papers(query: str, limit: int = 20) -> list[dict]:
    """
    Search Semantic Scholar for papers matching query.
    Returns a list of paper metadata dicts.
    """
    headers = {}
    if settings.semantic_scholar_api_key:
        headers["x-api-key"] = settings.semantic_scholar_api_key

    params = {"query": query, "limit": limit, "fields": FIELDS}

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(
                f"{SEMANTIC_SCHOLAR_BASE}/paper/search",
                params=params,
                headers=headers,
            )
            resp.raise_for_status()
            data = resp.json()
            papers = data.get("data", [])
            return [_normalize_paper(p) for p in papers]
    except Exception as e:
        # Return empty list on failure rather than crashing
        print(f"[literature_search] Semantic Scholar API error: {e}")
        return []


async def get_paper_details(paper_id: str) -> dict | None:
    """Fetch detailed info for a specific Semantic Scholar paper ID."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{SEMANTIC_SCHOLAR_BASE}/paper/{paper_id}",
                params={"fields": FIELDS + ",references,citations"},
            )
            resp.raise_for_status()
            return _normalize_paper(resp.json())
    except Exception:
        return None


def _normalize_paper(p: dict) -> dict:
    """Normalize Semantic Scholar paper to our internal format."""
    authors = ", ".join([a.get("name", "") for a in p.get("authors", [])[:5]])
    doi = p.get("externalIds", {}).get("DOI", "")
    pdf_url = (p.get("openAccessPdf") or {}).get("url", "")
    return {
        "title": p.get("title", ""),
        "authors": authors,
        "year": p.get("year"),
        "abstract": p.get("abstract", ""),
        "venue": p.get("venue", ""),
        "doi": doi,
        "citation_count": p.get("citationCount", 0),
        "pdf_url": pdf_url,
        "semantic_scholar_id": p.get("paperId", ""),
    }
