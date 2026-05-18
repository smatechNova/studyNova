import json
import sqlite3
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from uuid import uuid4

from app.config import get_settings
from app.schemas import (
    DailyProgress,
    SavedStudyPlan,
    StudyPlanProgress,
    StudyPlanResponse,
    StudySessionCompletion,
    StudySessionCompletionRequest,
)


class StudyPlanStore:
    def __init__(self, database_path: str) -> None:
        self.database_path = Path(database_path)
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        self._ensure_schema()

    def save(self, plan: StudyPlanResponse) -> SavedStudyPlan:
        saved_plan = SavedStudyPlan(
            id=str(uuid4()),
            student_name=plan.metadata.student_name,
            created_at=datetime.now(timezone.utc),
            plan=plan,
        )

        with self._connect() as connection:
            connection.execute(
                """
                insert into saved_study_plans (id, student_name, created_at, plan_json)
                values (?, ?, ?, ?)
                """,
                (
                    saved_plan.id,
                    saved_plan.student_name,
                    saved_plan.created_at.isoformat(),
                    json.dumps(plan.model_dump(mode="json")),
                ),
            )

        return saved_plan

    def latest(self, student_name: str | None = None) -> SavedStudyPlan | None:
        query = """
            select id, student_name, created_at, plan_json
            from saved_study_plans
        """
        params: tuple[str, ...] = ()
        if student_name:
            query += " where lower(student_name) = lower(?)"
            params = (student_name,)
        query += " order by created_at desc limit 1"

        with self._connect() as connection:
            row = connection.execute(query, params).fetchone()

        if row is None:
            return None

        return SavedStudyPlan(
            id=row["id"],
            student_name=row["student_name"],
            created_at=row["created_at"],
            plan=StudyPlanResponse.model_validate(json.loads(row["plan_json"])),
        )

    def by_id(self, plan_id: str) -> SavedStudyPlan | None:
        with self._connect() as connection:
            row = connection.execute(
                """
                select id, student_name, created_at, plan_json
                from saved_study_plans
                where id = ?
                """,
                (plan_id,),
            ).fetchone()

        if row is None:
            return None

        return SavedStudyPlan(
            id=row["id"],
            student_name=row["student_name"],
            created_at=row["created_at"],
            plan=StudyPlanResponse.model_validate(json.loads(row["plan_json"])),
        )

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
                    created_at text not null,
                    plan_json text not null
                )
                """
            )
            connection.execute(
                """
                create index if not exists idx_saved_study_plans_student_created
                on saved_study_plans (student_name, created_at desc)
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


@lru_cache
def get_study_plan_store() -> StudyPlanStore:
    return StudyPlanStore(get_settings().local_data_path)
