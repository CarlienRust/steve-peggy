from contextlib import asynccontextmanager, suppress
import asyncio
import logging
import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import ResponseValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import config

logger = logging.getLogger(__name__)
from core.http.cors import cors_headers_for_request
from core.llm.provider import LLMProviderError
from core.store.catalog import init_catalog
from core.store.qdrant_store import ensure_collections, get_client
from routers import (
    account_router,
    agent_router,
    calendar_router,
    chat_router,
    corpus_router,
    extractions_router,
    feedback_router,
    github_router,
    ingest_router,
    jobs_router,
    lab_book_router,
    limits_router,
    profile_router,
    setup_router,
    workflow_router,
    workspace_router,
)


async def _warm_up_services() -> None:
    try:
        from core.store.qdrant_store import ensure_payload_indexes

        await asyncio.wait_for(asyncio.to_thread(ensure_collections), timeout=20)
        await asyncio.wait_for(asyncio.to_thread(ensure_payload_indexes), timeout=20)
        from core.store.qdrant_store import _init_embedder, embedding_mode

        _init_embedder()
        print(f"[Peggy] Qdrant ready at {config.QDRANT_URL}")
        print(f"[Peggy] Embeddings: {embedding_mode()}")
        from core.limits import limits_snapshot

        print(f"[Peggy] Tier limits: {limits_snapshot()}")
        from core.llm.health import is_llm_configured

        print(f"[Peggy] LLM: {config.LLM_PROVIDER} (configured: {is_llm_configured()})")
    except Exception as e:
        print(f"[startup] Qdrant/embedder not ready: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if config.qdrant_https_requires_key():
        raise RuntimeError("QDRANT_API_KEY is required when QDRANT_URL is HTTPS (Qdrant Cloud).")
    print(f"[Peggy] CORS origins: {config.CORS_ORIGINS}")
    try:
        await asyncio.wait_for(init_catalog(), timeout=20)
        print("[Peggy] Catalog ready")
    except Exception as e:
        print(f"[startup] Catalog init failed: {e}")
    warm_task = asyncio.create_task(_warm_up_services())
    yield
    warm_task.cancel()
    with suppress(asyncio.CancelledError):
        await warm_task


_docs = "/docs" if config.EXPOSE_API_DOCS else None
app = FastAPI(
    title="Peggy Research Assistant API",
    version="2.0.0",
    lifespan=lifespan,
    docs_url=_docs,
    redoc_url="/redoc" if _docs else None,
    openapi_url="/openapi.json" if _docs else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    # Wildcard headers break credentialed preflight (browser gets 400, no Allow-Origin).
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"],
    expose_headers=["Content-Disposition"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    headers = dict(exc.headers or {})
    headers.update(cors_headers_for_request(request))
    detail = exc.detail
    return JSONResponse(status_code=exc.status_code, content={"detail": detail}, headers=headers)


@app.exception_handler(LLMProviderError)
async def llm_provider_error_handler(request: Request, exc: LLMProviderError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message},
        headers=cors_headers_for_request(request),
    )


@app.exception_handler(ResponseValidationError)
async def response_validation_handler(request: Request, exc: ResponseValidationError) -> JSONResponse:
    logger.error("Response validation failed on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers=cors_headers_for_request(request),
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
        headers=cors_headers_for_request(request),
    )


app.include_router(limits_router.router)
app.include_router(account_router.router)
app.include_router(ingest_router.router)
app.include_router(ingest_router.discover_router)
app.include_router(agent_router.router)
app.include_router(chat_router.router)
app.include_router(workflow_router.router)
app.include_router(corpus_router.router)
app.include_router(feedback_router.router)
app.include_router(profile_router.router)
app.include_router(workspace_router.router)
app.include_router(extractions_router.router)
app.include_router(extractions_router.workspace_router)
app.include_router(github_router.router)
app.include_router(setup_router.router)
app.include_router(calendar_router.router)
app.include_router(lab_book_router.router)
app.include_router(jobs_router.router)


@app.get("/health")
async def health():
    qdrant_ok = False
    try:
        get_client().get_collections()
        qdrant_ok = True
    except Exception:
        pass

    minimal = bool(os.getenv("RENDER")) and not config.PUBLIC_HEALTH_DETAIL
    if minimal:
        return {"status": "ok", "qdrant": qdrant_ok}

    from core.llm.health import is_llm_configured, is_llm_reachable, ollama_reachable
    from core.store.qdrant_store import embedding_mode
    from core.limits import limits_snapshot

    llm_configured = is_llm_configured()
    llm_reachable = await is_llm_reachable()
    ollama_ok = await ollama_reachable() if config.LLM_PROVIDER == "ollama" else None

    db_ok = bool(config.DATABASE_URL) or bool(config.SQLITE_DB)
    storage_ok = bool(config.SUPABASE_URL and config.SUPABASE_SERVICE_ROLE_KEY) or True
    return {
        "status": "ok",
        "qdrant": qdrant_ok,
        "database": db_ok,
        "storage": storage_ok,
        "llm_provider": config.LLM_PROVIDER,
        "gemini_tier": config.GEMINI_TIER,
        "llm_configured": llm_configured,
        "llm_reachable": llm_reachable,
        "ollama_reachable": ollama_ok,
        "embeddings": embedding_mode(),
        "embedding_backend": config.EMBEDDING_BACKEND,
        "limits": limits_snapshot(),
    }
