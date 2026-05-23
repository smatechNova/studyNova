from datetime import date, timedelta

from fastapi.testclient import TestClient

from app import api as api_module
from app.domain.study_planner import build_study_plan
from app.main import app
from app.schemas import (
    ParentAccountCreate,
    ParentStudentLinkCreate,
    StudentAccount,
    StudentAccountCreate,
    StudyPlanRequest,
    SubjectInput,
    TopicInput,
)
from app.storage import StudyPlanStore


def _request(student_name: str = "Alliyah") -> StudyPlanRequest:
    return StudyPlanRequest(
        student_profile={"name": student_name, "class_level": "SS2", "age": 15},
        exam_start_date=date.today() + timedelta(days=10),
        exam_end_date=date.today() + timedelta(days=14),
        available_daily_minutes=90,
        session_minutes=45,
        subjects=[
            SubjectInput(
                name="Mathematics",
                topics=[TopicInput(name="Algebra", pages=20, priority=5)],
            )
        ],
    )


def _student(store: StudyPlanStore, login_id: str, name: str) -> StudentAccount:
    return store.create_student_account(
        StudentAccountCreate(
            login_id=login_id,
            access_code="1234",
            name=name,
            class_level="SS2",
            age=15,
            school_name="",
        )
    )


def _headers(client: TestClient, role: str, login_id: str, access_code: str = "1234") -> dict[str, str]:
    response = client.post(
        "/api/v1/accounts/sign-in",
        json={"role": role, "login_id": login_id, "access_code": access_code},
    )
    assert response.status_code == 200
    token = response.json()["session_token"]
    assert token
    return {"Authorization": f"Bearer {token}"}


def test_student_cannot_read_another_students_plan(tmp_path, monkeypatch) -> None:
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    monkeypatch.setattr(api_module, "get_study_plan_store", lambda: store)
    client = TestClient(app)
    first_student = _student(store, "alliyah@example.com", "Alliyah Olaniyan")
    second_student = _student(store, "aminah@example.com", "Aminah Olaniyan")
    saved = store.save(build_study_plan(_request("Aminah")), student_id=second_student.id)

    response = client.get(
        f"/api/v1/study-plans/{saved.id}/progress",
        headers=_headers(client, "student", first_student.login_id),
    )

    assert response.status_code == 403


def test_parent_can_read_only_linked_student_plans(tmp_path, monkeypatch) -> None:
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    monkeypatch.setattr(api_module, "get_study_plan_store", lambda: store)
    client = TestClient(app)
    linked_student = _student(store, "alliyah@example.com", "Alliyah Olaniyan")
    unlinked_student = _student(store, "aminah@example.com", "Aminah Olaniyan")
    parent = store.create_parent_account(
        ParentAccountCreate(
            name="Mrs Olaniyan",
            contact="08012345678",
            access_code="4321",
            relationship="Mother",
        )
    )
    store.link_parent_student(ParentStudentLinkCreate(parent_id=parent.id, student_id=linked_student.id))
    linked_plan = store.save(build_study_plan(_request("Alliyah")), student_id=linked_student.id)
    unlinked_plan = store.save(build_study_plan(_request("Aminah")), student_id=unlinked_student.id)
    parent_headers = _headers(client, "parent", "08012345678", "4321")

    linked_response = client.get(f"/api/v1/study-plans/{linked_plan.id}/progress", headers=parent_headers)
    blocked_response = client.get(f"/api/v1/study-plans/{unlinked_plan.id}/progress", headers=parent_headers)

    assert linked_response.status_code == 200
    assert blocked_response.status_code == 403


def test_role_routes_reject_cross_role_access(tmp_path, monkeypatch) -> None:
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    monkeypatch.setattr(api_module, "get_study_plan_store", lambda: store)
    client = TestClient(app)
    student = _student(store, "alliyah@example.com", "Alliyah Olaniyan")
    parent = store.create_parent_account(
        ParentAccountCreate(
            name="Mrs Olaniyan",
            contact="08012345678",
            access_code="4321",
            relationship="Mother",
        )
    )
    store.link_parent_student(ParentStudentLinkCreate(parent_id=parent.id, student_id=student.id))

    parent_student_route = client.get(
        f"/api/v1/accounts/students/{student.id}/family",
        headers=_headers(client, "parent", "08012345678", "4321"),
    )
    student_parent_route = client.get(
        f"/api/v1/accounts/parents/{parent.id}/family",
        headers=_headers(client, "student", "alliyah@example.com"),
    )

    assert parent_student_route.status_code == 403
    assert student_parent_route.status_code == 403


def test_save_plan_uses_signed_in_student_not_posted_student_id(tmp_path, monkeypatch) -> None:
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    monkeypatch.setattr(api_module, "get_study_plan_store", lambda: store)
    client = TestClient(app)
    signed_in_student = _student(store, "alliyah@example.com", "Alliyah Olaniyan")
    other_student = _student(store, "aminah@example.com", "Aminah Olaniyan")
    request = _request("Alliyah")
    plan = build_study_plan(request)

    response = client.post(
        "/api/v1/study-plans/save",
        headers=_headers(client, "student", signed_in_student.login_id),
        json={
            "plan": plan.model_dump(mode="json"),
            "student_id": other_student.id,
            "setup_payload": request.model_dump(mode="json"),
        },
    )

    assert response.status_code == 200
    assert response.json()["student_id"] == signed_in_student.id
