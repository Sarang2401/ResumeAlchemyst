from pydantic import BaseModel
from typing import Optional, Literal


class ChatRequest(BaseModel):
    session_id: str
    message: str
    stream: bool = False


class ToolCall(BaseModel):
    tool_name: str
    tool_input: dict
    tool_output: dict


class ChatResponse(BaseModel):
    answer: str
    confidence: float
    source: Literal["resume", "inference", "insufficient"]
    missing_data: list[str] = []
    tools_used: list[str] = []
    session_id: str


class MessageHistory(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    metadata: Optional[dict] = None
