"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { ParseResumeResponse } from "@/lib/types";
import { Brain, Upload, FileText, Zap, Shield, ChevronRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const FEATURES = [
  { icon: <Brain className="w-5 h-5" />, title: "Agentic Intelligence", desc: "Intent classification, tool selection, and grounded LLM responses." },
  { icon: <Shield className="w-5 h-5" />, title: "Zero Hallucinations", desc: "Every answer is traced to the resume. Missing info is flagged, never fabricated." },
  { icon: <Zap className="w-5 h-5" />, title: "Instant Matching", desc: "Paste a JD and get a fit score with matched and missing skills in seconds." },
];

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const processFile = useCallback(async (file: File) => {
    if (!file) return;
    const allowed = ["application/pdf", "text/plain"];
    if (!allowed.includes(file.type)) {
      toast.error("Only PDF and plain text files are supported.");
      return;
    }
    setLoading(true);
    try {
      const result: ParseResumeResponse = await api.uploadResume(file);
      sessionStorage.setItem("session_id", result.session_id);
      sessionStorage.setItem("resume", JSON.stringify(result.resume));
      toast.success(`Resume parsed — ${result.resume.name || "Candidate"} ready.`);
      router.push("/resume");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to parse resume.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => files[0] && processFile(files[0]),
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
    accept: { "application/pdf": [".pdf"], "text/plain": [".txt"] },
    maxFiles: 1,
    disabled: loading,
  });

  return (
    <main className="min-h-screen dot-grid flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border/50 glass sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-400 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="font-semibold text-sm tracking-tight">ResumeAlchemyst</span>
        </div>
        <Badge variant="outline" className="text-xs text-muted-foreground hidden sm:flex">
          v1.0 · LLaMA 3.3 via Groq
        </Badge>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center max-w-4xl mx-auto w-full">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs text-muted-foreground mb-8 animate-fade-in">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-glow" />
          Agentic AI · Hallucination-Free · Recruiter-Grade
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6 animate-fade-in leading-tight">
          Turn Resumes Into{" "}
          <span className="gradient-text">Intelligent Insights</span>
        </h1>

        <p className="text-muted-foreground text-lg max-w-xl mb-12 animate-fade-in leading-relaxed">
          Upload any resume. Ask anything. Get structured, source-attributed answers —
          powered by an agentic AI that never makes things up.
        </p>

        {/* Drop Zone */}
        <div
          {...getRootProps()}
          id="resume-dropzone"
          className={`
            w-full max-w-lg rounded-2xl border-2 border-dashed p-12 cursor-pointer
            transition-all duration-300 relative overflow-hidden
            ${isDragActive || dragActive
              ? "border-purple-500 bg-purple-500/10 glow-purple scale-[1.02]"
              : "border-border hover:border-purple-500/50 hover:bg-purple-500/5"
            }
            ${loading ? "opacity-60 cursor-not-allowed" : ""}
          `}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300
              ${isDragActive ? "bg-purple-500/20" : "bg-secondary"}`}>
              {loading ? (
                <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload className={`w-7 h-7 transition-colors ${isDragActive ? "text-purple-400" : "text-muted-foreground"}`} />
              )}
            </div>
            <div>
              <p className="font-semibold text-foreground mb-1">
                {loading ? "Parsing resume..." : isDragActive ? "Drop it here" : "Drop your resume here"}
              </p>
              <p className="text-muted-foreground text-sm">
                {loading ? "Extracting structured data..." : "PDF or plain text · max 5MB"}
              </p>
            </div>
            {!loading && (
              <Button variant="outline" size="sm" className="mt-2" onClick={(e) => e.stopPropagation()}>
                <FileText className="w-4 h-4 mr-2" />
                Browse files
              </Button>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-4">
          Your resume is processed in-session and never stored permanently.
        </p>

        {/* Feature pills */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-20 w-full max-w-3xl">
          {FEATURES.map((f) => (
            <div key={f.title} className="glass rounded-xl p-5 text-left group hover:border-purple-500/30 transition-colors">
              <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 mb-3 group-hover:bg-purple-500/20 transition-colors">
                {f.icon}
              </div>
              <p className="font-semibold text-sm mb-1">{f.title}</p>
              <p className="text-muted-foreground text-xs leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
