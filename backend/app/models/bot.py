import uuid
import secrets
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Text, ForeignKey, Boolean, JSON
from sqlalchemy.dialects import postgresql as pg
from app.models.base import Base, TimestampMixin


class Bot(TimestampMixin, Base):
    """Chatbot configuration с поддержкой RAG."""
    __tablename__ = "bots"

    id: Mapped[uuid.UUID] = mapped_column(
        pg.UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    system_prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    settings: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Публичный API-ключ для доступа к чату без JWT
    api_key: Mapped[str | None] = mapped_column(
        String(255), unique=True, nullable=True, index=True
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False
    )

    # Relationships
    tenant: Mapped["Tenant"] = relationship("Tenant", back_populates="bots")
    documents: Mapped[list["Document"]] = relationship(
        "Document", back_populates="bot", cascade="all, delete-orphan"
    )

    def generate_api_key(self) -> str:
        """Генерирует новый публичный API ключ для бота."""
        self.api_key = "rag_" + secrets.token_urlsafe(32)
        return self.api_key
