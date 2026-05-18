import json
import sqlite3
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from uuid import uuid4

from app.config import get_settings
from app.schemas import SavedStudyPlan, StudyPlanResponse


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


@lru_cache
def get_study_plan_store() -> StudyPlanStore:
    return StudyPlanStore(get_settings().local_data_path)
