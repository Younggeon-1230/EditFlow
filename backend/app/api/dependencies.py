from typing import Annotated

from fastapi import Depends
from sqlmodel import Session

from app.core.database import get_session
from app.models.user import User
from app.services.users import ensure_development_user


SessionDependency = Annotated[Session, Depends(get_session)]


def get_development_user(session: SessionDependency) -> User:
    return ensure_development_user(session)


DevelopmentUserDependency = Annotated[User, Depends(get_development_user)]
