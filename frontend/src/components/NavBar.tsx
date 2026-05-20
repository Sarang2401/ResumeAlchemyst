"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileText, MessageSquare, Target, LogOut, Menu, X, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function NavBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [candidateName, setCandidateName] = useState<string>("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("resume");
    if (raw) {
      try {
        const resume = JSON.parse(raw);
        if (resume && resume.name) {
          setCandidateName(resume.name);
        }
      } catch (e) {
        console.error("Failed to parse resume from sessionStorage", e);
      }
    }
  }, [pathname]);

  const handleReset = () => {
    sessionStorage.removeItem("resume");
    sessionStorage.removeItem("session_id");
    router.push("/");
  };

  const navItems = [
    { href: "/resume", label: "Candidate Profile", icon: <User className="w-4 h-4" /> },
    { href: "/chat", label: "AI Chat Assistant", icon: <MessageSquare className="w-4 h-4" /> },
    { href: "/job-match", label: "Job Matcher", icon: <Target className="w-4 h-4" /> },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/50 glass">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo and Brand */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-300 flex items-center justify-center shadow-md shadow-amber-500/10 group-hover:scale-[1.02] transition-transform">
                <Sparkles className="w-4.5 h-4.5 text-white" />
              </div>
              <span className="font-bold text-base tracking-tight text-foreground group-hover:text-amber-400 transition-colors">
                ResumeAlchemyst
              </span>
            </Link>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider text-amber-500 border-amber-500/30 px-1.5 py-0 bg-amber-500/5 hidden sm:flex">
              Beta
            </Badge>
          </div>

          {/* Center Navigation Links (Desktop) */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200
                    ${isActive
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-sm shadow-amber-500/5"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60 border border-transparent"
                    }
                  `}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Right Status and Action Buttons (Desktop) */}
          <div className="hidden md:flex items-center gap-4">
            {candidateName && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-xs text-emerald-400">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="max-w-[140px] truncate font-medium">{candidateName}</span>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/5 hover:border-destructive/30 rounded-xl"
            >
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              Upload New
            </Button>
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden items-center gap-2">
            {candidateName && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-[11px] text-emerald-400">
                <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                <span className="max-w-[80px] truncate font-medium">{candidateName.split(" ")[0]}</span>
              </div>
            )}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/80 focus:outline-none"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border/40 bg-background/95 backdrop-blur-md px-4 pt-2 pb-4 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors
                  ${isActive
                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                  }
                `}
              >
                {item.icon}
                {item.label}
              </Link>
            );
          })}
          <div className="pt-2 border-t border-border/40">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                handleReset();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border border-destructive/20 text-destructive bg-destructive/5 hover:bg-destructive/10"
            >
              <LogOut className="w-4 h-4" />
              Upload New Resume
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
