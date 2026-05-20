"""
Tool 2: Skill Matcher
Checks if required skills exist in a resume.
Returns: matched skills, missing skills, partial matches, confidence score.
"""

import re
from difflib import SequenceMatcher
from dataclasses import dataclass, field

import structlog

logger = structlog.get_logger(__name__)

# ─── Skill Aliases / Synonyms ─────────────────────────────────────────────────
SKILL_ALIASES: dict[str, list[str]] = {
    "javascript": ["js", "es6", "es2015", "ecmascript", "node.js", "nodejs"],
    "typescript": ["ts"],
    "python": ["py"],
    "react": ["reactjs", "react.js"],
    "next.js": ["nextjs", "next js"],
    "vue": ["vuejs", "vue.js"],
    "angular": ["angularjs"],
    "postgresql": ["postgres", "psql"],
    "mongodb": ["mongo"],
    "kubernetes": ["k8s"],
    "machine learning": ["ml", "deep learning", "dl"],
    "artificial intelligence": ["ai"],
    "natural language processing": ["nlp"],
    "large language model": ["llm", "llms"],
    "retrieval augmented generation": ["rag"],
    "continuous integration": ["ci", "ci/cd", "cicd"],
    "amazon web services": ["aws"],
    "google cloud platform": ["gcp"],
    "microsoft azure": ["azure"],
    "restful api": ["rest", "rest api", "restful"],
    "graphql": ["gql"],
}

# Reverse alias map: alias → canonical
ALIAS_REVERSE: dict[str, str] = {}
for canonical, aliases in SKILL_ALIASES.items():
    for alias in aliases:
        ALIAS_REVERSE[alias.lower()] = canonical
    ALIAS_REVERSE[canonical.lower()] = canonical


@dataclass
class SkillMatchResult:
    matched: list[str] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)
    partial: list[str] = field(default_factory=list)
    confidence: float = 0.0
    match_rate: float = 0.0
    details: dict = field(default_factory=dict)


def normalize_skill(skill: str) -> str:
    """Normalize a skill string to lowercase canonical form."""
    lowered = skill.lower().strip()
    return ALIAS_REVERSE.get(lowered, lowered)


def fuzzy_similarity(a: str, b: str) -> float:
    """Return similarity ratio between two strings."""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()


def skill_in_resume(required_skill: str, resume_skills: list[str], raw_text: str = "") -> tuple[bool, bool, float]:
    """
    Check if a required skill exists in resume skills or raw text.
    Returns: (exact_match, partial_match, similarity_score)
    """
    req_norm = normalize_skill(required_skill)
    req_lower = required_skill.lower()

    # Check against normalized resume skills
    for skill in resume_skills:
        skill_norm = normalize_skill(skill)
        if req_norm == skill_norm:
            return True, False, 1.0

        # Fuzzy match
        sim = fuzzy_similarity(req_norm, skill_norm)
        if sim > 0.85:
            return True, False, sim

        # Partial / substring match
        if req_norm in skill_norm or skill_norm in req_norm:
            return False, True, 0.7

    # Search in raw text (handles cases where skill is in description but not in skills list)
    if raw_text:
        raw_lower = raw_text.lower()
        if re.search(r"\b" + re.escape(req_lower) + r"\b", raw_lower):
            return False, True, 0.6

        # Check aliases in raw text
        aliases = SKILL_ALIASES.get(req_norm, [])
        for alias in aliases:
            if re.search(r"\b" + re.escape(alias.lower()) + r"\b", raw_lower):
                return False, True, 0.6

    return False, False, 0.0


def match_skills(
    required_skills: list[str],
    resume_skills: list[str],
    raw_text: str = "",
) -> SkillMatchResult:
    """
    Core skill matching function.
    Compares required skills list against resume skills + raw text.
    """
    if not required_skills:
        return SkillMatchResult(confidence=1.0, match_rate=1.0)

    result = SkillMatchResult()
    skill_details = {}

    for req_skill in required_skills:
        exact, partial, score = skill_in_resume(req_skill, resume_skills, raw_text)

        skill_details[req_skill] = {
            "exact_match": exact,
            "partial_match": partial,
            "similarity_score": round(score, 3),
        }

        if exact:
            result.matched.append(req_skill)
        elif partial:
            result.partial.append(req_skill)
        else:
            result.missing.append(req_skill)

    # Compute match rate: exact=1.0 point, partial=0.5 points
    total = len(required_skills)
    score_sum = len(result.matched) * 1.0 + len(result.partial) * 0.5
    result.match_rate = round(score_sum / total, 3) if total > 0 else 0.0

    # Confidence based on data completeness
    resume_skill_count = len(resume_skills)
    if resume_skill_count == 0:
        result.confidence = 0.3  # Low confidence if no skills extracted
    elif resume_skill_count < 5:
        result.confidence = 0.6
    else:
        result.confidence = 0.9

    result.details = skill_details

    logger.info(
        "skill_match_complete",
        required=len(required_skills),
        matched=len(result.matched),
        partial=len(result.partial),
        missing=len(result.missing),
        match_rate=result.match_rate,
    )
    return result


def extract_skills_from_jd(jd_text: str) -> list[str]:
    """
    Extract required skills from a job description text.
    Used before calling match_skills for JD matching flow.
    """
    from tools.keyword_extractor import extract_keywords

    result = extract_keywords(jd_text)
    return result.get("technologies", []) + result.get("tools", [])
