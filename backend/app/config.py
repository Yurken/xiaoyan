"""
Application configuration loaded from environment variables.
"""
from pydantic_settings import BaseSettings
from typing import Literal


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://postgres:password@localhost:5432/research_copilot"

    # LLM Provider
    llm_provider: Literal["openai", "anthropic", "openai_compatible"] = "openai"

    # OpenAI
    openai_api_key: str = ""
    openai_chat_model: str = "gpt-4o-mini"
    openai_embedding_model: str = "text-embedding-3-small"
    openai_base_url: str = "https://api.openai.com/v1"

    # Anthropic
    anthropic_api_key: str = ""
    anthropic_chat_model: str = "claude-3-5-haiku-20241022"

    # OpenAI-Compatible
    openai_compatible_base_url: str = ""
    openai_compatible_api_key: str = ""
    openai_compatible_chat_model: str = "deepseek-chat"
    openai_compatible_embedding_model: str = "BAAI/bge-m3"

    # RAG
    chunk_size: int = 800
    chunk_overlap: int = 150
    rag_top_k: int = 5

    # File Upload
    upload_dir: str = "./uploads"
    max_file_size_mb: int = 50

    # CORS
    cors_origins: str = "http://localhost:3333"

    # Semantic Scholar
    semantic_scholar_api_key: str = ""

    # Auth (disabled by default for single-user mode)
    auth_enabled: bool = False
    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_access_expire_minutes: int = 60
    jwt_refresh_expire_days: int = 7

    # Redis (for ARQ job queue)
    redis_url: str = "redis://localhost:6379"

    # Storage backend: "local" or "s3"
    storage_backend: str = "local"
    s3_endpoint: str = "http://localhost:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket: str = "research-copilot"

    class Config:
        env_file = ".env"
        extra = "ignore"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


settings = Settings()
