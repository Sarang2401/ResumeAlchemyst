"""Router: POST /match-job — Job Description vs Resume matching."""

from fastapi import APIRouter, HTTPException
import structlog
import json

from schemas.job_match import JobMatchRequest, JobMatchResponse, SkillGap
from memory.session_store import store
from tools.skill_matcher import match_skills, extract_skills_from_jd
from services.llm_service import call_llm, parse_llm_json
from services.guardrails import validate_and_fix
from prompts.system_prompt import JOB_MATCH_PROMPT

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.post("/match-job", response_model=JobMatchResponse)
async def match_job(request: JobMatchRequest):
    if not request.job_description.strip():
        raise HTTPException(status_code=400, detail="Job description cannot be empty.")

    session = store.get(request.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found. Upload a resume first.")

    if not session.resume:
        raise HTTPException(status_code=400, detail="No resume found in session.")

    resume = session.resume

    # Step 1: Extract required skills from JD
    jd_skills = extract_skills_from_jd(request.job_description)
    logger.info("jd_skills_extracted", count=len(jd_skills), skills=jd_skills[:10])

    # Step 2: Run skill matcher
    match_result = match_skills(jd_skills, resume.skills, resume.raw_text)

    skill_gap = SkillGap(
        matched=match_result.matched,
        missing=match_result.missing,
        partial=match_result.partial,
    )

    # Step 3: LLM generates narrative summary and recommendations
    resume_dict = resume.model_dump(exclude={"raw_text"})
    skill_gap_dict = {
        "matched": match_result.matched,
        "missing": match_result.missing,
        "partial": match_result.partial,
        "match_rate": match_result.match_rate,
    }

    prompt = JOB_MATCH_PROMPT.format(
        resume_json=json.dumps(resume_dict, indent=2),
        skill_gap_json=json.dumps(skill_gap_dict, indent=2),
        job_description=request.job_description[:2000],
    )

    try:
        raw = await call_llm(
            system_prompt="You are a senior technical recruiter. Respond with valid JSON only.",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            expect_json=True,
        )
        llm_output = parse_llm_json(raw)
    except Exception as e:
        logger.error("job_match_llm_failed", error=str(e))
        llm_output = {
            "fit_score": round(match_result.match_rate * 100, 1),
            "summary": f"Skill match rate: {match_result.match_rate * 100:.0f}%.",
            "recommendations": ["Review missing skills listed above."],
            "confidence": match_result.confidence,
        }

    # Compute final fit score (blend of tool result + LLM score)
    tool_score = match_result.match_rate * 100
    llm_score = float(llm_output.get("fit_score", tool_score))
    final_score = round((tool_score * 0.6 + llm_score * 0.4), 1)

    logger.info(
        "job_match_complete",
        session=request.session_id,
        fit_score=final_score,
        matched=len(match_result.matched),
        missing=len(match_result.missing),
    )

    return JobMatchResponse(
        fit_score=min(100.0, max(0.0, final_score)),
        skill_gap=skill_gap,
        recommendations=llm_output.get("recommendations", []),
        summary=llm_output.get("summary", ""),
        confidence=float(llm_output.get("confidence", match_result.confidence)),
        session_id=request.session_id,
    )
