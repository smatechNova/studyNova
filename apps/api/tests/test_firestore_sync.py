from types import SimpleNamespace

import pytest

from app import firestore_sync
from app.firestore_sync import FirestoreSyncError


class FakeDocument:
    def __init__(self, *, fail: bool = False) -> None:
        self.fail = fail
        self.saved: list[tuple[dict[str, object], bool]] = []
        self.deleted = False

    def set(self, payload: dict[str, object], *, merge: bool) -> None:
        if self.fail:
            raise RuntimeError("Firestore unavailable")
        self.saved.append((payload, merge))

    def delete(self) -> None:
        if self.fail:
            raise RuntimeError("Firestore unavailable")
        self.deleted = True


class FakeCollection:
    def __init__(self, document: FakeDocument) -> None:
        self.fake_document = document

    def document(self, _document_id: str) -> FakeDocument:
        return self.fake_document


class FakeFirestoreClient:
    def __init__(self, document: FakeDocument) -> None:
        self.fake_document = document

    def collection(self, _collection: str) -> FakeCollection:
        return FakeCollection(self.fake_document)


def make_settings(**overrides: object) -> SimpleNamespace:
    defaults = {
        "firestore_enabled": True,
        "firestore_required": True,
        "firebase_project_id": "studynova-test",
        "firebase_service_account_json": '{"project_id":"studynova-test"}',
        "google_application_credentials": "",
    }
    defaults.update(overrides)
    return SimpleNamespace(**defaults)


def test_firestore_readiness_reports_complete_configuration(monkeypatch) -> None:
    monkeypatch.setattr(firestore_sync, "get_settings", lambda: make_settings())

    readiness = firestore_sync.firestore_readiness()

    assert readiness["configured"] is True
    assert readiness["warnings"] == []


def test_firestore_sync_is_a_noop_when_disabled(monkeypatch) -> None:
    monkeypatch.setattr(
        firestore_sync,
        "get_settings",
        lambda: make_settings(firestore_enabled=False),
    )
    monkeypatch.setattr(
        firestore_sync,
        "get_firestore_client",
        lambda: pytest.fail("Firestore should not be initialized."),
    )

    firestore_sync.sync_document("students", "student-1", {"name": "Aliyyah"})


def test_firestore_sync_writes_and_merges_document(monkeypatch) -> None:
    document = FakeDocument()
    monkeypatch.setattr(firestore_sync, "get_settings", lambda: make_settings())
    monkeypatch.setattr(
        firestore_sync,
        "get_firestore_client",
        lambda: FakeFirestoreClient(document),
    )

    firestore_sync.sync_document("students", "student-1", {"name": "Aliyyah"})

    assert document.saved == [({"name": "Aliyyah"}, True)]


def test_required_firestore_write_failure_blocks_request(monkeypatch) -> None:
    document = FakeDocument(fail=True)
    monkeypatch.setattr(firestore_sync, "get_settings", lambda: make_settings())
    monkeypatch.setattr(
        firestore_sync,
        "get_firestore_client",
        lambda: FakeFirestoreClient(document),
    )

    with pytest.raises(FirestoreSyncError, match="could not be saved"):
        firestore_sync.sync_document("students", "student-1", {"name": "Aliyyah"})


def test_optional_firestore_write_failure_keeps_local_fallback(monkeypatch) -> None:
    document = FakeDocument(fail=True)
    monkeypatch.setattr(
        firestore_sync,
        "get_settings",
        lambda: make_settings(firestore_required=False),
    )
    monkeypatch.setattr(
        firestore_sync,
        "get_firestore_client",
        lambda: FakeFirestoreClient(document),
    )

    firestore_sync.sync_document("students", "student-1", {"name": "Aliyyah"})
