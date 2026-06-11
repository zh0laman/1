"""
Тесты RAG-чата: построение промпта с контекстом и completion с источниками.
LLM API мокается.
"""
import pytest

from app.services import chat_service
from app.schemas.rag import ChatMessage


def _ctx(n=2):
    return [
        {
            "content": f"chunk content {i}",
            "filename": f"doc{i}.pdf",
            "page_number": i,
            "chunk_index": i,
            "similarity": 0.9 - i * 0.1,
        }
        for i in range(1, n + 1)
    ]


def test_build_prompt_includes_context_and_sources():
    system, messages = chat_service._build_prompt(
        history=[ChatMessage(role="user", content="prev"), ChatMessage(role="assistant", content="ans")],
        user_message="Какая столица?",
        context_chunks=_ctx(2),
        system_prompt="Кастомный промпт.",
    )
    assert "Кастомный промпт." in system
    assert "chunk content 1" in system
    assert "doc1.pdf" in system
    assert "КОНТЕКСТ ИЗ БАЗЫ ЗНАНИЙ" in system
    # история + новое сообщение
    assert messages[-1] == {"role": "user", "content": "Какая столица?"}
    assert len(messages) == 3


def test_build_prompt_no_context_uses_default_message():
    system, messages = chat_service._build_prompt(
        history=[],
        user_message="вопрос",
        context_chunks=[],
        system_prompt=None,
    )
    assert "Релевантные документы не найдены" in system
    # дефолтный системный промпт применён
    assert "ИИ-ассистент" in system


@pytest.mark.asyncio
async def test_chat_completion_returns_answer_and_sources(monkeypatch):
    class FakeResp:
        def raise_for_status(self):
            return None
        def json(self):
            return {"choices": [{"message": {"content": "Это ответ из контекста."}}]}

    class FakeClient:
        async def __aenter__(self):
            return self
        async def __aexit__(self, *a):
            return False
        async def post(self, url, json=None, headers=None):
            assert "/v1/chat/completions" in url
            # системное сообщение должно идти первым
            assert json["messages"][0]["role"] == "system"
            return FakeResp()

    monkeypatch.setattr(chat_service.httpx, "AsyncClient", lambda *a, **k: FakeClient())

    result = await chat_service.chat_completion(
        history=[],
        user_message="вопрос",
        context_chunks=_ctx(2),
    )
    assert result["answer"] == "Это ответ из контекста."
    assert result["context_used"] == 2
    assert len(result["sources"]) == 2
    assert result["sources"][0]["filename"] == "doc1.pdf"


@pytest.mark.asyncio
async def test_chat_stream_emits_sources_then_deltas(monkeypatch):
    class FakeStreamResp:
        def raise_for_status(self):
            return None
        async def aiter_lines(self):
            yield 'data: {"choices":[{"delta":{"content":"Прив"}}]}'
            yield 'data: {"choices":[{"delta":{"content":"ет"}}]}'
            yield "data: [DONE]"

    class FakeStreamCtx:
        async def __aenter__(self):
            return FakeStreamResp()
        async def __aexit__(self, *a):
            return False

    class FakeClient:
        async def __aenter__(self):
            return self
        async def __aexit__(self, *a):
            return False
        def stream(self, method, url, json=None, headers=None):
            return FakeStreamCtx()

    monkeypatch.setattr(chat_service.httpx, "AsyncClient", lambda *a, **k: FakeClient())

    events = []
    async for chunk in chat_service.chat_stream(
        history=[], user_message="hi", context_chunks=_ctx(1)
    ):
        events.append(chunk)

    joined = "".join(events)
    # первый event — источники
    assert '"type": "sources"' in events[0]
    assert '"type": "delta"' in joined
    # json.dumps экранирует не-ASCII → проверяем восстановленный текст
    import json as _json
    deltas = "".join(
        _json.loads(line[6:])["delta"]
        for line in joined.splitlines()
        if line.startswith("data: ") and '"delta"' in line
    )
    assert deltas == "Привет"
    assert "[DONE]" in joined
