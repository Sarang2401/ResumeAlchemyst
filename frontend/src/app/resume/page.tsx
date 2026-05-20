"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ResumeData } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  User, Mail, Phone, MapPin, Briefcase, GraduationCap,
  Code2, FolderGit2, Award, Sparkles, MessageSquare,
  ArrowLeft, ChevronRight, ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ResumePage() {
  const router = useRouter();
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [sessionId, setSessionId] = useState<string>("");

  useEffect(() => {
    const raw = sessionStorage.getItem("resume");
    const sid = sessionStorage.getItem("session_id");
    if (!raw || !sid) { router.push("/"); return; }
    setResume(JSON.parse(raw));
    setSessionId(sid);
  }, [router]);

  if (!resume) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <main className="min-h-screen bg-background">
      {/* Top bar */}
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 border-b border-border glass">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </Link>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-purple-500 to-cyan-400 flex items-center justify-center">
              <Sparkles className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold text-sm">ResumeAlchemyst</span>
          </div>
        </div>
        <Button
          size="sm"
          className="bg-gradient-to-r from-purple-600 to-cyan-500 hover:opacity-90 transition-opacity text-white border-0"
          onClick={() => router.push("/chat")}
        >
          <MessageSquare className="w-4 h-4 mr-2" /> Ask AI
          <ChevronRight className="w-3 h-3 ml-1" />
        </Button>
      </nav>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Candidate header */}
        <div className="glass rounded-2xl p-6 mb-6 glow-purple animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-cyan-400/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
              <User className="w-7 h-7 text-purple-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-foreground mb-1">
                {resume.name || "Candidate"}
              </h1>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                {resume.email && (
                  <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{resume.email}</span>
                )}
                {resume.phone && (
                  <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{resume.phone}</span>
                )}
                {resume.location && (
                  <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{resume.location}</span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline" className="text-purple-400 border-purple-500/30 bg-purple-500/10">
                {resume.skills.length} skills
              </Badge>
              <Badge variant="outline" className="text-cyan-400 border-cyan-500/30 bg-cyan-500/10">
                {resume.experience.length} roles
              </Badge>
              <Badge variant="outline" className="text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                {resume.education.length} degrees
              </Badge>
            </div>
          </div>
          {resume.summary && (
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed border-t border-border pt-4">
              {resume.summary}
            </p>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="skills" className="animate-fade-in">
          <TabsList className="bg-secondary border border-border mb-6 w-full sm:w-auto">
            <TabsTrigger value="skills" className="gap-1.5"><Code2 className="w-3.5 h-3.5" />Skills</TabsTrigger>
            <TabsTrigger value="experience" className="gap-1.5"><Briefcase className="w-3.5 h-3.5" />Experience</TabsTrigger>
            <TabsTrigger value="education" className="gap-1.5"><GraduationCap className="w-3.5 h-3.5" />Education</TabsTrigger>
            <TabsTrigger value="projects" className="gap-1.5"><FolderGit2 className="w-3.5 h-3.5" />Projects</TabsTrigger>
            {resume.certifications.length > 0 && (
              <TabsTrigger value="certs" className="gap-1.5"><Award className="w-3.5 h-3.5" />Certs</TabsTrigger>
            )}
          </TabsList>

          {/* Skills */}
          <TabsContent value="skills">
            <div className="glass rounded-2xl p-6">
              <h2 className="font-semibold mb-4 text-sm text-muted-foreground uppercase tracking-wider">Technical Skills</h2>
              {resume.skills.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {resume.skills.map((skill) => (
                    <Badge key={skill} variant="secondary" className="text-sm py-1 px-3 hover:bg-purple-500/20 hover:text-purple-300 transition-colors cursor-default">
                      {skill}
                    </Badge>
                  ))}
                </div>
              ) : (
                <EmptyState label="No skills extracted" />
              )}
            </div>
          </TabsContent>

          {/* Experience */}
          <TabsContent value="experience">
            <div className="space-y-4">
              {resume.experience.length > 0 ? resume.experience.map((exp, i) => (
                <div key={i} className="glass rounded-2xl p-5 hover:border-purple-500/30 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-2 mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{exp.role || "Role"}</h3>
                      <p className="text-muted-foreground text-sm">{exp.company}</p>
                    </div>
                    {exp.duration && (
                      <Badge variant="outline" className="text-xs text-muted-foreground self-start flex-shrink-0">
                        {exp.duration}
                      </Badge>
                    )}
                  </div>
                  {exp.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed mb-3">{exp.description}</p>
                  )}
                  {exp.technologies.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {exp.technologies.map((t) => (
                        <Badge key={t} variant="outline" className="text-xs text-cyan-400 border-cyan-500/20 bg-cyan-500/5">{t}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              )) : <EmptyState label="No experience extracted" />}
            </div>
          </TabsContent>

          {/* Education */}
          <TabsContent value="education">
            <div className="space-y-4">
              {resume.education.length > 0 ? resume.education.map((edu, i) => (
                <div key={i} className="glass rounded-2xl p-5 hover:border-purple-500/30 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{edu.institution}</h3>
                      <p className="text-muted-foreground text-sm">{edu.degree}{edu.field ? ` · ${edu.field}` : ""}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      {edu.year && <Badge variant="outline" className="text-xs">{edu.year}</Badge>}
                      {edu.gpa && <Badge variant="outline" className="text-xs text-emerald-400 border-emerald-500/30">GPA {edu.gpa}</Badge>}
                    </div>
                  </div>
                </div>
              )) : <EmptyState label="No education extracted" />}
            </div>
          </TabsContent>

          {/* Projects */}
          <TabsContent value="projects">
            <div className="space-y-4">
              {resume.projects.length > 0 ? resume.projects.map((proj, i) => (
                <div key={i} className="glass rounded-2xl p-5 hover:border-purple-500/30 transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-foreground">{proj.name}</h3>
                    {proj.url && (
                      <a href={proj.url} target="_blank" rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-cyan-400 transition-colors flex-shrink-0">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                  {proj.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed mb-3">{proj.description}</p>
                  )}
                  {proj.technologies.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {proj.technologies.map((t) => (
                        <Badge key={t} variant="outline" className="text-xs text-cyan-400 border-cyan-500/20 bg-cyan-500/5">{t}</Badge>
                      ))}
                    </div>
                  )}
                </div>
              )) : <EmptyState label="No projects extracted" />}
            </div>
          </TabsContent>

          {/* Certifications */}
          <TabsContent value="certs">
            <div className="space-y-3">
              {resume.certifications.map((cert, i) => (
                <div key={i} className="glass rounded-xl p-4 flex items-center gap-3 hover:border-purple-500/30 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                    <Award className="w-4 h-4 text-yellow-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{cert.name}</p>
                    {cert.issuer && <p className="text-muted-foreground text-xs">{cert.issuer}</p>}
                  </div>
                  {cert.year && <Badge variant="outline" className="text-xs flex-shrink-0">{cert.year}</Badge>}
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* CTA */}
        <div className="mt-8 gradient-border rounded-2xl p-px">
          <div className="rounded-2xl bg-card p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-foreground">Ready to ask questions?</p>
              <p className="text-muted-foreground text-sm">Chat with the AI about this candidate.</p>
            </div>
            <Button
              className="bg-gradient-to-r from-purple-600 to-cyan-500 hover:opacity-90 transition-opacity text-white border-0 w-full sm:w-auto"
              onClick={() => router.push("/chat")}
            >
              <MessageSquare className="w-4 h-4 mr-2" /> Open AI Chat
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-center py-8 text-muted-foreground text-sm">
      <p>{label}</p>
    </div>
  );
}
