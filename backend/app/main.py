from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import logging
import os

from app.api.auth.router import router as auth_router
from app.api.admin.bots import router as bots_router
from app.api.rag.router import router as rag_docs_router, key_router as rag_keys_router
from app.api.chat.router import router as chat_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Alem RAG API",
    description="""
## Multi-tenant RAG Chatbot Platform

### Возможности
- 🏢 **Multi-tenant**: каждый клиент создаёт своих ботов
- 🤖 **Создание ботов**: через админку с настройкой system prompt
- 📄 **База знаний**: загрузка PDF, DOCX, XLSX, PPTX, TXT, MD, HTML
- 🔍 **Векторный поиск**: pgvector + BAAI/bge-m3 эмбеддинги
- 💬 **Чат с историей**: с поддержкой стриминга (SSE)
- 🔑 **API ключи**: публичный доступ к чат-ботам

### Аутентификация
- **Админ-endpoints** (`/admin/*`): JWT Bearer токен (из `/auth/login`)
- **Чат-endpoint** (`/chat/{bot_id}`): API ключ бота в заголовке `X-API-Key`
    """,
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ──────────────────────────────────────────────────────────────────
app.include_router(auth_router)           # /auth/register, /auth/login, /auth/me
app.include_router(bots_router)           # /admin/bots CRUD
app.include_router(rag_docs_router)       # /admin/bots/{id}/documents
app.include_router(rag_keys_router)       # /admin/bots/{id}/api-key
app.include_router(chat_router)           # /chat/{bot_id}


@app.get("/health", tags=["system"])
async def health_check():
    return {"status": "ok", "service": "Alem RAG API", "version": "2.0.0"}


@app.on_event("startup")
async def startup_event():
    logger.info("🚀 Alem RAG API v2.0 starting up...")


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down Alem RAG API...")
