from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    allowed_origins: str = "http://localhost:8081,http://localhost:19006"
    allowed_origin_regex: str = r"https://.*\.app\.github\.dev"
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    local_data_path: str = "apps/api/.data/studynova.sqlite3"
    backup_data_path: str = "apps/api/.data/backups"
    study_proof_storage_backend: str = "local"
    study_proof_local_path: str = "apps/api/.data/study-proofs"
    study_proof_max_upload_mb: int = 6
    firebase_storage_bucket: str = ""
    session_secret: str = "studynova-local-session-secret"
    session_ttl_hours: int = 168
    admin_access_code: str = "studynova-admin-dev"
    public_api_base_url: str = ""
    email_provider: str = "development"
    resend_api_key: str = ""
    email_from: str = "StudyNova <accounts@studynova.app>"
    support_email: str = "support@studynova.app"
    email_verification_ttl_minutes: int = 20
    email_verification_resend_cooldown_seconds: int = 60
    email_verification_max_requests_per_hour: int = 5
    email_verification_max_attempts: int = 5
    account_recovery_ttl_minutes: int = 20
    account_recovery_resend_cooldown_seconds: int = 60
    account_recovery_max_requests_per_hour: int = 5
    account_recovery_max_attempts: int = 5

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env.strip().lower() in {"prod", "production"}

    @property
    def uses_default_admin_access_code(self) -> bool:
        return self.admin_access_code.strip() == "studynova-admin-dev"

    @property
    def uses_default_session_secret(self) -> bool:
        return self.session_secret.strip() == "studynova-local-session-secret"


@lru_cache
def get_settings() -> Settings:
    return Settings()
