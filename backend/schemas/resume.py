from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from pydantic import ConfigDict


class ExperienceItem(BaseModel):
    model_config = ConfigDict(extra="allow")

    company: str = ""
    role: str = ""
    duration: str = ""
    description: str = ""
    technologies: list[str] = []


class EducationItem(BaseModel):
    model_config = ConfigDict(extra="allow")

    institution: str = ""
    degree: str = ""
    field: str = ""
    year: str = ""
    gpa: Optional[str] = None


class ProjectItem(BaseModel):
    model_config = ConfigDict(extra="allow")

    name: str = ""
    description: str = ""
    technologies: list[str] = []
    url: Optional[str] = None


class CertificationItem(BaseModel):
    name: str = ""
    issuer: str = ""
    year: str = ""


class ResumeSchema(BaseModel):
    model_config = ConfigDict(extra="allow")

    name: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    summary: str = ""
    skills: list[str] = []
    experience: list[ExperienceItem] = []
    education: list[EducationItem] = []
    projects: list[ProjectItem] = []
    certifications: list[CertificationItem] = []
    raw_text: str = ""


class ParseResumeResponse(BaseModel):
    session_id: str
    resume: ResumeSchema
    message: str = "Resume parsed successfully"
