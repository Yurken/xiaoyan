"""
Anthropic Claude provider.
Note: Anthropic does not offer an embedding API, so embedding falls back to OpenAI.
"""
from typing import AsyncIterator
import anthropic
from app.services.llm.base import BaseLLMProvider, ChatMessage, ChatResponse
from app.config import settings


class AnthropicLLMProvider(BaseLLMProvider):
    def __init__(self, api_key: str, model: str):
        self._client = anthropic.AsyncAnthropic(api_key=api_key)
        self._model = model

    def _build_messages(self, messages: list[ChatMessage]) -> tuple[str | None, list[dict]]:
        """Separate system prompt from conversation messages."""
        system_prompt = None
        conv = []
        for m in messages:
            if m.role == "system":
                system_prompt = m.content
            else:
                conv.append({"role": m.role, "content": m.content})
        return system_prompt, conv

    async def chat(
        self,
        messages: list[ChatMessage],
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> ChatResponse:
        system_prompt, conv = self._build_messages(messages)
        kwargs = dict(
            model=self._model,
            max_tokens=max_tokens,
            temperature=temperature,
            messages=conv,
        )
        if system_prompt:
            kwargs["system"] = system_prompt
        response = await self._client.messages.create(**kwargs)
        return ChatResponse(
            content=response.content[0].text,
            model=response.model,
            usage={"input_tokens": response.usage.input_tokens, "output_tokens": response.usage.output_tokens},
        )

    async def stream_chat(
        self,
        messages: list[ChatMessage],
        temperature: float = 0.7,
        max_tokens: int = 4096,
    ) -> AsyncIterator[str]:
        system_prompt, conv = self._build_messages(messages)
        kwargs = dict(
            model=self._model,
            max_tokens=max_tokens,
            temperature=temperature,
            messages=conv,
        )
        if system_prompt:
            kwargs["system"] = system_prompt
        async with self._client.messages.stream(**kwargs) as stream:
            async for text in stream.text_stream:
                yield text
