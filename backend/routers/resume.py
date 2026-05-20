"""Router: POST /upload-resume"""

import uuid
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse
import structlog

from tools.resume_parser import parse_resume
from memory.session_store import store
from schemas.resume import ParseResumeResponse

logger = structlog.get_logger(__name__)
router = APIRouter()

ALLOWED_TYPES = {"application/pdf", "text/plain"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


@router.post("/upload-resume", response_model=ParseResumeResponse)
async def upload_resume(
    file: UploadFile = File(...),
    session_id: str = Form(default=""),
):
    # Validate file type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}. Use PDF or plain text.",
        )

    file_bytes = await file.read()

    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 5MB.")

    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        resume = parse_resume(file_bytes, file.filename or "resume.pdf")
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        logger.error("resume_parse_error", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to parse resume.")

    # Get or create session
    session = store.get_or_create(session_id or None)
    session.resume = resume
    session.chat_history = []  # Reset history on new upload
    session.metadata["filename"] = file.filename

    logger.info(
        "resume_uploaded",
        session_id=session.session_id,
        filename=file.filename,
        name=resume.name,
    )

    return ParseResumeResponse(
        session_id=session.session_id,
        resume=resume,
        message="Resume parsed successfully",
    )
