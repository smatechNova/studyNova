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


def test_student_invite_code_links_parent_to_student(tmp_path, monkeypatch) -> None:
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

    invite_response = client.post(
        f"/api/v1/accounts/students/{student.id}/parent-invites",
        headers=_headers(client, "student", student.login_id),
    )
    redeem_response = client.post(
        f"/api/v1/accounts/parents/{parent.id}/parent-invites/redeem",
        headers=_headers(client, "parent", parent.contact, "4321"),
        json={"code": invite_response.json()["code"]},
    )

    assert invite_response.status_code == 200
    assert invite_response.json()["code"].startswith("SN-")
    assert redeem_response.status_code == 200
    assert [linked_student["id"] for linked_student in redeem_response.json()["students"]] == [student.id]


def test_student_cannot_generate_invite_for_another_student(tmp_path, monkeypatch) -> None:
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    monkeypatch.setattr(api_module, "get_study_plan_store", lambda: store)
    client = TestClient(app)
    first_student = _student(store, "alliyah@example.com", "Alliyah Olaniyan")
    second_student = _student(store, "aminah@example.com", "Aminah Olaniyan")

    response = client.post(
        f"/api/v1/accounts/students/{second_student.id}/parent-invites",
        headers=_headers(client, "student", first_student.login_id),
    )

    assert response.status_code == 403


def test_invite_code_can_only_be_redeemed_once(tmp_path, monkeypatch) -> None:
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    monkeypatch.setattr(api_module, "get_study_plan_store", lambda: store)
    client = TestClient(app)
    student = _student(store, "alliyah@example.com", "Alliyah Olaniyan")
    first_parent = store.create_parent_account(
        ParentAccountCreate(
            name="Mrs Olaniyan",
            contact="08012345678",
            access_code="4321",
            relationship="Mother",
        )
    )
    second_parent = store.create_parent_account(
        ParentAccountCreate(
            name="Mr Adeyemi",
            contact="08087654321",
            access_code="5678",
            relationship="Guardian",
        )
    )
    invite = client.post(
        f"/api/v1/accounts/students/{student.id}/parent-invites",
        headers=_headers(client, "student", student.login_id),
    ).json()

    first_response = client.post(
        f"/api/v1/accounts/parents/{first_parent.id}/parent-invites/redeem",
        headers=_headers(client, "parent", first_parent.contact, "4321"),
        json={"code": invite["code"]},
    )
    second_response = client.post(
        f"/api/v1/accounts/parents/{second_parent.id}/parent-invites/redeem",
        headers=_headers(client, "parent", second_parent.contact, "5678"),
        json={"code": invite["code"]},
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 404


def test_account_recovery_request_returns_generic_receipt(tmp_path, monkeypatch) -> None:
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    monkeypatch.setattr(api_module, "get_study_plan_store", lambda: store)
    client = TestClient(app)
    _student(store, "alliyah@example.com", "Alliyah Olaniyan")

    existing_response = client.post(
        "/api/v1/accounts/recovery-requests",
        json={
            "role": "student",
            "login_id": "alliyah@example.com",
            "contact": "parent@example.com",
            "note": "Forgot access code",
        },
    )
    missing_response = client.post(
        "/api/v1/accounts/recovery-requests",
        json={
            "role": "student",
            "login_id": "missing@example.com",
            "contact": "parent@example.com",
        },
    )

    assert existing_response.status_code == 200
    assert missing_response.status_code == 200
    assert existing_response.json()["status"] == "received"
    assert missing_response.json()["status"] == "received"
    assert "matched_account_id" not in existing_response.json()


def test_admin_can_review_account_recovery_requests(tmp_path, monkeypatch) -> None:
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    monkeypatch.setattr(api_module, "get_study_plan_store", lambda: store)
    client = TestClient(app)
    _student(store, "alliyah@example.com", "Alliyah Olaniyan")
    client.post(
        "/api/v1/accounts/recovery-requests",
        json={
            "role": "student",
            "login_id": "alliyah@example.com",
            "contact": "parent@example.com",
            "note": "Forgot access code",
        },
    )

    blocked_response = client.get("/api/v1/admin/account-recovery-requests")
    allowed_response = client.get(
        "/api/v1/admin/account-recovery-requests",
        headers={"X-Admin-Code": "studynova-admin-dev"},
    )

    assert blocked_response.status_code == 403
    assert allowed_response.status_code == 200
    assert allowed_response.json()[0]["role"] == "student"
    assert allowed_response.json()[0]["matched_account"] is True
    assert "matched_account_id" not in allowed_response.json()[0]


def test_expired_session_token_is_rejected(tmp_path, monkeypatch) -> None:
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    monkeypatch.setattr(api_module, "get_study_plan_store", lambda: store)
    client = TestClient(app)
    student = _student(store, "alliyah@example.com", "Alliyah Olaniyan")
    expired_at = 1
    signature = api_module._session_signature("student", student.id, expired_at)

    response = client.get(
        f"/api/v1/accounts/students/{student.id}/family",
        headers={"Authorization": f"Bearer student.{student.id}.{expired_at}.{signature}"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Sign-in session expired."


def test_production_admin_access_requires_non_default_code(monkeypatch) -> None:
    class ProductionSettings:
        app_env = "production"
        admin_access_code = "studynova-admin-dev"
        session_secret = "test-session-secret"
        session_ttl_hours = 168

        @property
        def is_production(self) -> bool:
            return True

        @property
        def uses_default_admin_access_code(self) -> bool:
            return True

    monkeypatch.setattr(api_module, "get_settings", lambda: ProductionSettings())
    client = TestClient(app)

    response = client.get(
        "/api/v1/admin/account-recovery-requests",
        headers={"X-Admin-Code": "studynova-admin-dev"},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "Admin support access is not configured."


def test_admin_can_review_storage_health_and_create_backup(tmp_path, monkeypatch) -> None:
    class TestSettings:
        app_env = "development"
        admin_access_code = "admin-test"
        backup_data_path = str(tmp_path / "backups")
        session_secret = "test-session-secret"
        session_ttl_hours = 168

        @property
        def is_production(self) -> bool:
            return False

        @property
        def uses_default_admin_access_code(self) -> bool:
            return False

    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    _student(store, "alliyah@example.com", "Alliyah Olaniyan")
    monkeypatch.setattr(api_module, "get_study_plan_store", lambda: store)
    monkeypatch.setattr(api_module, "get_settings", lambda: TestSettings())
    client = TestClient(app)

    blocked_response = client.get("/api/v1/admin/storage/health")
    health_response = client.get("/api/v1/admin/storage/health", headers={"X-Admin-Code": "admin-test"})
    backup_response = client.post("/api/v1/admin/storage/backups", headers={"X-Admin-Code": "admin-test"})

    assert blocked_response.status_code == 403
    assert health_response.status_code == 200
    assert health_response.json()["provider"] == "sqlite"
    assert health_response.json()["database_exists"] is True
    assert backup_response.status_code == 200
    assert backup_response.json()["filename"].startswith("studynova-")


def test_admin_can_review_firebase_auth_readiness(monkeypatch) -> None:
    class TestSettings:
        app_env = "development"
        admin_access_code = "admin-test"
        session_secret = "test-session-secret"
        session_ttl_hours = 168

        @property
        def is_production(self) -> bool:
            return False

        @property
        def uses_default_admin_access_code(self) -> bool:
            return False

    monkeypatch.setattr(api_module, "get_settings", lambda: TestSettings())
    monkeypatch.setattr(
        api_module,
        "firebase_auth_readiness",
        lambda: {
            "provider": "firebase",
            "admin_sdk_installed": True,
            "service_account_configured": True,
            "google_application_credentials_configured": False,
            "project_id_configured": False,
            "server_verification_ready": True,
            "warnings": [],
        },
    )
    client = TestClient(app)

    blocked_response = client.get("/api/v1/admin/auth/firebase/readiness")
    allowed_response = client.get(
        "/api/v1/admin/auth/firebase/readiness",
        headers={"X-Admin-Code": "admin-test"},
    )

    assert blocked_response.status_code == 403
    assert allowed_response.status_code == 200
    assert allowed_response.json()["provider"] == "firebase"
    assert allowed_response.json()["server_verification_ready"] is True


def test_admin_can_review_deployment_readiness(tmp_path, monkeypatch) -> None:
    class TestSettings:
        app_env = "production"
        admin_access_code = "admin-test-code"
        allowed_origins = ""
        allowed_origin_regex = ""
        backup_data_path = str(tmp_path / "backups")
        public_api_base_url = "https://api.studynova.example.com"
        session_secret = "a-long-private-session-secret-for-tests"
        session_ttl_hours = 168

        @property
        def cors_origins(self) -> list[str]:
            return []

        @property
        def is_production(self) -> bool:
            return True

        @property
        def uses_default_admin_access_code(self) -> bool:
            return False

        @property
        def uses_default_session_secret(self) -> bool:
            return False

    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    monkeypatch.setattr(api_module, "get_study_plan_store", lambda: store)
    monkeypatch.setattr(api_module, "get_settings", lambda: TestSettings())
    monkeypatch.setattr(
        api_module,
        "firebase_auth_readiness",
        lambda: {
            "provider": "firebase",
            "admin_sdk_installed": True,
            "service_account_configured": True,
            "google_application_credentials_configured": False,
            "project_id_configured": False,
            "server_verification_ready": True,
            "warnings": [],
        },
    )
    client = TestClient(app)

    response = client.get("/api/v1/admin/deployment/readiness", headers={"X-Admin-Code": "admin-test-code"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["ready"] is True
    assert payload["public_api_base_url"] == "https://api.studynova.example.com"
    assert all(check["status"] == "pass" for check in payload["checks"])


def test_deployment_readiness_flags_unsafe_production_defaults(tmp_path, monkeypatch) -> None:
    class TestSettings:
        app_env = "production"
        admin_access_code = "admin-test-code"
        allowed_origins = "http://localhost:8081"
        allowed_origin_regex = r"https://.*\.app\.github\.dev"
        backup_data_path = str(tmp_path / "backups")
        public_api_base_url = "http://api.example.com"
        session_secret = "studynova-local-session-secret"
        session_ttl_hours = 168

        @property
        def cors_origins(self) -> list[str]:
            return ["http://localhost:8081"]

        @property
        def is_production(self) -> bool:
            return True

        @property
        def uses_default_admin_access_code(self) -> bool:
            return False

        @property
        def uses_default_session_secret(self) -> bool:
            return True

    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    monkeypatch.setattr(api_module, "get_study_plan_store", lambda: store)
    monkeypatch.setattr(api_module, "get_settings", lambda: TestSettings())
    monkeypatch.setattr(
        api_module,
        "firebase_auth_readiness",
        lambda: {
            "provider": "firebase",
            "admin_sdk_installed": True,
            "service_account_configured": False,
            "google_application_credentials_configured": False,
            "project_id_configured": False,
            "server_verification_ready": False,
            "warnings": ["Configure Firebase."],
        },
    )
    client = TestClient(app)

    response = client.get("/api/v1/admin/deployment/readiness", headers={"X-Admin-Code": "admin-test-code"})

    assert response.status_code == 200
    payload = response.json()
    failed_checks = {check["name"] for check in payload["checks"] if check["status"] == "fail"}
    warning_checks = {check["name"] for check in payload["checks"] if check["status"] == "warning"}
    assert payload["ready"] is False
    assert {"Public API URL", "Session secret", "CORS policy"}.issubset(failed_checks)
    assert "Firebase verification" in warning_checks
