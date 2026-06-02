import hashlib
import hmac
import json
import re
import secrets
import sqlite3
from datetime import date, datetime, timedelta, timezone
from functools import lru_cache
from pathlib import Path
from uuid import uuid4

from app.config import get_settings
from app.schemas import (
    AccountDeletionRequestCreate,
    AccountDeletionRequestReceipt,
    AccountDeletionRequestRecord,
    AccountDeletionReviewRequest,
    AccountRecoveryRequestCreate,
    AccountRecoveryRequestRecord,
    AccountRecoveryRequestReceipt,
    AccountRecoveryReviewRequest,
    AccountSignInRequest,
    AuthSession,
    CheckInRequest,
    CheckInResponse,
    DailyProgress,
    FamilyAccount,
    ParentAccount,
    ParentAccountCreate,
    ParentFamilyAccount,
    ParentInviteCode,
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
    WeeklyDigestDay,
    WeeklyStudyDigest,
    StudyPlanRequest,
    StudyPlanProgress,
    StudyPlanResponse,
    StudySessionCompletion,
    StudySessionCompletionRequest,
    MissedStudySession,
)


class AccountAccessCodeError(Exception):
    pass


class StudyPlanStore:
    def __init__(self, database_path: str) -> None:
        self.database_path = Path(database_path)
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self._ensure_schema()

    def save(
        self,
        plan: StudyPlanResponse,
        student_id: str | None = None,
        setup_payload: StudyPlanRequest | None = None,
    ) -> SavedStudyPlan:
        saved_plan = SavedStudyPlan(
            id=str(uuid4()),
            student_name=plan.metadata.student_name,
            student_id=student_id,
            created_at=datetime.now(timezone.utc),
            plan=plan,
            setup_payload=setup_payload,
        )

        with self._connect() as connection:
            connection.execute(
                """
                insert into saved_study_plans (
                    id,
                    student_name,
                    student_id,
                    created_at,
                    plan_json,
                    setup_payload_json
                )
                values (?, ?, ?, ?, ?, ?)
                """,
                (
                    saved_plan.id,
                    saved_plan.student_name,
                    saved_plan.student_id,
                    saved_plan.created_at.isoformat(),
                    json.dumps(plan.model_dump(mode="json")),
                    json.dumps(setup_payload.model_dump(mode="json")) if setup_payload is not None else None,
                ),
            )

        return saved_plan

    def latest(
        self,
        student_name: str | None = None,
        student_id: str | None = None,
    ) -> SavedStudyPlan | None:
        query = """
            select id, student_name, student_id, created_at, plan_json, setup_payload_json
            from saved_study_plans
        """
        params: tuple[str, ...] = ()
        if student_id:
            query += " where student_id = ?"
            params = (student_id,)
        elif student_name:
            query += " where lower(student_name) = lower(?)"
            params = (student_name,)
        query += " order by created_at desc limit 1"

        with self._connect() as connection:
            row = connection.execute(query, params).fetchone()

        if row is None:
            return None

        return _saved_plan_from_row(row)

    def history(
        self,
        student_name: str | None = None,
        student_id: str | None = None,
        limit: int = 20,
    ) -> list[SavedStudyPlan]:
        query = """
            select id, student_name, student_id, created_at, plan_json, setup_payload_json
            from saved_study_plans
        """
        params: tuple[object, ...] = ()
        if student_id:
            query += " where student_id = ?"
            params = (student_id,)
        elif student_name:
            query += " where lower(student_name) = lower(?)"
            params = (student_name,)

        query += " order by created_at desc limit ?"
        params = (*params, max(1, min(limit, 100)))

        with self._connect() as connection:
            rows = connection.execute(query, params).fetchall()

        return [_saved_plan_from_row(row) for row in rows]

    def create_student_account(self, payload: StudentAccountCreate) -> StudentAccount:
        access_code_hash = _hash_access_code(payload.access_code)

        if payload.auth_uid:
            existing_auth = self.student_account_by_auth_uid(payload.auth_uid)
            if existing_auth is not None:
                self._ensure_student_access_code(existing_auth.id, access_code_hash, payload.access_code)
                return existing_auth

        existing_login = self.student_account_by_login_id(payload.login_id)
        if existing_login is not None:
            self._ensure_student_access_code(existing_login.id, access_code_hash, payload.access_code)
            if payload.auth_uid and not existing_login.auth_uid:
                self._bind_student_auth_uid(existing_login.id, payload.auth_uid)
                return self.student_account_by_id(existing_login.id) or existing_login
            return existing_login

        existing_account = self.student_account_by_profile(payload)
        if existing_account is not None:
            self._ensure_student_access_code(existing_account.id, access_code_hash, payload.access_code)
            if payload.auth_uid and not existing_account.auth_uid:
                self._bind_student_auth_uid(existing_account.id, payload.auth_uid)
                return self.student_account_by_id(existing_account.id) or existing_account
            return existing_account

        account = StudentAccount(
            id=str(uuid4()),
            created_at=datetime.now(timezone.utc),
            login_id=payload.login_id,
            auth_uid=payload.auth_uid,
            name=payload.name,
            class_level=payload.class_level,
            age=payload.age,
            school_name=payload.school_name,
        )

        with self._connect() as connection:
            connection.execute(
                """
                insert into student_accounts (
                    id,
                    login_id,
                    access_code_hash,
                    auth_uid,
                    name,
                    class_level,
                    age,
                    school_name,
                    created_at
                )
                values (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    account.id,
                    account.login_id,
                    access_code_hash,
                    account.auth_uid,
                    account.name,
                    account.class_level,
                    account.age,
                    account.school_name,
                    account.created_at.isoformat(),
                ),
            )

        return account

    def sign_in(self, payload: AccountSignInRequest) -> AuthSession | None:
        if payload.role == "student":
            student = self.student_account_by_login_id(payload.login_id)
            if student is None or not self._student_access_code_matches(student.id, payload.access_code):
                return None

            return AuthSession(role="student", student=student)

        parent = self.parent_account_by_contact(payload.login_id)
        if parent is None or not self._parent_access_code_matches(parent.id, payload.access_code):
            return None

        family = self.parent_family(parent.id)
        return AuthSession(role="parent", parent=parent, students=family.students)

    def create_account_recovery_request(self, payload: AccountRecoveryRequestCreate) -> AccountRecoveryRequestReceipt:
        matched_account_id = self._recovery_account_id(payload)
        receipt = AccountRecoveryRequestReceipt(
            id=str(uuid4()),
            created_at=datetime.now(timezone.utc),
            message="Request received. A school or StudyNova support admin can review it without exposing account details.",
        )

        with self._connect() as connection:
            connection.execute(
                """
                insert into account_recovery_requests (
                    id,
                    role,
                    login_id,
                    contact,
                    note,
                    matched_account_id,
                    created_at
                )
                values (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    receipt.id,
                    payload.role,
                    payload.login_id,
                    payload.contact,
                    payload.note,
                    matched_account_id,
                    receipt.created_at.isoformat(),
                ),
            )

        return receipt

    def account_recovery_requests(self, limit: int = 50) -> list[AccountRecoveryRequestRecord]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                select
                    id,
                    role,
                    login_id,
                    contact,
                    note,
                    matched_account_id,
                    status,
                    reviewed_at,
                    admin_note,
                    created_at
                from account_recovery_requests
                order by created_at desc
                limit ?
                """,
                (max(1, min(limit, 100)),),
            ).fetchall()

        return [self._account_recovery_request_from_row(row) for row in rows]

    def review_account_recovery_request(
        self,
        request_id: str,
        payload: AccountRecoveryReviewRequest,
    ) -> AccountRecoveryRequestRecord | None:
        reviewed_at = datetime.now(timezone.utc).isoformat()
        with self._connect() as connection:
            cursor = connection.execute(
                """
                update account_recovery_requests
                set status = 'reviewed',
                    reviewed_at = ?,
                    admin_note = ?
                where id = ?
                """,
                (reviewed_at, payload.admin_note, request_id),
            )
            if cursor.rowcount == 0:
                return None

            row = connection.execute(
                """
                select
                    id,
                    role,
                    login_id,
                    contact,
                    note,
                    matched_account_id,
                    status,
                    reviewed_at,
                    admin_note,
                    created_at
                from account_recovery_requests
                where id = ?
                """,
                (request_id,),
            ).fetchone()

        return self._account_recovery_request_from_row(row) if row is not None else None

    def create_account_deletion_request(
        self,
        role: str,
        account_id: str,
        payload: AccountDeletionRequestCreate,
    ) -> AccountDeletionRequestReceipt | None:
        if role == "student":
            account = self.student_account_by_id(account_id)
            if account is None:
                return None
            account_label = account.name
            login_id = account.login_id
        else:
            account = self.parent_account_by_id(account_id)
            if account is None:
                return None
            account_label = account.name
            login_id = account.contact

        with self._connect() as connection:
            existing = connection.execute(
                """
                select id, created_at
                from account_deletion_requests
                where role = ? and account_id = ? and status in ('pending', 'reviewed')
                order by created_at desc
                limit 1
                """,
                (role, account_id),
            ).fetchone()
            if existing is not None:
                return AccountDeletionRequestReceipt(
                    id=existing["id"],
                    created_at=existing["created_at"],
                    message="A deletion request is already active for this account. Support will review it.",
                )

            receipt = AccountDeletionRequestReceipt(
                id=str(uuid4()),
                created_at=datetime.now(timezone.utc),
                message="Deletion request received. StudyNova support will review linked data before completing it.",
            )
            connection.execute(
                """
                insert into account_deletion_requests (
                    id,
                    role,
                    account_id,
                    account_label,
                    login_id,
                    contact,
                    reason,
                    status,
                    created_at
                )
                values (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
                """,
                (
                    receipt.id,
                    role,
                    account_id,
                    account_label,
                    login_id,
                    payload.contact,
                    payload.reason,
                    receipt.created_at.isoformat(),
                ),
            )

        return receipt

    def account_deletion_requests(self, limit: int = 50) -> list[AccountDeletionRequestRecord]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                select
                    id,
                    role,
                    account_id,
                    account_label,
                    login_id,
                    contact,
                    reason,
                    status,
                    reviewed_at,
                    completed_at,
                    admin_note,
                    created_at
                from account_deletion_requests
                order by
                    case status
                        when 'pending' then 0
                        when 'reviewed' then 1
                        else 2
                    end,
                    created_at desc
                limit ?
                """,
                (max(1, min(limit, 100)),),
            ).fetchall()

        return [self._account_deletion_request_from_row(row) for row in rows]

    def review_account_deletion_request(
        self,
        request_id: str,
        payload: AccountDeletionReviewRequest,
    ) -> AccountDeletionRequestRecord | None:
        reviewed_at = datetime.now(timezone.utc).isoformat()
        completed_at = reviewed_at if payload.status == "completed" else None

        with self._connect() as connection:
            request_row = connection.execute(
                """
                select
                    id,
                    role,
                    account_id,
                    account_label,
                    login_id,
                    contact,
                    reason,
                    status,
                    reviewed_at,
                    completed_at,
                    admin_note,
                    created_at
                from account_deletion_requests
                where id = ?
                """,
                (request_id,),
            ).fetchone()
            if request_row is None:
                return None

            if request_row["status"] == "completed":
                return self._account_deletion_request_from_row(request_row)

            if payload.status == "completed":
                self._complete_account_deletion(connection, request_row)

            cursor = connection.execute(
                """
                update account_deletion_requests
                set status = ?,
                    reviewed_at = coalesce(reviewed_at, ?),
                    completed_at = ?,
                    admin_note = ?
                where id = ?
                """,
                (payload.status, reviewed_at, completed_at, payload.admin_note, request_id),
            )
            if cursor.rowcount == 0:
                return None

            row = connection.execute(
                """
                select
                    id,
                    role,
                    account_id,
                    account_label,
                    login_id,
                    contact,
                    reason,
                    status,
                    reviewed_at,
                    completed_at,
                    admin_note,
                    created_at
                from account_deletion_requests
                where id = ?
                """,
                (request_id,),
            ).fetchone()

        return self._account_deletion_request_from_row(row) if row is not None else None

    def _complete_account_deletion(self, connection: sqlite3.Connection, request: sqlite3.Row) -> None:
        if request["role"] == "student":
            self._delete_student_account_data(connection, request["account_id"])
            return

        self._delete_parent_account_data(connection, request["account_id"])

    def _delete_student_account_data(self, connection: sqlite3.Connection, student_id: str) -> None:
        plan_selector = "select id from saved_study_plans where student_id = ?"
        connection.execute(
            f"delete from study_session_completions where plan_id in ({plan_selector})",
            (student_id,),
        )
        connection.execute(
            f"delete from study_reminder_settings where plan_id in ({plan_selector})",
            (student_id,),
        )
        connection.execute("delete from saved_study_plans where student_id = ?", (student_id,))
        connection.execute("delete from study_check_ins where student_id = ?", (student_id,))
        connection.execute("delete from parent_student_links where student_id = ?", (student_id,))
        connection.execute("delete from parent_invite_codes where student_id = ?", (student_id,))
        connection.execute(
            """
            update account_recovery_requests
            set matched_account_id = null
            where role = 'student' and matched_account_id = ?
            """,
            (student_id,),
        )
        connection.execute("delete from student_accounts where id = ?", (student_id,))

    def _delete_parent_account_data(self, connection: sqlite3.Connection, parent_id: str) -> None:
        connection.execute("delete from parent_student_links where parent_id = ?", (parent_id,))
        connection.execute(
            """
            update parent_invite_codes
            set redeemed_by_parent_id = null
            where redeemed_by_parent_id = ?
            """,
            (parent_id,),
        )
        connection.execute(
            """
            update account_recovery_requests
            set matched_account_id = null
            where role = 'parent' and matched_account_id = ?
            """,
            (parent_id,),
        )
        connection.execute("delete from parent_accounts where id = ?", (parent_id,))

    def storage_health(self, backup_directory: str, production: bool = False) -> StorageHealth:
        backup_path = Path(backup_directory)
        warnings: list[str] = []
        database_exists = self.database_path.exists()
        database_size = self.database_path.stat().st_size if database_exists else 0

        if production:
            if not self.database_path.is_absolute():
                warnings.append("LOCAL_DATA_PATH should be an absolute path on a persistent disk in production.")
            if "apps/api/.data" in self.database_path.as_posix():
                warnings.append("Default development data path is not a safe production database location.")
            if not backup_path.is_absolute():
                warnings.append("BACKUP_DATA_PATH should be an absolute path on a persistent disk in production.")

        return StorageHealth(
            database_path=str(self.database_path),
            database_exists=database_exists,
            database_size_bytes=database_size,
            backup_directory=str(backup_path),
            backup_directory_exists=backup_path.exists(),
            production_ready=not warnings,
            warnings=warnings,
        )

    def create_backup(self, backup_directory: str) -> StorageBackupReceipt:
        backup_path = Path(backup_directory)
        backup_path.mkdir(parents=True, exist_ok=True)
        created_at = datetime.now(timezone.utc)
        filename = f"studynova-{created_at.strftime('%Y%m%dT%H%M%SZ')}.sqlite3"
        destination_path = backup_path / filename

        with self._connect() as source, sqlite3.connect(destination_path) as destination:
            source.backup(destination)

        return StorageBackupReceipt(
            filename=filename,
            backup_path=str(destination_path),
            size_bytes=destination_path.stat().st_size,
            created_at=created_at,
        )

    def list_backups(self, backup_directory: str, limit: int = 20) -> list[StorageBackupReceipt]:
        backup_path = Path(backup_directory)
        if not backup_path.exists():
            return []

        backup_files = sorted(
            backup_path.glob("studynova-*.sqlite3"),
            key=lambda item: item.stat().st_mtime,
            reverse=True,
        )
        receipts: list[StorageBackupReceipt] = []
        for path in backup_files[: max(1, min(limit, 100))]:
            stat = path.stat()
            receipts.append(
                StorageBackupReceipt(
                    filename=path.name,
                    backup_path=str(path),
                    size_bytes=stat.st_size,
                    created_at=datetime.fromtimestamp(stat.st_mtime, timezone.utc),
                )
            )

        return receipts

    def firebase_sign_in(self, role: str, auth_uid: str, login_id: str) -> AuthSession | None:
        if role == "student":
            if self.parent_account_by_auth_uid(auth_uid) is not None:
                return None

            student = self.student_account_by_auth_uid(auth_uid) or self.student_account_by_login_id(login_id)
            if student is None:
                return None

            if not student.auth_uid:
                self._bind_student_auth_uid(student.id, auth_uid)
                student = self.student_account_by_id(student.id) or student

            return AuthSession(role="student", student=student)

        if self.student_account_by_auth_uid(auth_uid) is not None:
            return None

        parent = self.parent_account_by_auth_uid(auth_uid) or self.parent_account_by_contact(login_id)
        if parent is None:
            return None

        if not parent.auth_uid:
            self._bind_parent_auth_uid(parent.id, auth_uid)
            parent = self.parent_account_by_id(parent.id) or parent

        family = self.parent_family(parent.id)
        return AuthSession(role="parent", parent=parent, students=family.students)

    def create_parent_account(self, payload: ParentAccountCreate) -> ParentAccount:
        access_code_hash = _hash_access_code(payload.access_code)

        if payload.auth_uid:
            existing_auth = self.parent_account_by_auth_uid(payload.auth_uid)
            if existing_auth is not None:
                self._ensure_parent_access_code(existing_auth.id, access_code_hash, payload.access_code)
                return existing_auth

        existing_account = self.parent_account_by_contact(payload.contact)
        if existing_account is not None:
            self._ensure_parent_access_code(existing_account.id, access_code_hash, payload.access_code)
            if payload.auth_uid and not existing_account.auth_uid:
                self._bind_parent_auth_uid(existing_account.id, payload.auth_uid)
                return self.parent_account_by_id(existing_account.id) or existing_account
            return existing_account

        account = ParentAccount(
            id=str(uuid4()),
            created_at=datetime.now(timezone.utc),
            auth_uid=payload.auth_uid,
            name=payload.name,
            contact=payload.contact,
            relationship=payload.relationship,
        )

        with self._connect() as connection:
            connection.execute(
                """
                insert into parent_accounts (id, access_code_hash, auth_uid, name, contact, relationship, created_at)
                values (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    account.id,
                    access_code_hash,
                    account.auth_uid,
                    account.name,
                    account.contact,
                    account.relationship,
                    account.created_at.isoformat(),
                ),
            )

        return account

    def link_parent_student(self, payload: ParentStudentLinkCreate) -> ParentStudentLink | None:
        if self.student_account_by_id(payload.student_id) is None or self.parent_account_by_id(payload.parent_id) is None:
            return None

        created_at = datetime.now(timezone.utc)
        with self._connect() as connection:
            existing = connection.execute(
                """
                select id, parent_id, student_id, created_at
                from parent_student_links
                where parent_id = ? and student_id = ?
                """,
                (payload.parent_id, payload.student_id),
            ).fetchone()

            if existing:
                return self._link_from_row(existing)

            link = ParentStudentLink(
                id=str(uuid4()),
                parent_id=payload.parent_id,
                student_id=payload.student_id,
                created_at=created_at,
            )
            connection.execute(
                """
                insert into parent_student_links (id, parent_id, student_id, created_at)
                values (?, ?, ?, ?)
                """,
                (
                    link.id,
                    link.parent_id,
                    link.student_id,
                    link.created_at.isoformat(),
                ),
            )

        return link

    def create_parent_invite_code(self, student_id: str, ttl_minutes: int = 60) -> ParentInviteCode | None:
        if self.student_account_by_id(student_id) is None:
            return None

        created_at = datetime.now(timezone.utc)
        expires_at = created_at + timedelta(minutes=max(5, min(ttl_minutes, 24 * 60)))

        with self._connect() as connection:
            for _ in range(12):
                invite = ParentInviteCode(
                    code=_generate_parent_invite_code(),
                    student_id=student_id,
                    created_at=created_at,
                    expires_at=expires_at,
                )
                try:
                    connection.execute(
                        """
                        insert into parent_invite_codes (
                            id,
                            code,
                            student_id,
                            created_at,
                            expires_at,
                            redeemed_at,
                            redeemed_by_parent_id
                        )
                        values (?, ?, ?, ?, ?, null, null)
                        """,
                        (
                            str(uuid4()),
                            invite.code,
                            invite.student_id,
                            invite.created_at.isoformat(),
                            invite.expires_at.isoformat(),
                        ),
                    )
                    return invite
                except sqlite3.IntegrityError:
                    continue

        return None

    def redeem_parent_invite_code(self, parent_id: str, code: str) -> ParentStudentLink | None:
        parent = self.parent_account_by_id(parent_id)
        normalized_code = _normalize_parent_invite_code(code)
        if parent is None or normalized_code is None:
            return None

        now = datetime.now(timezone.utc)
        with self._connect() as connection:
            row = connection.execute(
                """
                select id, code, student_id, created_at, expires_at, redeemed_at, redeemed_by_parent_id
                from parent_invite_codes
                where code = ?
                order by created_at desc
                limit 1
                """,
                (normalized_code,),
            ).fetchone()

        if row is None or row["redeemed_at"]:
            return None

        expires_at = datetime.fromisoformat(row["expires_at"])
        if expires_at < now or self.student_account_by_id(row["student_id"]) is None:
            return None

        link = self.link_parent_student(
            ParentStudentLinkCreate(parent_id=parent.id, student_id=row["student_id"])
        )
        if link is None:
            return None

        with self._connect() as connection:
            connection.execute(
                """
                update parent_invite_codes
                set redeemed_at = ?,
                    redeemed_by_parent_id = ?
                where id = ? and redeemed_at is null
                """,
                (now.isoformat(), parent.id, row["id"]),
            )

        return link

    def latest_family(self) -> FamilyAccount:
        with self._connect() as connection:
            link_row = connection.execute(
                """
                select id, parent_id, student_id, created_at
                from parent_student_links
                order by created_at desc
                limit 1
                """
            ).fetchone()

        if link_row:
            link = self._link_from_row(link_row)
            return FamilyAccount(
                parent=self.parent_account_by_id(link.parent_id),
                student=self.student_account_by_id(link.student_id),
                link=link,
            )

        return FamilyAccount(parent=self.latest_parent_account(), student=self.latest_student_account(), link=None)

    def latest_parent_family(self) -> ParentFamilyAccount:
        with self._connect() as connection:
            link_row = connection.execute(
                """
                select id, parent_id, student_id, created_at
                from parent_student_links
                order by created_at desc
                limit 1
                """
            ).fetchone()

        if link_row:
            return self.parent_family(link_row["parent_id"])

        latest_parent = self.latest_parent_account()
        if latest_parent is None:
            return ParentFamilyAccount()

        return self.parent_family(latest_parent.id)

    def parent_family(self, parent_id: str) -> ParentFamilyAccount:
        parent = self.parent_account_by_id(parent_id)
        if parent is None:
            return ParentFamilyAccount()

        with self._connect() as connection:
            rows = connection.execute(
                """
                select id, parent_id, student_id, created_at
                from parent_student_links
                where parent_id = ?
                order by created_at asc
                """,
                (parent_id,),
            ).fetchall()

        links = [self._link_from_row(row) for row in rows]
        students = [
            student
            for student in (self.student_account_by_id(link.student_id) for link in links)
            if student is not None
        ]
        return ParentFamilyAccount(parent=parent, students=students, links=links)

    def student_family(self, student_id: str) -> FamilyAccount:
        student = self.student_account_by_id(student_id)
        if student is None:
            return FamilyAccount()

        with self._connect() as connection:
            link_row = connection.execute(
                """
                select id, parent_id, student_id, created_at
                from parent_student_links
                where student_id = ?
                order by created_at asc
                limit 1
                """,
                (student_id,),
            ).fetchone()

        if link_row is None:
            return FamilyAccount(student=student)

        link = self._link_from_row(link_row)
        return FamilyAccount(parent=self.parent_account_by_id(link.parent_id), student=student, link=link)

    def latest_student_account(self) -> StudentAccount | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                select id, login_id, auth_uid, name, class_level, age, school_name, created_at
                from student_accounts
                order by created_at desc
                limit 1
                """
            ).fetchone()

        return self._student_from_row(row) if row else None

    def latest_parent_account(self) -> ParentAccount | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                select id, auth_uid, name, contact, relationship, created_at
                from parent_accounts
                order by created_at desc
                limit 1
                """
            ).fetchone()

        return self._parent_from_row(row) if row else None

    def student_account_by_profile(self, payload: StudentAccountCreate) -> StudentAccount | None:
        profile_key = _student_profile_key(payload)
        with self._connect() as connection:
            rows = connection.execute(
                """
                select id, login_id, auth_uid, name, class_level, age, school_name, created_at
                from student_accounts
                order by created_at desc
                """
            ).fetchall()

        for row in rows:
            candidate_key = _student_profile_values(
                login_id=row["login_id"] or _legacy_student_login_id(row["id"]),
                name=row["name"],
                class_level=row["class_level"],
                age=row["age"],
                school_name=row["school_name"],
            )
            if candidate_key == profile_key:
                return self._student_from_row(row)

        return None

    def student_account_by_login_id(self, login_id: str) -> StudentAccount | None:
        login_key = _contact_key(login_id)
        with self._connect() as connection:
            rows = connection.execute(
                """
                select id, login_id, auth_uid, name, class_level, age, school_name, created_at
                from student_accounts
                order by created_at desc
                """
            ).fetchall()

        for row in rows:
            if _contact_key(row["login_id"]) == login_key:
                return self._student_from_row(row)

        return None

    def student_account_by_auth_uid(self, auth_uid: str) -> StudentAccount | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                select id, login_id, auth_uid, name, class_level, age, school_name, created_at
                from student_accounts
                where auth_uid = ?
                order by created_at desc
                limit 1
                """,
                (auth_uid,),
            ).fetchone()

        return self._student_from_row(row) if row else None

    def student_account_by_id(self, student_id: str) -> StudentAccount | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                select id, login_id, auth_uid, name, class_level, age, school_name, created_at
                from student_accounts
                where id = ?
                """,
                (student_id,),
            ).fetchone()

        return self._student_from_row(row) if row else None

    def parent_account_by_contact(self, contact: str) -> ParentAccount | None:
        contact_key = _contact_key(contact)
        with self._connect() as connection:
            rows = connection.execute(
                """
                select id, auth_uid, name, contact, relationship, created_at
                from parent_accounts
                order by created_at desc
                """
            ).fetchall()

        for row in rows:
            if _contact_key(row["contact"]) == contact_key:
                return self._parent_from_row(row)

        return None

    def parent_account_by_auth_uid(self, auth_uid: str) -> ParentAccount | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                select id, auth_uid, name, contact, relationship, created_at
                from parent_accounts
                where auth_uid = ?
                order by created_at desc
                limit 1
                """,
                (auth_uid,),
            ).fetchone()

        return self._parent_from_row(row) if row else None

    def parent_account_by_id(self, parent_id: str) -> ParentAccount | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                select id, auth_uid, name, contact, relationship, created_at
                from parent_accounts
                where id = ?
                """,
                (parent_id,),
            ).fetchone()

        return self._parent_from_row(row) if row else None

    def _parent_student_link_exists(self, parent_id: str, student_id: str) -> bool:
        with self._connect() as connection:
            row = connection.execute(
                """
                select id
                from parent_student_links
                where parent_id = ? and student_id = ?
                limit 1
                """,
                (parent_id, student_id),
            ).fetchone()

        return row is not None

    def _bind_student_auth_uid(self, student_id: str, auth_uid: str) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                update student_accounts
                set auth_uid = ?
                where id = ? and (auth_uid is null or auth_uid = '')
                """,
                (auth_uid, student_id),
            )

    def _bind_parent_auth_uid(self, parent_id: str, auth_uid: str) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                update parent_accounts
                set auth_uid = ?
                where id = ? and (auth_uid is null or auth_uid = '')
                """,
                (auth_uid, parent_id),
            )

    def _ensure_student_access_code(self, student_id: str, access_code_hash: str, access_code: str) -> None:
        current_hash = self._student_access_code_hash(student_id)
        if current_hash:
            if not _access_code_matches(current_hash, access_code):
                raise AccountAccessCodeError("Student account already exists with a different access code.")
            return

        self._bind_student_access_code_hash(student_id, access_code_hash)

    def _ensure_parent_access_code(self, parent_id: str, access_code_hash: str, access_code: str) -> None:
        current_hash = self._parent_access_code_hash(parent_id)
        if current_hash:
            if not _access_code_matches(current_hash, access_code):
                raise AccountAccessCodeError("Parent account already exists with a different access code.")
            return

        self._bind_parent_access_code_hash(parent_id, access_code_hash)

    def _account_recovery_request_from_row(self, row: sqlite3.Row) -> AccountRecoveryRequestRecord:
        return AccountRecoveryRequestRecord(
            id=row["id"],
            role=row["role"],
            login_id=row["login_id"],
            contact=row["contact"],
            note=row["note"],
            matched_account=bool(row["matched_account_id"]),
            status=row["status"],
            reviewed_at=row["reviewed_at"],
            admin_note=row["admin_note"],
            created_at=row["created_at"],
        )

    def _account_deletion_request_from_row(self, row: sqlite3.Row) -> AccountDeletionRequestRecord:
        return AccountDeletionRequestRecord(
            id=row["id"],
            role=row["role"],
            account_id=row["account_id"],
            account_label=row["account_label"],
            login_id=row["login_id"],
            contact=row["contact"],
            reason=row["reason"],
            status=row["status"],
            reviewed_at=row["reviewed_at"],
            completed_at=row["completed_at"],
            admin_note=row["admin_note"],
            created_at=row["created_at"],
        )

    def _student_access_code_matches(self, student_id: str, access_code: str) -> bool:
        access_code_hash = self._student_access_code_hash(student_id)
        return bool(access_code_hash and _access_code_matches(access_code_hash, access_code))

    def _parent_access_code_matches(self, parent_id: str, access_code: str) -> bool:
        access_code_hash = self._parent_access_code_hash(parent_id)
        return bool(access_code_hash and _access_code_matches(access_code_hash, access_code))

    def _recovery_account_id(self, payload: AccountRecoveryRequestCreate) -> str | None:
        if payload.role == "student":
            account = self.student_account_by_login_id(payload.login_id)
            return account.id if account is not None else None

        account = self.parent_account_by_contact(payload.login_id)
        return account.id if account is not None else None

    def _student_access_code_hash(self, student_id: str) -> str:
        with self._connect() as connection:
            row = connection.execute(
                """
                select access_code_hash
                from student_accounts
                where id = ?
                """,
                (student_id,),
            ).fetchone()

        return row["access_code_hash"] if row and row["access_code_hash"] else ""

    def _parent_access_code_hash(self, parent_id: str) -> str:
        with self._connect() as connection:
            row = connection.execute(
                """
                select access_code_hash
                from parent_accounts
                where id = ?
                """,
                (parent_id,),
            ).fetchone()

        return row["access_code_hash"] if row and row["access_code_hash"] else ""

    def _bind_student_access_code_hash(self, student_id: str, access_code_hash: str) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                update student_accounts
                set access_code_hash = ?
                where id = ? and (access_code_hash is null or access_code_hash = '')
                """,
                (access_code_hash, student_id),
            )

    def _bind_parent_access_code_hash(self, parent_id: str, access_code_hash: str) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                update parent_accounts
                set access_code_hash = ?
                where id = ? and (access_code_hash is null or access_code_hash = '')
                """,
                (access_code_hash, parent_id),
            )

    def by_id(self, plan_id: str) -> SavedStudyPlan | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                select id, student_name, student_id, created_at, plan_json, setup_payload_json
                from saved_study_plans
                where id = ?
                """,
                (plan_id,),
            ).fetchone()

        if row is None:
            return None

        return _saved_plan_from_row(row)

    def reminder_settings(self, plan_id: str) -> StudyReminderSettings | None:
        if self.by_id(plan_id) is None:
            return None

        with self._connect() as connection:
            row = connection.execute(
                """
                select *
                from study_reminder_settings
                where plan_id = ?
                """,
                (plan_id,),
            ).fetchone()

        if row is None:
            return _default_reminder_settings(plan_id)

        return _reminder_settings_from_row(row)

    def upsert_reminder_settings(
        self,
        plan_id: str,
        payload: StudyReminderSettingsUpdate,
    ) -> StudyReminderSettings | None:
        if self.by_id(plan_id) is None:
            return None

        updated_at = datetime.now(timezone.utc)
        with self._connect() as connection:
            connection.execute(
                """
                insert into study_reminder_settings (
                    plan_id,
                    reminders_enabled,
                    reminder_time,
                    reminder_minutes_before,
                    missed_session_alerts_enabled,
                    missed_session_followup_time,
                    parent_alerts_enabled,
                    updated_at
                )
                values (?, ?, ?, ?, ?, ?, ?, ?)
                on conflict(plan_id) do update set
                    reminders_enabled = excluded.reminders_enabled,
                    reminder_time = excluded.reminder_time,
                    reminder_minutes_before = excluded.reminder_minutes_before,
                    missed_session_alerts_enabled = excluded.missed_session_alerts_enabled,
                    missed_session_followup_time = excluded.missed_session_followup_time,
                    parent_alerts_enabled = excluded.parent_alerts_enabled,
                    updated_at = excluded.updated_at
                """,
                (
                    plan_id,
                    int(payload.reminders_enabled),
                    payload.reminder_time,
                    payload.reminder_minutes_before,
                    int(payload.missed_session_alerts_enabled),
                    payload.missed_session_followup_time,
                    int(payload.parent_alerts_enabled),
                    updated_at.isoformat(),
                ),
            )

        return StudyReminderSettings(plan_id=plan_id, updated_at=updated_at, **payload.model_dump())

    def complete_session(
        self,
        plan_id: str,
        payload: StudySessionCompletionRequest,
    ) -> StudySessionCompletion:
        completion_id = str(uuid4())
        completed_at = datetime.now(timezone.utc)

        with self._connect() as connection:
            existing = connection.execute(
                """
                select id
                from study_session_completions
                where plan_id = ? and session_key = ?
                """,
                (plan_id, payload.session_key),
            ).fetchone()

            if existing is None:
                connection.execute(
                    """
                    insert into study_session_completions (
                        id,
                        plan_id,
                        session_key,
                        study_date,
                        kind,
                        subject,
                        topic,
                        resource_type,
                        minutes_planned,
                        minutes_completed,
                        recall_note,
                        confidence,
                        completed_at
                    )
                    values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        completion_id,
                        plan_id,
                        payload.session_key,
                        payload.study_date.isoformat(),
                        payload.kind,
                        payload.subject,
                        payload.topic,
                        payload.resource_type,
                        payload.minutes_planned,
                        payload.minutes_completed,
                        payload.recall_note,
                        payload.confidence,
                        completed_at.isoformat(),
                    ),
                )
            else:
                completion_id = existing["id"]
                connection.execute(
                    """
                    update study_session_completions
                    set study_date = ?,
                        kind = ?,
                        subject = ?,
                        topic = ?,
                        resource_type = ?,
                        minutes_planned = ?,
                        minutes_completed = ?,
                        recall_note = ?,
                        confidence = ?,
                        completed_at = ?
                    where plan_id = ? and session_key = ?
                    """,
                    (
                        payload.study_date.isoformat(),
                        payload.kind,
                        payload.subject,
                        payload.topic,
                        payload.resource_type,
                        payload.minutes_planned,
                        payload.minutes_completed,
                        payload.recall_note,
                        payload.confidence,
                        completed_at.isoformat(),
                        plan_id,
                        payload.session_key,
                    ),
                )

        return StudySessionCompletion(
            id=completion_id,
            plan_id=plan_id,
            session_key=payload.session_key,
            study_date=payload.study_date,
            kind=payload.kind,
            subject=payload.subject,
            topic=payload.topic,
            resource_type=payload.resource_type,
            minutes_planned=payload.minutes_planned,
            minutes_completed=payload.minutes_completed,
            recall_note=payload.recall_note,
            confidence=payload.confidence,
            completed_at=completed_at,
        )

    def delete_completion(self, plan_id: str, session_key: str) -> bool:
        with self._connect() as connection:
            cursor = connection.execute(
                """
                delete from study_session_completions
                where plan_id = ? and session_key = ?
                """,
                (plan_id, session_key),
            )
            deleted_count = cursor.rowcount

        return deleted_count > 0

    def create_check_in(self, payload: CheckInRequest) -> CheckInResponse:
        check_in_id = str(uuid4())
        created_at = datetime.now(timezone.utc)

        with self._connect() as connection:
            connection.execute(
                """
                insert into study_check_ins (
                    id,
                    student_id,
                    study_date,
                    minutes_completed,
                    sessions_completed,
                    sessions_planned,
                    note,
                    created_at
                )
                values (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    check_in_id,
                    payload.student_id,
                    payload.study_date.isoformat(),
                    payload.minutes_completed,
                    payload.sessions_completed,
                    payload.sessions_planned,
                    payload.note,
                    created_at.isoformat(),
                ),
            )

        return CheckInResponse(
            id=check_in_id,
            student_id=payload.student_id,
            study_date=payload.study_date,
            saved=True,
        )

    def parent_progress_summary(self, parent_id: str, student_id: str) -> ParentProgressSummary | None:
        if not self._parent_student_link_exists(parent_id, student_id):
            return None

        with self._connect() as connection:
            rows = connection.execute(
                """
                select student_id,
                       study_date,
                       minutes_completed,
                       sessions_completed,
                       sessions_planned,
                       note,
                       created_at
                from study_check_ins
                where student_id = ?
                order by study_date asc, created_at asc
                """,
                (student_id,),
            ).fetchall()

        total_minutes = sum(row["minutes_completed"] for row in rows)
        completed_sessions = sum(row["sessions_completed"] for row in rows)
        planned_sessions = sum(row["sessions_planned"] for row in rows)
        completion_rate = round((completed_sessions / planned_sessions) * 100, 1) if planned_sessions else 0
        active_days = {datetime.fromisoformat(row["study_date"]).date() for row in rows}
        today = datetime.now(timezone.utc).date()
        streak_days = 0
        while today in active_days:
            streak_days += 1
            today = today.fromordinal(today.toordinal() - 1)

        latest_note = rows[-1]["note"] if rows else "No study activity has been recorded yet."

        return ParentProgressSummary(
            parent_id=parent_id,
            student_id=student_id,
            completion_rate=completion_rate,
            streak_days=streak_days,
            total_minutes=total_minutes,
            latest_note=latest_note,
        )

    def progress(self, plan_id: str) -> StudyPlanProgress | None:
        saved_plan = self.by_id(plan_id)
        if saved_plan is None:
            return None

        completions = self._completion_rows(plan_id)
        completed_session_keys = [completion.session_key for completion in completions]
        completed_session_key_set = set(completed_session_keys)
        completion_by_date: dict[str, list[StudySessionCompletion]] = {}
        for completion in completions:
            completion_by_date.setdefault(completion.study_date.isoformat(), []).append(completion)

        today = date.today()
        daily: list[DailyProgress] = []
        missed_sessions: list[MissedStudySession] = []
        for day in saved_plan.plan.schedule:
            completed_for_day = completion_by_date.get(day.study_date.isoformat(), [])
            completed_minutes = sum(completion.minutes_completed for completion in completed_for_day)
            planned_sessions = len(day.sessions)
            missed_for_day = 0
            for index, session in enumerate(day.sessions):
                session_key = f"{day.study_date.isoformat()}:{index}"
                if day.study_date >= today or session_key in completed_session_key_set:
                    continue

                missed_for_day += 1
                missed_sessions.append(
                    MissedStudySession(
                        session_key=session_key,
                        study_date=day.study_date,
                        kind=session.kind,
                        subject=session.subject,
                        topic=session.topic,
                        resource_type=session.resource_type,
                        minutes=session.minutes,
                        days_overdue=(today - day.study_date).days,
                    )
                )

            completion_rate = (
                round((completed_minutes / day.total_minutes) * 100, 1) if day.total_minutes else 0
            )
            daily_status = _daily_progress_status(
                study_date=day.study_date,
                today=today,
                planned_sessions=planned_sessions,
                completed_sessions=len(completed_for_day),
                missed_sessions=missed_for_day,
            )
            daily.append(
                DailyProgress(
                    study_date=day.study_date,
                    planned_minutes=day.total_minutes,
                    completed_minutes=completed_minutes,
                    planned_sessions=planned_sessions,
                    completed_sessions=len(completed_for_day),
                    missed_sessions=missed_for_day,
                    completion_rate=min(100, completion_rate),
                    status=daily_status,
                )
            )

        planned_minutes = sum(day.total_minutes for day in saved_plan.plan.schedule)
        planned_sessions = sum(len(day.sessions) for day in saved_plan.plan.schedule)
        completed_minutes = sum(completion.minutes_completed for completion in completions)
        missed_minutes = sum(session.minutes for session in missed_sessions)
        completion_rate = (
            round((completed_minutes / planned_minutes) * 100, 1) if planned_minutes else 0
        )

        return StudyPlanProgress(
            plan_id=plan_id,
            planned_minutes=planned_minutes,
            completed_minutes=completed_minutes,
            planned_sessions=planned_sessions,
            completed_sessions=len(completions),
            missed_sessions_count=len(missed_sessions),
            missed_minutes=missed_minutes,
            completion_rate=min(100, completion_rate),
            completed_session_keys=completed_session_keys,
            daily=daily,
            completions=completions,
            missed_sessions=missed_sessions,
        )

    def weekly_digest(self, plan_id: str) -> WeeklyStudyDigest | None:
        saved_plan = self.by_id(plan_id)
        progress = self.progress(plan_id)
        if saved_plan is None or progress is None:
            return None

        today = date.today()
        elapsed_days = [day for day in progress.daily if day.study_date <= today]
        digest_days = (elapsed_days or progress.daily[:7])[-7:]
        if not digest_days:
            return WeeklyStudyDigest(
                plan_id=plan_id,
                student_name=saved_plan.student_name,
                week_start=today,
                week_end=today,
                planned_minutes=0,
                completed_minutes=0,
                missed_minutes=0,
                planned_sessions=0,
                completed_sessions=0,
                missed_sessions=0,
                completion_rate=0,
                active_days=0,
                streak_days=0,
                headline="No study week yet",
                insight="Generate a study plan to start weekly review.",
                next_action="Create a plan and complete the first session.",
                days=[],
            )

        planned_minutes = sum(day.planned_minutes for day in digest_days)
        completed_minutes = sum(day.completed_minutes for day in digest_days)
        planned_sessions = sum(day.planned_sessions for day in digest_days)
        completed_sessions = sum(day.completed_sessions for day in digest_days)
        missed_sessions = sum(day.missed_sessions for day in digest_days)
        week_start = digest_days[0].study_date
        week_end = digest_days[-1].study_date
        missed_minutes = sum(
            missed.minutes
            for missed in progress.missed_sessions
            if week_start <= missed.study_date <= week_end
        )
        completion_rate = (
            round((completed_sessions / planned_sessions) * 100, 1) if planned_sessions else 0
        )
        active_days = sum(1 for day in digest_days if day.completed_sessions > 0)
        streak_days = _progress_streak_days(progress.daily, today)
        strongest_day = (
            max(digest_days, key=lambda day: day.completion_rate).study_date
            if digest_days
            else None
        )
        headline = _weekly_digest_headline(completion_rate, missed_sessions)
        insight = _weekly_digest_insight(completion_rate, active_days, missed_sessions, streak_days)
        next_action = _weekly_digest_next_action(completion_rate, missed_sessions)

        return WeeklyStudyDigest(
            plan_id=plan_id,
            student_name=saved_plan.student_name,
            week_start=week_start,
            week_end=week_end,
            planned_minutes=planned_minutes,
            completed_minutes=completed_minutes,
            missed_minutes=missed_minutes,
            planned_sessions=planned_sessions,
            completed_sessions=completed_sessions,
            missed_sessions=missed_sessions,
            completion_rate=min(100, completion_rate),
            active_days=active_days,
            streak_days=streak_days,
            strongest_day=strongest_day,
            headline=headline,
            insight=insight,
            next_action=next_action,
            days=[
                WeeklyDigestDay(
                    study_date=day.study_date,
                    planned_minutes=day.planned_minutes,
                    completed_minutes=day.completed_minutes,
                    planned_sessions=day.planned_sessions,
                    completed_sessions=day.completed_sessions,
                    missed_sessions=day.missed_sessions,
                    completion_rate=day.completion_rate,
                    status=day.status,
                )
                for day in digest_days
            ],
        )

    def _completion_rows(self, plan_id: str) -> list[StudySessionCompletion]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                select *
                from study_session_completions
                where plan_id = ?
                order by study_date asc, completed_at asc
                """,
                (plan_id,),
            ).fetchall()

        return [
            StudySessionCompletion(
                id=row["id"],
                plan_id=row["plan_id"],
                session_key=row["session_key"],
                study_date=row["study_date"],
                kind=row["kind"],
                subject=row["subject"],
                topic=row["topic"],
                resource_type=row["resource_type"],
                minutes_planned=row["minutes_planned"],
                minutes_completed=row["minutes_completed"],
                recall_note=row["recall_note"],
                confidence=row["confidence"],
                completed_at=row["completed_at"],
            )
            for row in rows
        ]

    def _student_from_row(self, row: sqlite3.Row) -> StudentAccount:
        return StudentAccount(
            id=row["id"],
            login_id=row["login_id"] or _legacy_student_login_id(row["id"]),
            auth_uid=row["auth_uid"] or None,
            name=row["name"],
            class_level=row["class_level"],
            age=row["age"],
            school_name=row["school_name"],
            created_at=row["created_at"],
        )

    def _parent_from_row(self, row: sqlite3.Row) -> ParentAccount:
        return ParentAccount(
            id=row["id"],
            auth_uid=row["auth_uid"] or None,
            name=row["name"],
            contact=row["contact"],
            relationship=row["relationship"],
            created_at=row["created_at"],
        )

    def _link_from_row(self, row: sqlite3.Row) -> ParentStudentLink:
        return ParentStudentLink(
            id=row["id"],
            parent_id=row["parent_id"],
            student_id=row["student_id"],
            created_at=row["created_at"],
        )

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.database_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _ensure_schema(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                create table if not exists saved_study_plans (
                    id text primary key,
                    student_name text not null,
                    student_id text,
                    created_at text not null,
                    plan_json text not null,
                    setup_payload_json text
                )
                """
            )
            saved_plan_columns = {
                row["name"] for row in connection.execute("pragma table_info(saved_study_plans)").fetchall()
            }
            if "student_id" not in saved_plan_columns:
                connection.execute("alter table saved_study_plans add column student_id text")
            if "setup_payload_json" not in saved_plan_columns:
                connection.execute("alter table saved_study_plans add column setup_payload_json text")
            connection.execute(
                """
                create index if not exists idx_saved_study_plans_student_created
                on saved_study_plans (student_name, created_at desc)
                """
            )
            connection.execute(
                """
                create index if not exists idx_saved_study_plans_student_id_created
                on saved_study_plans (student_id, created_at desc)
                """
            )
            connection.execute(
                """
                create table if not exists student_accounts (
                    id text primary key,
                    login_id text not null default '',
                    access_code_hash text,
                    auth_uid text,
                    name text not null,
                    class_level text not null,
                    age integer not null,
                    school_name text not null,
                    created_at text not null
                )
                """
            )
            student_account_columns = {
                row["name"] for row in connection.execute("pragma table_info(student_accounts)").fetchall()
            }
            if "login_id" not in student_account_columns:
                connection.execute("alter table student_accounts add column login_id text not null default ''")
            if "access_code_hash" not in student_account_columns:
                connection.execute("alter table student_accounts add column access_code_hash text")
            if "auth_uid" not in student_account_columns:
                connection.execute("alter table student_accounts add column auth_uid text")
            connection.execute(
                """
                create index if not exists idx_student_accounts_login
                on student_accounts (login_id)
                """
            )
            connection.execute(
                """
                create index if not exists idx_student_accounts_auth_uid
                on student_accounts (auth_uid)
                """
            )
            connection.execute(
                """
                create table if not exists parent_accounts (
                    id text primary key,
                    access_code_hash text,
                    auth_uid text,
                    name text not null,
                    contact text not null,
                    relationship text not null,
                    created_at text not null
                )
                """
            )
            parent_account_columns = {
                row["name"] for row in connection.execute("pragma table_info(parent_accounts)").fetchall()
            }
            if "auth_uid" not in parent_account_columns:
                connection.execute("alter table parent_accounts add column auth_uid text")
            if "access_code_hash" not in parent_account_columns:
                connection.execute("alter table parent_accounts add column access_code_hash text")
            connection.execute(
                """
                create index if not exists idx_parent_accounts_auth_uid
                on parent_accounts (auth_uid)
                """
            )
            connection.execute(
                """
                create table if not exists parent_student_links (
                    id text primary key,
                    parent_id text not null,
                    student_id text not null,
                    created_at text not null,
                    unique (parent_id, student_id)
                )
                """
            )
            connection.execute(
                """
                create index if not exists idx_parent_student_links_created
                on parent_student_links (created_at desc)
                """
            )
            connection.execute(
                """
                create table if not exists parent_invite_codes (
                    id text primary key,
                    code text not null unique,
                    student_id text not null,
                    created_at text not null,
                    expires_at text not null,
                    redeemed_at text,
                    redeemed_by_parent_id text
                )
                """
            )
            connection.execute(
                """
                create index if not exists idx_parent_invite_codes_student_created
                on parent_invite_codes (student_id, created_at desc)
                """
            )
            connection.execute(
                """
                create table if not exists account_recovery_requests (
                    id text primary key,
                    role text not null,
                    login_id text not null,
                    contact text not null,
                    note text not null,
                    matched_account_id text,
                    status text not null default 'open',
                    reviewed_at text,
                    admin_note text not null default '',
                    created_at text not null
                )
                """
            )
            account_recovery_columns = {
                row["name"] for row in connection.execute("pragma table_info(account_recovery_requests)").fetchall()
            }
            if "status" not in account_recovery_columns:
                connection.execute("alter table account_recovery_requests add column status text not null default 'open'")
            if "reviewed_at" not in account_recovery_columns:
                connection.execute("alter table account_recovery_requests add column reviewed_at text")
            if "admin_note" not in account_recovery_columns:
                connection.execute("alter table account_recovery_requests add column admin_note text not null default ''")
            connection.execute(
                """
                create index if not exists idx_account_recovery_requests_created
                on account_recovery_requests (created_at desc)
                """
            )
            connection.execute(
                """
                create index if not exists idx_account_recovery_requests_status_created
                on account_recovery_requests (status, created_at desc)
                """
            )
            connection.execute(
                """
                create table if not exists account_deletion_requests (
                    id text primary key,
                    role text not null,
                    account_id text not null,
                    account_label text not null,
                    login_id text not null,
                    contact text not null,
                    reason text not null,
                    status text not null default 'pending',
                    reviewed_at text,
                    completed_at text,
                    admin_note text not null default '',
                    created_at text not null
                )
                """
            )
            connection.execute(
                """
                create index if not exists idx_account_deletion_requests_account_status
                on account_deletion_requests (role, account_id, status)
                """
            )
            connection.execute(
                """
                create index if not exists idx_account_deletion_requests_status_created
                on account_deletion_requests (status, created_at desc)
                """
            )
            connection.execute(
                """
                create table if not exists study_session_completions (
                    id text primary key,
                    plan_id text not null,
                    session_key text not null,
                    study_date text not null,
                    kind text not null,
                    subject text not null,
                    topic text not null,
                    resource_type text not null,
                    minutes_planned integer not null,
                    minutes_completed integer not null,
                    recall_note text not null,
                    confidence integer not null,
                    completed_at text not null,
                    unique (plan_id, session_key)
                )
                """
            )
            connection.execute(
                """
                create index if not exists idx_study_session_completions_plan_date
                on study_session_completions (plan_id, study_date)
                """
            )
            connection.execute(
                """
                create table if not exists study_reminder_settings (
                    plan_id text primary key,
                    reminders_enabled integer not null,
                    reminder_time text not null,
                    reminder_minutes_before integer not null,
                    missed_session_alerts_enabled integer not null,
                    missed_session_followup_time text not null,
                    parent_alerts_enabled integer not null,
                    updated_at text not null
                )
                """
            )
            connection.execute(
                """
                create table if not exists study_check_ins (
                    id text primary key,
                    student_id text not null,
                    study_date text not null,
                    minutes_completed integer not null,
                    sessions_completed integer not null,
                    sessions_planned integer not null,
                    note text not null,
                    created_at text not null
                )
                """
            )
            connection.execute(
                """
                create index if not exists idx_study_check_ins_student_date
                on study_check_ins (student_id, study_date)
                """
            )


@lru_cache
def get_study_plan_store() -> StudyPlanStore:
    return StudyPlanStore(get_settings().local_data_path)


def _daily_progress_status(
    *,
    study_date: date,
    today: date,
    planned_sessions: int,
    completed_sessions: int,
    missed_sessions: int,
) -> str:
    if planned_sessions == 0:
        return "rest"
    if completed_sessions >= planned_sessions:
        return "complete"
    if missed_sessions:
        return "missed"
    if study_date == today:
        return "today"
    return "upcoming"


def _progress_streak_days(daily: list[DailyProgress], today: date) -> int:
    completed_dates = {day.study_date for day in daily if day.completed_sessions > 0}
    streak = 0
    cursor = today
    while cursor in completed_dates:
        streak += 1
        cursor = date.fromordinal(cursor.toordinal() - 1)
    return streak


def _weekly_digest_headline(completion_rate: float, missed_sessions: int) -> str:
    if completion_rate >= 85 and missed_sessions == 0:
        return "Strong study week"
    if completion_rate >= 60:
        return "Steady week with room to tighten"
    if missed_sessions:
        return "Catch-up week needed"
    return "Build the first study rhythm"


def _weekly_digest_insight(
    completion_rate: float,
    active_days: int,
    missed_sessions: int,
    streak_days: int,
) -> str:
    if completion_rate >= 85 and missed_sessions == 0:
        return f"The student studied on {active_days} days and has a {streak_days}-day streak."
    if missed_sessions:
        return f"{missed_sessions} planned sessions were missed this week. A short catch-up block will help."
    if active_days:
        return f"The student studied on {active_days} days. Keep sessions short, visible, and consistent."
    return "No completed study day has been recorded in this review window."


def _weekly_digest_next_action(completion_rate: float, missed_sessions: int) -> str:
    if missed_sessions:
        return "Open the Catch-up plan and rebalance if the missed work is piling up."
    if completion_rate >= 85:
        return "Protect the same routine next week and add one light revision session."
    if completion_rate >= 60:
        return "Choose one fixed study time and finish today's focus queue."
    return "Complete one short session today and write a recall note before closing the app."


def _default_reminder_settings(plan_id: str) -> StudyReminderSettings:
    return StudyReminderSettings(
        plan_id=plan_id,
        reminders_enabled=True,
        reminder_time="18:00",
        reminder_minutes_before=15,
        missed_session_alerts_enabled=True,
        missed_session_followup_time="20:00",
        parent_alerts_enabled=True,
        updated_at=datetime.now(timezone.utc),
    )


def _reminder_settings_from_row(row: sqlite3.Row) -> StudyReminderSettings:
    return StudyReminderSettings(
        plan_id=row["plan_id"],
        reminders_enabled=bool(row["reminders_enabled"]),
        reminder_time=row["reminder_time"],
        reminder_minutes_before=row["reminder_minutes_before"],
        missed_session_alerts_enabled=bool(row["missed_session_alerts_enabled"]),
        missed_session_followup_time=row["missed_session_followup_time"],
        parent_alerts_enabled=bool(row["parent_alerts_enabled"]),
        updated_at=row["updated_at"],
    )


def _saved_plan_from_row(row: sqlite3.Row) -> SavedStudyPlan:
    setup_payload_json = row["setup_payload_json"] if "setup_payload_json" in row.keys() else None
    setup_payload = StudyPlanRequest.model_validate(json.loads(setup_payload_json)) if setup_payload_json else None

    return SavedStudyPlan(
        id=row["id"],
        student_name=row["student_name"],
        student_id=row["student_id"],
        created_at=row["created_at"],
        plan=StudyPlanResponse.model_validate(json.loads(row["plan_json"])),
        setup_payload=setup_payload,
    )


def _student_profile_key(payload: StudentAccountCreate) -> tuple[str, str, str, int, str]:
    return _student_profile_values(
        login_id=payload.login_id,
        name=payload.name,
        class_level=payload.class_level,
        age=payload.age,
        school_name=payload.school_name,
    )


def _student_profile_values(
    *,
    login_id: str,
    name: str,
    class_level: str,
    age: int,
    school_name: str,
) -> tuple[str, str, str, int, str]:
    return (
        _contact_key(login_id),
        _compact_text(name),
        _compact_text(class_level),
        age,
        _compact_text(school_name),
    )


def _contact_key(contact: str) -> str:
    normalized = contact.strip().lower()
    if "@" in normalized:
        return normalized

    digits = "".join(character for character in normalized if character.isdigit())
    return digits or _compact_text(normalized)


def _generate_parent_invite_code() -> str:
    return f"SN-{secrets.randbelow(900000) + 100000}"


def _normalize_parent_invite_code(code: str) -> str | None:
    normalized = code.strip().upper().replace(" ", "")
    if re.fullmatch(r"\d{6}", normalized):
        return f"SN-{normalized}"
    if re.fullmatch(r"SN-?\d{6}", normalized):
        digits = normalized.replace("SN", "").replace("-", "")
        return f"SN-{digits}"
    return None


def _compact_text(value: str) -> str:
    return " ".join(value.strip().lower().split())


def _hash_access_code(access_code: str) -> str:
    normalized = access_code.strip()
    return hashlib.sha256(f"studynova-access-code-v1:{normalized}".encode("utf-8")).hexdigest()


def _access_code_matches(access_code_hash: str, access_code: str) -> bool:
    return hmac.compare_digest(access_code_hash, _hash_access_code(access_code))


def _legacy_student_login_id(student_id: str) -> str:
    return f"{student_id}@legacy.studynova.local"
