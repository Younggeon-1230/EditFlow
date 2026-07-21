"""SQLModel model exports used by the application and Alembic.

Import and re-export new table models from this module so Alembic's
autogenerate process registers them with ``SQLModel.metadata``.
"""

from app.models.user import User


__all__ = ["User"]
