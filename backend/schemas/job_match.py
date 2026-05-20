from pydantic import BaseModel
from typing import Optional


class JobMatchRequest(BaseModel):
    session_id: str
    job_description: str
    job_title: Optional[str] = None


class SkillGap(BaseModel):
    matched: list[str]
    missing: list[str]
    partial: list[str]


class JobMatchResponse(BaseModel):
    fit_score: float  # 0.0 - 100.0
    skill_gap: SkillGap
    recommendations: list[str]
    summary: str
    confidence: float
    session_id: str
