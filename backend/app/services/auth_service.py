from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status
from slugify import slugify
import uuid
import secrets
from app.models.user import User, UserRole
from app.models.tenant import Tenant
from app.schemas.auth import RegisterIn, LoginIn
from app.core.security import hash_password, verify_password, create_access_token
from typing import Tuple

async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    """Retrieve user by email."""
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()

async def get_tenant_by_slug(db: AsyncSession, slug: str) -> Tenant | None:
    """Retrieve tenant by slug."""
    result = await db.execute(select(Tenant).where(Tenant.slug == slug))
    return result.scalar_one_or_none()

async def register_user(db: AsyncSession, data: RegisterIn) -> Tuple[User, str]:
    """Register a new Tenant and the first User (Owner)."""
    # 1. Check if user already exists
    existing_user = await get_user_by_email(db, data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь с таким email уже зарегистрирован"
        )

    # 2. Slugify tenant name and handle conflicts
    base_slug = slugify(data.tenant_name)
    if not base_slug:
        base_slug = "tenant"
    slug = base_slug
    
    # Simple conflict resolution
    while True:
        existing_tenant = await get_tenant_by_slug(db, slug)
        if not existing_tenant:
            break
        slug = f"{base_slug}-{secrets.token_hex(3)}"

    # 3. Create Tenant
    tenant = Tenant(
        name=data.tenant_name,
        slug=slug,
        is_active=True
    )
    db.add(tenant)
    await db.flush() # Flush to populate tenant.id

    # 4. Create Owner User
    hashed_pwd = hash_password(data.password)
    user = User(
        email=data.email,
        hashed_password=hashed_pwd,
        full_name=data.full_name,
        role=UserRole.OWNER,
        is_active=True,
        tenant_id=tenant.id
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # 5. Generate token
    token_data = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role.value,
        "tenant_id": str(user.tenant_id)
    }
    token = create_access_token(data=token_data)

    return user, token

async def authenticate_user(db: AsyncSession, data: LoginIn) -> Tuple[User, str]:
    """Authenticate an existing user and return their token."""
    user = await get_user_by_email(db, data.email)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный email или пароль"
        )

    if not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Неверный email или пароль"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Пользователь заблокирован"
        )

    # Generate token
    token_data = {
        "sub": str(user.id),
        "email": user.email,
        "role": user.role.value,
        "tenant_id": str(user.tenant_id)
    }
    token = create_access_token(data=token_data)

    return user, token
