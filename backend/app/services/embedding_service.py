"""
Embedding service: wraps the embedding provider with batching and error handling.
"""
import asyncio
from tenacity import retry, stop_after_attempt, wait_exponential
from app.services.llm import get_embedding_provider


BATCH_SIZE = 100  # max texts per API call


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
async def embed_texts(texts: list[str]) -> list[list[float]]:
    """Embed a list of texts with automatic batching and retry."""
    provider = get_embedding_provider()
    all_embeddings = []
    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i:i + BATCH_SIZE]
        embeddings = await provider.embed(batch)
        all_embeddings.extend(embeddings)
    return all_embeddings


@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
async def embed_one(text: str) -> list[float]:
    """Embed a single text with retry."""
    provider = get_embedding_provider()
    return await provider.embed_one(text)


def get_embedding_dimension() -> int:
    return get_embedding_provider().dimension
