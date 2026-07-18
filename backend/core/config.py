"""
Centralised application settings.

All configuration flows through here (via environment variables / .env), so
the same codebase runs on SQLite locally and managed PostgreSQL in the
commercial-cloud (India-region) deployment without code changes.
"""

from functools import lru_cache
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # --- App ---
    app_name: str = "HaqSe — Citizen Welfare Agent API"
    environment: str = "development"  # development | staging | production
    debug: bool = True

    # --- Database ---
    # Dev default: local SQLite. Prod: set DATABASE_URL to the managed Postgres DSN,
    # e.g. postgresql+psycopg://user:pass@host:5432/haqse
    database_url: str = "sqlite:///./haqse.db"

    # --- Redis (session state, rate-limit store) ---
    redis_url: str = "redis://localhost:6379/0"

    # --- Security ---
    # MUST be overridden in every non-dev environment.
    phone_hmac_secret: str = "dev-secret-change-me"
    jwt_secret: str = "dev-jwt-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_ttl_minutes: int = 30

    # --- CORS ---
    cors_origins: List[str] = ["*"]  # lock down per-environment in prod

    # --- Rate limiting ---
    rate_limit_default: str = "60/minute"

    # --- DigiLocker / KYC integration ---
    # Provider selection lets the app run fully testable with a mock, and switch
    # to the real official DigiLocker (Meri Pehchaan) OAuth2/OIDC flow via config.
    digilocker_provider: str = "mock"  # mock | meripehchaan

    # Official DigiLocker "Meri Pehchaan" Requester API (partner-issued creds).
    # Obtain client_id/client_secret by registering on the DigiLocker Partner Portal;
    # redirect_uri MUST exactly match the one registered there.
    digilocker_base_url: str = "https://digilocker.meripehchaan.gov.in/public"
    digilocker_client_id: str = ""
    digilocker_client_secret: str = ""
    digilocker_redirect_uri: str = "http://localhost:8000/api/digilocker/callback"
    digilocker_scope: str = "openid files.issueddocs"
    # Optional: JWKS URL to verify the id_token signature. If empty, the id_token
    # is decoded WITHOUT signature verification (dev only — never in production).
    digilocker_jwks_url: str = ""

    # --- DPDP / data governance ---
    consent_policy_version: str = "1.0"
    data_retention_days: int = 1825  # 5 years default; tune per legal guidance

    @property
    def is_sqlite(self) -> bool:
        return self.database_url.startswith("sqlite")

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
