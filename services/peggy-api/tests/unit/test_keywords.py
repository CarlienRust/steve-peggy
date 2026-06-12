from core.rag.keywords import extract_tfidf_keywords, rank_by_tfidf_similarity


def test_extract_tfidf_keywords_empty():
    assert extract_tfidf_keywords([]) == []


def test_extract_tfidf_keywords_single_doc():
    keywords = extract_tfidf_keywords(
        ["Microbiome diversity affects metabolic health in type 2 diabetes patients."],
        top_n=5,
    )
    assert isinstance(keywords, list)
    assert len(keywords) >= 1


def test_extract_tfidf_keywords_multiple():
    abstracts = [
        "Gut microbiome composition and butyrate producers in diabetes.",
        "Type 2 diabetes cohort shows reduced microbial diversity.",
        "Butyrate metabolism links microbiome to insulin resistance.",
    ]
    keywords = extract_tfidf_keywords(abstracts, top_n=10)
    assert len(keywords) <= 10
    assert any("microbiome" in k or "butyrate" in k or "diabetes" in k for k in keywords)


def test_rank_by_tfidf_similarity_empty_corpus():
    candidates = [{"title": "A", "abstract": "microbiome diabetes"}]
    ranked = rank_by_tfidf_similarity(candidates, [])
    assert ranked[0]["relevance_score"] is None


def test_rank_by_tfidf_similarity_orders_by_score():
    corpus = [
        "Microbiome and butyrate in type 2 diabetes.",
        "Gut bacteria diversity in diabetic cohorts.",
    ]
    candidates = [
        {"title": "Unrelated", "abstract": "Quantum computing hardware advances."},
        {"title": "Related", "abstract": "Microbiome butyrate producers in diabetes patients."},
    ]
    ranked = rank_by_tfidf_similarity(candidates, corpus)
    assert ranked[0]["title"] == "Related"
    assert ranked[0]["relevance_score"] is not None
    assert ranked[0]["relevance_score"] >= (ranked[1]["relevance_score"] or 0)
