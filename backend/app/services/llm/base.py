"""
Abstract base classes for LLM and Embedding providers.
All providers must implement these interfaces.
"""
from abc import ABC, abstractmethod
from typing import AsyncIterator
from dataclasses import dataclass


@dataclass
class ChatMessage:
    role: str   # "system" | "user" | "assistant"
    content: str


@dataclass
class ChatResponse:
    content: str
    model: str
    usage: dict | None = None


class BaseLLMProvider(ABC):
    """Abstract chat/completion provider."""

    @abstractmethod
    async def chat(
        self,
        messages: list[ChatMessage],
        temperature: float = 0.7,
        max_tokens: int = 4096,
        model: str | None = None,
    ) -> ChatResponse:
        """Single-turn chat completion."""
        ...

    @abstractmethod
    async def stream_chat(
        self,
        messages: list[ChatMessage],
        temperature: float = 0.7,
        max_tokens: int = 4096,
        model: str | None = None,
    ) -> AsyncIterator[str]:
        """Streaming chat completion, yields text deltas."""
        ...


class BaseEmbeddingProvider(ABC):
    """Abstract embedding provider."""

    @abstractmethod
    async def embed(self, texts: list[str]) -> list[list[float]]:
        """Embed a batch of texts, returns list of float vectors."""
        ...

    @abstractmethod
    async def embed_one(self, text: str) -> list[float]:
        """Embed a single text."""
        ...

    @property
    @abstractmethod
    def dimension(self) -> int:
        """Vector dimension for this model."""
        ...
