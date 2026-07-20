from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from app import storage as storage_module
from app.schemas import (
    AccountAccessRecoveryConfirm,
    AccountAccessRecoveryCreate,
    AccountSignInRequest,
    ParentAccountCreate,
    ParentStudentLinkCreate,
    StudentAccountCreate,
)
from app.storage import AccountRecoveryRateLimitError, StudyPlanStore


def _settings(**overrides):
    values = {
        "is_production": False,
        "email_provider": "development",
        "account_recovery_ttl_minutes": 20,
        "account_recovery_resend_cooldown_seconds": 60,
        "account_recovery_max_requests_per_hour": 5,
        "account_recovery_max_attempts": 5,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def _family(store: StudyPlanStore):
    student = store.create_student_account(
        StudentAccountCreate(
            login_id="alliyah@example.com",
            access_code="1234",
            name="Alliyah Olaniyan",
            class_level="SS2",
            age=15,
        )
    )
    parent = store.create_parent_account(
        ParentAccountCreate(
            name="Mrs Olaniyan",
            contact="parent@example.com",
            access_code="4321",
            relationship="Mother",
        )
    )
    with store._connect() as connection:
        connection.execute(
            "update parent_accounts set email_verified = 1, email_verified_at = ? where id = ?",
            (datetime.now(timezone.utc).isoformat(), parent.id),
        )
    store.link_parent_student(ParentStudentLinkCreate(parent_id=parent.id, student_id=student.id))
    return student, parent


def test_parent_can_reset_access_code_by_email(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(storage_module, "get_settings", lambda: _settings())
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    _, parent = _family(store)
    receipt = store.request_access_code_recovery(
        AccountAccessRecoveryCreate(role="parent", login_id=parent.contact, email=parent.contact)
    )

    assert receipt.dev_code
    result = store.confirm_access_code_recovery(
        AccountAccessRecoveryConfirm(
            recovery_id=receipt.recovery_id,
            code=receipt.dev_code,
            new_access_code="9876",
        )
    )
    assert result is not None and result.reset
    assert store.sign_in(AccountSignInRequest(role="parent", login_id=parent.contact, access_code="4321")) is None
    assert store.sign_in(AccountSignInRequest(role="parent", login_id=parent.contact, access_code="9876"))


def test_student_recovery_uses_linked_verified_parent_email(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(storage_module, "get_settings", lambda: _settings())
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    student, parent = _family(store)
    receipt = store.request_access_code_recovery(
        AccountAccessRecoveryCreate(role="student", login_id=student.login_id, email=parent.contact)
    )
    assert receipt.dev_code
    assert store.confirm_access_code_recovery(
        AccountAccessRecoveryConfirm(
            recovery_id=receipt.recovery_id,
            code=receipt.dev_code,
            new_access_code="2468",
        )
    )
    assert store.sign_in(AccountSignInRequest(role="student", login_id=student.login_id, access_code="2468"))


def test_invalid_or_expired_recovery_code_is_rejected(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(storage_module, "get_settings", lambda: _settings())
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    _, parent = _family(store)
    receipt = store.request_access_code_recovery(
        AccountAccessRecoveryCreate(role="parent", login_id=parent.contact, email=parent.contact)
    )
    assert store.confirm_access_code_recovery(
        AccountAccessRecoveryConfirm(recovery_id=receipt.recovery_id, code="000000", new_access_code="9876")
    ) is None
    with store._connect() as connection:
        connection.execute(
            "update account_access_recoveries set expires_at = ? where id = ?",
            ((datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat(), receipt.recovery_id),
        )
    assert store.confirm_access_code_recovery(
        AccountAccessRecoveryConfirm(
            recovery_id=receipt.recovery_id,
            code=receipt.dev_code,
            new_access_code="9876",
        )
    ) is None


def test_recovery_resend_is_rate_limited(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr(storage_module, "get_settings", lambda: _settings())
    store = StudyPlanStore(str(tmp_path / "studynova.sqlite3"))
    _, parent = _family(store)
    payload = AccountAccessRecoveryCreate(role="parent", login_id=parent.contact, email=parent.contact)
    store.request_access_code_recovery(payload)
    with pytest.raises(AccountRecoveryRateLimitError):
        store.request_access_code_recovery(payload)
