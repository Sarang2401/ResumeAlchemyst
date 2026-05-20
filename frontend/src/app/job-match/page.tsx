"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { JobMatchResponse } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NavBar from "@/components/NavBar";
import {
  ArrowLeft, Sparkles, Target, CheckCircle2,
  XCircle, AlertCircle, Loader2, Lightbulb, TrendingUp,
  Globe, Link2, Info, FileText, ArrowRight, MousePointerClick
} from "lucide-react";

function FitScoreRing({ score }: { score: number }) {
  const color = score >= 70 ? "#f59e0b" : score >= 45 ? "#d97706" : "#b45309";
  const label = score >= 70 ? "Strong Fit" : score >= 45 ? "Partial Fit" : "Weak Fit";
  const r = 52, circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-36 h-36">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
          <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="8"
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s ease" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold tabular-nums" style={{ color }}>{Math.round(score)}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>
      <Badge className="text-xs" style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>
        {label}
      </Badge>
    </div>
  );
}

export default function JobMatchPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState("");
  const [jd, setJd] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<JobMatchResponse | null>(null);

  // New URL scraper states
  const [urlInput, setUrlInput] = useState("");
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [activeTab, setActiveTab] = useState("manual");

  useEffect(() => {
    const sid = sessionStorage.getItem("session_id");
    if (!sid) { router.push("/"); return; }
    setSessionId(sid);

    // Read URL search params for bookmarklet prefill safely on client
    const params = new URLSearchParams(window.location.search);
    const importTitle = params.get("import_title");
    const importDesc = params.get("import_desc");
    if (importTitle || importDesc) {
      if (importTitle) setJobTitle(decodeURIComponent(importTitle));
      if (importDesc) {
        setJd(decodeURIComponent(importDesc));
        toast.success("Job description successfully imported via scraper plugin!");
      }
      // Clean query parameters so they don't persist on page reload
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [router]);

  const runMatch = async () => {
    if (!jd.trim()) { toast.error("Please paste a job description."); return; }
    setLoading(true);
    setResult(null);
    try {
      const res = await api.matchJob(sessionId, jd, jobTitle || undefined);
      setResult(res);
      toast.success("Job match analysis completed!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Matching failed.");
    } finally {
      setLoading(false);
    }
  };

  const runUrlImport = async () => {
    if (!urlInput.trim()) { toast.error("Please enter a job posting URL."); return; }
    if (!urlInput.startsWith("http://") && !urlInput.startsWith("https://")) {
      toast.error("URL must start with http:// or https://");
      return;
    }

    if (urlInput.toLowerCase().includes("linkedin.com")) {
      toast.error("LinkedIn blocks automated requests. Please copy-paste the description manually into the Manual Paste tab.");
      return;
    }

    setFetchingUrl(true);
    try {
      const data = await api.extractJdFromUrl(urlInput);
      setJobTitle(data.job_title);
      setJd(data.job_description);
      setUrlInput("");
      setActiveTab("manual");
      toast.success("Successfully imported job details! Review below.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to extract job details.");
    } finally {
      setFetchingUrl(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex flex-col">
      <NavBar />

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 w-full flex-1">
        {/* Header Title */}
        <div className="text-center sm:text-left space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Job Match & Gap Analysis
          </h1>
          <p className="text-muted-foreground text-sm">
            Evaluate your active candidate against specific job descriptions using LLM semantic matching.
          </p>
        </div>

        {/* Input panel with dynamic Tabs */}
        <div className="glass rounded-2xl p-6 animate-fade-in border border-border/40">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-secondary/70 border border-border/50 mb-5 w-full sm:w-auto p-1">
              <TabsTrigger value="manual" className="text-xs px-4 py-1.5 gap-1.5 rounded-lg">
                <FileText className="w-3.5 h-3.5" /> Manual Paste
              </TabsTrigger>
              <TabsTrigger value="url" className="text-xs px-4 py-1.5 gap-1.5 rounded-lg">
                <Globe className="w-3.5 h-3.5" /> Import from URL
              </TabsTrigger>
            </TabsList>

            {/* Tab: Manual Input */}
            <TabsContent value="manual" className="space-y-4 outline-none">
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1 block">Job Position / Title</label>
                  <input
                    type="text"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    placeholder="e.g. Senior Backend Engineer"
                    className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-sm placeholder:text-muted-foreground/60 outline-none focus:border-amber-500/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-medium mb-1 block">Job Description Text</label>
                  <Textarea
                    id="jd-input"
                    value={jd}
                    onChange={(e) => setJd(e.target.value)}
                    placeholder="Paste the job description details, responsibilities, and requirements here..."
                    className="resize-none min-h-[200px] bg-secondary border-border rounded-xl text-sm placeholder:text-muted-foreground/60 focus:border-amber-500/50 transition-colors"
                  />
                </div>
              </div>
              <Button
                id="match-button"
                onClick={runMatch}
                disabled={loading || !jd.trim()}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-400 hover:opacity-95 transition-opacity text-white border-0 py-5 rounded-xl text-sm font-semibold tracking-wide shadow-md shadow-amber-500/10"
              >
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing Candidate Fit...</>
                ) : (
                  <><Target className="w-4 h-4 mr-2" /> Match Resume against JD</>
                )}
              </Button>
            </TabsContent>

            {/* Tab: URL Importer */}
            <TabsContent value="url" className="space-y-4 outline-none">
              <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4 text-xs text-muted-foreground leading-relaxed flex gap-3">
                <Info className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p>
                  Paste a public job posting URL from platforms like <strong>Greenhouse, Lever, Workday</strong>, or company career boards.
                  Our AI will instantly read the page, strip boilerplate header/footer elements, and populate the job matcher inputs automatically.
                </p>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground font-medium block">Job Posting URL</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Globe className="absolute left-3.5 top-3 w-4 h-4 text-muted-foreground/60" />
                    <input
                      type="url"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://boards.greenhouse.io/company/jobs/12345..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary border border-border text-sm placeholder:text-muted-foreground/60 outline-none focus:border-amber-500/50 transition-colors"
                    />
                  </div>
                  <Button
                    onClick={runUrlImport}
                    disabled={fetchingUrl || !urlInput.trim()}
                    className="bg-secondary hover:bg-secondary/80 border border-border text-foreground font-medium py-2.5 px-5 rounded-xl text-sm"
                  >
                    {fetchingUrl ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importing...</>
                    ) : (
                      <><Link2 className="w-4 h-4 mr-2" /> Fetch Details</>
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Results display */}
        {result && (
          <div className="space-y-4 animate-fade-in">
            {/* Score and summary */}
            <div className="glass border border-border/40 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6">
              <FitScoreRing score={result.fit_score} />
              <div className="flex-1 text-center sm:text-left space-y-2">
                <h2 className="font-bold text-lg text-foreground">Semantic Fit Analysis</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">{result.summary}</p>
                <div className="flex gap-4 mt-3 justify-center sm:justify-start text-xs font-semibold">
                  <span className="text-emerald-400 bg-emerald-500/5 px-2.5 py-1 rounded-lg border border-emerald-500/10 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> {result.skill_gap.matched.length} Matched
                  </span>
                  <span className="text-amber-400 bg-amber-500/5 px-2.5 py-1 rounded-lg border border-amber-500/10 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-400" /> {result.skill_gap.partial.length} Partial
                  </span>
                  <span className="text-red-400 bg-red-500/5 px-2.5 py-1 rounded-lg border border-red-500/10 flex items-center gap-1.5">
                    <XCircle className="w-3.5 h-3.5 text-red-400" /> {result.skill_gap.missing.length} Missing
                  </span>
                </div>
              </div>
            </div>

            {/* Skill gaps */}
            <div className="grid sm:grid-cols-3 gap-4">
              {result.skill_gap.matched.length > 0 && (
                <div className="glass border border-border/40 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Matched Skills</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.skill_gap.matched.map((s) => (
                      <Badge key={s} className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/10 hover:bg-emerald-500/15 cursor-default">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {result.skill_gap.partial.length > 0 && (
                <div className="glass border border-border/40 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">Partial Skills</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.skill_gap.partial.map((s) => (
                      <Badge key={s} className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/10 hover:bg-amber-500/15 cursor-default">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {result.skill_gap.missing.length > 0 && (
                <div className="glass border border-border/40 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-400" />
                    <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Missing Skills</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.skill_gap.missing.map((s) => (
                      <Badge key={s} className="text-xs bg-red-500/10 text-red-400 border-red-500/10 hover:bg-red-500/15 cursor-default">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Recommendations */}
            {result.recommendations.length > 0 && (
              <div className="glass border border-border/40 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-400" />
                  <span className="font-semibold text-sm text-foreground">Gap Closure Recommendations</span>
                </div>
                <ul className="space-y-2.5">
                  {result.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                      <TrendingUp className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <span className="leading-relaxed">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
