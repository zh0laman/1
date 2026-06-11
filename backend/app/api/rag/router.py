"""
RAG Admin API — управление базой знаний бота.
Требует JWT авторизации (Owner/Admin).
"""
import mimetypes
from uuid import UUID

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.api.deps import get_current_user, require_role
from app.models.user import User, UserRole
from app.models.bot import Bot
from app.schemas.rag import DocumentOut, DocumentListOut, BotApiKeyOut
from app.services import rag_service

router = APIRouter(prefix="/admin/bots/{bot_id}/documents", tags=["rag-documents"])
key_router = APIRouter(prefix="/admin/bots", tags=["rag-api-keys"])


async def _verify_bot_owner(bot_id: UUID, tenant_id: UUID, db: AsyncSession) -> Bot:
    """Проверяет что бот принадлежит тенанту."""
    result = await db.execute(
        select(Bot).where(Bot.id == bot_id, Bot.tenant_id == tenant_id)
    )
    bot = result.scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=404, detail="Бот не найден")
    return bot


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    bot_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """
    Загружает документ в базу знаний бота и запускает векторизацию.

    Поддерживаемые форматы: PDF, DOCX, XLSX, PPTX, TXT, MD, HTML, CSV.
    """
    await _verify_bot_owner(bot_id, current_user.tenant_id, db)

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Файл пустой")

    mime_type = file.content_type
    if not mime_type or mime_type == "application/octet-stream":
        guessed, _ = mimetypes.guess_type(file.filename or "")
        mime_type = guessed or "application/octet-stream"

    doc = await rag_service.ingest_document(
        db=db,
        tenant_id=current_user.tenant_id,
        bot_id=bot_id,
        file_bytes=content,
        filename=file.filename or "unnamed",
        mime_type=mime_type,
    )
    return doc


@router.get("", response_model=DocumentListOut)
async def list_documents(
    bot_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Список документов в базе знаний бота."""
    await _verify_bot_owner(bot_id, current_user.tenant_id, db)
    docs = await rag_service.list_documents(db, bot_id, current_user.tenant_id)
    return DocumentListOut(items=docs, total=len(docs))


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    bot_id: UUID,
    document_id: UUID,
    current_user: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Удаляет документ и все его чанки из базы знаний."""
    await _verify_bot_owner(bot_id, current_user.tenant_id, db)
    await rag_service.delete_document(db, document_id, bot_id, current_user.tenant_id)


# ── API Key Management ────────────────────────────────────────────────────────

@key_router.post("/{bot_id}/api-key", response_model=BotApiKeyOut)
async def generate_api_key(
    bot_id: UUID,
    current_user: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """
    Генерирует (или перегенерирует) публичный API ключ для чат-бота.
    Этот ключ используется в X-API-Key заголовке для доступа к /chat/{bot_id}.
    """
    bot = await _verify_bot_owner(bot_id, current_user.tenant_id, db)
    new_key = bot.generate_api_key()
    await db.commit()
    return BotApiKeyOut(bot_id=bot_id, api_key=new_key)
