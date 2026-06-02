from fastapi import APIRouter
from pydantic import BaseModel

from core.store import catalog

router = APIRouter(tags=["feedback"])


class FeedbackRequest(BaseModel):
    client_id: str = "default"
    query: str
    response: str
    correction: str


@router.post("/feedback")
async def submit_feedback(body: FeedbackRequest):
    await catalog.enqueue_feedback(body.client_id, body.query, body.response, body.correction)
    return {"status": "queued", "message": "Feedback saved for review (Inngest re-ingest when approved)"}
