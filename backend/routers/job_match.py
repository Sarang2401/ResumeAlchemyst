"""Router: POST /match-job — Job Description vs Resume matching."""

from fastapi import APIRouter, HTTPException
import structlog
import json
import re
from html.parser import HTMLParser
import httpx

from schemas.job_match import (
    JobMatchRequest,
    JobMatchResponse,
    SkillGap,
    ExtractJDUrlRequest,
    ExtractJDUrlResponse,
)
from memory.session_store import store
from tools.skill_matcher import match_skills, extract_skills_from_jd
from services.llm_service import call_llm, parse_llm_json
from services.guardrails import validate_and_fix
from prompts.system_prompt import JOB_MATCH_PROMPT

logger = structlog.get_logger(__name__)
router = APIRouter()


class MLStripper(HTMLParser):
    def __init__(self):
        super().__init__()
        self.reset()
        self.strict = False
        self.convert_charrefs = True
        self.text = []
    def handle_data(self, d):
        self.text.append(d)
    def get_data(self):
        return "".join(self.text)


def strip_tags(html: str) -> str:
    # Remove script and style tags completely
    html = re.sub(r"<(script|style)\b[^>]*>([\s\S]*?)<\/\1>", "", html, flags=re.IGNORECASE)
    # Remove HTML comments
    html = re.sub(r"<!--[\s\S]*?-->", "", html)
    # Strip remaining tags
    s = MLStripper()
    s.feed(html)
    text = s.get_data()
    # Normalize whitespaces
    text = re.sub(r"\s+", " ", text).strip()
    return text


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


@router.post("/match-job/extract-url", response_model=ExtractJDUrlResponse)
async def extract_jd_from_url(request: ExtractJDUrlRequest):
    url = request.url.strip()
    if not url:
        raise HTTPException(status_code=400, detail="URL cannot be empty.")
    
    # Simple block for LinkedIn to fail fast and nudge bookmarklet
    if "linkedin.com" in url.lower():
        raise HTTPException(
            status_code=403,
            detail="LinkedIn actively blocks automated scrapers. Please use our simple Chrome Extension/Bookmarklet helper on this page to import this job instantly!"
        )
        
    logger.info("extract_jd_url_start", url=url)
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
    }
    
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=12.0) as client:
            res = await client.get(url, headers=headers)
            if res.status_code != 200:
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to load job page. Host returned status code {res.status_code}. You can copy-paste the JD manually or use the browser Bookmarklet scraper."
                )
            html_content = res.text
    except Exception as e:
        logger.error("extract_jd_url_fetch_failed", url=url, error=str(e))
        raise HTTPException(
            status_code=400,
            detail=f"Unable to reach the job page URL. Please make sure the URL is valid, or use our Bookmarklet scraper/manual copy-paste as a fallback."
        )

    # Strip HTML to isolate text
    try:
        raw_text = strip_tags(html_content)
    except Exception as e:
        logger.error("extract_jd_url_strip_failed", error=str(e))
        raw_text = html_content

    sample_text = raw_text[:6000]

    system_prompt = (
        "You are an expert technical recruiter and resume intelligence parser. "
        "Your task is to analyze the raw, scraped web page content of a job posting and extract "
        "the official Job Title and the actual Job Description. "
        "Ignore all headers, footers, related jobs, sidebars, cookie banners, navigation links, and company boilerplate. "
        "Focus strictly on the role description, key responsibilities, requirements, and desired skills. "
        "Respond in valid JSON format only, matching the exact keys: 'job_title' and 'job_description'."
    )

    user_message = (
        f"Here is the raw text extracted from the job posting webpage:\n\n"
        f"--- START PAGE CONTENT ---\n"
        f"{sample_text}\n"
        f"--- END PAGE CONTENT ---\n\n"
        f"Please extract the job title and core job description. The 'job_description' field should be a clean, readable text description with markdown bullets where appropriate."
    )

    try:
        raw_llm = await call_llm(
            system_prompt=system_prompt,
            messages=[{"role": "user", "content": user_message}],
            temperature=0.1,
            expect_json=True,
        )
        data = parse_llm_json(raw_llm)
    except Exception as e:
        logger.error("extract_jd_url_llm_failed", error=str(e))
        raise HTTPException(
            status_code=500,
            detail="AI model failed to extract the job details from the webpage. Please copy-paste the job description manually."
        )

    job_title = data.get("job_title", "").strip() or "Imported Job Position"
    job_description = data.get("job_description", "").strip()

    if not job_description:
         raise HTTPException(
            status_code=400,
            detail="AI was unable to find a clear job description on that page. Please copy-paste the details manually or try another URL."
         )

    logger.info("extract_jd_url_success", url=url, title=job_title)
    return ExtractJDUrlResponse(job_title=job_title, job_description=job_description)

