# ResumeAlchemyst 🧪

**Intelligent AI Resume Assistant** — parse resumes, ask anything, match candidates to jobs. Zero hallucinations.

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![OpenAI](https://img.shields.io/badge/GPT--4.1--mini-Powered-412991?logo=openai)](https://openai.com)

---

## What it does

- 📄 **Resume Parsing** — Upload PDF or text. Extracts name, email, skills, experience, education, projects, and certifications into structured JSON.
- 🤖 **Agentic Chat** — Ask anything about the candidate. The agent classifies intent, invokes the right tools, and grounds every answer in the resume.
- 🛡️ **Guardrails** — Every response includes a confidence score and source attribution. Missing data is stated explicitly — never fabricated.
- 🎯 **Job Matching** — Paste a JD and instantly get a fit score, skill gap breakdown, and actionable recommendations.

---

## Architecture

```
Frontend (Next.js 15 + TypeScript + Tailwind + shadcn/ui)
    │
    ▼
FastAPI Backend
    │
    ├── Resume Parser    (pdfplumber + regex heuristics)
    ├── Skill Matcher    (alias resolution + fuzzy matching)
    ├── Keyword Extractor (tech vocab + YoE extraction)
    │
    └── Agent Controller
            │
            ├── Intent Classification (regex patterns)
            ├── Tool Selection        (intent → tools map)
            ├── LLM Call              (OpenAI / Anthropic)
            └── Guardrails            (validate + sanitize)
```

**Agent flow per query:**
1. Query received → intent classified
2. Relevant tools selected and invoked
3. Tool output injected into LLM context
4. LLM generates grounded answer (JSON mode)
5. Guardrails validate confidence, source, and completeness
6. Structured response returned

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- OpenAI API key (or Anthropic)

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Set up env
copy .env.example .env
# Edit .env and add your OPENAI_API_KEY

uvicorn main:app --reload --port 8000
```

### Frontend

```powershell
cd frontend
copy .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

### Or use the start scripts:

```powershell
# Terminal 1
.\scripts\start_backend.ps1

# Terminal 2
.\scripts\start_frontend.ps1
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/upload-resume` | Upload PDF or text resume |
| `POST` | `/chat` | Send a message to the AI agent |
| `GET` | `/session/{id}` | Retrieve session state |
| `POST` | `/match-job` | Match resume against a job description |
| `GET` | `/health` | Health check |

### Response schema (chat)

```json
{
  "answer": "The candidate has 4 years of Python experience.",
  "confidence": 0.92,
  "source": "resume",
  "missing_data": [],
  "tools_used": ["skill_matcher", "keyword_extractor"],
  "session_id": "abc-123"
}
```

---

## Guardrails Design

| Rule | Implementation |
|------|---------------|
| No fabrication | Source must be traceable to resume |
| Missing data | Listed in `missing_data[]`, never guessed |
| Low confidence | `< 0.5` → "Insufficient information available." |
| Fabrication signals | "I think", "probably" → confidence downgraded |
| Source attribution | `"resume"` or `"inference"` on every response |

---

## Internal Tools

| Tool | Purpose |
|------|---------|
| **Resume Parser** | PDF/text → structured JSON (pdfplumber + regex) |
| **Skill Matcher** | Required skills vs resume skills (fuzzy + alias-aware) |
| **Keyword Extractor** | Tech stack, domains, tools, years-of-experience |

---

## Deployment

### Frontend → Vercel

```bash
# Push to GitHub, then import at vercel.com
# Set env: NEXT_PUBLIC_API_URL=https://your-backend.onrender.com
```

### Backend → Render

1. Create a new **Web Service** on [render.com](https://render.com)
2. Set **Build command**: `pip install -r requirements.txt`
3. Set **Start command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add environment variables from `.env.example`

---

## Project Structure

```
ResumeAlchemyst/
├── frontend/           # Next.js 15 app
│   └── src/
│       ├── app/        # Pages: /, /resume, /chat, /job-match
│       ├── lib/        # API client + TypeScript types
│       └── components/ # shadcn/ui components
├── backend/
│   ├── main.py         # FastAPI entry point
│   ├── agents/         # Agent controller + orchestration
│   ├── tools/          # Resume parser, skill matcher, keyword extractor
│   ├── services/       # LLM service + guardrails
│   ├── memory/         # Session store (in-memory, TTL-based)
│   ├── routers/        # API route handlers
│   ├── schemas/        # Pydantic models
│   └── prompts/        # LLM system prompts
├── scripts/            # Local dev start scripts
└── docs/               # Architecture docs
```

---

## Design Tradeoffs

| Decision | Rationale |
|----------|-----------|
| In-memory sessions | Simple, fast, zero dependencies. Sufficient for demo/portfolio scale. |
| Regex intent classification | No LLM cost per request. Fast, predictable, debuggable. |
| pdfplumber over cloud OCR | No external API cost. Works offline. |
| Exact + fuzzy skill matching | Handles typos and aliases without embedding API cost. |
| JSON mode for LLM | Enforces structured output, enables guardrail validation. |

---

## License

MIT