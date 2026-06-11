"""
Регрессионные тесты пайплайна rag_service: ingest + retrieve.

Проверяют корректную работу с async-соединением SQLAlchemy
(await db.connection() → get_raw_connection → driver_connection),
а также порядок этапов: parse → chunk → embed → INSERT (pgvector).

БД (asyncpg), MinIO и LLM мокаются.
"""
import uuid
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services import rag_service
from app.rag import embeddings as emb


class FakePgConn:
    """Имитация asyncpg connection — захватывает SQL и параметры."""
    def __init__(self, fetch_rows=None):
        self.executemany_calls = []
        self.fetch_calls = []
        self._fetch_rows = fetch_rows or []

    async def executemany(self, sql, params):
        self.executemany_calls.append((sql, list(params)))

    async def fetch(self, sql, *args):
        self.fetch_calls.append((sql, args))
        return self._fetch_rows


class FakeAsyncConnection:
    def __init__(self, pg_conn):
        self._pg = pg_conn

    async def get_raw_connection(self):
        return MagicMock(driver_connection=self._pg)


class FakeSession:
    """Имитация AsyncSession: connection() — корутина (как в SQLAlchemy 2.0)."""
    def __init__(self, pg_conn):
        self._pg = pg_conn
        self.committed = 0
        self.added = []

    async def connection(self):
        return FakeAsyncConnection(self._pg)

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        self.committed += 1

    async def refresh(self, obj):
        # эмулируем присвоение id после flush
        if getattr(obj, "id", None) is None:
            obj.id = uuid.uuid4()


@pytest.mark.asyncio
async def test_ingest_document_full_pipeline(monkeypatch):
    pg = FakePgConn()
    session = FakeSession(pg)

    # MinIO upload — мок
    monkeypatch.setattr(rag_service, "upload_file", lambda **k: "key")

    # embeddings — детерминированный мок
    async def fake_embeddings(texts):
        return [[0.01 * (i + 1)] * emb.EMBEDDING_DIM for i in range(len(texts))]
    monkeypatch.setattr(rag_service, "get_embeddings", fake_embeddings)

    tenant_id = uuid.uuid4()
    bot_id = uuid.uuid4()
    text = ("Алматы — крупнейший город Казахстана. " * 40).encode("utf-8")

    doc = await rag_service.ingest_document(
        db=session,
        tenant_id=tenant_id,
        bot_id=bot_id,
        file_bytes=text,
        filename="about.txt",
        mime_type="text/plain",
    )

    # документ помечен ready и есть чанки
    assert doc.status == "ready"
    assert doc.chunk_count > 0

    # INSERT в chunks был вызван c корректным числом строк
    assert len(pg.executemany_calls) == 1
    sql, rows = pg.executemany_calls[0]
    assert "INSERT INTO chunks" in sql
    assert "::vector" in sql
    assert len(rows) == doc.chunk_count
    # embedding-параметр сериализован в JSON-строку
    first_row = rows[0]
    embedding_param = first_row[5]
    assert isinstance(embedding_param, str)
    assert len(json.loads(embedding_param)) == emb.EMBEDDING_DIM


@pytest.mark.asyncio
async def test_retrieve_chunks_runs_vector_search(monkeypatch):
    fake_rows = [
        {"content": "Алматы", "chunk_index": 0, "page_number": 1,
         "metadata": "{}", "filename": "about.txt", "similarity": 0.91},
        {"content": "Казахстан", "chunk_index": 1, "page_number": 1,
         "metadata": "{}", "filename": "about.txt", "similarity": 0.82},
    ]
    pg = FakePgConn(fetch_rows=fake_rows)
    session = FakeSession(pg)

    async def fake_embedding(text):
        return [0.5] * emb.EMBEDDING_DIM
    monkeypatch.setattr(rag_service, "get_embedding", fake_embedding)

    bot_id = uuid.uuid4()
    results = await rag_service.retrieve_chunks(session, bot_id, "Что такое Алматы?", top_k=2)

    # запрос ушёл с cosine-оператором pgvector
    assert len(pg.fetch_calls) == 1
    sql, args = pg.fetch_calls[0]
    assert "<=>" in sql
    assert "ORDER BY" in sql
    # top_k передан
    assert args[-1] == 2

    # результаты отсортированы по similarity и нормализованы
    assert len(results) == 2
    assert results[0]["similarity"] == pytest.approx(0.91)
    assert results[0]["filename"] == "about.txt"


@pytest.mark.asyncio
async def test_ingest_marks_error_on_empty_document(monkeypatch):
    pg = FakePgConn()
    session = FakeSession(pg)
    monkeypatch.setattr(rag_service, "upload_file", lambda **k: "key")

    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc:
        await rag_service.ingest_document(
            db=session,
            tenant_id=uuid.uuid4(),
            bot_id=uuid.uuid4(),
            file_bytes=b"   ",  # пустой документ
            filename="empty.txt",
            mime_type="text/plain",
        )
    assert exc.value.status_code == 422
    # документ помечен error, INSERT не выполнялся
    assert session.added[0].status == "error"
    assert len(pg.executemany_calls) == 0
