from __future__ import annotations

from fastapi import APIRouter

import config
from core.llm.health import is_llm_configured, is_llm_reachable, ollama_reachable
from core.store.qdrant_store import embedding_mode, get_client

router = APIRouter(prefix="/setup", tags=["setup"])


@router.get("/checks")
async def setup_checks():
    """Return deterministic setup checks with copy/paste fix commands (Figma /setup)."""
    checks: list[dict] = []

    # 1) Qdrant reachable
    qdrant_ok = False
    qdrant_detail = ""
    try:
        get_client().get_collections()
        qdrant_ok = True
    except Exception as exc:
        qdrant_detail = str(exc)[:300]
    checks.append(
        {
            "id": "qdrant",
            "label": "Qdrant reachable",
            "status": "ok" if qdrant_ok else "error",
            "detail": qdrant_detail or ("ok" if qdrant_ok else "Could not connect to Qdrant"),
            "fixCommand": "./scripts/start-qdrant.sh",
        }
    )

    # 2) LLM configured
    llm_conf = is_llm_configured()
    checks.append(
        {
            "id": "llm_configured",
            "label": f"LLM configured ({config.LLM_PROVIDER})",
            "status": "ok" if llm_conf else "error",
            "detail": "ok" if llm_conf else "Missing LLM configuration (see services/peggy-api/.env)",
            "fixCommand": "cd services/peggy-api && cp .env.example .env && $EDITOR .env",
        }
    )

    # 3) LLM reachable
    llm_ok = await is_llm_reachable()
    checks.append(
        {
            "id": "llm_reachable",
            "label": f"LLM reachable ({config.LLM_PROVIDER})",
            "status": "ok" if llm_ok else "error",
            "detail": "ok" if llm_ok else "LLM provider not reachable from API",
            "fixCommand": "./scripts/start-local.sh",
        }
    )

    # 4) Ollama reachable (only when provider=ollama)
    if config.LLM_PROVIDER == "ollama":
        ok = await ollama_reachable()
        checks.append(
            {
                "id": "ollama",
                "label": "Ollama reachable",
                "status": "ok" if ok else "error",
                "detail": "ok" if ok else "Ollama is not responding on the configured URL",
                "fixCommand": "ollama serve",
            }
        )
    else:
        checks.append(
            {
                "id": "ollama",
                "label": "Ollama reachable",
                "status": "skip",
                "detail": f"Skipped (LLM_PROVIDER={config.LLM_PROVIDER})",
                "fixCommand": "",
            }
        )

    # 5) Embeddings mode initialized
    mode = embedding_mode()
    emb_ok = mode not in ("uninitialized", "unknown", "")
    checks.append(
        {
            "id": "embeddings",
            "label": "Embeddings initialized",
            "status": "ok" if emb_ok else "error",
            "detail": f"mode={mode}",
            "fixCommand": "./scripts/start-local.sh",
        }
    )

    # 6) Database schema (when using Postgres)
    if config.DATABASE_URL:
        detail = ""
        ok = False
        try:
            from core.store.pg_catalog import _pool_conn

            pool = await _pool_conn()
            async with pool.acquire() as conn:
                # presence checks for key migrations used by the Figma-aligned UI
                obj_hist = await conn.fetchval("SELECT to_regclass('public.objective_history') IS NOT NULL AS ok")
                papers_journal = await conn.fetchval(
                    """
                    SELECT EXISTS (
                      SELECT 1 FROM information_schema.columns
                      WHERE table_name = 'papers' AND column_name = 'journal'
                    ) AS ok
                    """
                )
                papers_screening = await conn.fetchval(
                    """
                    SELECT EXISTS (
                      SELECT 1 FROM information_schema.columns
                      WHERE table_name = 'papers' AND column_name = 'screening_status'
                    ) AS ok
                    """
                )
                ws_fields = await conn.fetchval(
                    """
                    SELECT EXISTS (
                      SELECT 1 FROM information_schema.columns
                      WHERE table_name = 'workspaces' AND column_name = 'privacy_mode'
                    ) AS ok
                    """
                )
                ok = bool(obj_hist and papers_journal and papers_screening and ws_fields)
                if not ok:
                    detail = (
                        f"objective_history={bool(obj_hist)}, "
                        f"papers.journal={bool(papers_journal)}, "
                        f"papers.screening_status={bool(papers_screening)}, "
                        f"workspaces.privacy_mode={bool(ws_fields)}"
                    )
        except Exception as exc:
            detail = str(exc)[:300]
        checks.append(
            {
                "id": "db_schema",
                "label": "Postgres migrations applied",
                "status": "ok" if ok else "error",
                "detail": detail or ("ok" if ok else "Missing one or more required migrations"),
                "fixCommand": "Apply SQL migrations in services/peggy-api/migrations (Supabase SQL editor)",
            }
        )
    else:
        checks.append(
            {
                "id": "db_schema",
                "label": "Database schema",
                "status": "ok",
                "detail": "Using SQLite (local mode); schema auto-migrates on startup",
                "fixCommand": "",
            }
        )

    return {"checks": checks, "count": len(checks)}

