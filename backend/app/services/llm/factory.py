"""
Provider factory: selects the correct LLM and embedding providers based on config.
"""
from functools import lru_cache
from app.config import settings
from app.services.llm.base import BaseLLMProvider, BaseEmbeddingProvider


@lru_cache(maxsize=1)
def get_llm_provider() -> BaseLLMProvider:
    provider = settings.llm_provider
    if provider == "anthropic":
        from app.services.llm.anthropic_provider import AnthropicLLMProvider
        return AnthropicLLMProvider(settings.anthropic_api_key, settings.anthropic_chat_model)
    elif provider == "openai_compatible":
        from app.services.llm.openai_provider import create_openai_compatible_providers
        llm, _ = create_openai_compatible_providers()
        return llm
    else:  # default: openai
        from app.services.llm.openai_provider import create_openai_providers
        llm, _ = create_openai_providers()
        return llm


@lru_cache(maxsize=1)
def get_embedding_provider() -> BaseEmbeddingProvider:
    """
    Anthropic has no embedding API — always use OpenAI-family for embeddings.
    When provider is openai_compatible, use the compatible embedding model.
    """
    provider = settings.llm_provider
    if provider == "openai_compatible":
        from app.services.llm.openai_provider import create_openai_compatible_providers
        _, emb = create_openai_compatible_providers()
        return emb
    else:  # openai or anthropic both use openai embeddings
        from app.services.llm.openai_provider import create_openai_providers
        _, emb = create_openai_providers()
        return emb
