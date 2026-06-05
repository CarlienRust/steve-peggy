import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent

# Load services/peggy-api/.env when running outside Docker
load_dotenv(BASE_DIR / ".env")
# Load repo root .env (docker compose secrets) when present
load_dotenv(BASE_DIR.parent.parent / ".env")

QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
VECTOR_SIZE = 384

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-3-5-haiku-latest")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")

SQLITE_DB = os.getenv("SQLITE_DB", str(BASE_DIR / "data" / "peggy.db"))
NCBI_EMAIL = os.getenv("NCBI_EMAIL", "peggy@example.com")
NCBI_API_KEY = os.getenv("NCBI_API_KEY", "")

UPSTASH_REDIS_REST_URL = os.getenv("UPSTASH_REDIS_REST_URL", "")
UPSTASH_REDIS_REST_TOKEN = os.getenv("UPSTASH_REDIS_REST_TOKEN", "")

COLLECTION_LITERATURE = "peggy_literature"
COLLECTION_OWN_FINDINGS = "peggy_own_findings"
COLLECTION_CHAT = "chat_history_logs"

CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000,https://*.vercel.app").split(",")
