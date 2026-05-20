"""Router: POST /chat"""

from fastapi import APIRouter, HTTPException
import structlog

from schemas.chat import ChatRequest, ChatResponse
from agents.controller import orchestrate
from memory.session_store import store

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    session = store.get(request.session_id)
    if not session:
        raise HTTPException(
            status_code=404,
            detail="Session not found or expired. Please upload a resume first.",
        )

    # Add user message to history
    session.add_message("user", request.message)

    # Run agent pipeline
    try:
        response = await orchestrate(request.message, session)
    except Exception as e:
        logger.error("chat_orchestration_error", error=str(e), session=request.session_id)
        raise HTTPException(status_code=500, detail="Agent processing failed.")

    # Store assistant response in history
    session.add_message(
        "assistant",
        response.answer,
        metadata={
            "confidence": response.confidence,
            "source": response.source,
            "tools_used": response.tools_used,
        },
    )

    logger.info(
        "chat_complete",
        session=request.session_id,
        confidence=response.confidence,
        source=response.source,
    )
    return response
