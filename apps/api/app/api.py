import hashlib
import hmac
import re
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import FileResponse

from app.auth import FirebaseAuthUnavailable, InvalidFirebaseToken, firebase_auth_readiness, verify_firebase_id_token
from app.config import get_settings
from app.domain.study_planner import build_rebalanced_study_plan, build_study_plan
from app.schemas import (
    AccountRecoveryRequestCreate,
    AccountRecoveryRequestRecord,
    AccountRecoveryRequestReceipt,
    AccountRecoveryReviewRequest,
    AccountSignInRequest,
    AuthSession,
    CheckInRequest,
    CheckInResponse,
    DeleteResponse,
    DeploymentCheck,
    DeploymentReadiness,
    FamilyAccount,
    FirebaseAuthReadiness,
    FirebaseSignInRequest,
    ParentAccount,
    ParentAccountCreate,
    ParentFamilyAccount,
    ParentInviteCode,
    ParentInviteRedeemRequest,
    ParentProgressSummary,
    ParentStudentLink,
    ParentStudentLinkCreate,
    SavedStudyPlan,
    StorageBackupReceipt,
    StorageHealth,
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


@dataclass(frozen=True)
class SessionIdentity:
    role: str
    account_id: str


def _session_message(role: str, account_id: str, expires_at: int) -> str:
    return f"{role}:{account_id}:{expires_at}"


def _session_signature(role: str, account_id: str, expires_at: int) -> str:
    secret = get_settings().session_secret.encode("utf-8")
    return hmac.new(secret, _session_message(role, account_id, expires_at).encode("utf-8"), hashlib.sha256).hexdigest()


def _session_expires_at() -> datetime:
    ttl_hours = max(1, get_settings().session_ttl_hours)
    return datetime.now(UTC) + timedelta(hours=ttl_hours)


def _session_token(role: str, account_id: str, expires_at: datetime) -> str:
    expires_timestamp = int(expires_at.timestamp())
    return f"{role}.{account_id}.{expires_timestamp}.{_session_signature(role, account_id, expires_timestamp)}"


def _with_session_token(session: AuthSession) -> AuthSession:
    expires_at = _session_expires_at()
    if session.role == "student" and session.student is not None:
        return session.model_copy(
            update={
                "session_token": _session_token("student", session.student.id, expires_at),
                "session_expires_at": expires_at,
            }
        )
    if session.role == "parent" and session.parent is not None:
        return session.model_copy(
            update={
                "session_token": _session_token("parent", session.parent.id, expires_at),
                "session_expires_at": expires_at,
            }
        )
    return session


def require_session(authorization: str | None = Header(default=None)) -> SessionIdentity:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Sign in required.")

    token = authorization.removeprefix("Bearer ").strip()
    parts = token.split(".")
    if len(parts) != 4:
        raise HTTPException(status_code=401, detail="Invalid sign-in session.")

    role, account_id, expires_at_raw, signature = parts
    if role not in {"student", "parent"} or not account_id:
        raise HTTPException(status_code=401, detail="Invalid sign-in session.")

    try:
        expires_at = int(expires_at_raw)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid sign-in session.") from exc

    if expires_at <= int(datetime.now(UTC).timestamp()):
        raise HTTPException(status_code=401, detail="Sign-in session expired.")

    expected_signature = _session_signature(role, account_id, expires_at)
    if not hmac.compare_digest(signature, expected_signature):
        raise HTTPException(status_code=401, detail="Invalid sign-in session.")

    return SessionIdentity(role=role, account_id=account_id)


def _deny_access() -> None:
    raise HTTPException(status_code=403, detail="You do not have access to this resource.")


def _require_student_session(session: SessionIdentity) -> None:
    if session.role != "student":
        _deny_access()


def _require_parent_session(session: SessionIdentity) -> None:
    if session.role != "parent":
        _deny_access()


def require_admin(x_admin_code: str | None = Header(default=None, alias="X-Admin-Code")) -> None:
    settings = get_settings()
    expected_code = settings.admin_access_code.strip()
    if not expected_code or (settings.is_production and settings.uses_default_admin_access_code):
        raise HTTPException(status_code=503, detail="Admin support access is not configured.")

    if not x_admin_code or not hmac.compare_digest(x_admin_code, expected_code):
        raise HTTPException(status_code=403, detail="Admin access required.")


def _deployment_check(name: str, status: Literal["pass", "warning", "fail"], message: str) -> DeploymentCheck:
    return DeploymentCheck(name=name, status=status, message=message)


def _safe_backup_path(filename: str) -> Path:
    if not re.fullmatch(r"studynova-\d{8}T\d{6}Z\.sqlite3", filename):
        raise HTTPException(status_code=404, detail="Backup file was not found.")

    backup_directory = Path(get_settings().backup_data_path).resolve()
    backup_path = (backup_directory / filename).resolve()
    if backup_directory not in backup_path.parents or not backup_path.exists() or not backup_path.is_file():
        raise HTTPException(status_code=404, detail="Backup file was not found.")

    return backup_path


def _build_deployment_readiness() -> DeploymentReadiness:
    settings = get_settings()
    checks: list[DeploymentCheck] = []

    checks.append(
        _deployment_check(
            "Environment",
            "pass" if settings.is_production else "fail",
            "APP_ENV is production."
            if settings.is_production
            else "Set APP_ENV=production before Play Store testing.",
        )
    )

    public_api_base_url = settings.public_api_base_url.strip().rstrip("/")
    checks.append(
        _deployment_check(
            "Public API URL",
            "pass" if public_api_base_url.startswith("https://") else "fail",
            "Stable HTTPS API URL is configured."
            if public_api_base_url.startswith("https://")
            else "Set PUBLIC_API_BASE_URL to the deployed HTTPS API host.",
        )
    )

    storage_health = get_study_plan_store().storage_health(settings.backup_data_path, production=True)
    checks.append(
        _deployment_check(
            "Persistent storage",
            "pass" if storage_health.production_ready else "fail",
            "SQLite data and backup paths look production-ready."
            if storage_health.production_ready
            else "Move LOCAL_DATA_PATH and BACKUP_DATA_PATH to absolute persistent disk paths.",
        )
    )

    checks.append(
        _deployment_check(
            "Database file",
            "pass" if storage_health.database_exists else "warning",
            "Database file exists and schema is initialized."
            if storage_health.database_exists
            else "Database file has not been created yet. Start the API once, then recheck.",
        )
    )

    strong_session_secret = not settings.uses_default_session_secret and len(settings.session_secret.strip()) >= 32
    checks.append(
        _deployment_check(
            "Session secret",
            "pass" if strong_session_secret else "fail",
            "SESSION_SECRET is non-default and long enough."
            if strong_session_secret
            else "Set SESSION_SECRET to a private random value with at least 32 characters.",
        )
    )

    strong_admin_code = not settings.uses_default_admin_access_code and len(settings.admin_access_code.strip()) >= 8
    checks.append(
        _deployment_check(
            "Admin access code",
            "pass" if strong_admin_code else "fail",
            "ADMIN_ACCESS_CODE is non-default."
            if strong_admin_code
            else "Set ADMIN_ACCESS_CODE to a private value with at least 8 characters.",
        )
    )

    allowed_origins = settings.cors_origins
    cors_uses_default_dev = any("localhost" in origin for origin in allowed_origins) or (
        "app.github.dev" in settings.allowed_origin_regex
    )
    cors_uses_wildcard = "*" in allowed_origins or settings.allowed_origin_regex.strip() == ".*"
    cors_locked = not cors_uses_default_dev and not cors_uses_wildcard
    checks.append(
        _deployment_check(
            "CORS policy",
            "pass" if cors_locked else "fail",
            "CORS does not include localhost, Codespaces, or wildcard development access."
            if cors_locked
            else "Clear localhost/Codespaces CORS settings before production testing.",
        )
    )

    firebase_status = firebase_auth_readiness()
    firebase_ready = bool(firebase_status["server_verification_ready"])
    checks.append(
        _deployment_check(
            "Firebase verification",
            "pass" if firebase_ready else "warning",
            "Firebase ID token verification is configured."
            if firebase_ready
            else "Google sign-in will need Firebase service credentials before production rollout.",
        )
    )

    return DeploymentReadiness(
        environment=settings.app_env,
        production=settings.is_production,
        public_api_base_url=public_api_base_url,
        ready=all(check.status == "pass" for check in checks),
        checks=checks,
    )


def _require_own_student(session: SessionIdentity, student_id: str) -> None:
    if session.role != "student" or session.account_id != student_id:
        _deny_access()


def _require_own_parent(session: SessionIdentity, parent_id: str) -> None:
    if session.role != "parent" or session.account_id != parent_id:
        _deny_access()


def _parent_has_student(parent_id: str, student_id: str) -> bool:
    family = get_study_plan_store().parent_family(parent_id)
    return any(student.id == student_id for student in family.students)


def _require_student_visible_to_parent(session: SessionIdentity, student_id: str) -> None:
    _require_parent_session(session)
    if not _parent_has_student(session.account_id, student_id):
        _deny_access()


def _resolve_readable_student_id(session: SessionIdentity, student_id: str | None) -> str:
    if session.role == "student":
        if student_id and student_id != session.account_id:
            _deny_access()
        return session.account_id

    _require_parent_session(session)
    if not student_id:
        family = get_study_plan_store().parent_family(session.account_id)
        if len(family.students) != 1:
            raise HTTPException(status_code=400, detail="Choose which linked student to view.")
        return family.students[0].id

    _require_student_visible_to_parent(session, student_id)
    return student_id


def _require_readable_plan(plan_id: str, session: SessionIdentity) -> SavedStudyPlan:
    saved_plan = get_study_plan_store().by_id(plan_id)
    if saved_plan is None:
        raise HTTPException(status_code=404, detail="No saved study plan found.")
    if saved_plan.student_id is None:
        _deny_access()
    if session.role == "student":
        if saved_plan.student_id != session.account_id:
            _deny_access()
    else:
        _require_student_visible_to_parent(session, saved_plan.student_id)
    return saved_plan


def _require_student_plan_owner(plan_id: str, session: SessionIdentity) -> SavedStudyPlan:
    _require_student_session(session)
    saved_plan = get_study_plan_store().by_id(plan_id)
    if saved_plan is None:
        raise HTTPException(status_code=404, detail="No saved study plan found.")
    if saved_plan.student_id != session.account_id:
        _deny_access()
    return saved_plan


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


@router.post("/accounts/students/{student_id}/parent-invites", response_model=ParentInviteCode)
def create_parent_invite_code(
    student_id: str,
    session: SessionIdentity = Depends(require_session),
) -> ParentInviteCode:
    _require_own_student(session, student_id)
    invite = get_study_plan_store().create_parent_invite_code(student_id)
    if invite is None:
        raise HTTPException(status_code=404, detail="Student account was not found.")
    return invite


@router.post("/accounts/parents/{parent_id}/parent-invites/redeem", response_model=ParentFamilyAccount)
def redeem_parent_invite_code(
    parent_id: str,
    payload: ParentInviteRedeemRequest,
    session: SessionIdentity = Depends(require_session),
) -> ParentFamilyAccount:
    _require_own_parent(session, parent_id)
    link = get_study_plan_store().redeem_parent_invite_code(parent_id, payload.code)
    if link is None:
        raise HTTPException(status_code=404, detail="Invite code is invalid, expired, or already used.")
    return get_study_plan_store().parent_family(parent_id)


@router.post("/accounts/sign-in", response_model=AuthSession)
def sign_in_account(payload: AccountSignInRequest) -> AuthSession:
    session = get_study_plan_store().sign_in(payload)
    if session is None:
        raise HTTPException(status_code=404, detail="No account matched that role, sign-in ID, and access code.")
    return _with_session_token(session)


@router.post("/accounts/recovery-requests", response_model=AccountRecoveryRequestReceipt)
def create_account_recovery_request(payload: AccountRecoveryRequestCreate) -> AccountRecoveryRequestReceipt:
    return get_study_plan_store().create_account_recovery_request(payload)


@router.get("/admin/account-recovery-requests", response_model=list[AccountRecoveryRequestRecord])
def get_account_recovery_requests(
    limit: int = 50,
    _: None = Depends(require_admin),
) -> list[AccountRecoveryRequestRecord]:
    return get_study_plan_store().account_recovery_requests(limit=limit)


@router.patch("/admin/account-recovery-requests/{request_id}", response_model=AccountRecoveryRequestRecord)
def review_account_recovery_request(
    request_id: str,
    payload: AccountRecoveryReviewRequest,
    _: None = Depends(require_admin),
) -> AccountRecoveryRequestRecord:
    request = get_study_plan_store().review_account_recovery_request(request_id, payload)
    if request is None:
        raise HTTPException(status_code=404, detail="Account recovery request was not found.")
    return request


@router.get("/admin/storage/health", response_model=StorageHealth)
def get_admin_storage_health(_: None = Depends(require_admin)) -> StorageHealth:
    settings = get_settings()
    return get_study_plan_store().storage_health(
        backup_directory=settings.backup_data_path,
        production=settings.is_production,
    )


@router.post("/admin/storage/backups", response_model=StorageBackupReceipt)
def create_admin_storage_backup(_: None = Depends(require_admin)) -> StorageBackupReceipt:
    return get_study_plan_store().create_backup(get_settings().backup_data_path)


@router.get("/admin/storage/backups", response_model=list[StorageBackupReceipt])
def get_admin_storage_backups(
    limit: int = 20,
    _: None = Depends(require_admin),
) -> list[StorageBackupReceipt]:
    return get_study_plan_store().list_backups(get_settings().backup_data_path, limit=limit)


@router.get("/admin/storage/backups/{filename}")
def download_admin_storage_backup(
    filename: str,
    _: None = Depends(require_admin),
) -> FileResponse:
    backup_path = _safe_backup_path(filename)
    return FileResponse(
        backup_path,
        filename=backup_path.name,
        media_type="application/x-sqlite3",
    )


@router.get("/admin/auth/firebase/readiness", response_model=FirebaseAuthReadiness)
def get_admin_firebase_auth_readiness(_: None = Depends(require_admin)) -> FirebaseAuthReadiness:
    return FirebaseAuthReadiness(**firebase_auth_readiness())


@router.get("/admin/deployment/readiness", response_model=DeploymentReadiness)
def get_admin_deployment_readiness(_: None = Depends(require_admin)) -> DeploymentReadiness:
    return _build_deployment_readiness()


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
    return _with_session_token(session)


@router.get("/accounts/students/{student_id}/family", response_model=FamilyAccount)
def get_student_family_account(
    student_id: str,
    session: SessionIdentity = Depends(require_session),
) -> FamilyAccount:
    _require_own_student(session, student_id)
    family = get_study_plan_store().student_family(student_id)
    if family.student is None:
        raise HTTPException(status_code=404, detail="Student account was not found.")
    return family


@router.get("/accounts/family/latest", response_model=FamilyAccount)
def get_latest_family_account(session: SessionIdentity = Depends(require_session)) -> FamilyAccount:
    if session.role == "student":
        return get_study_plan_store().student_family(session.account_id)

    family = get_study_plan_store().parent_family(session.account_id)
    student = family.students[0] if family.students else None
    link = family.links[0] if family.links else None
    return FamilyAccount(parent=family.parent, student=student, link=link)


@router.get("/accounts/parents/latest/family", response_model=ParentFamilyAccount)
def get_latest_parent_family_account(session: SessionIdentity = Depends(require_session)) -> ParentFamilyAccount:
    _require_parent_session(session)
    return get_study_plan_store().parent_family(session.account_id)


@router.get("/accounts/parents/{parent_id}/family", response_model=ParentFamilyAccount)
def get_parent_family_account(
    parent_id: str,
    session: SessionIdentity = Depends(require_session),
) -> ParentFamilyAccount:
    _require_own_parent(session, parent_id)
    family = get_study_plan_store().parent_family(parent_id)
    if family.parent is None:
        raise HTTPException(status_code=404, detail="Parent account was not found.")
    return family


@router.post("/study-plans/generate", response_model=StudyPlanResponse)
def generate_study_plan(payload: StudyPlanRequest) -> StudyPlanResponse:
    return build_study_plan(payload)


@router.post("/study-plans/save", response_model=SavedStudyPlan)
def save_study_plan(
    payload: StudyPlanSaveRequest,
    session: SessionIdentity = Depends(require_session),
) -> SavedStudyPlan:
    _require_student_session(session)
    return get_study_plan_store().save(payload.plan, session.account_id, payload.setup_payload)


@router.get("/study-plans/latest", response_model=SavedStudyPlan)
def get_latest_study_plan(
    student_name: str | None = None,
    student_id: str | None = None,
    session: SessionIdentity = Depends(require_session),
) -> SavedStudyPlan:
    readable_student_id = _resolve_readable_student_id(session, student_id)
    saved_plan = get_study_plan_store().latest(student_name=None, student_id=readable_student_id)
    if saved_plan is None:
        raise HTTPException(status_code=404, detail="No saved study plan found.")
    return saved_plan


@router.get("/study-plans/history", response_model=list[SavedStudyPlan])
def get_study_plan_history(
    student_name: str | None = None,
    student_id: str | None = None,
    limit: int = 20,
    session: SessionIdentity = Depends(require_session),
) -> list[SavedStudyPlan]:
    readable_student_id = _resolve_readable_student_id(session, student_id)
    return get_study_plan_store().history(student_name=None, student_id=readable_student_id, limit=limit)


@router.get("/study-plans/{plan_id}/progress", response_model=StudyPlanProgress)
def get_study_plan_progress(
    plan_id: str,
    session: SessionIdentity = Depends(require_session),
) -> StudyPlanProgress:
    _require_readable_plan(plan_id, session)
    progress = get_study_plan_store().progress(plan_id)
    if progress is None:
        raise HTTPException(status_code=404, detail="No saved study plan found.")
    return progress


@router.get("/study-plans/{plan_id}/weekly-digest", response_model=WeeklyStudyDigest)
def get_study_weekly_digest(
    plan_id: str,
    session: SessionIdentity = Depends(require_session),
) -> WeeklyStudyDigest:
    _require_readable_plan(plan_id, session)
    digest = get_study_plan_store().weekly_digest(plan_id)
    if digest is None:
        raise HTTPException(status_code=404, detail="No saved study plan found.")
    return digest


@router.get("/study-plans/{plan_id}/reminders", response_model=StudyReminderSettings)
def get_study_reminder_settings(
    plan_id: str,
    session: SessionIdentity = Depends(require_session),
) -> StudyReminderSettings:
    _require_readable_plan(plan_id, session)
    settings = get_study_plan_store().reminder_settings(plan_id)
    if settings is None:
        raise HTTPException(status_code=404, detail="No saved study plan found.")
    return settings


@router.put("/study-plans/{plan_id}/reminders", response_model=StudyReminderSettings)
def update_study_reminder_settings(
    plan_id: str,
    payload: StudyReminderSettingsUpdate,
    session: SessionIdentity = Depends(require_session),
) -> StudyReminderSettings:
    _require_student_plan_owner(plan_id, session)
    settings = get_study_plan_store().upsert_reminder_settings(plan_id, payload)
    if settings is None:
        raise HTTPException(status_code=404, detail="No saved study plan found.")
    return settings


@router.post("/study-plans/{plan_id}/reschedule", response_model=SavedStudyPlan)
def reschedule_study_plan(
    plan_id: str,
    session: SessionIdentity = Depends(require_session),
) -> SavedStudyPlan:
    store = get_study_plan_store()
    saved_plan = _require_student_plan_owner(plan_id, session)

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
    session: SessionIdentity = Depends(require_session),
) -> StudySessionCompletion:
    store = get_study_plan_store()
    _require_student_plan_owner(plan_id, session)

    return store.complete_session(plan_id, payload)


@router.delete(
    "/study-plans/{plan_id}/session-completions/{session_key}",
    response_model=DeleteResponse,
)
def delete_study_session_completion(
    plan_id: str,
    session_key: str,
    session: SessionIdentity = Depends(require_session),
) -> DeleteResponse:
    _require_student_plan_owner(plan_id, session)
    deleted = get_study_plan_store().delete_completion(plan_id, session_key)
    return DeleteResponse(deleted=deleted)


@router.post("/progress/check-ins", response_model=CheckInResponse)
def create_check_in(
    payload: CheckInRequest,
    session: SessionIdentity = Depends(require_session),
) -> CheckInResponse:
    _require_own_student(session, payload.student_id)
    return get_study_plan_store().create_check_in(payload)


@router.get(
    "/parents/{parent_id}/students/{student_id}/summary",
    response_model=ParentProgressSummary,
)
def get_parent_progress(
    parent_id: str,
    student_id: str,
    session: SessionIdentity = Depends(require_session),
) -> ParentProgressSummary:
    if not parent_id.strip() or not student_id.strip():
        raise HTTPException(status_code=400, detail="Parent and student ids are required.")
    _require_own_parent(session, parent_id)
    _require_student_visible_to_parent(session, student_id)

    summary = get_study_plan_store().parent_progress_summary(parent_id, student_id)
    if summary is None:
        raise HTTPException(status_code=404, detail="Parent and student are not linked.")

    return summary
