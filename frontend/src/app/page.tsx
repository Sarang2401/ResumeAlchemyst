"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { ParseResumeResponse } from "@/lib/types";
import { Upload, FileText, Zap, Shield, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const FEATURES = [
  {
    icon: <Search className="w-4 h-4" />,
    title: "Ask anything about a candidate",
    desc: "Skills, experience, education, fit for a role — get a direct answer in seconds.",
  },
  {
    icon: <Shield className="w-4 h-4" />,
    title: "Every answer is sourced",
    desc: "Confidence score and source label on every response. Missing data is stated, not invented.",
  },
  {
    icon: <Zap className="w-4 h-4" />,
    title: "JD matching in one click",
    desc: "Paste a job description and get a fit score with a breakdown of matched and missing skills.",
  },
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
      toast.success(`Parsed — ${result.resume.name || "Candidate"} ready.`);
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
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-gradient-to-br from-amber-500 to-amber-300 flex items-center justify-center">
            <FileText className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-semibold text-sm tracking-tight">ResumeAlchemyst</span>
          <Badge variant="outline" className="text-xs text-muted-foreground ml-1 hidden sm:flex">
            Beta
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground hidden sm:block">
          Resume analysis for hiring teams
        </span>
      </nav>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center max-w-4xl mx-auto w-full">

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-5 animate-fade-in leading-tight">
          Stop reading resumes.{" "}
          <span className="gradient-text">Start asking questions.</span>
        </h1>

        <p className="text-muted-foreground text-lg max-w-lg mb-12 animate-fade-in leading-relaxed">
          Upload a resume, ask anything about the candidate, and get structured answers
          grounded in the document. No guesswork, no fabrication.
        </p>

        {/* Drop Zone */}
        <div
          {...getRootProps()}
          id="resume-dropzone"
          className={`
            w-full max-w-md rounded-xl border-2 border-dashed p-10 cursor-pointer
            transition-all duration-200 relative
            ${isDragActive || dragActive
              ? "border-amber-500 bg-amber-500/8 scale-[1.01]"
              : "border-border hover:border-amber-500/50 hover:bg-amber-500/4"
            }
            ${loading ? "opacity-60 cursor-not-allowed" : ""}
          `}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-4">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-colors duration-200
              ${isDragActive ? "bg-amber-500/15" : "bg-secondary"}`}>
              {loading ? (
                <div className="w-5 h-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Upload className={`w-6 h-6 transition-colors ${isDragActive ? "text-amber-400" : "text-muted-foreground"}`} />
              )}
            </div>
            <div>
              <p className="font-medium text-foreground mb-1">
                {loading ? "Parsing resume..." : isDragActive ? "Drop it here" : "Drop a resume here"}
              </p>
              <p className="text-muted-foreground text-sm">
                {loading ? "Extracting structured data..." : "PDF or plain text, up to 5 MB"}
              </p>
            </div>
            {!loading && (
              <Button variant="outline" size="sm" className="mt-1" onClick={(e) => e.stopPropagation()}>
                <FileText className="w-3.5 h-3.5 mr-2" />
                Browse files
              </Button>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          Processed in-session only. Nothing is stored after you close the tab.
        </p>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-16 w-full max-w-3xl">
          {FEATURES.map((f) => (
            <div key={f.title} className="glass rounded-xl p-5 text-left group hover:border-amber-500/25 transition-colors">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 mb-3 group-hover:bg-amber-500/18 transition-colors">
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
