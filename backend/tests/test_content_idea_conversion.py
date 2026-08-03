from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlmodel import Session, select

from app.models.content_idea import ContentIdea, ContentIdeaStatus
from app.models.project import Project
from app.models.user import User
from app.schemas.content_idea import ContentIdeaConversionCreate
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
    assert client.delete(f"/api/projects/{project_id}").status_code == 204

    restored = client.get(f"/api/content-ideas/{idea['id']}").json()
    assert restored["converted_project_id"] is None
    assert restored["status"] == "ready"
    assert client.get(f"/api/content-ideas/{unaffected['id']}").json()["status"] == "researching"
    assert convert(client, idea["id"], title="Converted again").status_code == 201


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


def test_openapi_exposes_conversion_endpoint(client: TestClient) -> None:
    schema = client.get("/openapi.json").json()
    operation = schema["paths"][
        "/api/content-ideas/{idea_id}/convert-to-project"
    ]["post"]
    assert operation["responses"].get("201") is not None
    assert operation["tags"] == ["Content Ideas"]
