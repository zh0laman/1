from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import List
from app.core.database import get_db
from app.api.deps import get_current_user, require_role
from app.models.user import User, UserRole
from app.schemas.bot import BotCreate, BotUpdate, BotOut
from app.services import bot_service

router = APIRouter(prefix="/admin/bots", tags=["admin-bots"])

@router.get("", response_model=List[BotOut])
async def list_bots(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """List all bots belonging to the current user's tenant."""
    bots = await bot_service.list_bots(db, current_user.tenant_id)
    return bots

@router.post("", response_model=BotOut, status_code=status.HTTP_201_CREATED)
async def create_bot(
    data: BotCreate,
    current_user: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Create a new bot for the current tenant. Only Owners and Admins are allowed."""
    bot = await bot_service.create_bot(db, current_user.tenant_id, data)
    return bot

@router.get("/{bot_id}", response_model=BotOut)
async def get_bot(
    bot_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get details of a specific bot. Only accessible if it belongs to the tenant."""
    bot = await bot_service.get_bot(db, bot_id, current_user.tenant_id)
    return bot

@router.put("/{bot_id}", response_model=BotOut)
async def update_bot(
    bot_id: UUID,
    data: BotUpdate,
    current_user: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Update bot details. Only Owners and Admins are allowed."""
    bot = await bot_service.update_bot(db, bot_id, current_user.tenant_id, data)
    return bot

@router.delete("/{bot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bot(
    bot_id: UUID,
    current_user: User = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db)
):
    """Delete a bot. Only Owners and Admins are allowed."""
    await bot_service.delete_bot(db, bot_id, current_user.tenant_id)
    return
