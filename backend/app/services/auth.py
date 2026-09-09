import hashlib
import secrets
import threading
import time
from collections import OrderedDict, deque
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from email_validator import EmailNotValidError, validate_email
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core.config import Settings
from app.models.auth_session import AuthSession
from app.models.user import User, utc_now
from app.services.passwords import hash_password, verify_dummy_password, verify_password


class InvalidEmailError(ValueError):
    pass


class InvalidPasswordError(ValueError):
    pass


class EmailAlreadyRegisteredError(Exception):
    pass


class InvalidCredentialsError(Exception):
    pass


@dataclass(frozen=True)
class AuthTokens:
    session_token: str
    csrf_token: str


@dataclass(frozen=True)
class AuthResult:
    user: User
    auth_session: AuthSession
    tokens: AuthTokens


@dataclass(frozen=True)
class AuthContext:
    user: User
    auth_session: AuthSession


@dataclass(frozen=True)
class RateLimitExceededError(Exception):
    retry_after: int


class AuthRateLimiter:
    def __init__(self, max_entries: int = 4096) -> None:
        self._lock = threading.Lock()
        self._requests: OrderedDict[str, deque[float]] = OrderedDict()
        self._max_entries = max_entries

    def clear(self) -> None:
        with self._lock:
            self._requests.clear()

    def check(self, key: str, *, limit: int, window_seconds: int) -> None:
        now = time.monotonic()
        cutoff = now - window_seconds
        with self._lock:
            requests = self._requests.get(key)
            if requests is None:
                requests = deque()
                self._requests[key] = requests
                while len(self._requests) > self._max_entries:
                    self._requests.popitem(last=False)
            else:
                self._requests.move_to_end(key)
            while requests and requests[0] <= cutoff:
                requests.popleft()
            if len(requests) >= limit:
                retry_after = max(1, int(requests[0] + window_seconds - now) + 1)
                raise RateLimitExceededError(retry_after)
            requests.append(now)


auth_rate_limiter = AuthRateLimiter()


def normalize_email(value: str) -> str:
    candidate = value.strip()
    try:
        normalized = validate_email(
            candidate,
            check_deliverability=False,
        ).normalized
    except EmailNotValidError as error:
        raise InvalidEmailError from error
    canonical = normalized.casefold()
    if len(canonical) > 255:
        raise InvalidEmailError
    return canonical


def validate_signup_password(password: str, settings: Settings) -> None:
    if (
        len(password) < settings.auth_password_min_length
        or len(password) > settings.auth_password_max_length
        or password.isspace()
    ):
        raise InvalidPasswordError


def token_digest(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def login_rate_limit_key(client_host: str, email: str) -> str:
    email_fingerprint = hashlib.sha256(
        email.strip().casefold().encode("utf-8")
    ).hexdigest()
    return f"login:{client_host}:{email_fingerprint}"


def create_user_and_session(
    session: Session,
    email: str,
    password: str,
    settings: Settings,
) -> AuthResult:
    canonical_email = normalize_email(email)
    validate_signup_password(password, settings)
    if session.exec(
        select(User).where(User.email == canonical_email)
    ).one_or_none() is not None:
        raise EmailAlreadyRegisteredError

    user = User(
        email=canonical_email,
        password_hash=hash_password(password),
        is_active=True,
    )
    session.add(user)
    try:
        session.flush()
        assert user.id is not None
        auth_session, tokens = _build_auth_session(user.id, settings)
        session.add(auth_session)
        session.commit()
    except IntegrityError as error:
        session.rollback()
        raise EmailAlreadyRegisteredError from error
    session.refresh(user)
    session.refresh(auth_session)
    return AuthResult(user=user, auth_session=auth_session, tokens=tokens)


def authenticate_and_create_session(
    session: Session,
    email: str,
    password: str,
    settings: Settings,
) -> AuthResult:
    try:
        canonical_email = normalize_email(email)
    except InvalidEmailError as error:
        verify_dummy_password(password)
        raise InvalidCredentialsError from error

    user = session.exec(
        select(User).where(User.email == canonical_email)
    ).one_or_none()
    password_hash = user.password_hash if user is not None else None
    verified = (
        verify_password(password_hash, password)
        if password_hash is not None
        else _verify_dummy_and_return_false(password)
    )
    if user is None or not user.is_active or not verified:
        raise InvalidCredentialsError

    assert user.id is not None
    auth_session, tokens = _build_auth_session(user.id, settings)
    session.add(auth_session)
    session.commit()
    session.refresh(auth_session)
    return AuthResult(user=user, auth_session=auth_session, tokens=tokens)


def lookup_auth_context(
    session: Session,
    raw_session_token: str | None,
    *,
    now: datetime | None = None,
) -> AuthContext | None:
    if not raw_session_token:
        return None
    digest = token_digest(raw_session_token)
    auth_session = session.exec(
        select(AuthSession).where(AuthSession.token_digest == digest)
    ).one_or_none()
    if auth_session is None or auth_session.revoked_at is not None:
        return None

    current_time = now or utc_now()
    if _as_utc(auth_session.expires_at) <= _as_utc(current_time):
        return None

    user = session.get(User, auth_session.user_id)
    if user is None or not user.is_active or user.password_hash is None:
        return None
    return AuthContext(user=user, auth_session=auth_session)


def revoke_auth_session(session: Session, auth_session: AuthSession) -> None:
    if auth_session.revoked_at is None:
        auth_session.revoked_at = utc_now()
        session.add(auth_session)
        session.commit()
        session.refresh(auth_session)


def _build_auth_session(
    user_id: int,
    settings: Settings,
) -> tuple[AuthSession, AuthTokens]:
    created_at = utc_now()
    session_token = secrets.token_urlsafe(32)
    csrf_token = secrets.token_urlsafe(32)
    return (
        AuthSession(
            user_id=user_id,
            token_digest=token_digest(session_token),
            csrf_token_digest=token_digest(csrf_token),
            created_at=created_at,
            expires_at=created_at
            + timedelta(seconds=settings.auth_session_ttl_seconds),
        ),
        AuthTokens(session_token=session_token, csrf_token=csrf_token),
    )


def _verify_dummy_and_return_false(password: str) -> bool:
    verify_dummy_password(password)
    return False


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
