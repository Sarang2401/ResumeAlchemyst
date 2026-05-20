"""
Tool 1: Resume Parser
Converts raw PDF/text resume into structured ResumeSchema JSON.
Uses pdfplumber for PDF extraction + regex heuristics for field detection.
"""

import re
import io
from pathlib import Path
from typing import Union

import pdfplumber
import structlog

from schemas.resume import (
    ResumeSchema,
    ExperienceItem,
    EducationItem,
    ProjectItem,
    CertificationItem,
)

logger = structlog.get_logger(__name__)

# ─── Regex Patterns ──────────────────────────────────────────────────────────
EMAIL_RE = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
PHONE_RE = re.compile(
    r"(\+?\d{1,3}[-.\s]?)?(\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}"
)
URL_RE = re.compile(r"https?://[^\s]+|www\.[^\s]+")
GITHUB_RE = re.compile(r"github\.com/([A-Za-z0-9_-]+)", re.IGNORECASE)
LINKEDIN_RE = re.compile(r"linkedin\.com/in/([A-Za-z0-9_-]+)", re.IGNORECASE)

SECTION_HEADERS = {
    "experience": [
        "experience",
        "work experience",
        "employment",
        "professional experience",
        "work history",
        "career",
    ],
    "education": ["education", "academic background", "qualifications", "academics"],
    "skills": [
        "skills",
        "technical skills",
        "core competencies",
        "technologies",
        "tech stack",
        "expertise",
        "proficiencies",
    ],
    "projects": ["projects", "personal projects", "side projects", "portfolio"],
    "certifications": [
        "certifications",
        "certificates",
        "licenses",
        "achievements",
        "awards",
    ],
    "summary": [
        "summary",
        "objective",
        "profile",
        "about",
        "overview",
        "professional summary",
    ],
}

# Known tech skills vocabulary for extraction
TECH_VOCAB = {
    "python", "javascript", "typescript", "java", "c++", "c#", "go", "rust",
    "ruby", "php", "swift", "kotlin", "scala", "r", "matlab",
    "react", "next.js", "vue", "angular", "svelte", "node.js", "express",
    "fastapi", "flask", "django", "spring", "laravel", "rails",
    "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "ansible",
    "postgresql", "mysql", "mongodb", "redis", "elasticsearch", "sqlite",
    "git", "linux", "nginx", "graphql", "rest", "grpc",
    "pytorch", "tensorflow", "scikit-learn", "pandas", "numpy",
    "langchain", "openai", "huggingface", "llm", "rag", "nlp",
    "html", "css", "tailwind", "sass", "webpack", "vite",
    "ci/cd", "jenkins", "github actions", "datadog", "prometheus",
}


def extract_text_from_pdf(file_bytes: bytes) -> str:
    """Extract raw text from PDF bytes using pdfplumber."""
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            pages = []
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    pages.append(text)
            return "\n".join(pages)
    except Exception as e:
        logger.error("pdf_extraction_failed", error=str(e))
        # Fallback to PyMuPDF
        try:
            import fitz
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            texts = []
            for page in doc:
                texts.append(page.get_text())
            return "\n".join(texts)
        except Exception as e2:
            logger.error("pymupdf_extraction_failed", error=str(e2))
            raise ValueError(f"Failed to extract text from PDF: {e2}")


def split_into_sections(text: str) -> dict[str, str]:
    """Split resume text into labelled sections using header detection."""
    lines = text.split("\n")
    sections: dict[str, list[str]] = {"header": []}
    current_section = "header"

    for line in lines:
        stripped = line.strip()
        lowered = stripped.lower()

        matched_section = None
        for section_key, keywords in SECTION_HEADERS.items():
            # Match if the line IS a header (short, matches keyword)
            if any(lowered == kw or lowered.startswith(kw) for kw in keywords):
                if len(stripped) < 50:  # Headers are short lines
                    matched_section = section_key
                    break

        if matched_section:
            current_section = matched_section
            sections.setdefault(current_section, [])
        else:
            sections.setdefault(current_section, []).append(line)

    return {k: "\n".join(v).strip() for k, v in sections.items()}


def extract_contact_info(header_text: str, full_text: str) -> dict:
    """Extract name, email, phone from header region."""
    result = {"name": "", "email": "", "phone": "", "location": ""}

    # Email
    email_match = EMAIL_RE.search(full_text)
    if email_match:
        result["email"] = email_match.group(0)

    # Phone
    phone_match = PHONE_RE.search(full_text)
    if phone_match:
        raw_phone = phone_match.group(0).strip()
        if len(raw_phone) >= 7:
            result["phone"] = raw_phone

    # Name: first non-empty line of header that's not an email/phone/url
    for line in header_text.split("\n"):
        stripped = line.strip()
        if (
            stripped
            and not EMAIL_RE.search(stripped)
            and not PHONE_RE.search(stripped)
            and not URL_RE.search(stripped)
            and len(stripped.split()) <= 5
            and len(stripped) > 2
        ):
            result["name"] = stripped
            break

    # Location: look for city/state patterns
    location_re = re.compile(
        r"\b([A-Z][a-z]+([\s,]+[A-Z][a-z]*){0,3},?\s*[A-Z]{2,})\b"
    )
    loc_match = location_re.search(header_text)
    if loc_match:
        result["location"] = loc_match.group(0).strip()

    return result


def extract_skills(skills_text: str, full_text: str) -> list[str]:
    """Extract skill list from skills section + cross-reference full text."""
    skills = set()

    # From skills section: split by common delimiters
    if skills_text:
        for part in re.split(r"[,|•·\n\t/]+", skills_text):
            skill = part.strip()
            if 1 < len(skill) < 40:
                skills.add(skill)

    # Cross-reference with known tech vocab
    full_lower = full_text.lower()
    for tech in TECH_VOCAB:
        if re.search(r"\b" + re.escape(tech) + r"\b", full_lower):
            skills.add(tech.title() if len(tech) > 3 else tech.upper())

    # Remove noise (single chars, pure numbers)
    cleaned = [s for s in skills if len(s) > 1 and not s.isdigit()]
    return sorted(cleaned)


def extract_experience(exp_text: str) -> list[ExperienceItem]:
    """Parse experience section into structured items."""
    items = []
    if not exp_text:
        return items

    # Split on common job entry delimiters (all-caps company names, date patterns)
    date_pattern = re.compile(
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|"
        r"March|April|June|July|August|September|October|November|December)"
        r"\s+\d{4}",
        re.IGNORECASE,
    )

    blocks = re.split(r"\n{2,}", exp_text)
    for block in blocks:
        block = block.strip()
        if not block or len(block) < 20:
            continue

        lines = [l.strip() for l in block.split("\n") if l.strip()]
        if not lines:
            continue

        item = ExperienceItem()

        # First line: usually role or company
        item.role = lines[0] if lines else ""

        # Second line: company or duration
        if len(lines) > 1:
            if date_pattern.search(lines[1]):
                item.duration = lines[1]
            else:
                item.company = lines[1]

        # Find duration anywhere in block
        dates = date_pattern.findall(block)
        if dates:
            # Find full date range string
            range_match = re.search(
                r"((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|"
                r"February|March|April|June|July|August|September|October|"
                r"November|December)\s+\d{4})\s*[-–—to]+\s*"
                r"((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|"
                r"February|March|April|June|July|August|September|October|"
                r"November|December)\s+\d{4}|Present|Current)",
                block,
                re.IGNORECASE,
            )
            if range_match:
                item.duration = range_match.group(0)

        # Description: remaining lines joined
        desc_lines = lines[2:] if len(lines) > 2 else []
        item.description = " ".join(desc_lines)

        # Technologies mentioned in this block
        block_lower = block.lower()
        techs = [
            t.title() if len(t) > 3 else t.upper()
            for t in TECH_VOCAB
            if re.search(r"\b" + re.escape(t) + r"\b", block_lower)
        ]
        item.technologies = techs

        if item.role or item.company:
            items.append(item)

    return items[:10]  # Cap at 10 entries


def extract_education(edu_text: str) -> list[EducationItem]:
    """Parse education section into structured items."""
    items = []
    if not edu_text:
        return items

    blocks = re.split(r"\n{2,}", edu_text)
    for block in blocks:
        block = block.strip()
        if not block or len(block) < 10:
            continue

        lines = [l.strip() for l in block.split("\n") if l.strip()]
        if not lines:
            continue

        item = EducationItem()
        item.institution = lines[0] if lines else ""
        item.degree = lines[1] if len(lines) > 1 else ""

        # Year
        year_match = re.search(r"\b(19|20)\d{2}\b", block)
        if year_match:
            item.year = year_match.group(0)

        # GPA
        gpa_match = re.search(r"[Gg][Pp][Aa][:\s]+(\d+\.\d+)", block)
        if gpa_match:
            item.gpa = gpa_match.group(1)

        if item.institution:
            items.append(item)

    return items[:5]


def extract_projects(proj_text: str) -> list[ProjectItem]:
    """Parse projects section into structured items."""
    items = []
    if not proj_text:
        return items

    blocks = re.split(r"\n{2,}", proj_text)
    for block in blocks:
        block = block.strip()
        if not block or len(block) < 15:
            continue

        lines = [l.strip() for l in block.split("\n") if l.strip()]
        if not lines:
            continue

        item = ProjectItem()
        item.name = lines[0]
        item.description = " ".join(lines[1:]) if len(lines) > 1 else ""

        # URL
        url_match = URL_RE.search(block)
        if url_match:
            item.url = url_match.group(0)

        # Technologies
        block_lower = block.lower()
        techs = [
            t.title() if len(t) > 3 else t.upper()
            for t in TECH_VOCAB
            if re.search(r"\b" + re.escape(t) + r"\b", block_lower)
        ]
        item.technologies = techs

        if item.name:
            items.append(item)

    return items[:8]


def extract_certifications(cert_text: str) -> list[CertificationItem]:
    """Parse certifications from text."""
    items = []
    if not cert_text:
        return items

    for line in cert_text.split("\n"):
        line = line.strip()
        if not line or len(line) < 5:
            continue

        cert = CertificationItem()
        year_match = re.search(r"\b(20\d{2})\b", line)
        if year_match:
            cert.year = year_match.group(0)
            cert.name = line.replace(year_match.group(0), "").strip(" -–|")
        else:
            cert.name = line

        if cert.name:
            items.append(cert)

    return items[:10]


# ─── Main Entry Point ─────────────────────────────────────────────────────────

def parse_resume(file_bytes: bytes, filename: str) -> ResumeSchema:
    """
    Main resume parsing function.
    Accepts raw file bytes + filename, returns structured ResumeSchema.
    """
    logger.info("resume_parse_start", filename=filename)

    # Step 1: Extract raw text
    if filename.lower().endswith(".pdf"):
        raw_text = extract_text_from_pdf(file_bytes)
    else:
        raw_text = file_bytes.decode("utf-8", errors="replace")

    if not raw_text.strip():
        raise ValueError("Could not extract text from the uploaded file.")

    # Step 2: Split into sections
    sections = split_into_sections(raw_text)
    logger.debug("sections_detected", sections=list(sections.keys()))

    # Step 3: Extract each field
    contact = extract_contact_info(sections.get("header", ""), raw_text)
    skills = extract_skills(sections.get("skills", ""), raw_text)
    experience = extract_experience(sections.get("experience", ""))
    education = extract_education(sections.get("education", ""))
    projects = extract_projects(sections.get("projects", ""))
    certifications = extract_certifications(sections.get("certifications", ""))
    summary = sections.get("summary", "").strip()

    resume = ResumeSchema(
        name=contact["name"],
        email=contact["email"],
        phone=contact["phone"],
        location=contact["location"],
        summary=summary,
        skills=skills,
        experience=experience,
        education=education,
        projects=projects,
        certifications=certifications,
        raw_text=raw_text[:5000],  # Store first 5000 chars for context
    )

    logger.info(
        "resume_parse_complete",
        name=resume.name,
        skills_count=len(resume.skills),
        experience_count=len(resume.experience),
    )
    return resume
