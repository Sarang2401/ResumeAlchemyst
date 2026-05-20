# Architecture Notes

## Overview

ResumeAlchemyst is split into two independently deployable services:

- **Backend**: FastAPI (Python), port 8000
- **Frontend**: Next.js 16 (TypeScript), port 3000

Communication is REST over HTTP. The frontend never talks to an LLM directly; all AI calls go through the backend.

---

## Request Lifecycle (Chat)

```
Browser
  |
  | POST /chat { session_id, message }
  v
FastAPI router (routers/chat.py)
  |
  | Looks up session from in-memory store
  v
Agent Controller (agents/controller.py)
  |
  +-- 1. classify_intent(query)
  |       Regex scoring across 7 intent categories
  |       Returns: skill_check | experience_query | education_query |
  |                fit_assessment | summarize | project_query | general
  |
  +-- 2. select_tools(intent)
  |       Maps intent to a list of tool names
  |       skill_check     -> [skill_matcher, keyword_extractor]
  |       fit_assessment  -> [skill_matcher, keyword_extractor]
  |       experience_query -> [keyword_extractor]
  |       all others      -> [] (LLM only, no tool overhead)
  |
  +-- 3. run_tools(tools, query, resume)
  |       Executes each tool, collects outputs
  |
  +-- 4. build_prompt_messages(query, resume, tool_outputs, history)
  |       Assembles: system prompt + resume JSON + tool output + last 4 turns + user query
  |
  +-- 5. call_llm(system_prompt, messages, temperature=0.1, expect_json=True)
  |       Routes to configured provider (Groq / OpenAI / Anthropic / Gemini / Ollama)
  |       Returns raw JSON string
  |
  +-- 6. parse_llm_json(raw)
  |       Strips markdown fences, extracts JSON object
  |
  +-- 7. validate_and_fix(parsed, resume_data)
            Checks required fields, clamps confidence, validates source,
            enforces low-confidence prefix, detects hedging language
  |
  v
ChatResponse { answer, confidence, source, missing_data, tools_used, session_id }
```

---

## Session Management

Sessions are stored in a Python dict (in-memory, per-process). Each session holds:

- Parsed resume data (ResumeSchema)
- Chat history (last 20 messages, for LLM context)
- Inferred intents list
- Timestamps for TTL (30-minute expiry)

Trade-off: sessions are lost on server restart. Acceptable for a demo; a production version would use Redis.

---

## LLM Service

`services/llm_service.py` is a thin routing layer. It reads `LLM_PROVIDER` from the environment at startup and dispatches to the right async function:

- `_call_openai` — OpenAI-compatible client, JSON mode
- `_call_anthropic` — Anthropic SDK
- `_call_gemini` — Google GenAI via OpenAI-compatible endpoint
- `_call_groq` — Groq via OpenAI-compatible endpoint
- `_call_ollama` — Local Ollama via OpenAI-compatible endpoint

All providers return a raw string. The LLM is always prompted in JSON mode (`expect_json=True`) to enforce structured output.

---

## Guardrails

The guardrail layer runs after every LLM call. It does not call the LLM again; it validates the parsed JSON output:

1. Required fields check (`answer`, `confidence`, `source`)
2. Confidence clamped to [0.0, 1.0]
3. Source validated against allowed values (`resume`, `inference`, `insufficient`)
4. Confidence below 0.5: answer prefixed with "Insufficient information available."
5. Missing `missing_data` key: defaulted to `[]`
6. Empty answer: replaced with "Insufficient information available."
7. Hedging language detection: "I think", "probably", "likely has", etc. trigger confidence downgrade to max 0.6

---

## Resume Parser

`tools/resume_parser.py` uses pdfplumber to extract raw text from PDFs, then applies a series of regex heuristics to identify:

- Name (first non-empty line heuristic)
- Email and phone (regex)
- Skills sections (keyword-based section detection)
- Experience blocks (company + role + date patterns)
- Education blocks (degree + institution patterns)
- Projects (project section detection)
- Certifications (cert section detection)

The raw text is also stored on the session for keyword extraction.

---

## Skill Matching

`tools/skill_matcher.py` uses a two-pass approach:

1. **Exact match** (case-insensitive) against the resume's skills list
2. **Alias resolution** (e.g. "JS" = "JavaScript", "k8s" = "Kubernetes")
3. **Fuzzy containment** for partial matches (e.g. "React" found in "React.js")

Output: matched, missing, partial skill lists + a match rate and confidence score.

---

## Frontend

Next.js 16 with TypeScript. Pages:

| Route | Purpose |
|-------|---------|
| `/` | Landing page, resume upload (drag and drop) |
| `/resume` | Parsed resume viewer, tabbed by section |
| `/chat` | Chat interface with confidence bars and source badges |
| `/job-match` | JD paste + fit score ring + skill gap breakdown |

State is passed between pages via `sessionStorage` (session_id + parsed resume JSON). No global state library needed.

---

## Key Trade-offs

**In-memory sessions vs. a database**
Kept simple on purpose. Adding Redis or Postgres would be straightforward (swap out `SessionStore`), but adds operational complexity that is not needed at this scale.

**Regex intent classification vs. an LLM classifier**
Using regex patterns costs nothing per request and is fully deterministic. An LLM-based classifier would be more flexible but adds latency and cost to every message.

**pdfplumber vs. cloud OCR**
pdfplumber works offline and handles the vast majority of digital PDFs. Scanned PDFs (image-based) would need an OCR step, which was out of scope.

**JSON mode enforcement**
All LLM calls use `response_format: json_object`. This eliminates the unpredictable plain-text response cases that would break the guardrail validation step.
