from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlmodel import Session, select

from app.models.checklist_item import ChecklistItem
from app.models.content_idea import ContentIdea, ContentIdeaStatus
from app.models.project import Project
from app.models.project_memo import ProjectMemo
from app.models.user import User
from app.schemas.content_idea import ContentIdeaConversionCreate
from app.services import content_ideas as content_idea_service
from app.services.content_ideas import convert_content_idea_to_project


def create_idea(client: TestClient, *, status: str = "idea") -> dict:
    response = client.post(
        "/api/content-ideas",
        json={
            "title": "Original idea",
            "description": "Original description",
            "platform": "youtube",
            "status": status,
        },
    )
    assert response.status_code == 201
    return response.json()


def convert(client: TestClient, idea_id: int, **overrides: object):
    body = {
        "title": "Converted project",
        "description": "Project description",
        **overrides,
    }
    return client.post(
        f"/api/content-ideas/{idea_id}/convert-to-project",
        json=body,
    )


@pytest.mark.parametrize("idea_status", ["idea", "researching", "ready"])
def test_supported_statuses_convert_atomically(
    client: TestClient,
    idea_status: str,
) -> None:
    idea = create_idea(client, status=idea_status)

    response = convert(
        client,
        idea["id"],
        status="in_progress",
        due_date="2026-08-20",
    )

    assert response.status_code == 201, response.text
    result = response.json()
    project = result["project"]
    converted = result["content_idea"]
    assert project["user_id"] == idea["user_id"]
    assert project["title"] == "Converted project"
    assert project["description"] == "Project description"
    assert project["status"] == "in_progress"
    assert project["due_date"] == "2026-08-20"
    assert project["reference_count"] == 0
    assert project["broll_count"] == 0
    assert project["checklist_total"] == 0
    assert project["checklist_completed"] == 0
    assert converted["status"] == "converted"
    assert converted["converted_project_id"] == project["id"]


def test_conversion_defaults_to_planning_and_normalizes_description(
    client: TestClient,
) -> None:
    idea = create_idea(client)

    response = convert(client, idea["id"], description="   ")

    assert response.status_code == 201
    assert response.json()["project"]["status"] == "planning"
    assert response.json()["project"]["description"] is None


def test_explicitly_disabled_setup_options_create_no_children(
    client: TestClient,
) -> None:
    idea = create_idea(client)

    response = convert(
        client,
        idea["id"],
        create_default_checklist=False,
        initial_memo=None,
    )

    assert response.status_code == 201
    project = response.json()["project"]
    assert project["checklist_total"] == 0
    assert client.get(
        f"/api/projects/{project['id']}/checklist-items"
    ).json() == []
    assert client.get(f"/api/projects/{project['id']}/memos").json() == []


def test_conversion_creates_shared_default_checklist_in_template_order(
    client: TestClient,
) -> None:
    idea = create_idea(client)

    response = convert(client, idea["id"], create_default_checklist=True)

    assert response.status_code == 201
    project = response.json()["project"]
    items = client.get(
        f"/api/projects/{project['id']}/checklist-items"
    ).json()
    assert project["checklist_total"] == len(
        content_idea_service.DEFAULT_CHECKLIST_TEMPLATE
    )
    assert project["checklist_completed"] == sum(
        item["done"] for item in content_idea_service.DEFAULT_CHECKLIST_TEMPLATE
    )
    assert [item["title"] for item in items] == [
        item["text"] for item in content_idea_service.DEFAULT_CHECKLIST_TEMPLATE
    ]
    assert [item["is_completed"] for item in items] == [
        item["done"] for item in content_idea_service.DEFAULT_CHECKLIST_TEMPLATE
    ]
    assert [item["position"] for item in items] == list(range(len(items)))


def test_conversion_creates_trimmed_initial_memo_only(
    client: TestClient,
) -> None:
    idea = create_idea(client)

    response = convert(client, idea["id"], initial_memo="  직접 작성한 메모  ")

    assert response.status_code == 201
    project = response.json()["project"]
    assert project["checklist_total"] == 0
    memos = client.get(f"/api/projects/{project['id']}/memos").json()
    assert [(memo["content"], memo["position"]) for memo in memos] == [
        ("직접 작성한 메모", 0)
    ]


def test_conversion_creates_checklist_and_memo_together(
    client: TestClient,
) -> None:
    idea = create_idea(client)

    response = convert(
        client,
        idea["id"],
        create_default_checklist=True,
        initial_memo="Initial plan",
    )

    assert response.status_code == 201
    project_id = response.json()["project"]["id"]
    assert len(client.get(f"/api/projects/{project_id}/checklist-items").json()) == len(
        content_idea_service.DEFAULT_CHECKLIST_TEMPLATE
    )
    assert [memo["content"] for memo in client.get(
        f"/api/projects/{project_id}/memos"
    ).json()] == ["Initial plan"]


@pytest.mark.parametrize("initial_memo", ["   ", "x" * 5001])
def test_invalid_initial_memo_is_rejected_before_conversion(
    client: TestClient,
    initial_memo: str,
) -> None:
    idea = create_idea(client)

    response = convert(client, idea["id"], initial_memo=initial_memo)

    assert response.status_code == 422
    refreshed = client.get(f"/api/content-ideas/{idea['id']}").json()
    assert refreshed["status"] == "idea"
    assert refreshed["converted_project_id"] is None


@pytest.mark.parametrize("source", ["manual", "ai"])
def test_conversion_options_preserve_content_idea_source(
    client: TestClient,
    test_engine: Engine,
    source: str,
) -> None:
    idea = create_idea(client)
    if source == "ai":
        with Session(test_engine) as session:
            row = session.get(ContentIdea, idea["id"])
            assert row is not None
            row.source = source
            session.add(row)
            session.commit()

    response = convert(
        client,
        idea["id"],
        create_default_checklist=True,
        initial_memo="Keep source",
    )

    assert response.status_code == 201
    assert response.json()["content_idea"]["source"] == source


@pytest.mark.parametrize(
    "body",
    [
        {"title": ""},
        {"title": "Project", "status": "invalid"},
        {"title": "Project", "due_date": "2026-02-30"},
        {"title": "Project", "user_id": 99},
        {"title": "Project", "converted_project_id": 3},
        {"title": "Project", "content_idea_status": "converted"},
    ],
)
def test_invalid_or_server_managed_conversion_fields_are_rejected(
    client: TestClient,
    body: dict,
) -> None:
    idea = create_idea(client)
    response = client.post(
        f"/api/content-ideas/{idea['id']}/convert-to-project",
        json=body,
    )
    assert response.status_code == 422


def test_missing_and_other_users_ideas_are_hidden(
    client: TestClient,
    test_engine: Engine,
) -> None:
    assert convert(client, 999999).status_code == 404
    with Session(test_engine) as session:
        other = User(email="conversion-owner@editflow.local")
        session.add(other)
        session.commit()
        session.refresh(other)
        idea = ContentIdea(
            user_id=other.id,
            title="Private",
            platform="youtube",
        )
        session.add(idea)
        session.commit()
        session.refresh(idea)
        idea_id = idea.id

    assert idea_id is not None
    assert convert(client, idea_id).status_code == 404


def test_archived_and_already_converted_ideas_return_conflict(
    client: TestClient,
) -> None:
    archived = create_idea(client, status="archived")
    archived_response = convert(client, archived["id"])
    assert archived_response.status_code == 409
    assert "보관된" in archived_response.json()["detail"]

    idea = create_idea(client)
    assert convert(client, idea["id"]).status_code == 201
    duplicate = convert(client, idea["id"])
    assert duplicate.status_code == 409
    assert "이미" in duplicate.json()["detail"]


def test_link_without_converted_status_still_blocks_conversion(
    client: TestClient,
    test_engine: Engine,
) -> None:
    project = client.post("/api/projects", json={"title": "Existing"}).json()
    idea = create_idea(client, status="ready")
    with Session(test_engine) as session:
        row = session.get(ContentIdea, idea["id"])
        assert row is not None
        row.converted_project_id = project["id"]
        session.add(row)
        session.commit()

    assert convert(client, idea["id"]).status_code == 409


def test_deleting_converted_project_restores_idea_and_allows_reconversion(
    client: TestClient,
) -> None:
    unaffected = create_idea(client, status="researching")
    idea = create_idea(client)
    first = convert(client, idea["id"])
    assert first.status_code == 201

    project_id = first.json()["project"]["id"]
    assert client.get(
        f"/api/projects/{project_id}/source-content-idea"
    ).status_code == 200
    assert client.delete(f"/api/projects/{project_id}").status_code == 204
    assert client.get(
        f"/api/projects/{project_id}/source-content-idea"
    ).status_code == 404

    restored = client.get(f"/api/content-ideas/{idea['id']}").json()
    assert restored["converted_project_id"] is None
    assert restored["status"] == "ready"
    assert client.get(f"/api/content-ideas/{unaffected['id']}").json()["status"] == "researching"
    assert convert(client, idea["id"], title="Converted again").status_code == 201


def test_project_source_content_idea_returns_linked_idea(
    client: TestClient,
) -> None:
    idea = create_idea(client)
    converted = convert(client, idea["id"]).json()

    response = client.get(
        f"/api/projects/{converted['project']['id']}/source-content-idea"
    )

    assert response.status_code == 200
    source_idea = response.json()
    assert source_idea["id"] == idea["id"]
    assert source_idea["title"] == idea["title"]
    assert source_idea["status"] == "converted"
    assert source_idea["converted_project_id"] == converted["project"]["id"]


def test_project_source_content_idea_returns_null_for_unlinked_project(
    client: TestClient,
) -> None:
    project = client.post("/api/projects", json={"title": "Standalone"}).json()

    response = client.get(
        f"/api/projects/{project['id']}/source-content-idea"
    )

    assert response.status_code == 200
    assert response.json() is None


def test_project_source_content_idea_returns_404_for_missing_project(
    client: TestClient,
) -> None:
    response = client.get(
        "/api/projects/999999/source-content-idea"
    )

    assert response.status_code == 404


def test_project_source_content_idea_hides_other_users_project(
    client: TestClient,
    test_engine: Engine,
) -> None:
    with Session(test_engine) as session:
        other = User(email="source-idea-owner@editflow.local")
        session.add(other)
        session.commit()
        session.refresh(other)
        project = Project(user_id=other.id, title="Private project")
        session.add(project)
        session.commit()
        session.refresh(project)
        project_id = project.id

    assert project_id is not None
    response = client.get(
        f"/api/projects/{project_id}/source-content-idea"
    )

    assert response.status_code == 404


def test_commit_failure_rolls_back_project_and_idea(
    client: TestClient,
    test_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    idea = create_idea(client)
    with Session(test_engine) as session:
        original_commit = session.commit

        def fail_commit() -> None:
            raise RuntimeError("forced commit failure")

        monkeypatch.setattr(session, "commit", fail_commit)
        with pytest.raises(RuntimeError, match="forced commit failure"):
            convert_content_idea_to_project(
                session,
                idea["user_id"],
                idea["id"],
                ContentIdeaConversionCreate(
                    title="Must roll back",
                    due_date=date(2026, 8, 20),
                ),
            )
        monkeypatch.setattr(session, "commit", original_commit)

    with Session(test_engine) as verification:
        idea_row = verification.get(ContentIdea, idea["id"])
        assert idea_row is not None
        assert idea_row.status == ContentIdeaStatus.IDEA
        assert idea_row.converted_project_id is None
        assert verification.exec(
            select(Project).where(Project.title == "Must roll back")
        ).one_or_none() is None


def assert_conversion_was_rolled_back(
    test_engine: Engine,
    idea_id: int,
    project_title: str,
) -> None:
    with Session(test_engine) as verification:
        idea = verification.get(ContentIdea, idea_id)
        assert idea is not None
        assert idea.status == ContentIdeaStatus.IDEA
        assert idea.converted_project_id is None
        assert verification.exec(
            select(Project).where(Project.title == project_title)
        ).one_or_none() is None
        assert verification.exec(select(ChecklistItem)).all() == []
        assert verification.exec(select(ProjectMemo)).all() == []


def test_checklist_failure_rolls_back_entire_conversion(
    client: TestClient,
    test_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    idea = create_idea(client)

    def fail_after_one_item(session: Session, project_id: int):
        session.add(
            ChecklistItem(
                project_id=project_id,
                title="Partial item",
                position=0,
            )
        )
        session.flush()
        raise RuntimeError("forced checklist failure")

    monkeypatch.setattr(
        content_idea_service,
        "_add_default_checklist_items",
        fail_after_one_item,
    )
    with Session(test_engine) as session:
        with pytest.raises(RuntimeError, match="forced checklist failure"):
            convert_content_idea_to_project(
                session,
                idea["user_id"],
                idea["id"],
                ContentIdeaConversionCreate(
                    title="Checklist rollback",
                    create_default_checklist=True,
                ),
            )

    assert_conversion_was_rolled_back(
        test_engine,
        idea["id"],
        "Checklist rollback",
    )


def test_memo_failure_rolls_back_entire_conversion(
    client: TestClient,
    test_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    idea = create_idea(client)

    def fail_after_memo(session: Session, project_id: int, content: str):
        session.add(ProjectMemo(project_id=project_id, content=content, position=0))
        session.flush()
        raise RuntimeError("forced memo failure")

    monkeypatch.setattr(content_idea_service, "_add_initial_memo", fail_after_memo)
    with Session(test_engine) as session:
        with pytest.raises(RuntimeError, match="forced memo failure"):
            convert_content_idea_to_project(
                session,
                idea["user_id"],
                idea["id"],
                ContentIdeaConversionCreate(
                    title="Memo rollback",
                    create_default_checklist=True,
                    initial_memo="Partial memo",
                ),
            )

    assert_conversion_was_rolled_back(test_engine, idea["id"], "Memo rollback")


def test_relation_update_failure_rolls_back_entire_conversion(
    client: TestClient,
    test_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    idea = create_idea(client)
    original_link = content_idea_service._link_content_idea_to_project

    def fail_relation_update(
        session: Session,
        idea_row: ContentIdea,
        project_id: int,
    ) -> None:
        original_link(session, idea_row, project_id)
        session.flush()
        raise RuntimeError("forced relation failure")

    monkeypatch.setattr(
        content_idea_service,
        "_link_content_idea_to_project",
        fail_relation_update,
    )
    with Session(test_engine) as session:
        with pytest.raises(RuntimeError, match="forced relation failure"):
            convert_content_idea_to_project(
                session,
                idea["user_id"],
                idea["id"],
                ContentIdeaConversionCreate(
                    title="Relation rollback",
                    create_default_checklist=True,
                    initial_memo="Rollback too",
                ),
            )

    assert_conversion_was_rolled_back(
        test_engine,
        idea["id"],
        "Relation rollback",
    )


def test_deleting_setup_project_removes_children_before_reconversion(
    client: TestClient,
    test_engine: Engine,
) -> None:
    idea = create_idea(client)
    first = convert(
        client,
        idea["id"],
        create_default_checklist=True,
        initial_memo="Old memo",
    ).json()
    first_project_id = first["project"]["id"]

    assert client.delete(f"/api/projects/{first_project_id}").status_code == 204
    restored = client.get(f"/api/content-ideas/{idea['id']}").json()
    assert restored["status"] == "ready"
    assert restored["converted_project_id"] is None
    with Session(test_engine) as verification:
        assert verification.exec(
            select(ChecklistItem).where(ChecklistItem.project_id == first_project_id)
        ).all() == []
        assert verification.exec(
            select(ProjectMemo).where(ProjectMemo.project_id == first_project_id)
        ).all() == []

    second = convert(
        client,
        idea["id"],
        title="Fresh setup",
        create_default_checklist=False,
        initial_memo="New memo",
    )
    assert second.status_code == 201
    second_project_id = second.json()["project"]["id"]
    assert client.get(
        f"/api/projects/{second_project_id}/checklist-items"
    ).json() == []
    assert [memo["content"] for memo in client.get(
        f"/api/projects/{second_project_id}/memos"
    ).json()] == ["New memo"]


def test_openapi_exposes_conversion_endpoint(client: TestClient) -> None:
    schema = client.get("/openapi.json").json()
    operation = schema["paths"][
        "/api/content-ideas/{idea_id}/convert-to-project"
    ]["post"]
    assert operation["responses"].get("201") is not None
    assert operation["tags"] == ["Content Ideas"]
