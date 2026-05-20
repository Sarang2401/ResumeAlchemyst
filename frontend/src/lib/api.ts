// Typed API client for ResumeAlchemyst backend

import type {
  ParseResumeResponse,
  ChatResponse,
  JobMatchResponse,
  SessionInfo,
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  /** Upload a resume PDF or text file */
  uploadResume: async (
    file: File,
    sessionId?: string
  ): Promise<ParseResumeResponse> => {
    const form = new FormData();
    form.append("file", file);
    if (sessionId) form.append("session_id", sessionId);

    const res = await fetch(`${API_BASE}/upload-resume`, {
      method: "POST",
      body: form,
    });
    return handleResponse<ParseResumeResponse>(res);
  },

  /** Send a chat message */
  chat: async (sessionId: string, message: string): Promise<ChatResponse> => {
    const res = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, message }),
    });
    return handleResponse<ChatResponse>(res);
  },

  /** Get session info */
  getSession: async (sessionId: string): Promise<SessionInfo> => {
    const res = await fetch(`${API_BASE}/session/${sessionId}`);
    return handleResponse<SessionInfo>(res);
  },

  /** Match resume against job description */
  matchJob: async (
    sessionId: string,
    jobDescription: string,
    jobTitle?: string
  ): Promise<JobMatchResponse> => {
    const res = await fetch(`${API_BASE}/match-job`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        job_description: jobDescription,
        job_title: jobTitle,
      }),
    });
    return handleResponse<JobMatchResponse>(res);
  },

  /** Extract JD from a URL using backend scraper */
  extractJdFromUrl: async (url: string): Promise<{ job_title: string; job_description: string }> => {
    const res = await fetch(`${API_BASE}/match-job/extract-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    return handleResponse<{ job_title: string; job_description: string }>(res);
  },
};

