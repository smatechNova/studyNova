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
    login_id = str(email or phone_number or "")

    if not uid or not login_id:
        raise InvalidFirebaseToken("Firebase token is missing an account identity.")

    return FirebaseIdentity(uid=uid, login_id=login_id, email=email, phone_number=phone_number)
