// Shared TypeScript types for ResumeAlchemyst frontend

export interface ExperienceItem {
  company: string;
  role: string;
  duration: string;
  description: string;
  technologies: string[];
}

export interface EducationItem {
  institution: string;
  degree: string;
  field: string;
  year: string;
  gpa?: string;
}

export interface ProjectItem {
  name: string;
  description: string;
  technologies: string[];
  url?: string;
}

export interface CertificationItem {
  name: string;
  issuer: string;
  year: string;
}

export interface ResumeData {
  name: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  skills: string[];
  experience: ExperienceItem[];
  education: EducationItem[];
  projects: ProjectItem[];
  certifications: CertificationItem[];
}

export interface ParseResumeResponse {
  session_id: string;
  resume: ResumeData;
  message: string;
}

export type MessageSource = "resume" | "inference" | "insufficient";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  confidence?: number;
  source?: MessageSource;
  tools_used?: string[];
  timestamp: Date;
}

export interface ChatResponse {
  answer: string;
  confidence: number;
  source: MessageSource;
  missing_data: string[];
  tools_used: string[];
  session_id: string;
}

export interface SkillGap {
  matched: string[];
  missing: string[];
  partial: string[];
}

export interface JobMatchResponse {
  fit_score: number;
  skill_gap: SkillGap;
  recommendations: string[];
  summary: string;
  confidence: number;
  session_id: string;
}

export interface SessionInfo {
  session_id: string;
  has_resume: boolean;
  candidate_name: string;
  message_count: number;
  resume_summary?: {
    name: string;
    email: string;
    skills_count: number;
    experience_count: number;
    education_count: number;
    top_skills: string[];
  };
}
