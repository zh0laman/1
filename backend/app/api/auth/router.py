from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.api.deps import get_current_user
from app.schemas.auth import RegisterIn, LoginIn, UserAndTokenOut, UserOut
from app.models.user import User
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/register", response_model=UserAndTokenOut, status_code=status.HTTP_201_CREATED)
async def register(
    data: RegisterIn,
    db: AsyncSession = Depends(get_db)
):
    """Register a new Tenant and Owner User."""
    user, token = await auth_service.register_user(db, data)
    return {
        "user": user,
        "access_token": token,
        "token_type": "bearer"
    }

@router.post("/login", response_model=UserAndTokenOut)
async def login(
    data: LoginIn,
    db: AsyncSession = Depends(get_db)
):
    """Authenticate User and return token."""
    user, token = await auth_service.authenticate_user(db, data)
    return {
        "user": user,
        "access_token": token,
        "token_type": "bearer"
    }

@router.get("/me", response_model=UserOut)
async def get_me(
    current_user: User = Depends(get_current_user)
):
    """Retrieve details of the currently authenticated user."""
    return current_user
