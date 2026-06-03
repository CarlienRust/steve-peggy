# Test PDFs

Local papers for Peggy ingest testing (not committed to CI if large — keep in repo for dev).

| File | Notes |
|------|--------|
| `ssrn-5084868.pdf` | Smallest; used by API unit/integration tests |
| `Brain and Behavior - 2025 - Rust - ...` | Blood microbiome / Parkinson's |
| `Genes Brain and Behavior - 2025 - O'Hare - ...` | Gut microbiome |

## Ingest all into running API

```bash
./scripts/start-qdrant.sh   # terminal 1
./scripts/start-api.sh      # terminal 2
python3 scripts/ingest-test-pdfs.py   # stdlib only — no pip install
```

Or a custom folder:

```bash
python scripts/ingest-test-pdfs.py ~/Documents/my-papers
```

Then check http://localhost:3000/ingest (Corpus page) or `GET http://localhost:8000/corpus`.
