"""Add RAG tables: bot api_key, documents, chunks with pgvector

Revision ID: b2c3d4e5f6a7
Revises: 60e4e3d828fd
Create Date: 2026-06-12 10:00:00.000000
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql as pg

revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = '60e4e3d828fd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Включаем pgvector
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")

    # Добавляем api_key к ботам (публичный ключ для чат-доступа без JWT)
    op.add_column('bots',
        sa.Column('api_key', sa.String(255), nullable=True)
    )
    op.create_index('ix_bots_api_key', 'bots', ['api_key'], unique=True)

    # Таблица documents — метаданные загруженных файлов
    op.create_table('documents',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('bot_id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('filename', sa.String(500), nullable=False),
        sa.Column('minio_key', sa.Text(), nullable=False),
        sa.Column('mime_type', sa.String(255), nullable=True),
        sa.Column('file_size', sa.BigInteger(), nullable=True),
        sa.Column('chunk_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('status', sa.String(50), nullable=False, server_default='pending'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['bot_id'], ['bots.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_documents_bot_id', 'documents', ['bot_id'])
    op.create_index('ix_documents_tenant_id', 'documents', ['tenant_id'])

    # Таблица chunks — векторизованные фрагменты текста
    op.create_table('chunks',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('document_id', sa.UUID(), nullable=False),
        sa.Column('bot_id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('chunk_index', sa.Integer(), nullable=False),
        sa.Column('page_number', sa.Integer(), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_chunks_bot_id', 'chunks', ['bot_id'])
    op.create_index('ix_chunks_document_id', 'chunks', ['document_id'])

    # Добавляем колонку embedding как vector(1024)
    op.execute("ALTER TABLE chunks ADD COLUMN embedding vector(1024);")

    # IVFFlat индекс для быстрого косинусного поиска
    op.execute(
        "CREATE INDEX ix_chunks_embedding ON chunks "
        "USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_chunks_embedding;")
    op.drop_table('chunks')
    op.drop_table('documents')
    op.drop_index('ix_bots_api_key', table_name='bots')
    op.drop_column('bots', 'api_key')
    op.execute("DROP EXTENSION IF EXISTS vector;")
