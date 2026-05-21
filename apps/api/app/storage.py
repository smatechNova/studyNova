import hashlib
import hmac
import json
import sqlite3
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from uuid import uuid4

from app.config import get_settings
from app.schemas import (
    AccountSignInRequest,
    AuthSession,
    CheckInRequest,
    CheckInResponse,
    DailyProgress,
    FamilyAccount,
    ParentAccount,
    ParentAccountCreate,
    ParentFamilyAccount,
    ParentProgressSummary,
    ParentStudentLink,
    ParentStudentLinkCreate,
    SavedStudyPlan,
    StudentAccount,
    StudentAccountCreate,
    StudyPlanRequest,
    StudyPlanProgress,
    StudyPlanResponse,
    StudySessionCompletion,
    StudySessionCompletionRequest,
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

    def _student_access_code_matches(self, student_id: str, access_code: str) -> bool:
        access_code_hash = self._student_access_code_hash(student_id)
        return bool(access_code_hash and _access_code_matches(access_code_hash, access_code))

    def _parent_access_code_matches(self, parent_id: str, access_code: str) -> bool:
        access_code_hash = self._parent_access_code_hash(parent_id)
        return bool(access_code_hash and _access_code_matches(access_code_hash, access_code))

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
        completion_by_date: dict[str, list[StudySessionCompletion]] = {}
        for completion in completions:
            completion_by_date.setdefault(completion.study_date.isoformat(), []).append(completion)

        daily: list[DailyProgress] = []
        for day in saved_plan.plan.schedule:
            completed_for_day = completion_by_date.get(day.study_date.isoformat(), [])
            completed_minutes = sum(completion.minutes_completed for completion in completed_for_day)
            planned_sessions = len(day.sessions)
            completion_rate = round((completed_minutes / day.total_minutes) * 100, 1) if day.total_minutes else 0
            daily.append(
                DailyProgress(
                    study_date=day.study_date,
                    planned_minutes=day.total_minutes,
                    completed_minutes=completed_minutes,
                    planned_sessions=planned_sessions,
                    completed_sessions=len(completed_for_day),
                    completion_rate=min(100, completion_rate),
                )
            )

        planned_minutes = sum(day.total_minutes for day in saved_plan.plan.schedule)
        planned_sessions = sum(len(day.sessions) for day in saved_plan.plan.schedule)
        completed_minutes = sum(completion.minutes_completed for completion in completions)
        completion_rate = round((completed_minutes / planned_minutes) * 100, 1) if planned_minutes else 0

        return StudyPlanProgress(
            plan_id=plan_id,
            planned_minutes=planned_minutes,
            completed_minutes=completed_minutes,
            planned_sessions=planned_sessions,
            completed_sessions=len(completions),
            completion_rate=min(100, completion_rate),
            completed_session_keys=completed_session_keys,
            daily=daily,
            completions=completions,
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


def _compact_text(value: str) -> str:
    return " ".join(value.strip().lower().split())


def _hash_access_code(access_code: str) -> str:
    normalized = access_code.strip()
    return hashlib.sha256(f"studynova-access-code-v1:{normalized}".encode("utf-8")).hexdigest()


def _access_code_matches(access_code_hash: str, access_code: str) -> bool:
    return hmac.compare_digest(access_code_hash, _hash_access_code(access_code))


def _legacy_student_login_id(student_id: str) -> str:
    return f"{student_id}@legacy.studynova.local"
