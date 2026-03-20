"""
PDF text extraction and chunking service.
"""
import re
from pypdf import PdfReader
from app.config import settings


def extract_text_from_pdf(file_path: str) -> str:
    """Extract all text from a PDF file."""
    reader = PdfReader(file_path)
    pages = []
    for page in reader.pages:
        text = page.extract_text()
        if text:
            pages.append(text)
    return "\n\n".join(pages)


def chunk_text(text: str, chunk_size: int | None = None, overlap: int | None = None) -> list[dict]:
    """
    Split text into overlapping chunks for embedding.
    Returns list of dicts: {chunk_index, content, char_start, char_end}
    """
    chunk_size = chunk_size or settings.chunk_size
    overlap = overlap or settings.chunk_overlap

    # Clean text
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r' {2,}', ' ', text)

    chunks = []
    start = 0
    idx = 0

    while start < len(text):
        end = start + chunk_size
        # Try to break at sentence boundary
        if end < len(text):
            # Look for sentence end in last 200 chars of chunk
            breakpoint = text.rfind('. ', start, end)
            if breakpoint != -1 and breakpoint > start + chunk_size // 2:
                end = breakpoint + 1
        chunk_text_content = text[start:end].strip()
        if chunk_text_content:
            chunks.append({
                "chunk_index": idx,
                "content": chunk_text_content,
                "char_start": start,
                "char_end": end,
            })
            idx += 1
        start = end - overlap

    return chunks


def extract_metadata_from_text(text: str) -> dict:
    """
    Heuristically extract title, authors from the first portion of the text.
    Returns partial metadata dict.
    """
    first_page = text[:2000]
    lines = [line.strip() for line in first_page.split('\n') if line.strip()]

    # Title is often the first non-trivial line
    title = ""
    for line in lines[:5]:
        if len(line) > 10 and not line.lower().startswith(("abstract", "arxiv", "doi", "http")):
            title = line
            break

    return {"title": title}
