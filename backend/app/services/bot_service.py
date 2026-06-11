from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status
from uuid import UUID
from app.models.bot import Bot
from app.schemas.bot import BotCreate, BotUpdate
from typing import List

async def list_bots(db: AsyncSession, tenant_id: UUID) -> List[Bot]:
    """List all bots belonging to the tenant."""
    result = await db.execute(
        select(Bot)
        .where(Bot.tenant_id == tenant_id)
        .order_by(Bot.created_at.desc())
    )
    return list(result.scalars().all())

async def get_bot(db: AsyncSession, bot_id: UUID, tenant_id: UUID) -> Bot:
    """Retrieve a specific bot by ID and check tenant ownership."""
    result = await db.execute(
        select(Bot)
        .where(Bot.id == bot_id, Bot.tenant_id == tenant_id)
    )
    bot = result.scalar_one_or_none()
    if not bot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Чат-бот не найден"
        )
    return bot

async def create_bot(db: AsyncSession, tenant_id: UUID, data: BotCreate) -> Bot:
    """Create a new bot for the specified tenant."""
    bot = Bot(
        name=data.name,
        description=data.description,
        system_prompt=data.system_prompt,
        settings=data.settings,
        tenant_id=tenant_id,
        is_active=True
    )
    db.add(bot)
    await db.commit()
    await db.refresh(bot)
    return bot

async def update_bot(db: AsyncSession, bot_id: UUID, tenant_id: UUID, data: BotUpdate) -> Bot:
    """Update bot details, verifying tenant ownership."""
    bot = await get_bot(db, bot_id, tenant_id)
    
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(bot, field, value)
        
    await db.commit()
    await db.refresh(bot)
    return bot

async def delete_bot(db: AsyncSession, bot_id: UUID, tenant_id: UUID) -> None:
    """Delete a bot, verifying tenant ownership."""
    bot = await get_bot(db, bot_id, tenant_id)
    await db.delete(bot)
    await db.commit()
