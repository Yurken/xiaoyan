"""
OpenAI and OpenAI-compatible API provider.
Supports any provider with an OpenAI-compatible REST API.
"""
from typing import AsyncIterator
from openai import AsyncOpenAI
from app.services.llm.base import BaseLLMProvider, BaseEmbeddingProvider, ChatMessage, ChatResponse
from app.config import settings


def _build_openai_client(base_url: str, api_key: str) -> AsyncOpenAI:
    return AsyncOpenAI(api_key=api_key, base_url=base_url)


class OpenAILLMProvider(BaseLLMProvider):
    def __init__(self, client: AsyncOpenAI, model: str):
        self._client = client
        self._model = model

    async def chat(
        self,
        messages: list[ChatMessage],
        temperature: float = 0.7,
        max_tokens: int = 4096,
        model: str | None = None,
    ) -> ChatResponse:
        response = await self._client.chat.completions.create(
            model=model or self._model,
            messages=[{"role": m.role, "content": m.content} for m in messages],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return ChatResponse(
            content=response.choices[0].message.content or "",
            model=response.model,
            usage=response.usage.model_dump() if response.usage else None,
        )

    async def stream_chat(
        self,
        messages: list[ChatMessage],
        temperature: float = 0.7,
        max_tokens: int = 4096,
        model: str | None = None,
    ) -> AsyncIterator[str]:
        stream = await self._client.chat.completions.create(
            model=model or self._model,
            messages=[{"role": m.role, "content": m.content} for m in messages],
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta


class OpenAIEmbeddingProvider(BaseEmbeddingProvider):
    # Dimension map for known models
    _DIMENSIONS = {
        "text-embedding-3-small": 1536,
        "text-embedding-3-large": 3072,
        "text-embedding-ada-002": 1536,
        "text-embedding-v1": 1536,
        "text-embedding-v2": 1536,
        "text-embedding-v3": 1024,
    }

    def __init__(self, client: AsyncOpenAI, model: str):
        self._client = client
        self._model = model
        self._dim = self._DIMENSIONS.get(model, 1536)

    async def embed(self, texts: list[str]) -> list[list[float]]:
        # OpenAI allows up to 2048 texts per request; batch naively here
        response = await self._client.embeddings.create(
            model=self._model,
            input=texts,
        )
        return [item.embedding for item in sorted(response.data, key=lambda x: x.index)]

    async def embed_one(self, text: str) -> list[float]:
        result = await self.embed([text])
        return result[0]

    @property
    def dimension(self) -> int:
        return self._dim


def create_openai_providers() -> tuple[OpenAILLMProvider, OpenAIEmbeddingProvider]:
    client = _build_openai_client(settings.openai_base_url, settings.openai_api_key)
    llm = OpenAILLMProvider(client, settings.openai_chat_model)
    emb = OpenAIEmbeddingProvider(client, settings.openai_embedding_model)
    return llm, emb


def create_openai_compatible_providers() -> tuple[OpenAILLMProvider, OpenAIEmbeddingProvider]:
    client = _build_openai_client(settings.openai_compatible_base_url, settings.openai_compatible_api_key)
    llm = OpenAILLMProvider(client, settings.openai_compatible_chat_model)
    emb = OpenAIEmbeddingProvider(client, settings.openai_compatible_embedding_model)
    return llm, emb
