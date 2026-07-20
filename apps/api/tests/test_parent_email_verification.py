from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import httpx
import pytest
from fastapi.testclient import TestClient

from app import api as api_module
from app import email_delivery as email_delivery_module
from app import storage as storage_module
from app.auth import FirebaseIdentity
from app.email_delivery import EmailDeliveryError, email_delivery_readiness, send_parent_verification_email
from app.main import app
from app.schemas import ParentAccountCreate
from app.storage import ParentEmailVerificationRateLimitError, StudyPlanStore


def _parent(store: StudyPlanStore, email: str = "parent@example.com"):
    return store.create_parent_account(
        ParentAccountCreate(
            name="Mrs Olaniyan",
            contact=email,
            access_code="4321",
            relationship="Mother",
        )
    )


def _verification_settings(**overrides):
    values = {
        "is_production": False,
        "email_provider": "development",
        "resend_api_key": "",
        "email_from": "StudyNova <accounts@studynova.app>",
        "support_email": "support@studynova.app",
        "email_verification_ttl_minutes": 20,
        "email_verification_resend_cooldown_seconds": 60,
        "email_verification_max_requests_per_hour": 5,
        "email_verification_max_attempts": 5,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_email_delivery_readiness_requires_complete_resend_settings() -> None:
    missing = email_delivery_readiness(_verification_settings(is_production=True, email_provider="resend"))
    ready = email_delivery_readiness(
        _verification_settings(
            is_production=True,
            email_provider="resend",
            resend_api_key="re_private_test_key",
        )
    )

    assert missing["configured"] is False
    assert "Set RESEND_API_KEY on the API host." in missing["warnings"]
    assert ready["configured"] is True


def test_resend_delivery_posts_verification_email(monkeypatch) -> None:
    settings = _verification_settings(
        is_production=True,
        email_provider="resend",
        resend_api_key="re_private_test_key",
    )
    captured: dict[str, object] = {}

    def fake_post(url, **kwargs):
        captured["url"] = url
        captured.update(kwargs)
        return httpx.Response(200, json={"id": "email-message-1"})

    monkeypatch.setattr(email_delivery_module, "get_settings", lambda: settings)
    monkeypatch.setattr(email_delivery_module.httpx, "post", fake_post)

    result = send_parent_verification_email(
        recipient="parent@example.com",
        verification_code="123456",
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=20),
        idempotency_key="parent-verification/test-1",
    )

    assert result.provider == "resend"
    assert result.message_id == "email-message-1"
    assert captured["url"] == email_delivery_module.RESEND_EMAILS_URL
    assert captured["headers"]["Authorization"] == "Bearer re_private_test_key"
    assert captured["json"]["to"] == ["parent@example.com"]
    assert "123456" in captured["json"]["text"]


def test_resend_delivery_reports_provider_failure(monkeypatch) -> None:
    settings = _verification_settings(
        is_production=True,
        email_provider="resend",
        resend_api_key="re_private_test_key",
    )
    monkeypatch.setattr(email_delivery_module, "get_settings", lambda: settings)
    monkeypatch.setattr(
        email_delivery_module.httpx,
        "post",
        lambda *args, **kwargs: httpx.Response(422, json={"message": "Rejected"}),
    )

    with pytest.raises(EmailDeliveryError, match="rejected"):
        send_parent_verification_email(
            recipient="parent@example.com",
            verification_code="123456",
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=20),
            idempotency_key="parent-verification/test-2",
        )


def test_parent_verification_code_expires(tmp_path) -> None:
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    parent = _parent(store)
    receipt = store.request_parent_email_verification(parent.id)
    assert receipt is not None and receipt.dev_code

    with store._connect() as connection:
        connection.execute(
            "update parent_email_verifications set expires_at = ? where parent_id = ?",
            ((datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat(), parent.id),
        )

    assert store.confirm_parent_email_verification(parent.id, receipt.dev_code) is None
    assert store.parent_account_by_id(parent.id).email_verified is False


def test_parent_verification_resend_is_rate_limited(tmp_path, monkeypatch) -> None:
    settings = _verification_settings(email_verification_resend_cooldown_seconds=60)
    monkeypatch.setattr(storage_module, "get_settings", lambda: settings)
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    parent = _parent(store)

    first = store.request_parent_email_verification(parent.id)
    assert first is not None

    with pytest.raises(ParentEmailVerificationRateLimitError) as error:
        store.request_parent_email_verification(parent.id)

    assert 1 <= error.value.retry_after_seconds <= 61


def test_parent_verification_hourly_limit_is_enforced(tmp_path, monkeypatch) -> None:
    settings = _verification_settings(
        email_verification_resend_cooldown_seconds=15,
        email_verification_max_requests_per_hour=2,
    )
    monkeypatch.setattr(storage_module, "get_settings", lambda: settings)
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    parent = _parent(store)

    assert store.request_parent_email_verification(parent.id) is not None
    with store._connect() as connection:
        connection.execute(
            "update parent_email_verifications set created_at = ? where parent_id = ?",
            ((datetime.now(timezone.utc) - timedelta(minutes=2)).isoformat(), parent.id),
        )
    assert store.request_parent_email_verification(parent.id) is not None
    with store._connect() as connection:
        connection.execute(
            "update parent_email_verifications set created_at = ? where parent_id = ?",
            ((datetime.now(timezone.utc) - timedelta(minutes=2)).isoformat(), parent.id),
        )

    with pytest.raises(ParentEmailVerificationRateLimitError):
        store.request_parent_email_verification(parent.id)


def test_invalid_codes_are_locked_after_max_attempts(tmp_path, monkeypatch) -> None:
    settings = _verification_settings(email_verification_max_attempts=2)
    monkeypatch.setattr(storage_module, "get_settings", lambda: settings)
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    parent = _parent(store)
    receipt = store.request_parent_email_verification(parent.id)
    assert receipt is not None and receipt.dev_code

    assert store.confirm_parent_email_verification(parent.id, "000000") is None
    assert store.confirm_parent_email_verification(parent.id, "111111") is None
    assert store.confirm_parent_email_verification(parent.id, receipt.dev_code) is None


def test_failed_delivery_does_not_create_usable_code(tmp_path, monkeypatch) -> None:
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    parent = _parent(store)

    def fail_delivery(**kwargs):
        raise EmailDeliveryError("Provider unavailable")

    monkeypatch.setattr(storage_module, "send_parent_verification_email", fail_delivery)

    with pytest.raises(EmailDeliveryError):
        store.request_parent_email_verification(parent.id)

    with store._connect() as connection:
        row = connection.execute(
            "select delivery_status, consumed_at from parent_email_verifications where parent_id = ?",
            (parent.id,),
        ).fetchone()

    assert row["delivery_status"] == "failed"
    assert row["consumed_at"] is not None


def test_verified_firebase_email_trusts_matching_parent_only(tmp_path) -> None:
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    trusted_parent = _parent(store, "parent@example.com")
    other_parent = _parent(store, "guardian@example.com")

    trusted_session = store.firebase_sign_in(
        "parent",
        "firebase-parent-1",
        "parent@example.com",
        verified_email="parent@example.com",
    )
    other_session = store.firebase_sign_in(
        "parent",
        "firebase-parent-2",
        "guardian@example.com",
        verified_email="different@example.com",
    )

    assert trusted_session is not None
    assert trusted_session.parent.email_verified is True
    assert other_session is not None
    assert other_session.parent.email_verified is False
    assert store.parent_account_by_id(trusted_parent.id).email_verified is True
    assert store.parent_account_by_id(other_parent.id).email_verified is False


def test_unverified_parent_cannot_sign_in(tmp_path, monkeypatch) -> None:
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    parent = _parent(store)
    monkeypatch.setattr(api_module, "get_study_plan_store", lambda: store)

    response = TestClient(app).post(
        "/api/v1/accounts/sign-in",
        json={"role": "parent", "login_id": parent.contact, "access_code": "4321"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Verify the parent email before signing in."


def test_verification_endpoint_returns_retry_after(tmp_path, monkeypatch) -> None:
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    parent = _parent(store)
    monkeypatch.setattr(api_module, "get_study_plan_store", lambda: store)
    client = TestClient(app)

    assert client.post(f"/api/v1/accounts/parents/{parent.id}/email-verification").status_code == 200
    response = client.post(f"/api/v1/accounts/parents/{parent.id}/email-verification")

    assert response.status_code == 429
    assert int(response.headers["Retry-After"]) >= 1


def test_verification_endpoint_handles_delivery_failure(tmp_path, monkeypatch) -> None:
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    parent = _parent(store)
    monkeypatch.setattr(api_module, "get_study_plan_store", lambda: store)
    monkeypatch.setattr(
        storage_module,
        "send_parent_verification_email",
        lambda **kwargs: (_ for _ in ()).throw(EmailDeliveryError("Provider unavailable")),
    )

    response = TestClient(app).post(f"/api/v1/accounts/parents/{parent.id}/email-verification")

    assert response.status_code == 503
    assert "could not be delivered" in response.json()["detail"]


def test_verified_firebase_parent_sign_in_marks_email_verified(tmp_path, monkeypatch) -> None:
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    parent = _parent(store)
    monkeypatch.setattr(api_module, "get_study_plan_store", lambda: store)
    monkeypatch.setattr(
        api_module,
        "verify_firebase_id_token",
        lambda _: FirebaseIdentity(
            uid="firebase-parent-api",
            login_id=parent.contact,
            email=parent.contact,
            email_verified=True,
        ),
    )

    response = TestClient(app).post(
        "/api/v1/accounts/firebase-sign-in",
        json={"role": "parent", "id_token": "a-valid-looking-firebase-token"},
    )

    assert response.status_code == 200
    assert response.json()["parent"]["email_verified"] is True
    assert response.json()["session_token"]
