from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from threading import Barrier, local
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.engine import Engine
from sqlmodel import Session, select

from app.core.datetime import utc_now
from app.core.config import Settings
from app.models.auth_session import AuthSession
from app.models.checklist_item import ChecklistItem
from app.models.content_idea import ContentIdea, ContentIdeaStatus, ContentPlatform
from app.models.project import Project
from app.models.project_memo import ProjectMemo
from app.models.user import User
from app.schemas.project import LocalProjectImport
from app.schemas.content_idea import ContentIdeaConversionCreate
from app.schemas.content_idea_recommendation import RecommendationTokenPayload
from app.services import content_ideas as content_idea_service
from app.services import projects as project_service
from app.services.auth import lookup_auth_context, token_digest
from app.services.content_idea_recommendations import (
    RecommendationServiceError,
    recommendation_runtime_state,
    save_recommendation,
    sign_save_token,
)


pytestmark = pytest.mark.postgresql


def _user(email: str) -> User:
    return User(email=email, password_hash="test-hash", is_active=True)


def _import_data(source_local_id: str) -> LocalProjectImport:
    return LocalProjectImport.model_validate(
        {
            "source_local_id": source_local_id,
            "title": "Imported project",
            "status": "planning",
            "checklist_items": [
                {"title": "Imported task", "is_completed": False, "position": 0}
            ],
            "memos": [{"content": "Imported memo", "position": 0}],
        }
    )


def test_live_schema_matches_migration_contract(postgresql_engine: Engine) -> None:
    inspector = inspect(postgresql_engine)
    tables = set(inspector.get_table_names())
    assert tables == {
        "alembic_version",
        "auth_sessions",
        "checklist_items",
        "content_idea_brolls",
        "content_idea_references",
        "content_ideas",
        "project_memos",
        "projects",
        "saved_brolls",
        "saved_references",
        "users",
    }
    auth_columns = {column["name"]: column for column in inspector.get_columns("auth_sessions")}
    checklist_columns = {
        column["name"]: column for column in inspector.get_columns("checklist_items")
    }
    assert str(auth_columns["expires_at"]["type"]) == "TIMESTAMP"
    assert auth_columns["expires_at"]["type"].timezone is True
    assert checklist_columns["is_completed"]["default"] == "false"
    assert inspector.get_pk_constraint("projects")["constrained_columns"] == ["id"]
    assert any(
        constraint["name"] == "uq_projects_user_source_local_id"
        for constraint in inspector.get_unique_constraints("projects")
    )
    assert inspector.get_foreign_keys("auth_sessions")[0]["options"]["ondelete"] == "CASCADE"
    sequences = set(inspector.get_sequence_names())
    assert {
        "users_id_seq",
        "projects_id_seq",
        "checklist_items_id_seq",
        "content_ideas_id_seq",
        "saved_references_id_seq",
        "saved_brolls_id_seq",
    } <= sequences


def test_connection_commit_rollback_and_pool_reuse(postgresql_engine: Engine) -> None:
    with postgresql_engine.begin() as connection:
        connection.execute(text("CREATE TEMP TABLE pool_probe (value integer)"))
        connection.execute(text("INSERT INTO pool_probe VALUES (1)"))

    with pytest.raises(RuntimeError, match="rollback probe"):
        with postgresql_engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO users (email, created_at, updated_at) "
                    "VALUES ('rollback@example.com', :now, :now)"
                ),
                {"now": utc_now()},
            )
            raise RuntimeError("rollback probe")

    with postgresql_engine.connect() as connection:
        assert connection.execute(
            text("SELECT count(*) FROM users WHERE email='rollback@example.com'")
        ).scalar_one() == 0
        assert connection.execute(text("SELECT 1")).scalar_one() == 1
    assert postgresql_engine.pool.checkedout() == 0


def test_timestamptz_round_trip_and_session_expiry_boundaries(
    postgresql_engine: Engine,
) -> None:
    raw_session_token = "postgresql-live-session-token"
    korea = timezone(timedelta(hours=9))
    created_at = datetime(2026, 9, 16, 12, 30, 1, 123456, tzinfo=korea)
    expires_at = datetime(2026, 9, 16, 4, 0, 2, 654321, tzinfo=timezone.utc)
    with Session(postgresql_engine) as session:
        user = _user("ttl@example.com")
        session.add(user)
        session.flush()
        auth_session = AuthSession(
            user_id=user.id,
            token_digest=token_digest(raw_session_token),
            csrf_token_digest="b" * 64,
            created_at=created_at,
            expires_at=expires_at,
        )
        session.add(auth_session)
        session.commit()
        session_id = auth_session.id

    with Session(postgresql_engine) as session:
        stored = session.get(AuthSession, session_id)
        assert stored is not None
        assert stored.created_at == datetime(
            2026, 9, 16, 3, 30, 1, 123456, tzinfo=timezone.utc
        )
        assert stored.expires_at == expires_at
        assert stored.created_at.utcoffset() == timedelta(0)
        assert lookup_auth_context(
            session,
            raw_session_token,
            now=expires_at - timedelta(microseconds=1),
        ) is not None
        assert lookup_auth_context(session, raw_session_token, now=expires_at) is None
        assert lookup_auth_context(
            session,
            raw_session_token,
            now=expires_at + timedelta(microseconds=1),
        ) is None


def test_boolean_defaults_sequences_and_unique_null_semantics(
    postgresql_engine: Engine,
) -> None:
    with Session(postgresql_engine) as session:
        user = _user("constraints@example.com")
        session.add(user)
        session.flush()
        first = Project(user_id=user.id, title="First")
        second = Project(user_id=user.id, title="Second")
        session.add_all([first, second])
        session.flush()
        assert first.id is not None and second.id == first.id + 1
        default_value = session.exec(
            text(
                "INSERT INTO checklist_items "
                "(project_id, title, position, created_at, updated_at) "
                "VALUES (:project_id, 'Default', 0, :now, :now) "
                "RETURNING is_completed"
            ).bindparams(project_id=first.id, now=utc_now())
        ).one()
        assert default_value[0] is False
        explicit_true = ChecklistItem(
            project_id=first.id,
            title="Explicit true",
            is_completed=True,
            position=1,
        )
        session.add(explicit_true)
        session.commit()
        session.refresh(explicit_true)
        assert explicit_true.is_completed is True
        first_id = first.id
        session.delete(second)
        session.commit()
        third = Project(user_id=user.id, title="Third")
        session.add(third)
        session.commit()
        assert third.id is not None and third.id > first_id

        session.add_all(
            [
                Project(user_id=user.id, title="Nullable one"),
                Project(user_id=user.id, title="Nullable two"),
            ]
        )
        session.commit()
        session.add(Project(user_id=user.id, title="Unique", source_local_id="same"))
        session.commit()
        session.add(Project(user_id=user.id, title="Duplicate", source_local_id="same"))
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()
        other = _user("other-constraints@example.com")
        session.add(other)
        session.flush()
        session.add(Project(user_id=other.id, title="Other", source_local_id="same"))
        session.commit()


def test_foreign_keys_cascade_set_null_and_project_cleanup(
    postgresql_engine: Engine,
) -> None:
    with Session(postgresql_engine) as session:
        session.add(Project(user_id=999999, title="Invalid FK"))
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()

        user = _user("foreign-key@example.com")
        session.add(user)
        session.flush()
        project = Project(user_id=user.id, title="Converted")
        session.add(project)
        session.flush()
        idea = ContentIdea(
            user_id=user.id,
            title="Idea",
            platform=ContentPlatform.YOUTUBE,
            status=ContentIdeaStatus.CONVERTED,
            converted_project_id=project.id,
        )
        child = ChecklistItem(project_id=project.id, title="Child", position=0)
        session.add_all([idea, child])
        session.commit()
        project_service.delete_project(session, project)
        session.refresh(idea)
        assert idea.converted_project_id is None
        assert idea.status == ContentIdeaStatus.READY
        assert session.exec(select(ChecklistItem)).all() == []

        cascade_user = _user("auth-cascade@example.com")
        session.add(cascade_user)
        session.flush()
        auth_session = AuthSession(
            user_id=cascade_user.id,
            token_digest="c" * 64,
            csrf_token_digest="d" * 64,
            expires_at=utc_now() + timedelta(days=1),
        )
        session.add(auth_session)
        session.commit()
        session.delete(cascade_user)
        session.commit()
        assert session.exec(select(AuthSession)).all() == []


def test_legacy_import_commit_retry_rollback_and_concurrency(
    postgresql_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with Session(postgresql_engine) as session:
        user = _user("import@example.com")
        session.add(user)
        session.commit()
        user_id = user.id

    with Session(postgresql_engine) as session:
        first, created = project_service.import_local_project(
            session, user_id, _import_data("retry")
        )
        retry, retry_created = project_service.import_local_project(
            session, user_id, _import_data("retry")
        )
        assert created is True and retry_created is False and retry.id == first.id

    original_add_memos = project_service._add_import_memos
    monkeypatch.setattr(
        project_service,
        "_add_import_memos",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("forced failure")),
    )
    with Session(postgresql_engine) as session:
        with pytest.raises(RuntimeError, match="forced failure"):
            project_service.import_local_project(
                session, user_id, _import_data("rollback")
            )
    monkeypatch.setattr(project_service, "_add_import_memos", original_add_memos)

    barrier = Barrier(2)
    thread_state = local()
    original_lookup = project_service.get_project_by_source_local_id

    def synchronized_lookup(session, target_user_id, source_local_id):
        result = original_lookup(session, target_user_id, source_local_id)
        if source_local_id == "concurrent" and not getattr(thread_state, "waited", False):
            thread_state.waited = True
            barrier.wait(timeout=10)
        return result

    monkeypatch.setattr(project_service, "get_project_by_source_local_id", synchronized_lookup)

    def run_import():
        with Session(postgresql_engine) as session:
            return project_service.import_local_project(
                session, user_id, _import_data("concurrent")
            )

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: run_import(), range(2)))

    assert sorted(created for _, created in results) == [False, True]
    assert len({project.id for project, _ in results}) == 1
    with Session(postgresql_engine) as session:
        assert len(
            session.exec(
                select(Project).where(Project.source_local_id == "concurrent")
            ).all()
        ) == 1
        assert session.exec(
            select(Project).where(Project.source_local_id == "rollback")
        ).all() == []


def test_concurrent_canonical_signup_creates_one_user(
    anonymous_client: TestClient,
    postgresql_engine: Engine,
) -> None:
    barrier = Barrier(2)

    def signup(email: str) -> int:
        barrier.wait(timeout=10)
        response = anonymous_client.post(
            "/api/auth/signup",
            json={"email": email, "password": "concurrent password"},
        )
        return response.status_code

    with ThreadPoolExecutor(max_workers=2) as executor:
        statuses = list(executor.map(signup, ["Race@Example.com", "race@example.COM"]))

    assert sorted(statuses) == [201, 409]
    with Session(postgresql_engine) as session:
        users = session.exec(select(User).where(User.email == "race@example.com")).all()
        assert len(users) == 1


def test_conversion_commits_all_rows_and_rolls_back_partial_failure(
    postgresql_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with Session(postgresql_engine) as session:
        user = _user("conversion@example.com")
        session.add(user)
        session.flush()
        success_idea = ContentIdea(
            user_id=user.id,
            title="Success idea",
            platform=ContentPlatform.YOUTUBE,
        )
        failure_idea = ContentIdea(
            user_id=user.id,
            title="Failure idea",
            platform=ContentPlatform.BLOG,
        )
        session.add_all([success_idea, failure_idea])
        session.commit()
        user_id = user.id
        success_id = success_idea.id
        failure_id = failure_idea.id

    with Session(postgresql_engine) as session:
        project, idea = content_idea_service.convert_content_idea_to_project(
            session,
            user_id,
            success_id,
            ContentIdeaConversionCreate(
                title="Committed conversion",
                create_default_checklist=True,
                initial_memo="Committed memo",
            ),
        )
        assert idea.converted_project_id == project.id
        assert project.checklist_total > 0

    original_add_memo = content_idea_service._add_initial_memo

    def fail_after_memo(session: Session, project_id: int, content: str):
        original_add_memo(session, project_id, content)
        session.flush()
        raise RuntimeError("forced PostgreSQL rollback")

    monkeypatch.setattr(content_idea_service, "_add_initial_memo", fail_after_memo)
    with Session(postgresql_engine) as session:
        with pytest.raises(RuntimeError, match="forced PostgreSQL rollback"):
            content_idea_service.convert_content_idea_to_project(
                session,
                user_id,
                failure_id,
                ContentIdeaConversionCreate(
                    title="Rolled back conversion",
                    create_default_checklist=True,
                    initial_memo="Must roll back",
                ),
            )

    with Session(postgresql_engine) as session:
        failed_idea = session.get(ContentIdea, failure_id)
        assert failed_idea is not None
        assert failed_idea.converted_project_id is None
        assert failed_idea.status == ContentIdeaStatus.IDEA
        assert session.exec(
            select(Project).where(Project.title == "Rolled back conversion")
        ).one_or_none() is None
        assert session.exec(
            select(ProjectMemo).where(ProjectMemo.content == "Must roll back")
        ).one_or_none() is None


def test_save_token_save_and_replay_use_postgresql_transaction(
    postgresql_engine: Engine,
) -> None:
    recommendation_runtime_state.clear()
    secret = "postgresql integration signing secret"
    settings = Settings(
        _env_file=None,
        llm_recommendation_signing_secret=secret,
    )
    with Session(postgresql_engine) as session:
        user = _user("recommendation@example.com")
        session.add(user)
        session.commit()
        user_id = user.id

    token = sign_save_token(
        RecommendationTokenPayload(
            version=1,
            user_id=user_id,
            issued_at=100,
            expires_at=200,
            client_key=uuid4(),
            title="Saved with PostgreSQL",
            description=None,
            platform=ContentPlatform.BLOG,
            tags=[],
            target_audience=None,
            content_format=None,
        ),
        secret,
    )
    with Session(postgresql_engine) as session:
        saved = save_recommendation(
            session, user_id, token, settings, clock=lambda: 150
        )
        assert saved.source == "ai"
        with pytest.raises(RecommendationServiceError) as error:
            save_recommendation(session, user_id, token, settings, clock=lambda: 151)
        assert error.value.code == "recommendation_token_reused"
    with Session(postgresql_engine) as session:
        rows = session.exec(
            select(ContentIdea).where(ContentIdea.title == "Saved with PostgreSQL")
        ).all()
        assert len(rows) == 1


def test_concurrent_conversion_creates_one_project(
    postgresql_engine: Engine,
) -> None:
    with Session(postgresql_engine) as session:
        user = _user("concurrent-conversion@example.com")
        session.add(user)
        session.flush()
        idea = ContentIdea(
            user_id=user.id,
            title="Concurrent idea",
            platform=ContentPlatform.YOUTUBE,
        )
        session.add(idea)
        session.commit()
        user_id = user.id
        idea_id = idea.id

    barrier = Barrier(2)

    def convert(index: int) -> str:
        barrier.wait(timeout=10)
        with Session(postgresql_engine) as session:
            try:
                content_idea_service.convert_content_idea_to_project(
                    session,
                    user_id,
                    idea_id,
                    ContentIdeaConversionCreate(title=f"Concurrent project {index}"),
                )
            except content_idea_service.ContentIdeaConversionConflictError:
                return "conflict"
        return "created"

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(convert, range(2)))

    assert sorted(results) == ["conflict", "created"]
    with Session(postgresql_engine) as session:
        projects = session.exec(
            select(Project).where(Project.user_id == user_id)
        ).all()
        assert len(projects) == 1
