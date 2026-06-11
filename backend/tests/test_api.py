"""
API-тесты: публичный чат (X-API-Key) и multi-tenant админка.
БД и LLM мокаются через dependency_overrides и monkeypatch.
"""
import uuid
import pytest
from fastapi.testclient import TestClient

from types import SimpleNamespace

from app.main import app
from app.core.database import get_db
from app.api import deps
from app.api.chat import router as chat_router_mod
from app.models.user import UserRole
from app.services import rag_service, chat_service, bot_service


# ─── Фейковые объекты ─────────────────────────────────────────────────────────
# Лёгкие stand-in вместо ORM-моделей: роутеры обращаются только к атрибутам,
# поэтому SimpleNamespace полностью покрывает контракт без обращения к БД.

TENANT_A = uuid.uuid4()
TENANT_B = uuid.uuid4()
BOT_ID = uuid.uuid4()


def _make_bot(tenant_id=TENANT_A, bot_id=BOT_ID, api_key="rag_validkey", active=True):
    return SimpleNamespace(
        id=bot_id,
        tenant_id=tenant_id,
        api_key=api_key,
        is_active=active,
        system_prompt="Ты бот компании А.",
        name="Bot A",
    )


async def _fake_get_db():
    yield None  # реальный сеанс не нужен — сервисы замоканы


@pytest.fixture(autouse=True)
def _clear_overrides():
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    return TestClient(app)


# ─── Публичный чат-API ─────────────────────────────────────────────────────────

def test_chat_rejects_invalid_api_key(client, monkeypatch):
    # _get_bot_by_api_key не находит бота → 401
    from fastapi import HTTPException

    def fake_dep():
        raise HTTPException(status_code=401, detail="Неверный или неактивный API ключ бота")

    app.dependency_overrides[get_db] = _fake_get_db
    app.dependency_overrides[chat_router_mod._get_bot_by_api_key] = fake_dep

    resp = client.post(f"/chat/{BOT_ID}", json={"message": "привет"}, headers={"X-API-Key": "bad"})
    assert resp.status_code == 401


def test_chat_rejects_bot_id_mismatch(client):
    other_bot = _make_bot(bot_id=uuid.uuid4())  # ключ принадлежит другому боту
    app.dependency_overrides[get_db] = _fake_get_db
    app.dependency_overrides[chat_router_mod._get_bot_by_api_key] = lambda: other_bot

    resp = client.post(f"/chat/{BOT_ID}", json={"message": "привет"}, headers={"X-API-Key": "rag_validkey"})
    assert resp.status_code == 403


def test_chat_success_returns_answer_and_sources(client, monkeypatch):
    bot = _make_bot()
    app.dependency_overrides[get_db] = _fake_get_db
    app.dependency_overrides[chat_router_mod._get_bot_by_api_key] = lambda: bot

    async def fake_retrieve(db, bot_id, message, top_k):
        assert str(bot_id) == str(BOT_ID)
        return [{"content": "ctx", "filename": "f.pdf", "page_number": 1, "chunk_index": 0, "similarity": 0.88}]

    async def fake_completion(history, user_message, context_chunks, system_prompt=None):
        assert system_prompt == "Ты бот компании А."
        return {"answer": "ответ", "context_used": len(context_chunks),
                "sources": [{"filename": "f.pdf", "page_number": 1, "similarity": 0.88}]}

    monkeypatch.setattr(rag_service, "retrieve_chunks", fake_retrieve)
    monkeypatch.setattr(chat_service, "chat_completion", fake_completion)

    resp = client.post(f"/chat/{BOT_ID}", json={"message": "вопрос", "top_k": 3},
                       headers={"X-API-Key": "rag_validkey"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["answer"] == "ответ"
    assert body["context_used"] == 1
    assert body["sources"][0]["filename"] == "f.pdf"


def test_chat_validates_empty_message(client):
    bot = _make_bot()
    app.dependency_overrides[get_db] = _fake_get_db
    app.dependency_overrides[chat_router_mod._get_bot_by_api_key] = lambda: bot
    resp = client.post(f"/chat/{BOT_ID}", json={"message": ""}, headers={"X-API-Key": "rag_validkey"})
    assert resp.status_code == 422  # min_length=1


# ─── Multi-tenant админка ─────────────────────────────────────────────────────

def _make_user(tenant_id, role=UserRole.ADMIN):
    return SimpleNamespace(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        role=role,
        is_active=True,
        email="a@b.c",
    )


def test_list_bots_scoped_to_tenant(client, monkeypatch):
    user_a = _make_user(TENANT_A)
    app.dependency_overrides[get_db] = _fake_get_db
    app.dependency_overrides[deps.get_current_user] = lambda: user_a

    captured = {}

    async def fake_list(db, tenant_id):
        captured["tenant_id"] = tenant_id
        return []

    monkeypatch.setattr(bot_service, "list_bots", fake_list)

    resp = client.get("/admin/bots")
    assert resp.status_code == 200
    # сервис вызван строго с tenant текущего пользователя
    assert captured["tenant_id"] == TENANT_A


def test_create_bot_requires_token(client):
    # без переопределения get_current_user → 401 (нет токена)
    app.dependency_overrides[get_db] = _fake_get_db
    resp = client.post("/admin/bots", json={"name": "X"})
    assert resp.status_code == 401


def test_health_endpoint(client):
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
