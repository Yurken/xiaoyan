from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

# Keys that are exposed via the API
EXPOSED_KEYS: list[str] = [
    "llm_provider",
    # OpenAI
    "openai_api_key",
    "openai_base_url",
    "openai_chat_model",
    "openai_embedding_model",
    # Anthropic
    "anthropic_api_key",
    "anthropic_chat_model",
    # OpenAI-Compatible (DashScope, DeepSeek, etc.)
    "openai_compatible_base_url",
    "openai_compatible_api_key",
    "openai_compatible_chat_model",
    "openai_compatible_embedding_model",
    # RAG
    "chunk_size",
    "chunk_overlap",
    "rag_top_k",
    # External APIs
    "semantic_scholar_api_key",
]

# Keys whose values are masked in GET responses
SENSITIVE_KEYS: set[str] = {
    "openai_api_key",
    "anthropic_api_key",
    "openai_compatible_api_key",
    "semantic_scholar_api_key",
}


class SettingsRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_all(self) -> dict[str, str]:
        result = await self.session.execute(
            text("SELECT key, value FROM app_settings")
        )
        return {row[0]: row[1] for row in result.fetchall()}

    async def upsert_many(self, data: dict[str, str]) -> None:
        for key, value in data.items():
            await self.session.execute(
                text(
                    "INSERT INTO app_settings (key, value, updated_at) "
                    "VALUES (:key, :value, NOW()) "
                    "ON CONFLICT (key) DO UPDATE SET value = :value, updated_at = NOW()"
                ),
                {"key": key, "value": value},
            )
        await self.session.commit()
