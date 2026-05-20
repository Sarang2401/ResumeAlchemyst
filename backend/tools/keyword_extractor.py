"""
Tool 3: Keyword Extractor
Extracts technologies, domains, tools, and years-of-experience references
from resume text using regex patterns and curated vocabulary.
"""

import re
from dataclasses import dataclass, field
import structlog

logger = structlog.get_logger(__name__)

# ─── Curated Vocabularies ────────────────────────────────────────────────────
TECHNOLOGIES = {
    # Languages
    "Python", "JavaScript", "TypeScript", "Java", "C++", "C#", "Go", "Rust",
    "Ruby", "PHP", "Swift", "Kotlin", "Scala", "R", "MATLAB", "Dart",
    # Frontend
    "React", "Next.js", "Vue.js", "Angular", "Svelte", "HTML", "CSS",
    "Tailwind", "Bootstrap", "SASS", "Redux", "Zustand",
    # Backend
    "Node.js", "FastAPI", "Flask", "Django", "Express", "Spring Boot",
    "Rails", "Laravel", "GraphQL", "REST", "gRPC",
    # Cloud & DevOps
    "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform", "Ansible",
    "Jenkins", "GitHub Actions", "CI/CD", "Nginx", "Linux",
    # Data
    "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch", "SQLite",
    "DynamoDB", "Cassandra", "BigQuery", "Snowflake",
    # AI/ML
    "PyTorch", "TensorFlow", "Scikit-learn", "Pandas", "NumPy", "OpenAI",
    "LangChain", "HuggingFace", "LLM", "RAG", "NLP", "Computer Vision",
    # Tools
    "Git", "Jira", "Figma", "Postman", "VS Code", "Linux", "Bash",
}

DOMAINS = {
    "Machine Learning", "Deep Learning", "Natural Language Processing",
    "Computer Vision", "Data Science", "Data Engineering", "MLOps",
    "DevOps", "Cloud Computing", "Cybersecurity", "Blockchain",
    "Full Stack Development", "Backend Development", "Frontend Development",
    "Mobile Development", "System Design", "Distributed Systems",
    "Microservices", "API Development", "Database Administration",
}

YOE_PATTERNS = [
    # "5 years of Python" / "3+ years experience in React"
    re.compile(
        r"(\d+\.?\d*)\+?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:experience\s+(?:in|with)\s+)?([A-Za-z][A-Za-z0-9\s.+#-]{1,30})",
        re.IGNORECASE,
    ),
    # "Python (5 years)"
    re.compile(
        r"([A-Za-z][A-Za-z0-9\s.+#-]{1,20})\s*\((\d+\.?\d*)\+?\s*(?:years?|yrs?)\)",
        re.IGNORECASE,
    ),
    # "over 3 years in AWS"
    re.compile(
        r"(?:over|more than|approximately|~)?\s*(\d+\.?\d*)\+?\s*(?:years?|yrs?)\s+(?:of\s+)?(?:experience\s+)?(?:in|with|using)?\s+([A-Za-z][A-Za-z0-9\s.+#-]{1,30})",
        re.IGNORECASE,
    ),
]


def extract_keywords(text: str) -> dict:
    """
    Main extraction function. Returns:
    {
        "technologies": [...],
        "domains": [...],
        "tools": [...],
        "years_of_experience": {"Python": 3, "AWS": 2, ...}
    }
    """
    if not text:
        return {"technologies": [], "domains": [], "tools": [], "years_of_experience": {}}

    text_lower = text.lower()
    found_technologies = []
    found_domains = []
    years_map: dict[str, float] = {}

    # ── Extract technologies ──────────────────────────────────────────────────
    for tech in TECHNOLOGIES:
        pattern = re.escape(tech.lower())
        if re.search(r"\b" + pattern + r"\b", text_lower):
            found_technologies.append(tech)

    # ── Extract domains ───────────────────────────────────────────────────────
    for domain in DOMAINS:
        if domain.lower() in text_lower:
            found_domains.append(domain)

    # ── Extract years of experience references ────────────────────────────────
    for pattern in YOE_PATTERNS:
        for match in pattern.finditer(text):
            groups = match.groups()
            if len(groups) == 2:
                # Pattern 1 & 3: (years, skill) or (skill, years)
                try:
                    first, second = groups
                    # Determine which is the year and which is the skill
                    try:
                        years = float(first)
                        skill = second.strip().rstrip(".,;:")
                    except ValueError:
                        years = float(second)
                        skill = first.strip().rstrip(".,;:")

                    if 0 < years <= 30 and len(skill) > 1:
                        # Normalize skill name
                        canonical = _normalize_skill_name(skill)
                        if canonical:
                            existing = years_map.get(canonical, 0)
                            years_map[canonical] = max(existing, years)
                except (ValueError, IndexError):
                    pass

    logger.info(
        "keyword_extraction_complete",
        technologies=len(found_technologies),
        domains=len(found_domains),
        yoe_entries=len(years_map),
    )

    return {
        "technologies": sorted(found_technologies),
        "domains": sorted(found_domains),
        "tools": _extract_tools(text),
        "years_of_experience": {k: int(v) if v == int(v) else v for k, v in years_map.items()},
    }


def _normalize_skill_name(skill: str) -> str:
    """Clean up and validate extracted skill names."""
    # Remove trailing punctuation and whitespace
    skill = skill.strip().rstrip(".,;:")
    # Must be at least 2 chars, not all stopwords
    stop = {"the", "a", "an", "and", "or", "in", "with", "of", "for", "on", "to"}
    words = skill.lower().split()
    if all(w in stop for w in words):
        return ""
    if len(skill) < 2 or len(skill) > 40:
        return ""
    return skill.strip()


TOOL_KEYWORDS = {
    "Git", "GitHub", "GitLab", "Bitbucket", "Jira", "Confluence",
    "Slack", "Figma", "Postman", "Insomnia", "VS Code", "IntelliJ",
    "PyCharm", "Vim", "Bash", "PowerShell", "Make", "CMake",
    "Webpack", "Vite", "ESLint", "Prettier", "Jest", "Pytest",
    "Selenium", "Playwright", "Cypress", "Datadog", "Grafana",
    "Prometheus", "New Relic", "Sentry", "LangSmith",
}


def _extract_tools(text: str) -> list[str]:
    text_lower = text.lower()
    found = []
    for tool in TOOL_KEYWORDS:
        if re.search(r"\b" + re.escape(tool.lower()) + r"\b", text_lower):
            found.append(tool)
    return sorted(found)
