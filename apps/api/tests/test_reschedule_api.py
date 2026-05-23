from datetime import date, timedelta

from fastapi.testclient import TestClient

from app import api as api_module
from app.domain.study_planner import build_study_plan
from app.main import app
from app.schemas import StudyPlanRequest, SubjectInput, TopicInput
from app.storage import StudyPlanStore


def _request() -> StudyPlanRequest:
    return StudyPlanRequest(
        student_profile={"name": "Alliyah", "class_level": "SS2", "age": 15},
        exam_start_date=date.today() + timedelta(days=10),
        exam_end_date=date.today() + timedelta(days=14),
        available_daily_minutes=90,
        session_minutes=45,
        subjects=[
            SubjectInput(
                name="Mathematics",
                topics=[
                    TopicInput(name="Algebra", pages=20, priority=5),
                    TopicInput(name="Geometry", pages=16, priority=4),
                ],
            )
        ],
    )


def test_reschedule_endpoint_saves_rebalanced_plan_version(tmp_path, monkeypatch) -> None:
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    monkeypatch.setattr(api_module, "get_study_plan_store", lambda: store)
    plan = build_study_plan(_request())
    plan.schedule[0].study_date = date.today() - timedelta(days=1)
    saved = store.save(plan, student_id="student-1", setup_payload=_request())
    client = TestClient(app)

    response = client.post(f"/api/v1/study-plans/{saved.id}/reschedule")

    assert response.status_code == 200
    body = response.json()
    history = store.history(student_id="student-1")
    assert body["id"] != saved.id
    assert body["plan"]["metadata"]["recommendation"].startswith(
        "Plan rebalanced after missed sessions."
    )
    assert len(history) == 2
    assert history[0].id == body["id"]


def test_reminder_settings_endpoint_round_trips_plan_preferences(tmp_path, monkeypatch) -> None:
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    monkeypatch.setattr(api_module, "get_study_plan_store", lambda: store)
    saved = store.save(
        build_study_plan(_request()),
        student_id="student-1",
        setup_payload=_request(),
    )
    client = TestClient(app)

    default_response = client.get(f"/api/v1/study-plans/{saved.id}/reminders")
    update_response = client.put(
        f"/api/v1/study-plans/{saved.id}/reminders",
        json={
            "reminders_enabled": True,
            "reminder_time": "19:30",
            "reminder_minutes_before": 30,
            "missed_session_alerts_enabled": True,
            "missed_session_followup_time": "21:00",
            "parent_alerts_enabled": False,
        },
    )

    assert default_response.status_code == 200
    assert default_response.json()["reminder_time"] == "18:00"
    assert update_response.status_code == 200
    assert update_response.json()["reminder_time"] == "19:30"
    assert update_response.json()["parent_alerts_enabled"] is False


def test_weekly_digest_endpoint_returns_current_progress_review(tmp_path, monkeypatch) -> None:
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    monkeypatch.setattr(api_module, "get_study_plan_store", lambda: store)
    plan = build_study_plan(_request())
    plan.schedule[0].study_date = date.today() - timedelta(days=1)
    saved = store.save(plan, student_id="student-1", setup_payload=_request())
    client = TestClient(app)

    response = client.get(f"/api/v1/study-plans/{saved.id}/weekly-digest")

    assert response.status_code == 200
    body = response.json()
    assert body["plan_id"] == saved.id
    assert body["missed_sessions"] == len(plan.schedule[0].sessions)
    assert body["headline"] == "Catch-up week needed"
    assert body["days"]
