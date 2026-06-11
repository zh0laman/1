import uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Boolean
from sqlalchemy.dialects import postgresql as pg
from app.models.base import Base, TimestampMixin
from typing import List

class Tenant(TimestampMixin, Base):
    """Represent a system Tenant (Client)."""
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(
        pg.UUID(as_uuid=True), 
        primary_key=True, 
        default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    users: Mapped[List["User"]] = relationship(
        "User", 
        back_populates="tenant", 
        cascade="all, delete-orphan"
    )
    bots: Mapped[List["Bot"]] = relationship(
        "Bot", 
        back_populates="tenant", 
        cascade="all, delete-orphan"
    )
