from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    # ─── Auth ───────────────────────────────────────────────────────────────
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

    # ─── LLM (Chat + Embeddings) ─────────────────────────────────────────────
    LLM_BASE_URL: str = "https://llm.nitec.kz"
    LLM_API_KEY: str
    LLM_CHAT_MODEL: str = "alemgpt-intent"
    LLM_EMBEDDING_MODEL: str = "BAAI/bge-m3"

    # ─── MinIO ───────────────────────────────────────────────────────────────
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin123"
    MINIO_SECURE: bool = False

    # ─── RAG Pipeline ────────────────────────────────────────────────────────
    CHUNK_SIZE: int = 512
    CHUNK_OVERLAP: int = 64
    EMBEDDING_DIM: int = 1024
    RAG_TOP_K: int = 5


settings = Settings()
