"""
Общий конфиг для тестов RAG-системы.

Эти тесты запускаются БЕЗ Docker/PostgreSQL/MinIO/реального LLM.
Все внешние зависимости (БД, объектное хранилище, LLM API) мокаются,
чтобы проверить логику пайплайна векторизации и API-контракты.
"""
import os
import sys
from pathlib import Path

# Backend root в sys.path
BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

# Обязательные env-переменные ДО импорта app.core.config
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test")
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest-only")
os.environ.setdefault("LLM_API_KEY", "test-llm-key")
os.environ.setdefault("LLM_BASE_URL", "https://llm.example.test")
os.environ.setdefault("MINIO_ENDPOINT", "localhost:9000")

import pytest


@pytest.fixture
def anyio_backend():
    return "asyncio"
