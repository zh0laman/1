"""
Тесты слоя векторизации (embeddings) и MinIO-хранилища.
Внешние сервисы (LLM API, MinIO) мокаются.
"""
import io
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.rag import embeddings as emb
from app.rag import storage


# ─── Embeddings ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_embeddings_calls_llm_and_parses(monkeypatch):
    fake_vectors = [[0.1] * emb.EMBEDDING_DIM, [0.2] * emb.EMBEDDING_DIM]

    class FakeResp:
        def raise_for_status(self):
            return None
        def json(self):
            return {"data": [{"embedding": v} for v in fake_vectors]}

    class FakeClient:
        async def __aenter__(self):
            return self
        async def __aexit__(self, *a):
            return False
        async def post(self, url, json=None, headers=None):
            assert "/v1/embeddings" in url
            assert json["input"] == ["a", "b"]
            return FakeResp()

    monkeypatch.setattr(emb.httpx, "AsyncClient", lambda *a, **k: FakeClient())

    result = await emb.get_embeddings(["a", "b"])
    assert len(result) == 2
    assert len(result[0]) == emb.EMBEDDING_DIM


@pytest.mark.asyncio
async def test_get_embeddings_empty_short_circuits():
    # пустой список не должен дергать сеть
    assert await emb.get_embeddings([]) == []


@pytest.mark.asyncio
async def test_get_embedding_single(monkeypatch):
    async def fake_batch(texts):
        return [[0.5] * emb.EMBEDDING_DIM for _ in texts]
    monkeypatch.setattr(emb, "get_embeddings", fake_batch)

    vec = await emb.get_embedding("query text")
    assert len(vec) == emb.EMBEDDING_DIM
    assert vec[0] == 0.5


# ─── Storage / MinIO ──────────────────────────────────────────────────────────

def test_build_storage_key_format():
    key = storage.build_storage_key("tenant1", "bot1", "Report Final.pdf")
    assert key.startswith("tenant1/bot1/")
    assert key.endswith("_Report Final.pdf")
    # включает короткий хэш
    middle = key.split("/")[-1]
    assert len(middle.split("_")[0]) == 8


def test_build_storage_key_strips_path():
    # path traversal в имени файла не должен ломать ключ
    key = storage.build_storage_key("t", "b", "/etc/passwd")
    assert key.startswith("t/b/")
    assert "passwd" in key
    assert "/etc/" not in key.replace("t/b/", "")


def test_upload_file_creates_bucket_and_puts():
    fake_client = MagicMock()
    fake_client.bucket_exists.return_value = False

    with patch.object(storage, "get_minio_client", return_value=fake_client):
        obj = storage.upload_file(b"hello", "t/b/file.txt", "text/plain", bucket="rag-documents")

    assert obj == "t/b/file.txt"
    fake_client.make_bucket.assert_called_once_with("rag-documents")
    fake_client.put_object.assert_called_once()
    _, kwargs = fake_client.put_object.call_args
    assert kwargs["length"] == 5
    assert kwargs["content_type"] == "text/plain"


def test_delete_file_calls_remove():
    fake_client = MagicMock()
    with patch.object(storage, "get_minio_client", return_value=fake_client):
        storage.delete_file("t/b/file.txt")
    fake_client.remove_object.assert_called_once()
