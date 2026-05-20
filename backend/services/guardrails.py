"""
Guardrails — Hallucination prevention and output validation.

Every LLM response is validated to ensure:
- Required fields are present
- Confidence scores are within bounds
- Source attribution is honest
- Missing data is explicitly listed, not fabricated
"""

import structlog
from typing import Any

logger = structlog.get_logger(__name__)

REQUIRED_FIELDS = {"answer", "confidence", "source"}
VALID_SOURCES = {"resume", "inference", "insufficient"}
LOW_CONFIDENCE_THRESHOLD = 0.5
INSUFFICIENT_PREFIX = "Insufficient information available."


def validate_and_fix(raw_output: dict, resume_data: dict | None = None) -> dict:
    """
    Validate LLM output against guardrail rules.
    Auto-fixes minor issues, flags major ones.
    Returns a cleaned, validated response dict.
    """
    output = dict(raw_output)

    # ── 1. Ensure required fields exist ──────────────────────────────────────
    for field in REQUIRED_FIELDS:
        if field not in output:
            logger.warning("guardrail_missing_field", field=field)
            output = _apply_fallback(output)
            break

    # ── 2. Validate and clamp confidence ─────────────────────────────────────
    try:
        confidence = float(output.get("confidence", 0.0))
        confidence = max(0.0, min(1.0, confidence))
        output["confidence"] = round(confidence, 3)
    except (TypeError, ValueError):
        output["confidence"] = 0.0
        logger.warning("guardrail_invalid_confidence")

    # ── 3. Validate source field ──────────────────────────────────────────────
    source = output.get("source", "")
    if source not in VALID_SOURCES:
        output["source"] = "inference"
        logger.warning("guardrail_invalid_source", source=source)

    # ── 4. Enforce low-confidence prefix ─────────────────────────────────────
    if output["confidence"] < LOW_CONFIDENCE_THRESHOLD:
        answer = output.get("answer", "")
        if not answer.startswith(INSUFFICIENT_PREFIX):
            output["answer"] = f"{INSUFFICIENT_PREFIX} {answer}".strip()
        output["source"] = "insufficient"

    # ── 5. Ensure missing_data is a list ─────────────────────────────────────
    if "missing_data" not in output or not isinstance(output["missing_data"], list):
        output["missing_data"] = []

    # ── 6. Strip empty answer ─────────────────────────────────────────────────
    if not output.get("answer", "").strip():
        output["answer"] = INSUFFICIENT_PREFIX
        output["confidence"] = 0.0
        output["source"] = "insufficient"

    # ── 7. Detect fabrication keywords ───────────────────────────────────────
    answer_lower = output.get("answer", "").lower()
    fabrication_signals = [
        "i believe", "i think", "probably", "likely has",
        "might have", "could be", "seems to", "appears to"
    ]
    if any(sig in answer_lower for sig in fabrication_signals):
        # Downgrade confidence if LLM is guessing
        if output["confidence"] > 0.7:
            output["confidence"] = min(output["confidence"], 0.6)
            output["source"] = "inference"
            logger.info("guardrail_confidence_downgraded_fabrication_signal")

    logger.info(
        "guardrail_validated",
        confidence=output["confidence"],
        source=output["source"],
        missing_count=len(output.get("missing_data", [])),
    )
    return output


def _apply_fallback(output: dict) -> dict:
    """Apply safe fallback values for malformed LLM output."""
    return {
        "answer": output.get("answer") or INSUFFICIENT_PREFIX,
        "confidence": 0.0,
        "source": "insufficient",
        "missing_data": output.get("missing_data", []),
    }


def build_not_found_response(field: str) -> dict:
    """Standard 'not found in resume' response for a specific field."""
    return {
        "answer": f"Not mentioned in resume.",
        "confidence": 1.0,  # High confidence that the data is absent
        "source": "resume",
        "missing_data": [field],
    }
