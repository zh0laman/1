"""
Разбивка текста на чанки с перекрытием.
Интегрировано из rag.zip в основной проект alem-ai-backend.
"""
import hashlib
import logging
from dataclasses import dataclass, field
from typing import List, Optional

from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.rag.parsers import ParsedDocument

logger = logging.getLogger(__name__)

# Настройки по умолчанию (переопределяются через env/settings)
DEFAULT_CHUNK_SIZE = 512
DEFAULT_CHUNK_OVERLAP = 64


@dataclass
class TextChunk:
    content: str
    chunk_index: int
    page_number: Optional[int] = None
    start_char: int = 0
    end_char: int = 0
    metadata: dict = field(default_factory=dict)

    @property
    def content_hash(self) -> str:
        return hashlib.sha256(self.content.encode()).hexdigest()


def make_splitter(
    chunk_size: Optional[int] = None,
    chunk_overlap: Optional[int] = None,
) -> RecursiveCharacterTextSplitter:
    return RecursiveCharacterTextSplitter(
        chunk_size=chunk_size or DEFAULT_CHUNK_SIZE,
        chunk_overlap=chunk_overlap or DEFAULT_CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", "! ", "? ", "; ", ", ", " ", ""],
        keep_separator=True,
        length_function=len,
    )


def chunk_document(
    doc: ParsedDocument,
    chunk_size: Optional[int] = None,
    chunk_overlap: Optional[int] = None,
) -> List[TextChunk]:
    splitter = make_splitter(chunk_size, chunk_overlap)
    chunks: List[TextChunk] = []
    chunk_index = 0
    overlap = chunk_overlap or DEFAULT_CHUNK_OVERLAP

    for page in doc.pages:
        if not page.text.strip():
            continue
        page_chunks = splitter.split_text(page.text)
        cursor = 0
        for raw_chunk in page_chunks:
            if not raw_chunk.strip():
                continue
            start = page.text.find(raw_chunk, cursor)
            if start == -1:
                start = cursor
            end = start + len(raw_chunk)
            cursor = max(cursor, end - overlap)
            chunks.append(TextChunk(
                content=raw_chunk.strip(),
                chunk_index=chunk_index,
                page_number=page.page_number,
                start_char=start,
                end_char=end,
                metadata={**page.metadata, "page_number": page.page_number},
            ))
            chunk_index += 1

    logger.info("Chunked document: %d pages → %d chunks", len(doc.pages), len(chunks))
    return chunks


def chunk_text(
    text: str,
    chunk_size: Optional[int] = None,
    chunk_overlap: Optional[int] = None,
) -> List[TextChunk]:
    splitter = make_splitter(chunk_size, chunk_overlap)
    raw_chunks = splitter.split_text(text)
    chunks = []
    cursor = 0
    for i, raw in enumerate(raw_chunks):
        if not raw.strip():
            continue
        start = text.find(raw, cursor)
        if start == -1:
            start = cursor
        end = start + len(raw)
        cursor = end
        chunks.append(TextChunk(content=raw.strip(), chunk_index=i, start_char=start, end_char=end))
    return chunks
