"""
Public Chat API — доступ по API ключу бота (без JWT).
Используется клиентами для общения с чат-ботом.
"""
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.models.bot import Bot
from app.schemas.rag import ChatRequest, ChatResponse
from app.services import rag_service, chat_service

router = APIRouter(prefix="/chat", tags=["chat"])


async def _get_bot_by_api_key(
    x_api_key: str = Header(alias="X-API-Key"),
    db: AsyncSession = Depends(get_db),
) -> Bot:
    """Авторизация по публичному API ключу бота."""
    result = await db.execute(
        select(Bot).where(
            Bot.api_key == x_api_key,
            Bot.is_active == True,
        )
    )
    bot = result.scalar_one_or_none()
    if not bot:
        raise HTTPException(status_code=401, detail="Неверный или неактивный API ключ бота")
    return bot


@router.post("/{bot_id}")
async def chat(
    bot_id: UUID,
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
    bot: Bot = Depends(_get_bot_by_api_key),
):
    """
    RAG Чат — задайте вопрос боту.

    Авторизация: заголовок `X-API-Key: rag_<key>`
    (API ключ генерируется через POST /admin/bots/{bot_id}/api-key)

    - `stream: true` — ответ в формате Server-Sent Events
    - `history` — массив предыдущих сообщений для многоходового диалога
    - `top_k` — количество релевантных фрагментов из базы знаний (1-20)
    """
    if str(bot.id) != str(bot_id):
        raise HTTPException(status_code=403, detail="API ключ не соответствует боту")

    # Семантический поиск по базе знаний
    context = await rag_service.retrieve_chunks(db, bot_id, body.message, body.top_k)

    if body.stream:
        return StreamingResponse(
            chat_service.chat_stream(
                history=body.history,
                user_message=body.message,
                context_chunks=context,
                system_prompt=bot.system_prompt,
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no",
                "Connection": "keep-alive",
            },
        )

    result = await chat_service.chat_completion(
        history=body.history,
        user_message=body.message,
        context_chunks=context,
        system_prompt=bot.system_prompt,
    )
    return result
