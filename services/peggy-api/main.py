from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from qdrant_client import QdrantClient

import config
from core.store.catalog import init_catalog
from core.store.qdrant_store import ensure_collections
from routers import chat_router, corpus_router, feedback_router, ingest_router, workflow_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_catalog()
    try:
        ensure_collections()
        from core.store.qdrant_store import _init_embedder, embedding_mode
        _init_embedder()
        print(f"[Peggy] Qdrant ready at {config.QDRANT_URL}")
        print(f"[Peggy] Embeddings: {embedding_mode()}")
        print(f"[Peggy] LLM: {config.LLM_PROVIDER} (key set: {bool(config.OPENAI_API_KEY or config.ANTHROPIC_API_KEY)})")
    except Exception as e:
        print(f"[startup] Qdrant/embedder not ready: {e}")
    yield


app = FastAPI(title="Peggy Research Assistant API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest_router.router)
app.include_router(chat_router.router)
app.include_router(workflow_router.router)
app.include_router(corpus_router.router)
app.include_router(feedback_router.router)


@app.get("/health")
async def health():
    qdrant_ok = False
    try:
        QdrantClient(url=config.QDRANT_URL).get_collections()
        qdrant_ok = True
    except Exception:
        pass
    from core.store.qdrant_store import embedding_mode
    llm_configured = bool(
        (config.LLM_PROVIDER == "openai" and config.OPENAI_API_KEY)
        or (config.LLM_PROVIDER == "anthropic" and config.ANTHROPIC_API_KEY)
        or config.LLM_PROVIDER == "ollama"
    )
    return {
        "status": "ok",
        "qdrant": qdrant_ok,
        "llm_provider": config.LLM_PROVIDER,
        "llm_configured": llm_configured,
        "embeddings": embedding_mode(),
    }
