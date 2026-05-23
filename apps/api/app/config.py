from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_env: str = "development"
    allowed_origins: str = "http://localhost:8081,http://localhost:19006"
    allowed_origin_regex: str = r"https://.*\.app\.github\.dev"
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    local_data_path: str = "apps/api/.data/studynova.sqlite3"
    session_secret: str = "studynova-local-session-secret"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.allowed_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
