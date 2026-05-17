from datetime import date
from typing import Literal

from pydantic import BaseModel, Field


class TopicInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    pages: int = Field(gt=0, le=500)
    priority: int = Field(default=3, ge=1, le=5)


class SubjectInput(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    topics: list[TopicInput] = Field(min_length=1)


class StudyPlanRequest(BaseModel):
    student_name: str = Field(default="Student", min_length=1, max_length=80)
    exam_date: date
    available_daily_minutes: int = Field(default=180, ge=30, le=720)
    minutes_per_page: int = Field(default=5, ge=1, le=30)
    session_minutes: int = Field(default=45, ge=20, le=90)
    break_minutes: int = Field(default=10, ge=5, le=30)
    subjects: list[SubjectInput] = Field(min_length=1)


class PlanMetadata(BaseModel):
    student_name: str
    exam_date: date
    days_until_exam: int
    total_study_minutes: int
    required_daily_minutes: int
    available_daily_minutes: int
    daily_gap_minutes: int
    status: Literal["on_track", "tight", "behind"]
    recommendation: str


class SubjectDistribution(BaseModel):
    subject: str
    estimated_minutes: int
    percentage: float


class PlanSession(BaseModel):
    kind: Literal["study", "revision"]
    subject: str
    topic: str
    minutes: int
    break_after_minutes: int


class DailyPlan(BaseModel):
    study_date: date
    total_minutes: int
    sessions: list[PlanSession]


class StudyPlanResponse(BaseModel):
    metadata: PlanMetadata
    subject_distribution: list[SubjectDistribution]
    schedule: list[DailyPlan]


class CheckInRequest(BaseModel):
    student_id: str = Field(min_length=1, max_length=80)
    study_date: date
    minutes_completed: int = Field(ge=0, le=720)
    sessions_completed: int = Field(ge=0, le=40)
    sessions_planned: int = Field(ge=0, le=40)
    note: str = Field(default="", max_length=240)


class CheckInResponse(BaseModel):
    id: str
    student_id: str
    study_date: date
    saved: bool


class ParentProgressSummary(BaseModel):
    parent_id: str
    student_id: str
    completion_rate: float
    streak_days: int
    total_minutes: int
    latest_note: str

