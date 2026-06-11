"""
Embedding service — вызывает LLM API (BAAI/bge-m3) для получения векторных представлений.
Использует LLM_BASE_URL и LLM_API_KEY из основного config.
"""
import json
import logging
from typing import List

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from app.core.config import settings

logger = logging.getLogger(__name__)

EMBEDDING_DIM = 1024  # BAAI/bge-m3 output dimension


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry=retry_if_exception_type(httpx.HTTPError),
)
async def get_embeddings(texts: List[str]) -> List[List[float]]:
    """
    Получает эмбеддинги от LLM API (OpenAI-compatible /v1/embeddings).
    Возвращает список float-векторов, по одному на каждый текст.
    """
    if not texts:
        return []

    url = f"{settings.LLM_BASE_URL}/v1/embeddings"
    headers = {
        "Authorization": f"Bearer {settings.LLM_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.LLM_EMBEDDING_MODEL,
        "input": texts,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()

    embeddings = [item["embedding"] for item in data["data"]]
    logger.info("Got %d embeddings (dim=%d)", len(embeddings), len(embeddings[0]) if embeddings else 0)
    return embeddings


async def get_embedding(text: str) -> List[float]:
    """Получает одиночный эмбеддинг для поискового запроса."""
    results = await get_embeddings([text])
    return results[0] if results else [0.0] * EMBEDDING_DIM
