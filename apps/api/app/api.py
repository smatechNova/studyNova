from datetime import date
from uuid import uuid4

from fastapi import APIRouter, HTTPException

from app.domain.study_planner import build_study_plan
from app.schemas import (
    CheckInRequest,
    CheckInResponse,
    ParentProgressSummary,
    SavedStudyPlan,
    StudyPlanRequest,
    StudyPlanResponse,
)
from app.storage import get_study_plan_store

router = APIRouter(prefix="/api/v1")

_check_ins: list[CheckInRequest] = []


@router.post("/study-plans/generate", response_model=StudyPlanResponse)
def generate_study_plan(payload: StudyPlanRequest) -> StudyPlanResponse:
    return build_study_plan(payload)


@router.post("/study-plans/save", response_model=SavedStudyPlan)
def save_study_plan(plan: StudyPlanResponse) -> SavedStudyPlan:
    return get_study_plan_store().save(plan)


@router.get("/study-plans/latest", response_model=SavedStudyPlan)
def get_latest_study_plan(student_name: str | None = None) -> SavedStudyPlan:
    saved_plan = get_study_plan_store().latest(student_name)
    if saved_plan is None:
        raise HTTPException(status_code=404, detail="No saved study plan found.")
    return saved_plan


@router.post("/progress/check-ins", response_model=CheckInResponse)
def create_check_in(payload: CheckInRequest) -> CheckInResponse:
    _check_ins.append(payload)
    return CheckInResponse(
        id=str(uuid4()),
        student_id=payload.student_id,
        study_date=payload.study_date,
        saved=True,
    )


@router.get(
    "/parents/{parent_id}/students/{student_id}/summary",
    response_model=ParentProgressSummary,
)
def get_parent_progress(parent_id: str, student_id: str) -> ParentProgressSummary:
    student_logs = [log for log in _check_ins if log.student_id == student_id]
    if not parent_id.strip() or not student_id.strip():
        raise HTTPException(status_code=400, detail="Parent and student ids are required.")

    total_minutes = sum(log.minutes_completed for log in student_logs)
    completed_sessions = sum(log.sessions_completed for log in student_logs)
    planned_sessions = sum(log.sessions_planned for log in student_logs)
    completion_rate = round((completed_sessions / planned_sessions) * 100, 1) if planned_sessions else 0

    active_days = {log.study_date for log in student_logs}
    today = date.today()
    streak_days = 0
    while today in active_days:
        streak_days += 1
        today = date.fromordinal(today.toordinal() - 1)

    return ParentProgressSummary(
        parent_id=parent_id,
        student_id=student_id,
        completion_rate=completion_rate,
        streak_days=streak_days,
        total_minutes=total_minutes,
        latest_note=student_logs[-1].note if student_logs else "No study activity has been recorded yet.",
    )
