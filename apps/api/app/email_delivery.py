from __future__ import annotations

import html
import re
from dataclasses import dataclass
from datetime import datetime

import httpx

from app.config import Settings, get_settings


RESEND_EMAILS_URL = "https://api.resend.com/emails"
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class EmailDeliveryError(Exception):
    pass


@dataclass(frozen=True)
class EmailDeliveryResult:
    provider: str
    message_id: str | None = None


def email_delivery_readiness(settings: Settings | object | None = None) -> dict[str, object]:
    active_settings = settings or get_settings()
    provider = str(getattr(active_settings, "email_provider", "")).strip().lower()
    api_key = str(getattr(active_settings, "resend_api_key", "")).strip()
    email_from = str(getattr(active_settings, "email_from", "")).strip()
    support_email = str(getattr(active_settings, "support_email", "")).strip()

    warnings: list[str] = []
    if provider != "resend":
        warnings.append("Set EMAIL_PROVIDER=resend for production verification emails.")
    if not api_key:
        warnings.append("Set RESEND_API_KEY on the API host.")
    if not _contains_valid_email(email_from):
        warnings.append("Set EMAIL_FROM to a sender on the verified Resend domain.")
    if not EMAIL_PATTERN.fullmatch(support_email):
        warnings.append("Set SUPPORT_EMAIL to the public StudyNova support address.")

    return {
        "provider": provider or "development",
        "configured": not warnings,
        "email_from": email_from,
        "support_email": support_email,
        "warnings": warnings,
    }


def send_parent_verification_email(
    *,
    recipient: str,
    verification_code: str,
    expires_at: datetime,
    idempotency_key: str,
) -> EmailDeliveryResult:
    settings = get_settings()
    provider = settings.email_provider.strip().lower()

    if not settings.is_production and provider != "resend":
        return EmailDeliveryResult(provider="development")

    readiness = email_delivery_readiness(settings)
    if not readiness["configured"]:
        raise EmailDeliveryError("Parent verification email delivery is not configured.")

    if not EMAIL_PATTERN.fullmatch(recipient.strip().lower()):
        raise EmailDeliveryError("The parent account does not contain a valid email address.")

    expiry_text = expires_at.strftime("%H:%M UTC")
    safe_code = html.escape(verification_code)
    safe_support_email = html.escape(settings.support_email.strip())
    payload = {
        "from": settings.email_from.strip(),
        "to": [recipient.strip().lower()],
        "subject": "Your StudyNova verification code",
        "text": (
            f"Your StudyNova parent verification code is {verification_code}. "
            f"It expires at {expiry_text}. Do not share this code. "
            f"For help, contact {settings.support_email.strip()}."
        ),
        "html": (
            "<div style=\"font-family:Arial,sans-serif;color:#102A43;line-height:1.5\">"
            "<h2 style=\"margin-bottom:8px\">Verify your StudyNova parent account</h2>"
            "<p>Enter this code in StudyNova:</p>"
            f"<p style=\"font-size:32px;font-weight:700;letter-spacing:8px;color:#2563EB\">{safe_code}</p>"
            f"<p>This code expires at {expiry_text}. Do not share it with anyone.</p>"
            f"<p style=\"color:#52667A\">Need help? Contact {safe_support_email}.</p>"
            "</div>"
        ),
    }

    try:
        response = httpx.post(
            RESEND_EMAILS_URL,
            headers={
                "Authorization": f"Bearer {settings.resend_api_key.strip()}",
                "Content-Type": "application/json",
                "Idempotency-Key": idempotency_key,
            },
            json=payload,
            timeout=10.0,
        )
    except httpx.HTTPError as exc:
        raise EmailDeliveryError("The verification email service could not be reached.") from exc

    if response.status_code < 200 or response.status_code >= 300:
        raise EmailDeliveryError("The verification email service rejected the message.")

    try:
        message_id = str(response.json().get("id") or "") or None
    except ValueError:
        message_id = None

    return EmailDeliveryResult(provider="resend", message_id=message_id)


def send_account_recovery_email(
    *,
    recipient: str,
    recovery_code: str,
    expires_at: datetime,
    account_role: str,
    idempotency_key: str,
) -> EmailDeliveryResult:
    settings = get_settings()
    provider = settings.email_provider.strip().lower()
    if not settings.is_production and provider != "resend":
        return EmailDeliveryResult(provider="development")

    readiness = email_delivery_readiness(settings)
    if not readiness["configured"]:
        raise EmailDeliveryError("Account recovery email delivery is not configured.")
    if not EMAIL_PATTERN.fullmatch(recipient.strip().lower()):
        raise EmailDeliveryError("The recovery address is not a valid email.")

    expiry_text = expires_at.strftime("%H:%M UTC")
    safe_code = html.escape(recovery_code)
    safe_role = html.escape(account_role)
    safe_support_email = html.escape(settings.support_email.strip())
    payload = {
        "from": settings.email_from.strip(),
        "to": [recipient.strip().lower()],
        "subject": "Reset your StudyNova access code",
        "text": (
            f"Your StudyNova {account_role} recovery code is {recovery_code}. "
            f"It expires at {expiry_text}. Do not share this code. "
            f"If you did not request this reset, ignore this email."
        ),
        "html": (
            "<div style=\"font-family:Arial,sans-serif;color:#102A43;line-height:1.5\">"
            "<h2 style=\"margin-bottom:8px\">Reset your StudyNova access code</h2>"
            f"<p>Use this code to reset the {safe_role} account:</p>"
            f"<p style=\"font-size:32px;font-weight:700;letter-spacing:8px;color:#2563EB\">{safe_code}</p>"
            f"<p>This code expires at {expiry_text}. Do not share it with anyone.</p>"
            f"<p style=\"color:#52667A\">Did not request this? Ignore this email or contact {safe_support_email}.</p>"
            "</div>"
        ),
    }
    try:
        response = httpx.post(
            RESEND_EMAILS_URL,
            headers={
                "Authorization": f"Bearer {settings.resend_api_key.strip()}",
                "Content-Type": "application/json",
                "Idempotency-Key": idempotency_key,
            },
            json=payload,
            timeout=10.0,
        )
    except httpx.HTTPError as exc:
        raise EmailDeliveryError("The recovery email service could not be reached.") from exc
    if response.status_code < 200 or response.status_code >= 300:
        raise EmailDeliveryError("The recovery email service rejected the message.")
    try:
        message_id = str(response.json().get("id") or "") or None
    except ValueError:
        message_id = None
    return EmailDeliveryResult(provider="resend", message_id=message_id)


def _contains_valid_email(value: str) -> bool:
    if "<" in value and value.endswith(">"):
        value = value.rsplit("<", 1)[1][:-1].strip()
    return bool(EMAIL_PATTERN.fullmatch(value))
