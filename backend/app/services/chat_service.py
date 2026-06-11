"""
Chat Service — RAG retrieval + LLM completion.
Поддерживает стриминг (SSE) и обычный ответ.
Использует OpenAI-compatible API (LLM_BASE_URL).
"""
import json
import logging
from typing import AsyncGenerator, List, Optional

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from app.core.config import settings
from app.schemas.rag import ChatMessage, SourceItem

logger = logging.getLogger(__name__)

DEFAULT_SYSTEM = (
    "Ты — полезный ИИ-ассистент. Отвечай на вопросы пользователя ТОЛЬКО на основе "
    "предоставленного контекста из базы знаний. Если контекст не содержит нужной информации, "
    "честно скажи об этом. Не придумывай факты."
)


def _build_prompt(
    history: List[ChatMessage],
    user_message: str,
    context_chunks: List[dict],
    system_prompt: Optional[str],
) -> tuple[str, list]:
    """Формирует system prompt с контекстом и массив сообщений."""
    if context_chunks:
        context_parts = []
        for i, c in enumerate(context_chunks, 1):
            source = f"[Источник {i}: {c['filename']}"
            if c.get("page_number"):
                source += f", стр. {c['page_number']}"
            source += f" | сходство: {c.get('similarity', 0):.2f}]"
            context_parts.append(f"{source}\n{c['content']}")
        context_text = "\n\n---\n\n".join(context_parts)
    else:
        context_text = "(Релевантные документы не найдены в базе знаний)"

    system = f"""{system_prompt or DEFAULT_SYSTEM}

=== КОНТЕКСТ ИЗ БАЗЫ ЗНАНИЙ ===
{context_text}
=== КОНЕЦ КОНТЕКСТА ===

Отвечай на языке вопроса. Будь точным и лаконичным."""

    messages = [{"role": m.role, "content": m.content} for m in history]
    messages.append({"role": "user", "content": user_message})

    return system, messages


@retry(stop=stop_after_attempt(2), wait=wait_exponential(multiplier=1, min=1, max=5))
async def chat_completion(
    history: List[ChatMessage],
    user_message: str,
    context_chunks: List[dict],
    system_prompt: Optional[str] = None,
) -> dict:
    """Обычный (не стриминговый) ответ от LLM."""
    system, messages = _build_prompt(history, user_message, context_chunks, system_prompt)

    url = f"{settings.LLM_BASE_URL}/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.LLM_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.LLM_CHAT_MODEL,
        "messages": [{"role": "system", "content": system}] + messages,
        "max_tokens": 2048,
        "temperature": 0.7,
    }

    async with httpx.AsyncClient(timeout=90.0) as client:
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()

    answer = data["choices"][0]["message"]["content"]
    sources = [
        SourceItem(
            filename=c["filename"],
            page_number=c.get("page_number"),
            similarity=round(c.get("similarity", 0.0), 3),
        )
        for c in context_chunks
    ]

    return {
        "answer": answer,
        "context_used": len(context_chunks),
        "sources": [s.model_dump() for s in sources],
    }


async def chat_stream(
    history: List[ChatMessage],
    user_message: str,
    context_chunks: List[dict],
    system_prompt: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """Стриминговый ответ через Server-Sent Events."""
    system, messages = _build_prompt(history, user_message, context_chunks, system_prompt)

    # Сначала отдаём метаданные источников
    sources = [
        {"filename": c["filename"], "page_number": c.get("page_number"), "similarity": round(c.get("similarity", 0.0), 3)}
        for c in context_chunks
    ]
    yield f"data: {json.dumps({'type': 'sources', 'sources': sources, 'context_used': len(context_chunks)})}\n\n"

    url = f"{settings.LLM_BASE_URL}/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.LLM_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.LLM_CHAT_MODEL,
        "messages": [{"role": "system", "content": system}] + messages,
        "max_tokens": 2048,
        "temperature": 0.7,
        "stream": True,
    }

    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", url, json=payload, headers=headers) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    raw = line[6:].strip()
                    if raw == "[DONE]":
                        yield "data: [DONE]\n\n"
                        break
                    try:
                        chunk = json.loads(raw)
                        delta = chunk["choices"][0].get("delta", {})
                        if delta.get("content"):
                            yield f"data: {json.dumps({'type': 'delta', 'delta': delta['content']})}\n\n"
                    except (json.JSONDecodeError, KeyError, IndexError):
                        continue
    except Exception as e:
        logger.error("Stream error: %s", e)
        yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
        yield "data: [DONE]\n\n"
