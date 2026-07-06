import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent

# Load services/peggy-api/.env when running outside Docker
load_dotenv(BASE_DIR / ".env")
# Load repo root .env (docker compose secrets) when present
load_dotenv(BASE_DIR.parent.parent / ".env")

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", "")
PORT = int(os.getenv("PORT", "8000"))
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
VECTOR_SIZE = 384

_LLM_DEFAULT = "gemini" if os.getenv("RENDER") else "ollama"
LLM_PROVIDER = os.getenv("LLM_PROVIDER", _LLM_DEFAULT).lower()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")

SQLITE_DB = os.getenv("SQLITE_DB", str(BASE_DIR / "data" / "peggy.db"))
# When DATABASE_URL is set, catalog uses Postgres (Supabase); SQLITE_DB is ignored.
DATABASE_URL = os.getenv("DATABASE_URL", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
# JWT Secret from Supabase Settings → API (not the anon/publishable key).
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")
_AUTH_DEFAULT = "true" if os.getenv("RENDER") else "false"
AUTH_REQUIRED = os.getenv("AUTH_REQUIRED", _AUTH_DEFAULT).lower() in ("1", "true", "yes")
NCBI_EMAIL = os.getenv("NCBI_EMAIL", "peggy@example.com")
NCBI_API_KEY = os.getenv("NCBI_API_KEY", "")

UPSTASH_REDIS_REST_URL = os.getenv("UPSTASH_REDIS_REST_URL", "")
UPSTASH_REDIS_REST_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN", "")

COLLECTION_LITERATURE = "peggy_literature"
COLLECTION_OWN_FINDINGS = "peggy_own_findings"
COLLECTION_CHAT = "chat_history_logs"

_CORS_DEFAULT = (
    "https://peggy-ra.vercel.app,http://localhost:3000"
    if os.getenv("RENDER")
    else "http://localhost:3000"
)
CORS_ORIGINS = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", _CORS_DEFAULT).split(",")
    if o.strip()
]

# --- Free-tier enforcement (see docs/RESTRICTIONS.md) ---
# On Render (512MB RAM), default to hash embeddings to avoid OOM from sentence-transformers.
_EMBEDDING_DEFAULT = "hash" if os.getenv("RENDER") else "auto"
EMBEDDING_BACKEND = os.getenv("EMBEDDING_BACKEND", _EMBEDDING_DEFAULT).lower()

MAX_PAPERS_PER_USER = int(os.getenv("MAX_PAPERS_PER_USER", "200"))
MAX_WORKSPACES_PER_USER = int(os.getenv("MAX_WORKSPACES_PER_USER", "10"))
MAX_PMIDS_PER_INGEST = int(os.getenv("MAX_PMIDS_PER_INGEST", "10"))
MAX_DISCOVER_RESULTS = int(os.getenv("MAX_DISCOVER_RESULTS", "20"))
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(5 * 1024 * 1024)))
MAX_TEXT_QUERY_LEN = int(os.getenv("MAX_TEXT_QUERY_LEN", "4000"))
MAX_AGENT_STEPS = int(os.getenv("MAX_AGENT_STEPS", "5"))

RATE_LIMIT_CHAT_PER_HOUR = int(os.getenv("RATE_LIMIT_CHAT_PER_HOUR", "30"))
RATE_LIMIT_AGENT_PER_HOUR = int(os.getenv("RATE_LIMIT_AGENT_PER_HOUR", "15"))
RATE_LIMIT_INGEST_PER_HOUR = int(os.getenv("RATE_LIMIT_INGEST_PER_HOUR", "20"))
RATE_LIMIT_DISCOVER_PER_HOUR = int(os.getenv("RATE_LIMIT_DISCOVER_PER_HOUR", "20"))
RATE_LIMIT_WORKFLOW_PER_HOUR = int(os.getenv("RATE_LIMIT_WORKFLOW_PER_HOUR", "15"))

# When false on Render, /health returns minimal status (no LLM/limits detail).
PUBLIC_HEALTH_DETAIL = os.getenv("PUBLIC_HEALTH_DETAIL", "false").lower() in ("1", "true", "yes")
