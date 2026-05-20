# ResumeAlchemyst

An AI-powered resume analysis tool built for recruiters and hiring teams. Upload a resume, ask questions, and get grounded answers drawn directly from the candidate's documents.

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![Groq](https://img.shields.io/badge/LLaMA_3.3-via_Groq-F55036?logo=meta)](https://groq.com)

---

## What it does

- **Resume Parsing** — Upload a PDF or plain text file. The backend extracts name, contact info, skills, work experience, education, projects, and certifications into structured JSON.
- **Agentic Chat** — Ask anything about the candidate. The agent classifies the question, selects the right internal tools, and grounds every answer in the resume data.
- **Guardrails** — Every response includes a confidence score and source label. When data is missing, the system says so. It never makes things up.
- **Job Matching** — Paste a job description to get a fit score, a skill gap breakdown (matched, partial, missing), and specific recommendations.

---

## Architecture

```
Frontend (Next.js 16 + TypeScript + Tailwind CSS)
    |
    v
FastAPI Backend
    |
    +-- Resume Parser      (pdfplumber + regex heuristics)
    +-- Skill Matcher      (fuzzy matching + alias resolution)
    +-- Keyword Extractor  (tech vocab + years-of-experience extraction)
    |
    +-- Agent Controller
            |
            +-- Intent Classification  (regex pattern scoring, no LLM cost)
            +-- Tool Selection         (intent to tools map)
            +-- LLM Call              (Groq / OpenAI / Anthropic / Ollama)
            +-- Guardrails            (validate, sanitize, enforce schema)
```

**Agent flow for each query:**

1. User message received, intent classified (skill check, experience, education, fit, general)
2. Relevant tools selected and executed
3. Tool output + resume context injected into LLM prompt
4. LLM generates a grounded answer in JSON mode
5. Guardrails validate the response: confidence clamped, source checked, fabrication signals detected
6. Structured response returned to frontend

---

## Quick Start

### Requirements

- Python 3.11+
- Node.js 18+
- A Groq API key (free at [console.groq.com](https://console.groq.com))

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

copy .env.example .env
# Open .env and set your GROQ_API_KEY

uvicorn main:app --reload --port 8000
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

API explorer: [http://localhost:8000/docs](http://localhost:8000/docs)

### Start scripts (alternative)

```powershell
# Terminal 1
.\scripts\start_backend.ps1

# Terminal 2
.\scripts\start_frontend.ps1
```

---

## LLM Provider Configuration

The backend supports multiple providers. Set `LLM_PROVIDER` in `backend/.env`:

| Provider | Key | Model |
|---|---|---|
| `groq` (default) | `GROQ_API_KEY` | `llama-3.3-70b-versatile` |
| `gemini` | `GEMINI_API_KEY` | `gemini-2.0-flash` |
| `openai` | `OPENAI_API_KEY` | `gpt-4.1-mini` |
| `anthropic` | `ANTHROPIC_API_KEY` | `claude-sonnet-4-5` |
| `ollama` | none | `llama3` (local) |

Example `.env` for Groq:

```env
LLM_PROVIDER=groq
GROQ_API_KEY=gsk_...
GROQ_MODEL=llama-3.3-70b-versatile
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/upload-resume` | Upload PDF or text resume, start session |
| `POST` | `/chat` | Send a message to the AI agent |
| `GET` | `/session/{id}` | Get current session state |
| `POST` | `/match-job` | Match resume against a job description |
| `GET` | `/health` | Health check |

### Chat response schema

```json
{
  "answer": "The candidate has 3 years of Python experience across two roles.",
  "confidence": 0.92,
  "source": "resume",
  "missing_data": [],
  "tools_used": ["keyword_extractor"],
  "session_id": "abc-123"
}
```

---

## Internal Tools

| Tool | What it does |
|------|-------------|
| **Resume Parser** | Converts PDF or text to structured JSON using pdfplumber and regex |
| **Skill Matcher** | Compares required skills vs resume skills with alias resolution and fuzzy scoring |
| **Keyword Extractor** | Pulls out tech stack, domains, tools, and years-of-experience mentions |

---

## Guardrails

| Rule | How it is enforced |
|------|--------------------|
| No fabrication | Source must trace back to resume; "Not mentioned in resume." is the fallback |
| Missing data | Listed in `missing_data[]`, not guessed |
| Low confidence | Confidence below 0.5 prepends "Insufficient information available." |
| Hedging language | "I think", "probably", "likely has" trigger a confidence downgrade |
| Source attribution | Every response is labeled `resume`, `inference`, or `insufficient` |

---

## Project Structure

```
ResumeAlchemyst/
+-- frontend/
|   +-- src/
|       +-- app/          # Pages: /, /resume, /chat, /job-match
|       +-- lib/          # API client, TypeScript types
|       +-- components/   # UI components (shadcn/ui + custom)
+-- backend/
|   +-- main.py           # FastAPI app entry point + .env loader
|   +-- agents/           # Orchestrator: intent, tools, LLM, guardrails
|   +-- tools/            # Resume parser, skill matcher, keyword extractor
|   +-- services/         # LLM service (multi-provider) + guardrails
|   +-- memory/           # In-memory session store with TTL
|   +-- routers/          # API route handlers
|   +-- schemas/          # Pydantic models for request/response
|   +-- prompts/          # LLM system prompt and tool context templates
+-- scripts/              # Local dev start scripts
+-- docs/                 # Architecture notes
```

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| In-memory sessions | Fast, zero dependencies, no database needed for a demo-scale tool |
| Regex intent classification | Avoids an extra LLM call per message; cheaper and more predictable |
| pdfplumber over cloud OCR | No external API cost, works offline, handles most structured PDFs |
| Fuzzy + alias skill matching | Handles abbreviations (e.g. "JS" = "JavaScript") without embedding costs |
| JSON mode for LLM output | Enforces structured output so guardrails can reliably parse and validate |
| Multi-provider LLM routing | Swap providers in one env variable; no code change needed |

---

## Deployment

### Frontend on Vercel

Push to GitHub, then import at [vercel.com](https://vercel.com). Set the environment variable:

```
NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

### Backend on Render

1. Create a new Web Service at [render.com](https://render.com)
2. Build command: `pip install -r requirements.txt`
3. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add environment variables from `.env.example`

---

## License

MIT