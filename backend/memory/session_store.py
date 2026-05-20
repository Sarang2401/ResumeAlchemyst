"""
Session Store — In-memory session management.
Stores parsed resume, chat history, and inferred intent per session.
Sessions expire after 30 minutes of inactivity.
"""

import time
import uuid
from dataclasses import dataclass, field
from typing import Optional
import structlog

from schemas.resume import ResumeSchema
from schemas.chat import MessageHistory

logger = structlog.get_logger(__name__)

SESSION_TTL_SECONDS = 1800  # 30 minutes


@dataclass
class Session:
    session_id: str
    created_at: float = field(default_factory=time.time)
    last_accessed: float = field(default_factory=time.time)
    resume: Optional[ResumeSchema] = None
    chat_history: list[MessageHistory] = field(default_factory=list)
    inferred_intents: list[str] = field(default_factory=list)
    metadata: dict = field(default_factory=dict)

    def touch(self):
        self.last_accessed = time.time()

    def is_expired(self) -> bool:
        return (time.time() - self.last_accessed) > SESSION_TTL_SECONDS

    def add_message(self, role: str, content: str, metadata: Optional[dict] = None):
        self.chat_history.append(
            MessageHistory(role=role, content=content, metadata=metadata)
        )
        # Keep last 20 messages to manage context window
        if len(self.chat_history) > 20:
            self.chat_history = self.chat_history[-20:]
        self.touch()

    def get_history_for_prompt(self) -> list[dict]:
        """Format chat history for LLM prompt."""
        return [
            {"role": msg.role, "content": msg.content}
            for msg in self.chat_history
        ]


class SessionStore:
    def __init__(self):
        self._store: dict[str, Session] = {}

    def create(self) -> Session:
        session_id = str(uuid.uuid4())
        session = Session(session_id=session_id)
        self._store[session_id] = session
        logger.info("session_created", session_id=session_id)
        return session

    def get(self, session_id: str) -> Optional[Session]:
        session = self._store.get(session_id)
        if session is None:
            return None
        if session.is_expired():
            self.delete(session_id)
            logger.info("session_expired", session_id=session_id)
            return None
        session.touch()
        return session

    def get_or_create(self, session_id: Optional[str] = None) -> Session:
        if session_id:
            session = self.get(session_id)
            if session:
                return session
        return self.create()

    def delete(self, session_id: str):
        self._store.pop(session_id, None)
        logger.info("session_deleted", session_id=session_id)

    def cleanup_expired(self):
        """Remove all expired sessions."""
        expired = [sid for sid, s in self._store.items() if s.is_expired()]
        for sid in expired:
            self.delete(sid)
        if expired:
            logger.info("sessions_cleaned", count=len(expired))

    def stats(self) -> dict:
        return {
            "total_sessions": len(self._store),
            "active_sessions": sum(1 for s in self._store.values() if not s.is_expired()),
        }


# Global singleton store
store = SessionStore()
