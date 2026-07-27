import json
from functools import lru_cache

from app.config import get_settings


class FirebaseAdminUnavailable(RuntimeError):
    pass


@lru_cache
def get_firebase_admin_app():
    try:
        import firebase_admin
        from firebase_admin import credentials
    except ImportError as exc:
        raise FirebaseAdminUnavailable("firebase-admin is not installed.") from exc

    if firebase_admin._apps:
        return firebase_admin.get_app()

    settings = get_settings()
    options: dict[str, str] = {}
    if settings.firebase_project_id.strip():
        options["projectId"] = settings.firebase_project_id.strip()
    if settings.firebase_storage_bucket.strip():
        options["storageBucket"] = settings.firebase_storage_bucket.strip()

    service_account_json = settings.firebase_service_account_json.strip()
    if service_account_json:
        try:
            certificate = credentials.Certificate(json.loads(service_account_json))
        except (json.JSONDecodeError, ValueError, TypeError) as exc:
            raise FirebaseAdminUnavailable("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.") from exc
        return firebase_admin.initialize_app(certificate, options or None)

    try:
        return firebase_admin.initialize_app(options=options or None)
    except Exception as exc:
        raise FirebaseAdminUnavailable(
            "Firebase application credentials are not configured for the API."
        ) from exc


def get_firestore_client():
    try:
        from firebase_admin import firestore
    except ImportError as exc:
        raise FirebaseAdminUnavailable("firebase-admin Firestore support is not installed.") from exc

    return firestore.client(app=get_firebase_admin_app())
