from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID
from datetime import datetime
from typing import Optional, List, Dict, Any


# ── Documents ────────────────────────────────────────────────────────────────

class DocumentOut(BaseModel):
    id: UUID
    bot_id: UUID
    tenant_id: UUID
    filename: str
    mime_type: Optional[str] = None
    file_size: Optional[int] = None
    chunk_count: int
    status: str
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentListOut(BaseModel):
    items: List[DocumentOut]
    total: int


# ── Chat ─────────────────────────────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str = Field(..., pattern="^(user|assistant)$")
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=8192)
    history: List[ChatMessage] = Field(default_factory=list)
    top_k: int = Field(5, ge=1, le=20)
    stream: bool = False


class SourceItem(BaseModel):
    filename: str
    page_number: Optional[int] = None
    similarity: float


class ChatResponse(BaseModel):
    answer: str
    context_used: int
    sources: List[SourceItem] = Field(default_factory=list)


# ── Bot API Key ───────────────────────────────────────────────────────────────

class BotApiKeyOut(BaseModel):
    bot_id: UUID
    api_key: str
    note: str = "Сохраните ключ. Он больше не будет показан."


# ── Extended BotOut с api_key статусом ───────────────────────────────────────

class BotOutExtended(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    system_prompt: Optional[str] = None
    settings: Dict[str, Any]
    is_active: bool
    tenant_id: UUID
    has_api_key: bool
    document_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
