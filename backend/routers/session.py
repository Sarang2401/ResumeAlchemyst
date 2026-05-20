"""Router: GET /session/{session_id}"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import structlog

from memory.session_store import store

logger = structlog.get_logger(__name__)
router = APIRouter()


class SessionResponse(BaseModel):
    session_id: str
    has_resume: bool
    candidate_name: str
    message_count: int
    resume_summary: Optional[dict] = None


@router.get("/session/{session_id}", response_model=SessionResponse)
async def get_session(session_id: str):
    session = store.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired.")

    resume_summary = None
    if session.resume:
        resume_summary = {
            "name": session.resume.name,
            "email": session.resume.email,
            "skills_count": len(session.resume.skills),
            "experience_count": len(session.resume.experience),
            "education_count": len(session.resume.education),
            "top_skills": session.resume.skills[:10],
        }

    return SessionResponse(
        session_id=session.session_id,
        has_resume=session.resume is not None,
        candidate_name=session.resume.name if session.resume else "",
        message_count=len(session.chat_history),
        resume_summary=resume_summary,
    )


@router.delete("/session/{session_id}")
async def delete_session(session_id: str):
    session = store.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found.")
    store.delete(session_id)
    return {"message": "Session deleted successfully"}
