"""
LLM Service — OpenAI GPT-4.1-mini / Claude Sonnet integration.
Supports structured JSON output with guardrailed prompting.
Switch providers via LLM_PROVIDER env variable.
"""

import json
import os
from typing import Optional
import structlog

logger = structlog.get_logger(__name__)

LLM_PROVIDER = os.getenv("LLM_PROVIDER", "openai")  # "openai" | "anthropic" | "gemini" | "groq" | "ollama"
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")
MAX_TOKENS = int(os.getenv("LLM_MAX_TOKENS", "1024"))


async def call_llm(
    system_prompt: str,
    messages: list[dict],
    temperature: float = 0.1,
    expect_json: bool = True,
) -> str:
    """
    Call the configured LLM provider.
    Returns raw string response (JSON string when expect_json=True).
    Low temperature (0.1) for factual, consistent answers.
    """
    if LLM_PROVIDER == "anthropic":
        return await _call_anthropic(system_prompt, messages, temperature)
    elif LLM_PROVIDER == "gemini":
        return await _call_gemini(system_prompt, messages, temperature, expect_json)
    elif LLM_PROVIDER == "groq":
        return await _call_groq(system_prompt, messages, temperature, expect_json)
    elif LLM_PROVIDER == "ollama":
        return await _call_ollama(system_prompt, messages, temperature, expect_json)
    else:
        return await _call_openai(system_prompt, messages, temperature, expect_json)



async def _call_openai(
    system_prompt: str,
    messages: list[dict],
    temperature: float,
    expect_json: bool,
) -> str:
    from openai import AsyncOpenAI

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable not set.")

    client = AsyncOpenAI(api_key=api_key)

    full_messages = [{"role": "system", "content": system_prompt}] + messages

    kwargs = dict(
        model=OPENAI_MODEL,
        messages=full_messages,
        temperature=temperature,
        max_tokens=MAX_TOKENS,
    )
    if expect_json:
        kwargs["response_format"] = {"type": "json_object"}

    logger.info("llm_call_start", provider="openai", model=OPENAI_MODEL)
    response = await client.chat.completions.create(**kwargs)
    content = response.choices[0].message.content or ""
    logger.info("llm_call_complete", tokens=response.usage.total_tokens if response.usage else 0)
    return content


async def _call_anthropic(
    system_prompt: str,
    messages: list[dict],
    temperature: float,
) -> str:
    import anthropic

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY environment variable not set.")

    client = anthropic.AsyncAnthropic(api_key=api_key)

    logger.info("llm_call_start", provider="anthropic", model=ANTHROPIC_MODEL)
    response = await client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=MAX_TOKENS,
        system=system_prompt,
        messages=messages,
        temperature=temperature,
    )
    content = response.content[0].text if response.content else ""
    logger.info("llm_call_complete", provider="anthropic")
    return content


async def _call_gemini(
    system_prompt: str,
    messages: list[dict],
    temperature: float,
    expect_json: bool,
) -> str:
    from openai import AsyncOpenAI

    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY or GOOGLE_API_KEY environment variable not set.")

    # We use Google's OpenAI-compatible endpoint
    client = AsyncOpenAI(
        api_key=api_key,
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
    )

    full_messages = [{"role": "system", "content": system_prompt}] + messages

    kwargs = dict(
        model=GEMINI_MODEL,
        messages=full_messages,
        temperature=temperature,
        max_tokens=MAX_TOKENS,
    )
    if expect_json:
        kwargs["response_format"] = {"type": "json_object"}

    logger.info("llm_call_start", provider="gemini", model=GEMINI_MODEL)
    response = await client.chat.completions.create(**kwargs)
    content = response.choices[0].message.content or ""
    logger.info("llm_call_complete", tokens=response.usage.total_tokens if response.usage else 0)
    return content


async def _call_groq(
    system_prompt: str,
    messages: list[dict],
    temperature: float,
    expect_json: bool,
) -> str:
    from openai import AsyncOpenAI

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError("GROQ_API_KEY environment variable not set.")

    client = AsyncOpenAI(
        api_key=api_key,
        base_url="https://api.groq.com/openai/v1"
    )

    full_messages = [{"role": "system", "content": system_prompt}] + messages

    kwargs = dict(
        model=GROQ_MODEL,
        messages=full_messages,
        temperature=temperature,
        max_tokens=MAX_TOKENS,
    )
    if expect_json:
        kwargs["response_format"] = {"type": "json_object"}

    logger.info("llm_call_start", provider="groq", model=GROQ_MODEL)
    response = await client.chat.completions.create(**kwargs)
    content = response.choices[0].message.content or ""
    logger.info("llm_call_complete", tokens=response.usage.total_tokens if response.usage else 0)
    return content


async def _call_ollama(
    system_prompt: str,
    messages: list[dict],
    temperature: float,
    expect_json: bool,
) -> str:
    from openai import AsyncOpenAI

    client = AsyncOpenAI(
        api_key="ollama",
        base_url="http://localhost:11434/v1"
    )

    full_messages = [{"role": "system", "content": system_prompt}] + messages

    kwargs = dict(
        model=OLLAMA_MODEL,
        messages=full_messages,
        temperature=temperature,
    )
    if expect_json:
        kwargs["response_format"] = {"type": "json_object"}

    logger.info("llm_call_start", provider="ollama", model=OLLAMA_MODEL)
    response = await client.chat.completions.create(**kwargs)
    content = response.choices[0].message.content or ""
    logger.info("llm_call_complete", tokens=response.usage.total_tokens if response.usage else 0)
    return content


def parse_llm_json(raw: str) -> dict:
    """
    Safely parse JSON from LLM response.
    Handles cases where LLM wraps JSON in markdown code blocks.
    """
    # Strip markdown code fences
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        cleaned = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        # Try to extract JSON object from response
        import re
        json_match = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if json_match:
            return json.loads(json_match.group(0))
        raise ValueError(f"Could not parse JSON from LLM response: {raw[:200]}")
