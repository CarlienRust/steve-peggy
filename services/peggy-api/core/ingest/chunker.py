"""Text chunking for embedding."""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass


@dataclass
class Chunk:
    chunk_id: str
    text: str
    metadata: dict


def chunk_text(
    text: str,
    metadata: dict,
    chunk_size: int = 500,
    overlap: int = 50,
) -> list[Chunk]:
    text = re.sub(r"\s+", " ", text.strip())
    if not text:
        return []
    words = text.split()
    chunks: list[Chunk] = []
    i = 0
    idx = 0
    while i < len(words):
        window = words[i : i + chunk_size]
        chunk_str = " ".join(window)
        base = metadata.get("pmid") or metadata.get("doc_id") or "doc"
        chunk_id = hashlib.md5(f"{base}:{idx}:{chunk_str[:80]}".encode()).hexdigest()
        chunks.append(
            Chunk(
                chunk_id=chunk_id,
                text=chunk_str,
                metadata={**metadata, "chunk_index": idx},
            )
        )
        i += chunk_size - overlap
        idx += 1
    return chunks


def paper_to_chunks(paper, source_type: str = "literature") -> list[Chunk]:
    meta = {
        "pmid": paper.pmid,
        "title": paper.title,
        "authors": paper.authors,
        "year": paper.year,
        "doi": getattr(paper, "doi", ""),
        "source_type": source_type,
    }
    body = f"{paper.title}. {paper.abstract}".strip()
    return chunk_text(body, meta)
