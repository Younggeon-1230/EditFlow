from fastapi import APIRouter, HTTPException, Request, Response, status

from app.api.dependencies import (
    CurrentUserDependency,
    OptionalAuthContextDependency,
    SessionDependency,
    SettingsDependency,
)
from app.schemas.auth import AuthUserRead, LoginRequest, SignupRequest
from app.services import auth as auth_service
from app.services.auth_cookies import (
    clear_auth_cookies,
    set_auth_cookies,
    set_csrf_cookie,
)
from app.services.csrf import generate_csrf_token


router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.get("/csrf", status_code=status.HTTP_204_NO_CONTENT)
def csrf_bootstrap(
    response: Response,
    session: SessionDependency,
    context: OptionalAuthContextDependency,
    settings: SettingsDependency,
) -> Response:
    csrf_token = generate_csrf_token()
    if context is not None:
        context.auth_session.csrf_token_digest = auth_service.token_digest(csrf_token)
        session.add(context.auth_session)
        session.commit()
    set_csrf_cookie(response, csrf_token, settings)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.post(
    "/signup",
    response_model=AuthUserRead,
    status_code=status.HTTP_201_CREATED,
)
def signup(
    credentials: SignupRequest,
    request: Request,
    response: Response,
    session: SessionDependency,
    settings: SettingsDependency,
) -> AuthUserRead:
    _check_signup_rate_limit(request, settings)
    try:
        result = auth_service.create_user_and_session(
            session,
            credentials.email,
            credentials.password,
            settings,
        )
    except auth_service.InvalidEmailError as error:
        raise _auth_error(
            422,
            "invalid_email",
            "올바른 이메일 주소를 입력해 주세요.",
        ) from error
    except auth_service.InvalidPasswordError as error:
        raise _auth_error(
            422,
            "invalid_password",
            (
                f"비밀번호는 {settings.auth_password_min_length}자 이상 "
                f"{settings.auth_password_max_length}자 이하여야 합니다."
            ),
        ) from error
    except auth_service.EmailAlreadyRegisteredError as error:
        raise _auth_error(
            409,
            "email_already_registered",
            "이미 등록된 이메일입니다.",
        ) from error

    set_auth_cookies(response, result, settings)
    return AuthUserRead.model_validate(result.user)


@router.post("/login", response_model=AuthUserRead)
def login(
    credentials: LoginRequest,
    request: Request,
    response: Response,
    session: SessionDependency,
    settings: SettingsDependency,
) -> AuthUserRead:
    _check_login_rate_limit(request, credentials.email, settings)
    try:
        result = auth_service.authenticate_and_create_session(
            session,
            credentials.email,
            credentials.password,
            settings,
        )
    except auth_service.InvalidCredentialsError as error:
        raise _auth_error(
            401,
            "invalid_credentials",
            "이메일 또는 비밀번호가 올바르지 않습니다.",
        ) from error

    set_auth_cookies(response, result, settings)
    return AuthUserRead.model_validate(result.user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    session: SessionDependency,
    context: OptionalAuthContextDependency,
    settings: SettingsDependency,
) -> Response:
    if context is not None:
        auth_service.revoke_auth_session(session, context.auth_session)
    clear_auth_cookies(response, settings)
    response.status_code = status.HTTP_204_NO_CONTENT
    return response


@router.get("/me", response_model=AuthUserRead)
def me(user: CurrentUserDependency) -> AuthUserRead:
    return AuthUserRead.model_validate(user)


def _check_signup_rate_limit(request: Request, settings: SettingsDependency) -> None:
    client_host = request.client.host if request.client is not None else "unknown"
    _run_rate_limit(
        f"signup:{client_host}",
        settings.auth_signup_rate_limit_requests,
        settings.auth_signup_rate_limit_window_seconds,
    )


def _check_login_rate_limit(
    request: Request,
    email: str,
    settings: SettingsDependency,
) -> None:
    client_host = request.client.host if request.client is not None else "unknown"
    _run_rate_limit(
        auth_service.login_rate_limit_key(client_host, email),
        settings.auth_login_rate_limit_requests,
        settings.auth_login_rate_limit_window_seconds,
    )


def _run_rate_limit(key: str, limit: int, window_seconds: int) -> None:
    try:
        auth_service.auth_rate_limiter.check(
            key,
            limit=limit,
            window_seconds=window_seconds,
        )
    except auth_service.RateLimitExceededError as error:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "rate_limited",
                "message": "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
            },
            headers={"Retry-After": str(error.retry_after)},
        ) from error


def _auth_error(status_code: int, code: str, message: str) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message},
    )
