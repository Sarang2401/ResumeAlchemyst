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
import {
  ArrowLeft, Sparkles, Target, CheckCircle2,
  XCircle, AlertCircle, Loader2, Lightbulb, TrendingUp,
} from "lucide-react";

function FitScoreRing({ score }: { score: number }) {
  const color = score >= 70 ? "#10b981" : score >= 45 ? "#f59e0b" : "#ef4444";
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
      <Badge className="text-xs" style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}>
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

  useEffect(() => {
    const sid = sessionStorage.getItem("session_id");
    if (!sid) { router.push("/"); return; }
    setSessionId(sid);
  }, [router]);

  const runMatch = async () => {
    if (!jd.trim()) { toast.error("Please paste a job description."); return; }
    setLoading(true);
    setResult(null);
    try {
      const res = await api.matchJob(sessionId, jd, jobTitle || undefined);
      setResult(res);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Matching failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 border-b border-border glass">
        <div className="flex items-center gap-3">
          <Link href="/chat" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Chat
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-500 to-cyan-400 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-sm">Job Match</span>
          </div>
        </div>
        <Badge variant="outline" className="text-xs gap-1"><Target className="w-3 h-3" /> Skill Matching</Badge>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Input panel */}
        <div className="glass rounded-2xl p-6 animate-fade-in">
          <h1 className="font-bold text-lg mb-1">Resume vs Job Description</h1>
          <p className="text-muted-foreground text-sm mb-5">Paste a job description and get an instant fit score with skill gap analysis.</p>
          <div className="space-y-3">
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Job title (optional) — e.g. Senior Backend Engineer"
              className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-sm placeholder:text-muted-foreground/60 outline-none focus:border-purple-500/50 transition-colors"
            />
            <Textarea
              id="jd-input"
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="Paste the job description here..."
              className="resize-none min-h-[180px] bg-secondary border-border rounded-xl text-sm placeholder:text-muted-foreground/60"
            />
          </div>
          <Button
            id="match-button"
            onClick={runMatch}
            disabled={loading || !jd.trim()}
            className="mt-4 w-full bg-gradient-to-r from-purple-600 to-cyan-500 hover:opacity-90 transition-opacity text-white border-0"
          >
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analyzing...</> : <><Target className="w-4 h-4 mr-2" /> Run Match</>}
          </Button>
        </div>

        {/* Results */}
        {result && (
          <div className="space-y-4 animate-fade-in">
            {/* Score */}
            <div className="glass rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6">
              <FitScoreRing score={result.fit_score} />
              <div className="flex-1 text-center sm:text-left">
                <h2 className="font-bold text-lg mb-2">Match Analysis</h2>
                <p className="text-muted-foreground text-sm leading-relaxed">{result.summary}</p>
                <div className="flex gap-3 mt-3 justify-center sm:justify-start text-sm">
                  <span className="text-emerald-400">{result.skill_gap.matched.length} matched</span>
                  <span className="text-yellow-400">{result.skill_gap.partial.length} partial</span>
                  <span className="text-red-400">{result.skill_gap.missing.length} missing</span>
                </div>
              </div>
            </div>

            {/* Skill breakdown */}
            <div className="grid sm:grid-cols-3 gap-4">
              {result.skill_gap.matched.length > 0 && (
                <div className="glass rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-semibold text-emerald-400">Matched</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.skill_gap.matched.map((s) => (
                      <Badge key={s} className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {result.skill_gap.partial.length > 0 && (
                <div className="glass rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="w-4 h-4 text-yellow-400" />
                    <span className="text-sm font-semibold text-yellow-400">Partial</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.skill_gap.partial.map((s) => (
                      <Badge key={s} className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/20">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {result.skill_gap.missing.length > 0 && (
                <div className="glass rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <XCircle className="w-4 h-4 text-red-400" />
                    <span className="text-sm font-semibold text-red-400">Missing</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.skill_gap.missing.map((s) => (
                      <Badge key={s} className="text-xs bg-red-500/10 text-red-400 border-red-500/20">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Recommendations */}
            {result.recommendations.length > 0 && (
              <div className="glass rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Lightbulb className="w-4 h-4 text-yellow-400" />
                  <span className="font-semibold text-sm">Recommendations</span>
                </div>
                <ul className="space-y-2">
                  {result.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <TrendingUp className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
                      {rec}
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
