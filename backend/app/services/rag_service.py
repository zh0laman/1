"""
RAG Service — пайплайн векторизации и семантического поиска.

Пайплайн загрузки:
  upload file → MinIO → parse → chunk → embed (batch) → pgvector

Пайплайн запроса:
  query → embed → cosine search (pgvector <=> operator) → top-k chunks
"""
import io
import json
import logging
import uuid
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.rag import Document, Chunk
from app.rag.parsers import parse_document
from app.rag.chunker import chunk_document
from app.rag.embeddings import get_embeddings, get_embedding
from app.rag.storage import (
    get_minio_client, ensure_bucket, upload_file, delete_file,
    build_storage_key, BUCKET_DOCUMENTS
)
from app.core.config import settings

logger = logging.getLogger(__name__)


# ─── Ingestion Pipeline ───────────────────────────────────────────────────────

async def ingest_document(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    bot_id: uuid.UUID,
    file_bytes: bytes,
    filename: str,
    mime_type: Optional[str] = None,
) -> Document:
    """
    Полный пайплайн векторизации:
      1. Загрузить сырой файл в MinIO
      2. Распарсить документ (PDF/DOCX/XLSX/PPTX/HTML/TXT/MD)
      3. Разбить на чанки с перекрытием
      4. Получить эмбеддинги батчами
      5. Сохранить Document + Chunks в PostgreSQL (pgvector)
    """
    minio_key = build_storage_key(str(tenant_id), str(bot_id), filename)

    # 1. Сохранить в MinIO
    try:
        upload_file(
            data=file_bytes,
            object_name=minio_key,
            content_type=mime_type or "application/octet-stream",
            bucket=BUCKET_DOCUMENTS,
        )
    except Exception as e:
        logger.error("MinIO upload failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Ошибка сохранения файла в хранилище: {e}",
        )

    # Создаём запись документа (статус processing)
    doc = Document(
        bot_id=bot_id,
        tenant_id=tenant_id,
        filename=filename,
        minio_key=minio_key,
        mime_type=mime_type,
        file_size=len(file_bytes),
        status="processing",
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    try:
        # 2. Парсим документ
        parsed = parse_document(file_bytes, filename, mime_type)
        if not parsed.pages:
            raise ValueError("Не удалось извлечь текст из документа")

        # 3. Разбиваем на чанки
        chunks = chunk_document(
            parsed,
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
        )
        if not chunks:
            raise ValueError("Документ не содержит текстовых фрагментов")

        # 4. Получаем эмбеддинги батчами
        batch_size = 32
        all_embeddings = []
        texts = [c.content for c in chunks]
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            batch_embs = await get_embeddings(batch)
            all_embeddings.extend(batch_embs)

        # 5. Вставляем чанки через raw SQL (pgvector <-> vector type)
        async with db.connection() as conn:
            raw = await conn.get_raw_connection()
            pg_conn = raw.driver_connection

            await pg_conn.executemany(
                """
                INSERT INTO chunks
                  (id, document_id, bot_id, tenant_id, content, embedding, chunk_index, page_number, metadata)
                VALUES
                  ($1, $2, $3, $4, $5, $6::vector, $7, $8, $9)
                """,
                [
                    (
                        uuid.uuid4(),
                        doc.id,
                        bot_id,
                        tenant_id,
                        chunk.content,
                        json.dumps(emb),
                        chunk.chunk_index,
                        chunk.page_number,
                        json.dumps(chunk.metadata),
                    )
                    for chunk, emb in zip(chunks, all_embeddings)
                ],
            )

        doc.status = "ready"
        doc.chunk_count = len(chunks)
        await db.commit()
        await db.refresh(doc)
        logger.info("Ingested document %s: %d chunks", doc.id, len(chunks))

    except Exception as e:
        logger.error("Ingestion failed for doc %s: %s", doc.id, e)
        doc.status = "error"
        doc.error_message = str(e)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Ошибка обработки документа: {e}",
        )

    return doc


# ─── Retrieval ────────────────────────────────────────────────────────────────

async def retrieve_chunks(
    db: AsyncSession,
    bot_id: uuid.UUID,
    query: str,
    top_k: int = 5,
) -> List[dict]:
    """
    Семантический поиск: embed query → cosine similarity → top-k chunks.
    Использует pgvector оператор <=> (cosine distance).
    """
    query_emb = await get_embedding(query)

    async with db.connection() as conn:
        raw = await conn.get_raw_connection()
        pg_conn = raw.driver_connection

        rows = await pg_conn.fetch(
            """
            SELECT
                c.content,
                c.chunk_index,
                c.page_number,
                c.metadata,
                d.filename,
                1 - (c.embedding <=> $1::vector) AS similarity
            FROM chunks c
            JOIN documents d ON d.id = c.document_id
            WHERE c.bot_id = $2
              AND d.status = 'ready'
            ORDER BY c.embedding <=> $1::vector
            LIMIT $3
            """,
            json.dumps(query_emb),
            bot_id,
            top_k,
        )

    return [
        {
            "content": r["content"],
            "filename": r["filename"],
            "page_number": r["page_number"],
            "chunk_index": r["chunk_index"],
            "similarity": float(r["similarity"]),
        }
        for r in rows
    ]


# ─── Document Management ──────────────────────────────────────────────────────

async def list_documents(
    db: AsyncSession,
    bot_id: uuid.UUID,
    tenant_id: uuid.UUID,
) -> List[Document]:
    result = await db.execute(
        select(Document)
        .where(Document.bot_id == bot_id, Document.tenant_id == tenant_id)
        .order_by(Document.created_at.desc())
    )
    return list(result.scalars().all())


async def get_document(
    db: AsyncSession,
    document_id: uuid.UUID,
    bot_id: uuid.UUID,
    tenant_id: uuid.UUID,
) -> Document:
    result = await db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.bot_id == bot_id,
            Document.tenant_id == tenant_id,
        )
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Документ не найден")
    return doc


async def delete_document(
    db: AsyncSession,
    document_id: uuid.UUID,
    bot_id: uuid.UUID,
    tenant_id: uuid.UUID,
) -> None:
    doc = await get_document(db, document_id, bot_id, tenant_id)
    try:
        delete_file(doc.minio_key, bucket=BUCKET_DOCUMENTS)
    except Exception as e:
        logger.warning("MinIO delete failed (продолжаем): %s", e)
    await db.delete(doc)
    await db.commit()
