from datetime import datetime

from pydantic import ConfigDict
from sqlmodel import Field, SQLModel


class AuthCredentials(SQLModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(min_length=1, max_length=1000)
    password: str = Field(min_length=1, max_length=1024)


class SignupRequest(AuthCredentials):
    pass


class LoginRequest(AuthCredentials):
    pass


class AuthUserRead(SQLModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    created_at: datetime
