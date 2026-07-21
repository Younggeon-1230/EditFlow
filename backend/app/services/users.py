from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.models.user import User


DEVELOPMENT_USER_EMAIL = "dev@editflow.local"


def ensure_development_user(session: Session) -> User:
    user = session.exec(
        select(User).where(User.email == DEVELOPMENT_USER_EMAIL)
    ).one_or_none()
    if user is not None:
        return user

    user = User(email=DEVELOPMENT_USER_EMAIL)
    session.add(user)
    try:
        session.commit()
    except IntegrityError:
        # A concurrent request may have inserted the same unique email first.
        session.rollback()
        return session.exec(
            select(User).where(User.email == DEVELOPMENT_USER_EMAIL)
        ).one()

    session.refresh(user)
    return user
