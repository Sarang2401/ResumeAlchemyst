"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { api } from "@/lib/api";
import type { ChatMessage, ResumeData } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Send, Sparkles, User, Bot, ArrowLeft, FileText,
  Loader2, ChevronDown, Zap, Shield, AlertTriangle, Target,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

const SUGGESTED_QUESTIONS = [
  "Summarize this candidate in 3 sentences",
  "What are the top 5 technical skills?",
  "How many years of experience do they have?",
  "Are they suitable for a DevOps role?",
  "What skills are missing for a backend engineer role?",
  "What projects have they built?",
];

function SourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  const map: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    resume: { label: "From Resume", cls: "badge-resume", icon: <FileText className="w-3 h-3" /> },
    inference: { label: "Inference", cls: "badge-inference", icon: <Zap className="w-3 h-3" /> },
    insufficient: { label: "Insufficient Data", cls: "badge-insufficient", icon: <AlertTriangle className="w-3 h-3" /> },
  };
  const config = map[source];
  if (!config) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.cls}`}>
      {config.icon}{config.label}
    </span>
  );
}

function ConfidenceBar({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="h-1 flex-1 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums">{pct}%</span>
    </div>
  );
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} animate-fade-in`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0
        ${isUser ? "bg-purple-500/20 text-purple-400" : "bg-cyan-500/20 text-cyan-400"}`}>
        {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>
      <div className={`max-w-[80%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1.5`}>
        <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed
          ${isUser
            ? "bg-purple-600/20 border border-purple-500/30 text-foreground rounded-tr-sm"
            : "glass text-foreground rounded-tl-sm"
          }`}>
          {isUser ? (
            msg.content
          ) : (
            <div className="prose prose-invert prose-sm max-w-none
              prose-p:my-1 prose-p:leading-relaxed
              prose-ul:my-1 prose-ul:pl-4 prose-li:my-0.5
              prose-strong:text-foreground prose-strong:font-semibold
              prose-headings:text-foreground prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1
            ">
              <ReactMarkdown>{msg.content}</ReactMarkdown>
            </div>
          )}
        </div>
        {!isUser && (msg.source || msg.confidence !== undefined) && (
          <div className="px-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <SourceBadge source={msg.source} />
              {msg.tools_used && msg.tools_used.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  Tools: {msg.tools_used.join(", ")}
                </span>
              )}
            </div>
            {msg.confidence !== undefined && <ConfidenceBar confidence={msg.confidence} />}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [sessionId, setSessionId] = useState<string>("");
  const [showSuggestions, setShowSuggestions] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("resume");
    const sid = sessionStorage.getItem("session_id");
    if (!raw || !sid) { router.push("/"); return; }
    setResume(JSON.parse(raw));
    setSessionId(sid);
    // Welcome message
    setMessages([{
      role: "assistant",
      content: `Hi! I've analyzed **${JSON.parse(raw).name || "the candidate"}'s** resume. Ask me anything — skills, experience, suitability for roles, or missing qualifications.`,
      source: "resume",
      confidence: 1.0,
      tools_used: [],
      timestamp: new Date(),
    }]);
  }, [router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading || !sessionId) return;

    setInput("");
    setShowSuggestions(false);

    const userMsg: ChatMessage = { role: "user", content: msg, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await api.chat(sessionId, msg);
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: res.answer,
        confidence: res.confidence,
        source: res.source,
        tools_used: res.tools_used,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to get response.");
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        source: "insufficient",
        confidence: 0,
        tools_used: [],
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  return (
    <main className="min-h-screen flex flex-col bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-4 py-3 border-b border-border glass">
        <div className="flex items-center gap-3">
          <Link href="/resume" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Resume
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-amber-500 to-amber-300 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-sm">AI Chat</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {resume && (
            <>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-glow" />
              <span className="text-xs text-muted-foreground hidden sm:inline">{resume.name || "Candidate"}</span>
              <Badge variant="outline" className="text-xs hidden sm:flex items-center gap-1">
                <Shield className="w-3 h-3 text-emerald-400" /> Hallucination-free
              </Badge>
            </>
          )}
          <Link href="/job-match" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-xs px-2 py-1 rounded-lg hover:bg-secondary ml-1">
            <Target className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Job Match</span>
          </Link>
        </div>
      </nav>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-5">
          {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}

          {/* Suggestions */}
          {showSuggestions && messages.length <= 1 && (
            <div className="animate-fade-in">
              <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
                <Zap className="w-3 h-3" /> Suggested questions
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUGGESTED_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    onClick={() => sendMessage(q)}
                    className="text-left text-xs px-3 py-2.5 rounded-xl glass hover:border-purple-500/40 hover:text-purple-300 transition-all duration-200 text-muted-foreground"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {loading && (
            <div className="flex gap-3 animate-fade-in">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="glass rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Analyzing resume...</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Scroll to bottom */}
      <div className="flex justify-center -mb-3 z-10">
        <button
          onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      </div>

      {/* Input */}
      <div className="sticky bottom-0 border-t border-border glass px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                id="chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about skills, experience, suitability..."
                className="resize-none bg-secondary border-border min-h-[48px] max-h-32 pr-4 text-sm rounded-xl placeholder:text-muted-foreground/60"
                rows={1}
                disabled={loading}
              />
            </div>
            <Button
              id="send-button"
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="bg-gradient-to-r from-amber-500 to-amber-400 hover:opacity-90 transition-opacity text-white border-0 h-12 w-12 p-0 rounded-xl flex-shrink-0"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Press Enter to send · Shift+Enter for new line · Answers sourced from resume only
          </p>
        </div>
      </div>
    </main>
  );
}
