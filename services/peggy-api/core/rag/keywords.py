"""TF-IDF keyword extraction and candidate ranking."""

from __future__ import annotations

from typing import Any

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def extract_tfidf_keywords(abstracts: list[str], top_n: int = 15) -> list[str]:
    """Extract top TF-IDF terms from a corpus of abstracts."""
    texts = [a.strip() for a in abstracts if a and a.strip()]
    if not texts:
        return []
    n_features = min(top_n, max(1, len(texts)))
    vectorizer = TfidfVectorizer(stop_words="english", max_features=n_features)
    try:
        vectorizer.fit(texts)
        return list(vectorizer.get_feature_names_out())
    except ValueError:
        return []


def rank_by_tfidf_similarity(
    candidates: list[dict[str, Any]],
    corpus_abstracts: list[str],
) -> list[dict[str, Any]]:
    """Rank candidates by cosine similarity to the corpus TF-IDF centroid."""
    if not candidates:
        return []
    if not corpus_abstracts or not any(a.strip() for a in corpus_abstracts):
        return [{**c, "relevance_score": None} for c in candidates]

    corpus_texts = [a.strip() for a in corpus_abstracts if a and a.strip()]
    cand_texts = [(c.get("abstract") or c.get("title") or "").strip() for c in candidates]
    all_texts = corpus_texts + cand_texts
    if len(all_texts) < 2:
        return [{**c, "relevance_score": None} for c in candidates]

    vectorizer = TfidfVectorizer(stop_words="english")
    try:
        matrix = vectorizer.fit_transform(all_texts)
    except ValueError:
        return [{**c, "relevance_score": None} for c in candidates]

    n_corpus = len(corpus_texts)
    corpus_matrix = matrix[:n_corpus]
    cand_matrix = matrix[n_corpus:]
    centroid = np.asarray(corpus_matrix.mean(axis=0))
    scores = cosine_similarity(cand_matrix, centroid).flatten()

    ranked = []
    for cand, score in zip(candidates, scores):
        ranked.append({**cand, "relevance_score": float(max(0.0, min(1.0, score)))})
    ranked.sort(key=lambda x: x.get("relevance_score") or 0.0, reverse=True)
    return ranked
