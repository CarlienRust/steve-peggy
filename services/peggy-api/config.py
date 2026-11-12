from __future__ import annotations

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
GEMINI_EMBED_MODEL = os.getenv("GEMINI_EMBED_MODEL", "text-embedding-004")

_LLM_DEFAULT = "gemini" if os.getenv("RENDER") else "ollama"
LLM_PROVIDER = os.getenv("LLM_PROVIDER", _LLM_DEFAULT).lower()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

_RETIRED_GEMINI_MODELS = {
    "gemini-2.0-flash": "gemini-3.8-flash",
    "gemini-2.0-flash-001": "gemini-3.8-flash",
    "gemini-2.0-flash-lite": "gemini-3.8-flash",
    "gemini-1.5-flash": "gemini-3.8-flash",
    "gemini-1.5-flash-latest": "gemini-3.8-flash",
    "gemini-1.5-pro": "gemini-3.8-flash",
    "gemini-1.5-pro-latest": "gemini-3.8-flash",
}


def normalize_gemini_model(raw: str | None) -> str:
    name = (raw or "gemini-3.8-flash").strip().removeprefix("models/")
    if not name:
        return "gemini-3.8-flash"
    return _RETIRED_GEMINI_MODELS.get(name, name)


GEMINI_MODEL = normalize_gemini_model(os.getenv("GEMINI_MODEL", "gemini-3.8-flash"))
PEGGY_SECRETS_KEY = os.getenv("PEGGY_SECRETS_KEY", "")
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-3-5-sonnet-latest")
CHATGPT_MODEL = os.getenv("CHATGPT_MODEL", "gpt-4o-mini")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
OPENROUTER_MODEL = os.getenv("OPENROUTER_MODEL", "openai/gpt-4o-mini")
LLM_USER_PROVIDERS = ("gemini", "claude", "chatgpt", "groq", "openrouter")
GEMINI_TIER = os.getenv("GEMINI_TIER", "unpaid").strip().lower() or "unpaid"
DEMO_MODE = os.getenv("DEMO_MODE", "false").lower() in ("1", "true", "yes")
DEMO_WORKSPACE_ID = os.getenv("DEMO_WORKSPACE_ID", "")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")

SQLITE_DB = os.getenv("SQLITE_DB", str(BASE_DIR / "data" / "peggy.db"))
# When DATABASE_URL is set, catalog uses Postgres (Supabase); SQLITE_DB is ignored.
DATABASE_URL = os.getenv("DATABASE_URL", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
# JWT Secret from Supabase Settings → API (not the anon/publishable key).
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
UPLOAD_DIR = os.getenv("UPLOAD_DIR", str(BASE_DIR / "data" / "uploads"))
STORAGE_BUCKET = os.getenv("STORAGE_BUCKET", "peggy-uploads")
LLM_SOURCE_TYPES = ("literature", "own_findings")
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
    else "http://localhost:3000,http://localhost:3001"
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
# Gemini text-embedding-004 is 768-d. MiniLM/hash stay 384. Never reuse a collection across sizes.
if EMBEDDING_BACKEND == "gemini":
    VECTOR_SIZE = int(os.getenv("VECTOR_SIZE", "768"))
else:
    VECTOR_SIZE = int(os.getenv("VECTOR_SIZE", "384"))
RETRIEVAL_RECALL_AT_5_TARGET = float(os.getenv("RETRIEVAL_RECALL_AT_5_TARGET", "0.6"))
RETRIEVAL_RECALL_AT_10_TARGET = float(os.getenv("RETRIEVAL_RECALL_AT_10_TARGET", "0.75"))

MAX_PAPERS_PER_USER = int(os.getenv("MAX_PAPERS_PER_USER", "200"))
MAX_WORKSPACES_PER_USER = int(os.getenv("MAX_WORKSPACES_PER_USER", "10"))
MAX_PMIDS_PER_INGEST = int(os.getenv("MAX_PMIDS_PER_INGEST", "10"))
MAX_DISCOVER_RESULTS = int(os.getenv("MAX_DISCOVER_RESULTS", "50"))
DISCOVER_FETCH_PER_SOURCE = int(os.getenv("DISCOVER_FETCH_PER_SOURCE", "75"))
OPENALEX_ENABLED = os.getenv("OPENALEX_ENABLED", "true").lower() in ("1", "true", "yes")
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_BYTES", str(5 * 1024 * 1024)))
MAX_TEXT_QUERY_LEN = int(os.getenv("MAX_TEXT_QUERY_LEN", "4000"))
MAX_STUDY_PLAN_LEN = int(os.getenv("MAX_STUDY_PLAN_LEN", "20000"))
MAX_AGENT_STEPS = int(os.getenv("MAX_AGENT_STEPS", "5"))
AGENT_TOKEN_BUDGET = int(os.getenv("AGENT_TOKEN_BUDGET", "8000"))
AGENT_TOOL_TIMEOUT_SEC = int(os.getenv("AGENT_TOOL_TIMEOUT_SEC", "45"))
AGENT_SESSION_DAYS = int(os.getenv("AGENT_SESSION_DAYS", "30"))

RATE_LIMIT_CHAT_PER_HOUR = int(os.getenv("RATE_LIMIT_CHAT_PER_HOUR", "30"))
RATE_LIMIT_AGENT_PER_HOUR = int(os.getenv("RATE_LIMIT_AGENT_PER_HOUR", "15"))
RATE_LIMIT_INGEST_PER_HOUR = int(os.getenv("RATE_LIMIT_INGEST_PER_HOUR", "20"))
RATE_LIMIT_DISCOVER_PER_HOUR = int(os.getenv("RATE_LIMIT_DISCOVER_PER_HOUR", "20"))
RATE_LIMIT_WORKFLOW_PER_HOUR = int(os.getenv("RATE_LIMIT_WORKFLOW_PER_HOUR", "15"))
MAX_LLM_TOKENS_PER_DAY = int(os.getenv("MAX_LLM_TOKENS_PER_DAY", "200000"))
PHI_ID_PATTERNS = os.getenv("PHI_ID_PATTERNS", "")
JOB_TOKEN = os.getenv("JOB_TOKEN", "")

# Structured extraction (Phase 2B)
EXTRACTION_BATCH_SIZE = int(os.getenv("EXTRACTION_BATCH_SIZE", "2"))
MAX_EXTRACTION_TEXT_LEN = int(os.getenv("MAX_EXTRACTION_TEXT_LEN", "12000"))
EXTRACTION_MODULES = [
    m.strip()
    for m in os.getenv("EXTRACTION_MODULES", "core,outcomes").split(",")
    if m.strip()
]

# When false on Render, /health returns minimal status (no LLM/limits detail).
PUBLIC_HEALTH_DETAIL = os.getenv("PUBLIC_HEALTH_DETAIL", "false").lower() in ("1", "true", "yes")

# Swagger / OpenAPI. Default off when AUTH_REQUIRED (Render). Local solo keeps /docs.
_expose_docs_raw = os.getenv("EXPOSE_API_DOCS")
if _expose_docs_raw is None or not _expose_docs_raw.strip():
    EXPOSE_API_DOCS = not AUTH_REQUIRED
else:
    EXPOSE_API_DOCS = _expose_docs_raw.lower() in ("1", "true", "yes")


def qdrant_https_requires_key(url: str | None = None, api_key: str | None = None) -> bool:
    host = (url if url is not None else QDRANT_URL or "").strip().lower()
    key = api_key if api_key is not None else QDRANT_API_KEY
    if not host.startswith("https://"):
        return False
    if "localhost" in host or "127.0.0.1" in host:
        return False
    return not bool(key)

GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
GITHUB_OAUTH_CALLBACK_URL = os.getenv(
    "GITHUB_OAUTH_CALLBACK_URL",
    f"http://localhost:{PORT}/auth/github/callback",
)
GITHUB_OAUTH_REDIRECT_WEB = os.getenv("GITHUB_OAUTH_REDIRECT_WEB", "http://localhost:3000/dashboard")
GITHUB_SYNC_MAX_BYTES = int(os.getenv("GITHUB_SYNC_MAX_BYTES", str(512 * 1024)))
