from __future__ import annotations

from typing import Any

from pydantic import BaseModel

from app.config import get_settings
from app.firebase_admin_app import get_firestore_client


class FirestoreSyncError(RuntimeError):
    pass


def firestore_readiness() -> dict[str, object]:
    settings = get_settings()
    enabled = settings.firestore_enabled
    project_configured = bool(settings.firebase_project_id.strip())
    credentials_configured = bool(
        settings.firebase_service_account_json.strip()
        or settings.google_application_credentials.strip()
    )
    configured = enabled and project_configured and credentials_configured
    warnings: list[str] = []

    if not enabled:
        warnings.append("Set FIRESTORE_ENABLED=true to synchronize StudyNova records to Firestore.")
    if enabled and not project_configured:
        warnings.append("FIREBASE_PROJECT_ID is missing.")
    if enabled and not credentials_configured:
        warnings.append("Configure Firebase service-account or Google application credentials.")

    return {
        "enabled": enabled,
        "required": settings.firestore_required,
        "project_configured": project_configured,
        "credentials_configured": credentials_configured,
        "configured": configured,
        "warnings": warnings,
    }


def sync_document(collection: str, document_id: str, payload: BaseModel | dict[str, Any]) -> None:
    settings = get_settings()
    if not settings.firestore_enabled:
        return

    data = payload.model_dump(mode="json") if isinstance(payload, BaseModel) else payload
    try:
        get_firestore_client().collection(collection).document(document_id).set(data, merge=True)
    except Exception as exc:
        if settings.firestore_required:
            raise FirestoreSyncError("The record could not be saved to Firestore.") from exc


def delete_document(collection: str, document_id: str) -> None:
    settings = get_settings()
    if not settings.firestore_enabled:
        return

    try:
        get_firestore_client().collection(collection).document(document_id).delete()
    except Exception as exc:
        if settings.firestore_required:
            raise FirestoreSyncError("The Firestore record could not be deleted.") from exc


def verify_firestore_connection() -> bool:
    settings = get_settings()
    if not settings.firestore_enabled:
        return False

    try:
        get_firestore_client().collection("_system").document("readiness").set(
            {"service": "studynova-api", "status": "ready"},
            merge=True,
        )
        return True
    except Exception:
        return False
