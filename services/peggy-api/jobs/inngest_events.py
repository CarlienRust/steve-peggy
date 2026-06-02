"""Inngest integration stub.

When INNGEST_EVENT_KEY is set, wire these event names to Inngest functions:
  - peggy/ingest.requested  -> run_ingest_job
  - peggy/feedback.approved -> re-embed correction into Qdrant

Local dev uses FastAPI BackgroundTasks (see routers/ingest_router.py).
"""

EVENT_INGEST = "peggy/ingest.requested"
EVENT_FEEDBACK_APPROVED = "pegy/feedback.approved"
