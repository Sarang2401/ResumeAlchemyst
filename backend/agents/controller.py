"""
Agent Controller — Lightweight orchestration layer.
Decides: which tools to call, when to call the LLM, when data is insufficient.

Flow:
  1. classify_intent(query) → intent type
  2. select_tools(intent)   → list of tools to invoke
  3. run_tools(...)         → tool outputs
  4. build_prompt(...)      → LLM context
  5. call LLM              → raw JSON
  6. validate via guardrails → final response
"""

import json
import re
import structlog

from schemas.resume import ResumeSchema
from schemas.chat import ChatResponse
from services.llm_service import call_llm, parse_llm_json
from services.guardrails import validate_and_fix
from tools.skill_matcher import match_skills, extract_skills_from_jd
from tools.keyword_extractor import extract_keywords
from prompts.system_prompt import (
    SYSTEM_PROMPT,
    RESUME_CONTEXT_TEMPLATE,
    TOOL_CONTEXT_TEMPLATE,
    CHAT_INSTRUCTION,
)

logger = structlog.get_logger(__name__)


# ─── Intent Classification ────────────────────────────────────────────────────

INTENT_PATTERNS = {
    "skill_check": [
        r"\bknow\b", r"\bskill\b", r"\bexperience with\b", r"\bfamiliar\b",
        r"\bproficient\b", r"\bwork(ed)? with\b", r"\bused?\b", r"\btech\b",
        r"\btechnology\b", r"\bstack\b", r"\bcertif\b",
    ],
    "experience_query": [
        r"\byears?\b", r"\bexperience\b", r"\bwork(ed)?\b", r"\bemployed\b",
        r"\bjob\b", r"\bcompany\b", r"\bcompanies\b", r"\bcareer\b",
        r"\bposition\b", r"\brole\b",
    ],
    "education_query": [
        r"\bdegree\b", r"\buniversity\b", r"\bcollege\b", r"\bschool\b",
        r"\beducation\b", r"\bgpa\b", r"\bgraduate\b", r"\bstudie[ds]\b",
    ],
    "fit_assessment": [
        r"\bsuit(able|ed)?\b", r"\bgood fit\b", r"\bqualif\b", r"\bhire\b",
        r"\brecommend\b", r"\bfit\b", r"\bcandidate\b.*\brole\b",
        r"\bdevops\b", r"\bbackend\b", r"\bfrontend\b", r"\bfullstack\b",
        r"\bmissing\b",
    ],
    "summarize": [
        r"\bsummar\b", r"\boverview\b", r"\bwho is\b", r"\btell me about\b",
        r"\bdescribe\b", r"\bprofile\b",
    ],
    "contact_info": [
        r"\bemail\b", r"\bphone\b", r"\bcontact\b", r"\blocated?\b",
        r"\blocation\b", r"\baddress\b",
    ],
    "project_query": [
        r"\bproject\b", r"\bbuilt\b", r"\bcreated?\b", r"\bdeveloped?\b",
        r"\bportfolio\b",
    ],
}


def classify_intent(query: str) -> str:
    """
    Classify the user's query into one of the intent types.
    Uses regex pattern matching — no LLM call needed for this step.
    """
    query_lower = query.lower()

    scores: dict[str, int] = {}
    for intent, patterns in INTENT_PATTERNS.items():
        score = sum(1 for p in patterns if re.search(p, query_lower))
        if score > 0:
            scores[intent] = score

    if not scores:
        return "general"

    # Return highest-scoring intent; tie-break: prefer fit_assessment > skill_check > experience_query
    priority_order = ["fit_assessment", "skill_check", "experience_query", "summarize",
                      "education_query", "project_query", "contact_info", "general"]
    top_score = max(scores.values())
    for intent in priority_order:
        if scores.get(intent, 0) == top_score:
            return intent

    return max(scores, key=scores.get)


# ─── Tool Selection ───────────────────────────────────────────────────────────

INTENT_TO_TOOLS = {
    "skill_check": ["skill_matcher", "keyword_extractor"],
    "fit_assessment": ["skill_matcher", "keyword_extractor"],
    "experience_query": ["keyword_extractor"],
    "summarize": [],  # LLM handles with resume context only
    "education_query": [],
    "project_query": [],
    "contact_info": [],
    "general": [],
}


def select_tools(intent: str) -> list[str]:
    return INTENT_TO_TOOLS.get(intent, [])


# ─── Tool Execution ───────────────────────────────────────────────────────────

async def run_tools(
    tools: list[str],
    query: str,
    resume: ResumeSchema,
) -> tuple[list[str], dict]:
    """
    Execute selected tools and return (tool_names_used, combined_context).
    """
    tool_outputs: dict[str, dict] = {}
    tools_used: list[str] = []

    for tool_name in tools:
        try:
            if tool_name == "skill_matcher":
                # Extract required skills from query
                required = _extract_required_skills_from_query(query, resume)
                if required:
                    result = match_skills(required, resume.skills, resume.raw_text)
                    tool_outputs["skill_matcher"] = {
                        "matched": result.matched,
                        "missing": result.missing,
                        "partial": result.partial,
                        "match_rate": result.match_rate,
                        "confidence": result.confidence,
                    }
                    tools_used.append("skill_matcher")

            elif tool_name == "keyword_extractor":
                result = extract_keywords(resume.raw_text)
                tool_outputs["keyword_extractor"] = result
                tools_used.append("keyword_extractor")

        except Exception as e:
            logger.error("tool_execution_failed", tool=tool_name, error=str(e))

    return tools_used, tool_outputs


def _extract_required_skills_from_query(query: str, resume: ResumeSchema) -> list[str]:
    """
    Extract skill names mentioned in the user's query.
    E.g. "Does she know AWS?" → ["AWS"]
    """
    from tools.keyword_extractor import extract_keywords
    extracted = extract_keywords(query)
    skills = extracted.get("technologies", []) + extracted.get("tools", [])

    # Also try simple noun extraction for unlisted skills
    common_stopwords = {"does", "this", "the", "is", "are", "was", "were", "has",
                        "have", "had", "know", "knows", "candidate", "person", "he",
                        "she", "they", "their", "resume", "experience", "years"}
    words = query.split()
    for word in words:
        cleaned = re.sub(r"[^a-zA-Z0-9.#+]", "", word)
        if len(cleaned) > 1 and cleaned.lower() not in common_stopwords:
            if cleaned not in skills:
                skills.append(cleaned)

    return skills[:10]  # Cap to avoid bloat


# ─── Prompt Builder ───────────────────────────────────────────────────────────

def build_prompt_messages(
    query: str,
    resume: ResumeSchema,
    tool_outputs: dict,
    history: list[dict],
) -> list[dict]:
    """Assemble the full message list for the LLM."""
    # Compact resume JSON (drop raw_text to save tokens)
    resume_dict = resume.model_dump(exclude={"raw_text"})
    resume_context = RESUME_CONTEXT_TEMPLATE.format(
        resume_json=json.dumps(resume_dict, indent=2)
    )

    # Tool outputs context
    tool_context = ""
    for tool_name, output in tool_outputs.items():
        tool_context += TOOL_CONTEXT_TEMPLATE.format(
            tool_name=tool_name,
            tool_output=json.dumps(output, indent=2),
        )

    # Build context message
    context_content = resume_context + tool_context + CHAT_INSTRUCTION.format(question=query)

    messages = []

    # Include last 4 turns of history for context (saves tokens)
    recent_history = history[-8:] if len(history) > 8 else history
    messages.extend(recent_history)

    # Add current turn context
    messages.append({"role": "user", "content": context_content})

    return messages


# ─── Main Orchestration ───────────────────────────────────────────────────────

async def orchestrate(
    query: str,
    session,
) -> ChatResponse:
    """
    Full agent pipeline for a user query.
    Returns a validated ChatResponse.
    """
    from memory.session_store import Session

    # Guard: resume must be uploaded first
    if not session.resume:
        return ChatResponse(
            answer="Please upload a resume first before asking questions.",
            confidence=1.0,
            source="resume",
            missing_data=["resume"],
            tools_used=[],
            session_id=session.session_id,
        )

    resume = session.resume
    history = session.get_history_for_prompt()

    logger.info("agent_orchestrate_start", query=query[:80], session=session.session_id)

    # Step 1: Classify intent
    intent = classify_intent(query)
    logger.info("intent_classified", intent=intent)

    # Step 2: Select tools
    tools = select_tools(intent)

    # Step 3: Run tools
    tools_used, tool_outputs = await run_tools(tools, query, resume)

    # Step 4: Build prompt
    messages = build_prompt_messages(query, resume, tool_outputs, history)

    # Step 5: Call LLM
    try:
        raw_response = await call_llm(
            system_prompt=SYSTEM_PROMPT,
            messages=messages,
            temperature=0.1,
            expect_json=True,
        )
        parsed = parse_llm_json(raw_response)
    except Exception as e:
        logger.error("llm_call_failed", error=str(e))
        parsed = {
            "answer": "I encountered an error processing your request. Please try again.",
            "confidence": 0.0,
            "source": "insufficient",
            "missing_data": [],
        }

    # Step 6: Validate via guardrails
    validated = validate_and_fix(parsed, resume.model_dump())

    logger.info(
        "agent_orchestrate_complete",
        intent=intent,
        tools_used=tools_used,
        confidence=validated["confidence"],
    )

    return ChatResponse(
        answer=validated["answer"],
        confidence=validated["confidence"],
        source=validated["source"],
        missing_data=validated.get("missing_data", []),
        tools_used=tools_used,
        session_id=session.session_id,
    )
