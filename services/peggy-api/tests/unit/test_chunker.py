from core.ingest.chunker import chunk_text, paper_to_chunks
from core.ingest.pubmed import PaperRecord, _parse_pubmed_xml


def test_chunk_text_empty():
    assert chunk_text("", {"pmid": "1"}) == []


def test_chunk_text_produces_ids():
    text = " ".join(["word"] * 600)
    chunks = chunk_text(text, {"pmid": "123"}, chunk_size=100, overlap=10)
    assert len(chunks) >= 2
    assert chunks[0].metadata["pmid"] == "123"
    assert chunks[0].chunk_id != chunks[1].chunk_id


def test_paper_to_chunks():
    paper = PaperRecord(
        pmid="1",
        title="Test title",
        authors="Smith",
        year="2024",
        abstract="Abstract text here.",
    )
    chunks = paper_to_chunks(paper)
    assert len(chunks) >= 1
    assert "Test title" in chunks[0].text
    assert chunks[0].metadata["source_type"] == "literature"


def test_parse_pubmed_xml_minimal():
    xml = """<?xml version="1.0"?>
    <PubmedArticleSet>
      <PubmedArticle>
        <MedlineCitation>
          <Article>
            <ArticleTitle>Microbiome study</ArticleTitle>
            <Abstract><AbstractText>We found diversity shifts.</AbstractText></Abstract>
            <AuthorList><Author><LastName>Jones</LastName></Author></AuthorList>
          </Article>
        </MedlineCitation>
        <PubmedData><History><PubMedPubDate><Year>2023</Year></PubMedPubDate></History></PubmedData>
      </PubmedArticle>
    </PubmedArticleSet>"""
    record = _parse_pubmed_xml(xml, "999")
    assert record is not None
    assert record.title == "Microbiome study"
    assert "diversity" in record.abstract
    assert record.authors == "Jones"
    assert record.pmid == "999"
