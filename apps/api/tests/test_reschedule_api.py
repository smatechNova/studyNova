from datetime import date, timedelta

from fastapi.testclient import TestClient

from app import api as api_module
from app.domain.study_planner import build_study_plan
from app.main import app
from app.schemas import StudentAccount, StudentAccountCreate, StudyPlanRequest, SubjectInput, TopicInput
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


def _student_session(client: TestClient, store: StudyPlanStore) -> tuple[StudentAccount, dict[str, str]]:
    student = store.create_student_account(
        StudentAccountCreate(
            login_id="alliyah@example.com",
            access_code="1234",
            name="Alliyah Olaniyan",
            class_level="SS2",
            age=15,
            school_name="",
        )
    )
    response = client.post(
        "/api/v1/accounts/sign-in",
        json={"role": "student", "login_id": "alliyah@example.com", "access_code": "1234"},
    )
    assert response.status_code == 200
    return student, {"Authorization": f"Bearer {response.json()['session_token']}"}


def test_reschedule_endpoint_saves_rebalanced_plan_version(tmp_path, monkeypatch) -> None:
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    monkeypatch.setattr(api_module, "get_study_plan_store", lambda: store)
    client = TestClient(app)
    student, headers = _student_session(client, store)
    plan = build_study_plan(_request())
    plan.schedule[0].study_date = date.today() - timedelta(days=1)
    saved = store.save(plan, student_id=student.id, setup_payload=_request())

    response = client.post(f"/api/v1/study-plans/{saved.id}/reschedule", headers=headers)

    assert response.status_code == 200
    body = response.json()
    history = store.history(student_id=student.id)
    assert body["id"] != saved.id
    assert body["plan"]["metadata"]["recommendation"].startswith(
        "Plan rebalanced after missed sessions."
    )
    assert len(history) == 2
    assert history[0].id == body["id"]


def test_reminder_settings_endpoint_round_trips_plan_preferences(tmp_path, monkeypatch) -> None:
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    monkeypatch.setattr(api_module, "get_study_plan_store", lambda: store)
    client = TestClient(app)
    student, headers = _student_session(client, store)
    saved = store.save(
        build_study_plan(_request()),
        student_id=student.id,
        setup_payload=_request(),
    )

    default_response = client.get(f"/api/v1/study-plans/{saved.id}/reminders", headers=headers)
    update_response = client.put(
        f"/api/v1/study-plans/{saved.id}/reminders",
        headers=headers,
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
    client = TestClient(app)
    student, headers = _student_session(client, store)
    plan = build_study_plan(_request())
    plan.schedule[0].study_date = date.today() - timedelta(days=1)
    saved = store.save(plan, student_id=student.id, setup_payload=_request())

    response = client.get(f"/api/v1/study-plans/{saved.id}/weekly-digest", headers=headers)

    assert response.status_code == 200
    body = response.json()
    assert body["plan_id"] == saved.id
    assert body["missed_sessions"] == len(plan.schedule[0].sessions)
    assert body["headline"] == "Catch-up week needed"
    assert body["days"]
