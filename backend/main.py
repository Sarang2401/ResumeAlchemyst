"""
ResumeAlchemyst — FastAPI Backend Entry Point
"""

# ── Load .env FIRST so every os.getenv() call below sees the values ──────────
from dotenv import load_dotenv
load_dotenv()
# ─────────────────────────────────────────────────────────────────────────────

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import structlog

from utils.logger import setup_logging
from routers import resume, chat, session, job_match
from memory.session_store import store

setup_logging()
logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    logger.info("resumealchemyst_startup")

    # Background task: clean up expired sessions every 10 minutes
    async def cleanup_loop():
        while True:
            await asyncio.sleep(600)
            store.cleanup_expired()

    task = asyncio.create_task(cleanup_loop())
    yield
    task.cancel()
    logger.info("resumealchemyst_shutdown")


app = FastAPI(
    title="ResumeAlchemyst API",
    description="Agentic AI Resume Assistant — parse resumes, chat with candidates, match jobs.",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS — allow Next.js dev server and production domain
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://resumealchemyst.vercel.app",  # update after deploy
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(resume.router, tags=["Resume"])
app.include_router(chat.router, tags=["Chat"])
app.include_router(session.router, tags=["Session"])
app.include_router(job_match.router, tags=["Job Match"])


@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "service": "ResumeAlchemyst API", "version": "1.0.0"}


@app.get("/health", tags=["Health"])
async def health():
    stats = store.stats()
    return {"status": "healthy", **stats}
