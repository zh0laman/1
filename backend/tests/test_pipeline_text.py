"""
Тесты пайплайна обработки текста: парсеры + чанкинг.
Проверяют этапы: parse → chunk (до векторизации).
"""
import pytest

from app.rag.parsers import (
    parse_text, parse_html, parse_markdown, parse_document,
    ParsedDocument, ParsedPage,
)
from app.rag.chunker import chunk_document, chunk_text, TextChunk


# ─── Parsers ──────────────────────────────────────────────────────────────────

def test_parse_text_plain():
    doc = parse_text("Привет, мир. Это тестовый документ.".encode("utf-8"))
    assert isinstance(doc, ParsedDocument)
    assert len(doc.pages) == 1
    assert "тестовый документ" in doc.pages[0].text


def test_parse_text_empty_returns_no_pages():
    doc = parse_text(b"   \n  ")
    assert doc.pages == []


def test_parse_html_strips_tags_and_scripts():
    html = b"""
    <html><head><title>My Title</title><style>body{color:red}</style></head>
    <body><script>alert(1)</script><h1>Heading</h1><p>Some body text here.</p></body></html>
    """
    doc = parse_html(html)
    assert doc.title == "My Title"
    text = doc.full_text
    assert "Heading" in text
    assert "Some body text here." in text
    # script/style вырезаны
    assert "alert" not in text
    assert "color:red" not in text


def test_parse_markdown_to_plain_text():
    md = b"# Title\n\nThis is **bold** and a [link](http://x.com)."
    doc = parse_markdown(md)
    text = doc.full_text
    assert "Title" in text
    assert "bold" in text
    # markdown-разметка убрана
    assert "**" not in text


def test_parse_document_routes_by_extension():
    doc = parse_document(b"hello world content", "notes.txt")
    assert doc.full_text.strip() == "hello world content"


def test_parse_document_unknown_falls_back_to_text():
    doc = parse_document(b"raw bytes content here", "file.unknownext")
    assert "raw bytes content here" in doc.full_text


def test_full_text_joins_pages():
    doc = ParsedDocument(pages=[
        ParsedPage(page_number=1, text="page one"),
        ParsedPage(page_number=2, text="page two"),
    ])
    assert doc.full_text == "page one\n\npage two"


# ─── Chunker ────────────────────────────────────────────────────────────────

def test_chunk_text_basic():
    text = "Sentence one. " * 200  # длинный текст
    chunks = chunk_text(text, chunk_size=100, chunk_overlap=20)
    assert len(chunks) > 1
    assert all(isinstance(c, TextChunk) for c in chunks)
    # индексы последовательны
    assert [c.chunk_index for c in chunks] == list(range(len(chunks)))


def test_chunk_respects_size():
    text = "word " * 500
    chunks = chunk_text(text, chunk_size=120, chunk_overlap=0)
    # каждый чанк не должен сильно превышать chunk_size
    assert all(len(c.content) <= 200 for c in chunks)


def test_chunk_document_assigns_page_numbers():
    doc = ParsedDocument(pages=[
        ParsedPage(page_number=1, text="First page content. " * 50),
        ParsedPage(page_number=2, text="Second page content. " * 50),
    ])
    chunks = chunk_document(doc, chunk_size=100, chunk_overlap=10)
    pages_seen = {c.page_number for c in chunks}
    assert pages_seen == {1, 2}
    # глобально уникальные и последовательные индексы поверх страниц
    assert [c.chunk_index for c in chunks] == list(range(len(chunks)))


def test_chunk_document_skips_empty_pages():
    doc = ParsedDocument(pages=[
        ParsedPage(page_number=1, text="   "),
        ParsedPage(page_number=2, text="Real content here that is long enough. " * 10),
    ])
    chunks = chunk_document(doc, chunk_size=80, chunk_overlap=10)
    assert len(chunks) >= 1
    assert all(c.page_number == 2 for c in chunks)


def test_chunk_content_hash_stable():
    c1 = TextChunk(content="same content", chunk_index=0)
    c2 = TextChunk(content="same content", chunk_index=5)
    assert c1.content_hash == c2.content_hash
