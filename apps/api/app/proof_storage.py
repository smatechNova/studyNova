import json
import os
import re
from dataclasses import dataclass
from pathlib import Path
from uuid import uuid4

from app.config import get_settings


class StudyProofStorageError(Exception):
    pass


@dataclass(frozen=True)
class StoredStudyProof:
    backend: str
    path: str
    content_type: str


@dataclass(frozen=True)
class LoadedStudyProof:
    data: bytes
    content_type: str


SUPPORTED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def save_study_proof_image(completion_id: str, image_data: bytes, content_type: str) -> StoredStudyProof:
    normalized_type = _normalize_content_type(content_type)
    backend = get_settings().study_proof_storage_backend.strip().lower() or "local"

    if backend == "firebase":
        return _save_firebase_proof(completion_id, image_data, normalized_type)

    return _save_local_proof(completion_id, image_data, normalized_type)


def load_study_proof_image(backend: str, storage_path: str, content_type: str | None = None) -> LoadedStudyProof:
    normalized_backend = (backend or "local").strip().lower()

    if normalized_backend == "firebase":
        return _load_firebase_proof(storage_path, content_type)

    return _load_local_proof(storage_path, content_type)


def delete_study_proof_image(backend: str | None, storage_path: str | None) -> None:
    if not backend or not storage_path:
        return

    try:
        if backend.strip().lower() == "firebase":
            _firebase_bucket().blob(storage_path).delete()
            return

        path = _local_storage_root() / storage_path
        if path.exists() and path.is_file():
            path.unlink()
    except Exception:
        return


def _save_local_proof(completion_id: str, image_data: bytes, content_type: str) -> StoredStudyProof:
    extension = SUPPORTED_IMAGE_TYPES[content_type]
    safe_completion_id = _safe_path_segment(completion_id)
    relative_path = f"{safe_completion_id}-{uuid4().hex}{extension}"
    path = _local_storage_root() / relative_path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(image_data)
    return StoredStudyProof(backend="local", path=relative_path, content_type=content_type)


def _load_local_proof(storage_path: str, content_type: str | None = None) -> LoadedStudyProof:
    safe_path = Path(storage_path)
    if safe_path.is_absolute() or ".." in safe_path.parts:
        raise StudyProofStorageError("Invalid study proof path.")

    path = _local_storage_root() / safe_path
    if not path.exists() or not path.is_file():
        raise StudyProofStorageError("Study proof image was not found.")

    return LoadedStudyProof(data=path.read_bytes(), content_type=content_type or _content_type_from_suffix(path.suffix))


def _save_firebase_proof(completion_id: str, image_data: bytes, content_type: str) -> StoredStudyProof:
    extension = SUPPORTED_IMAGE_TYPES[content_type]
    safe_completion_id = _safe_path_segment(completion_id)
    object_path = f"study-proofs/{safe_completion_id}-{uuid4().hex}{extension}"
    _firebase_bucket().blob(object_path).upload_from_string(image_data, content_type=content_type)
    return StoredStudyProof(backend="firebase", path=object_path, content_type=content_type)


def _load_firebase_proof(storage_path: str, content_type: str | None = None) -> LoadedStudyProof:
    blob = _firebase_bucket().blob(storage_path)
    if not blob.exists():
        raise StudyProofStorageError("Study proof image was not found.")
    data = blob.download_as_bytes()
    return LoadedStudyProof(data=data, content_type=content_type or blob.content_type or "image/jpeg")


def _firebase_bucket():
    settings = get_settings()
    if not settings.firebase_storage_bucket.strip():
        raise StudyProofStorageError("FIREBASE_STORAGE_BUCKET is not configured.")

    try:
        import firebase_admin
        from firebase_admin import credentials, storage
    except ImportError as exc:
        raise StudyProofStorageError("firebase-admin is not installed.") from exc

    if not firebase_admin._apps:
        service_account_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON", "").strip()
        if service_account_json:
            firebase_admin.initialize_app(credentials.Certificate(json.loads(service_account_json)))
        else:
            firebase_admin.initialize_app()

    return storage.bucket(settings.firebase_storage_bucket.strip())


def _local_storage_root() -> Path:
    return Path(get_settings().study_proof_local_path)


def _normalize_content_type(content_type: str) -> str:
    normalized = (content_type or "image/jpeg").split(";")[0].strip().lower()
    if normalized == "image/jpg":
        normalized = "image/jpeg"
    if normalized not in SUPPORTED_IMAGE_TYPES:
        raise StudyProofStorageError("Only JPG, PNG, and WebP study proof images are supported.")
    return normalized


def _content_type_from_suffix(suffix: str) -> str:
    suffix = suffix.lower()
    if suffix == ".png":
        return "image/png"
    if suffix == ".webp":
        return "image/webp"
    return "image/jpeg"


def _safe_path_segment(value: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_.-]", "-", value).strip(".-") or "study-proof"
