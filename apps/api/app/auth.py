import json
import os
from dataclasses import dataclass
from typing import Any


class FirebaseAuthError(Exception):
    pass


class FirebaseAuthUnavailable(FirebaseAuthError):
    pass


class InvalidFirebaseToken(FirebaseAuthError):
    pass


@dataclass(frozen=True)
class FirebaseIdentity:
    uid: str
    login_id: str
    email: str | None = None
    phone_number: str | None = None
    email_verified: bool = False


def firebase_auth_readiness() -> dict[str, object]:
    try:
        import firebase_admin  # noqa: F401

        admin_sdk_installed = True
    except ImportError:
        admin_sdk_installed = False

    service_account_configured = bool(os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip())
    google_credentials_configured = bool(os.getenv("GOOGLE_APPLICATION_CREDENTIALS", "").strip())
    project_id_configured = bool(os.getenv("GOOGLE_CLOUD_PROJECT", "").strip())
    server_verification_ready = admin_sdk_installed and (
        service_account_configured or google_credentials_configured or project_id_configured
    )
    warnings: list[str] = []

    if not admin_sdk_installed:
        warnings.append("firebase-admin is not installed on the API server.")
    if admin_sdk_installed and not server_verification_ready:
        warnings.append("Configure FIREBASE_SERVICE_ACCOUNT_JSON or Google application credentials before production.")

    return {
        "provider": "firebase",
        "admin_sdk_installed": admin_sdk_installed,
        "service_account_configured": service_account_configured,
        "google_application_credentials_configured": google_credentials_configured,
        "project_id_configured": project_id_configured,
        "server_verification_ready": server_verification_ready,
        "warnings": warnings,
    }


def verify_firebase_id_token(id_token: str) -> FirebaseIdentity:
    try:
        import firebase_admin
        from firebase_admin import auth, credentials
    except ImportError as exc:
        raise FirebaseAuthUnavailable("firebase-admin is not installed.") from exc

    if not firebase_admin._apps:
        service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
        if service_account_json:
            firebase_admin.initialize_app(credentials.Certificate(json.loads(service_account_json)))
        else:
            firebase_admin.initialize_app()

    try:
        decoded: dict[str, Any] = auth.verify_id_token(id_token)
    except Exception as exc:
        raise InvalidFirebaseToken("Firebase ID token could not be verified.") from exc

    uid = str(decoded.get("uid") or decoded.get("sub") or "")
    email = decoded.get("email")
    phone_number = decoded.get("phone_number")
    email_verified = bool(decoded.get("email_verified"))
    login_id = str(email or phone_number or "")

    if not uid or not login_id:
        raise InvalidFirebaseToken("Firebase token is missing an account identity.")

    return FirebaseIdentity(
        uid=uid,
        login_id=login_id,
        email=email,
        phone_number=phone_number,
        email_verified=email_verified,
    )
