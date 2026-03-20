"""
Provider factory: selects the correct LLM and embedding providers based on config.
"""
from app.config import settings
from app.services.llm.base import BaseLLMProvider, BaseEmbeddingProvider

_llm_provider: BaseLLMProvider | None = None
_embedding_provider: BaseEmbeddingProvider | None = None

def get_llm_provider() -> BaseLLMProvider:
    global _llm_provider
    if _llm_provider is not None:
        return _llm_provider

    provider = settings.llm_provider
    if provider == "anthropic":
        from app.services.llm.anthropic_provider import AnthropicLLMProvider
        _llm_provider = AnthropicLLMProvider(settings.anthropic_api_key, settings.anthropic_chat_model)
    elif provider == "openai_compatible":
        from app.services.llm.openai_provider import create_openai_compatible_providers
        llm, _ = create_openai_compatible_providers()
        _llm_provider = llm
    else:  # default: openai
        from app.services.llm.openai_provider import create_openai_providers
        llm, _ = create_openai_providers()
        _llm_provider = llm

    return _llm_provider


def get_embedding_provider() -> BaseEmbeddingProvider:
    """
    Anthropic has no embedding API — always use OpenAI-family for embeddings.
    When provider is openai_compatible, use the compatible embedding model.
    """
    global _embedding_provider
    if _embedding_provider is not None:
        return _embedding_provider

    provider = settings.llm_provider
    if provider == "openai_compatible":
        from app.services.llm.openai_provider import create_openai_compatible_providers
        _, emb = create_openai_compatible_providers()
        _embedding_provider = emb
    else:  # openai or anthropic both use openai embeddings
        from app.services.llm.openai_provider import create_openai_providers
        _, emb = create_openai_providers()
        _embedding_provider = emb

    return _embedding_provider


def invalidate_provider_cache() -> None:
    global _llm_provider, _embedding_provider
    _llm_provider = None
    _embedding_provider = None
