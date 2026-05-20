from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


class TopicInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    pages: int = Field(gt=0, le=500)
    priority: int = Field(default=3, ge=1, le=5)
    resource_type: str = Field(default="Textbook", min_length=1, max_length=80)


class StudentProfileInput(BaseModel):
    name: str = Field(default="Student", min_length=1, max_length=80)
    class_level: str = Field(default="", max_length=40)
    age: int | None = Field(default=None, ge=3, le=30)
    parent_name: str = Field(default="", max_length=80)
    parent_contact: str = Field(default="", max_length=80)


class SubjectInput(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    topics: list[TopicInput] = Field(min_length=1)


class StudyPlanRequest(BaseModel):
    student_profile: StudentProfileInput | None = None
    student_name: str | None = Field(default=None, min_length=1, max_length=80)
    exam_date: date | None = None
    exam_start_date: date | None = None
    exam_end_date: date | None = None
    available_daily_minutes: int = Field(default=180, ge=30, le=720)
    minutes_per_page: int = Field(default=5, ge=1, le=30)
    session_minutes: int = Field(default=45, ge=20, le=90)
    break_minutes: int = Field(default=10, ge=5, le=30)
    study_strength_note: str = Field(default="", max_length=240)
    subjects: list[SubjectInput] = Field(min_length=1)


class PlanMetadata(BaseModel):
    student_name: str
    class_level: str = ""
    exam_date: date
    exam_start_date: date
    exam_end_date: date | None = None
    days_until_exam: int
    total_study_minutes: int
    average_daily_minutes: int
    required_daily_minutes: int
    available_daily_minutes: int
    daily_gap_minutes: int
    status: Literal["on_track", "tight", "behind"]
    recommendation: str
    resources_used: list[str] = Field(default_factory=list)
    study_strength_note: str = ""


class SubjectDistribution(BaseModel):
    subject: str
    estimated_minutes: int
    percentage: float


class PlanSession(BaseModel):
    kind: Literal["study", "revision", "practice"]
    subject: str
    topic: str
    resource_type: str = "Textbook"
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


class SavedStudyPlan(BaseModel):
    id: str
    student_name: str
    student_id: str | None = None
    created_at: datetime
    plan: StudyPlanResponse


class StudyPlanSaveRequest(BaseModel):
    plan: StudyPlanResponse
    student_id: str | None = Field(default=None, max_length=80)


class StudentAccountCreate(BaseModel):
    login_id: str = Field(min_length=5, max_length=120)
    access_code: str = Field(min_length=4, max_length=6, pattern=r"^\d{4,6}$")
    auth_uid: str | None = Field(default=None, max_length=160)
    name: str = Field(min_length=2, max_length=80)
    class_level: str = Field(min_length=1, max_length=40)
    age: int = Field(ge=3, le=30)
    school_name: str = Field(default="", max_length=120)


class StudentAccount(BaseModel):
    id: str
    login_id: str
    auth_uid: str | None = None
    name: str
    class_level: str
    age: int
    school_name: str = ""
    created_at: datetime


class ParentAccountCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    contact: str = Field(min_length=5, max_length=120)
    access_code: str = Field(min_length=4, max_length=6, pattern=r"^\d{4,6}$")
    relationship: str = Field(default="Parent", min_length=2, max_length=40)
    auth_uid: str | None = Field(default=None, max_length=160)


class ParentAccount(BaseModel):
    id: str
    auth_uid: str | None = None
    name: str
    contact: str
    relationship: str = "Parent"
    created_at: datetime


class ParentStudentLinkCreate(BaseModel):
    parent_id: str = Field(min_length=1, max_length=80)
    student_id: str = Field(min_length=1, max_length=80)


class ParentStudentLink(ParentStudentLinkCreate):
    id: str
    created_at: datetime


class FamilyAccount(BaseModel):
    parent: ParentAccount | None = None
    student: StudentAccount | None = None
    link: ParentStudentLink | None = None


class ParentFamilyAccount(BaseModel):
    parent: ParentAccount | None = None
    students: list[StudentAccount] = Field(default_factory=list)
    links: list[ParentStudentLink] = Field(default_factory=list)


class AccountSignInRequest(BaseModel):
    role: Literal["student", "parent"]
    login_id: str = Field(min_length=5, max_length=120)
    access_code: str = Field(min_length=4, max_length=6, pattern=r"^\d{4,6}$")


class FirebaseSignInRequest(BaseModel):
    role: Literal["student", "parent"]
    id_token: str = Field(min_length=20)


class AuthSession(BaseModel):
    role: Literal["student", "parent"]
    student: StudentAccount | None = None
    parent: ParentAccount | None = None
    students: list[StudentAccount] = Field(default_factory=list)


class StudySessionCompletionRequest(BaseModel):
    session_key: str = Field(min_length=1, max_length=240)
    study_date: date
    kind: Literal["study", "revision", "practice"]
    subject: str = Field(min_length=1, max_length=80)
    topic: str = Field(min_length=1, max_length=160)
    resource_type: str = Field(default="Textbook", min_length=1, max_length=80)
    minutes_planned: int = Field(ge=1, le=720)
    minutes_completed: int = Field(ge=1, le=720)
    recall_note: str = Field(min_length=10, max_length=480)
    confidence: int = Field(ge=1, le=5)


class StudySessionCompletion(BaseModel):
    id: str
    plan_id: str
    session_key: str
    study_date: date
    kind: Literal["study", "revision", "practice"]
    subject: str
    topic: str
    resource_type: str
    minutes_planned: int
    minutes_completed: int
    recall_note: str
    confidence: int
    completed_at: datetime


class DailyProgress(BaseModel):
    study_date: date
    planned_minutes: int
    completed_minutes: int
    planned_sessions: int
    completed_sessions: int
    completion_rate: float


class StudyPlanProgress(BaseModel):
    plan_id: str
    planned_minutes: int
    completed_minutes: int
    planned_sessions: int
    completed_sessions: int
    completion_rate: float
    completed_session_keys: list[str] = Field(default_factory=list)
    daily: list[DailyProgress] = Field(default_factory=list)
    completions: list[StudySessionCompletion] = Field(default_factory=list)


class DeleteResponse(BaseModel):
    deleted: bool


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
