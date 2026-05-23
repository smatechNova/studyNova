from fastapi import APIRouter, HTTPException

from app.auth import FirebaseAuthUnavailable, InvalidFirebaseToken, verify_firebase_id_token
from app.domain.study_planner import build_rebalanced_study_plan, build_study_plan
from app.schemas import (
    AccountSignInRequest,
    AuthSession,
    CheckInRequest,
    CheckInResponse,
    DeleteResponse,
    FamilyAccount,
    FirebaseSignInRequest,
    ParentAccount,
    ParentAccountCreate,
    ParentFamilyAccount,
    ParentProgressSummary,
    ParentStudentLink,
    ParentStudentLinkCreate,
    SavedStudyPlan,
    StudentAccount,
    StudentAccountCreate,
    StudyReminderSettings,
    StudyReminderSettingsUpdate,
    StudyPlanProgress,
    StudyPlanRequest,
    StudyPlanResponse,
    StudyPlanSaveRequest,
    StudySessionCompletion,
    StudySessionCompletionRequest,
    WeeklyStudyDigest,
)
from app.storage import AccountAccessCodeError, get_study_plan_store

router = APIRouter(prefix="/api/v1")


@router.post("/accounts/students", response_model=StudentAccount)
def create_student_account(payload: StudentAccountCreate) -> StudentAccount:
    try:
        return get_study_plan_store().create_student_account(payload)
    except AccountAccessCodeError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


@router.post("/accounts/parents", response_model=ParentAccount)
def create_parent_account(payload: ParentAccountCreate) -> ParentAccount:
    try:
        return get_study_plan_store().create_parent_account(payload)
    except AccountAccessCodeError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


@router.post("/accounts/links", response_model=ParentStudentLink)
def link_parent_student(payload: ParentStudentLinkCreate) -> ParentStudentLink:
    link = get_study_plan_store().link_parent_student(payload)
    if link is None:
        raise HTTPException(status_code=404, detail="Parent or student account was not found.")
    return link


@router.post("/accounts/sign-in", response_model=AuthSession)
def sign_in_account(payload: AccountSignInRequest) -> AuthSession:
    session = get_study_plan_store().sign_in(payload)
    if session is None:
        raise HTTPException(status_code=404, detail="No account matched that role, sign-in ID, and access code.")
    return session


@router.post("/accounts/firebase-sign-in", response_model=AuthSession)
def firebase_sign_in_account(payload: FirebaseSignInRequest) -> AuthSession:
    try:
        identity = verify_firebase_id_token(payload.id_token)
    except FirebaseAuthUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except InvalidFirebaseToken as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    session = get_study_plan_store().firebase_sign_in(payload.role, identity.uid, identity.login_id)
    if session is None:
        raise HTTPException(status_code=404, detail="No StudyNova account matched this Google sign-in.")
    return session


@router.get("/accounts/students/{student_id}/family", response_model=FamilyAccount)
def get_student_family_account(student_id: str) -> FamilyAccount:
    family = get_study_plan_store().student_family(student_id)
    if family.student is None:
        raise HTTPException(status_code=404, detail="Student account was not found.")
    return family


@router.get("/accounts/family/latest", response_model=FamilyAccount)
def get_latest_family_account() -> FamilyAccount:
    return get_study_plan_store().latest_family()


@router.get("/accounts/parents/latest/family", response_model=ParentFamilyAccount)
def get_latest_parent_family_account() -> ParentFamilyAccount:
    return get_study_plan_store().latest_parent_family()


@router.get("/accounts/parents/{parent_id}/family", response_model=ParentFamilyAccount)
def get_parent_family_account(parent_id: str) -> ParentFamilyAccount:
    family = get_study_plan_store().parent_family(parent_id)
    if family.parent is None:
        raise HTTPException(status_code=404, detail="Parent account was not found.")
    return family


@router.post("/study-plans/generate", response_model=StudyPlanResponse)
def generate_study_plan(payload: StudyPlanRequest) -> StudyPlanResponse:
    return build_study_plan(payload)


@router.post("/study-plans/save", response_model=SavedStudyPlan)
def save_study_plan(payload: StudyPlanSaveRequest) -> SavedStudyPlan:
    return get_study_plan_store().save(payload.plan, payload.student_id, payload.setup_payload)


@router.get("/study-plans/latest", response_model=SavedStudyPlan)
def get_latest_study_plan(
    student_name: str | None = None,
    student_id: str | None = None,
) -> SavedStudyPlan:
    saved_plan = get_study_plan_store().latest(student_name=student_name, student_id=student_id)
    if saved_plan is None:
        raise HTTPException(status_code=404, detail="No saved study plan found.")
    return saved_plan


@router.get("/study-plans/history", response_model=list[SavedStudyPlan])
def get_study_plan_history(
    student_name: str | None = None,
    student_id: str | None = None,
    limit: int = 20,
) -> list[SavedStudyPlan]:
    return get_study_plan_store().history(student_name=student_name, student_id=student_id, limit=limit)


@router.get("/study-plans/{plan_id}/progress", response_model=StudyPlanProgress)
def get_study_plan_progress(plan_id: str) -> StudyPlanProgress:
    progress = get_study_plan_store().progress(plan_id)
    if progress is None:
        raise HTTPException(status_code=404, detail="No saved study plan found.")
    return progress


@router.get("/study-plans/{plan_id}/weekly-digest", response_model=WeeklyStudyDigest)
def get_study_weekly_digest(plan_id: str) -> WeeklyStudyDigest:
    digest = get_study_plan_store().weekly_digest(plan_id)
    if digest is None:
        raise HTTPException(status_code=404, detail="No saved study plan found.")
    return digest


@router.get("/study-plans/{plan_id}/reminders", response_model=StudyReminderSettings)
def get_study_reminder_settings(plan_id: str) -> StudyReminderSettings:
    settings = get_study_plan_store().reminder_settings(plan_id)
    if settings is None:
        raise HTTPException(status_code=404, detail="No saved study plan found.")
    return settings


@router.put("/study-plans/{plan_id}/reminders", response_model=StudyReminderSettings)
def update_study_reminder_settings(
    plan_id: str,
    payload: StudyReminderSettingsUpdate,
) -> StudyReminderSettings:
    settings = get_study_plan_store().upsert_reminder_settings(plan_id, payload)
    if settings is None:
        raise HTTPException(status_code=404, detail="No saved study plan found.")
    return settings


@router.post("/study-plans/{plan_id}/reschedule", response_model=SavedStudyPlan)
def reschedule_study_plan(plan_id: str) -> SavedStudyPlan:
    store = get_study_plan_store()
    saved_plan = store.by_id(plan_id)
    if saved_plan is None:
        raise HTTPException(status_code=404, detail="No saved study plan found.")

    progress = store.progress(plan_id)
    completed_keys = set(progress.completed_session_keys if progress is not None else [])
    rebalanced_plan = build_rebalanced_study_plan(saved_plan.plan, completed_keys)
    return store.save(rebalanced_plan, saved_plan.student_id, saved_plan.setup_payload)


@router.post(
    "/study-plans/{plan_id}/session-completions",
    response_model=StudySessionCompletion,
)
def complete_study_session(
    plan_id: str,
    payload: StudySessionCompletionRequest,
) -> StudySessionCompletion:
    store = get_study_plan_store()
    if store.by_id(plan_id) is None:
        raise HTTPException(status_code=404, detail="No saved study plan found.")

    return store.complete_session(plan_id, payload)


@router.delete(
    "/study-plans/{plan_id}/session-completions/{session_key}",
    response_model=DeleteResponse,
)
def delete_study_session_completion(plan_id: str, session_key: str) -> DeleteResponse:
    deleted = get_study_plan_store().delete_completion(plan_id, session_key)
    return DeleteResponse(deleted=deleted)


@router.post("/progress/check-ins", response_model=CheckInResponse)
def create_check_in(payload: CheckInRequest) -> CheckInResponse:
    return get_study_plan_store().create_check_in(payload)


@router.get(
    "/parents/{parent_id}/students/{student_id}/summary",
    response_model=ParentProgressSummary,
)
def get_parent_progress(parent_id: str, student_id: str) -> ParentProgressSummary:
    if not parent_id.strip() or not student_id.strip():
        raise HTTPException(status_code=400, detail="Parent and student ids are required.")

    summary = get_study_plan_store().parent_progress_summary(parent_id, student_id)
    if summary is None:
        raise HTTPException(status_code=404, detail="Parent and student are not linked.")

    return summary
