from fastapi import APIRouter, Depends
from pydantic import BaseModel

from core.auth.deps import AuthUser, get_current_user
from core.store import catalog

router = APIRouter(tags=["feedback"])


class FeedbackRequest(BaseModel):
    query: str
    response: str
    correction: str


@router.post("/feedback")
async def submit_feedback(body: FeedbackRequest, user: AuthUser = Depends(get_current_user)):
    await catalog.enqueue_feedback(user.id, body.query, body.response, body.correction)
    return {"status": "queued", "message": "Feedback saved for review (Inngest re-ingest when approved)"}
