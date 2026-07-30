import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlmodel import Session

from app.models.project import Project
from app.models.project_memo import ProjectMemo
from app.models.user import User


def create_project(client: TestClient, title: str = "Memo project") -> dict:
    response = client.post("/api/projects", json={"title": title})
    assert response.status_code == 201
    return response.json()


def create_memo(
    client: TestClient,
    project_id: int,
    content: str = "Editing note",
    **fields: object,
) -> dict:
    response = client.post(
        f"/api/projects/{project_id}/memos",
        json={"content": content, **fields},
    )
    assert response.status_code == 201
    return response.json()


def test_empty_list_and_create_trimmed_memo(client: TestClient) -> None:
    project = create_project(client)
    assert client.get(f"/api/projects/{project['id']}/memos").json() == []

    memo = create_memo(client, project["id"], "  Warm and bright  ")

    assert memo["id"] > 0
    assert memo["project_id"] == project["id"]
    assert memo["content"] == "Warm and bright"
    assert memo["position"] == 0
    assert memo["created_at"]
    assert memo["updated_at"]


def test_omitted_position_uses_project_maximum_plus_one(
    client: TestClient,
) -> None:
    project = create_project(client)
    other_project = create_project(client, "Other")
    create_memo(client, project["id"], "First", position=4)

    second = create_memo(client, project["id"], "Second")
    other_first = create_memo(client, other_project["id"], "Other first")

    assert second["position"] == 5
    assert other_first["position"] == 0


def test_list_is_project_scoped_and_orders_by_position_then_id(
    client: TestClient,
) -> None:
    project = create_project(client)
    other_project = create_project(client, "Other")
    tied_first = create_memo(client, project["id"], "Tie first", position=2)
    first = create_memo(client, project["id"], "First", position=0)
    tied_second = create_memo(client, project["id"], "Tie second", position=2)
    create_memo(client, other_project["id"], "Hidden", position=0)

    response = client.get(f"/api/projects/{project['id']}/memos")

    assert response.status_code == 200
    assert [memo["id"] for memo in response.json()] == [
        first["id"],
        tied_first["id"],
        tied_second["id"],
    ]


def test_partial_and_combined_updates(client: TestClient) -> None:
    project = create_project(client)
    created = create_memo(client, project["id"], "Original", position=3)

    content_response = client.patch(
        f"/api/project-memos/{created['id']}",
        json={"content": "  Revised  "},
    )
    assert content_response.status_code == 200
    assert content_response.json()["content"] == "Revised"
    assert content_response.json()["position"] == 3

    position_response = client.patch(
        f"/api/project-memos/{created['id']}",
        json={"position": 7},
    )
    assert position_response.status_code == 200
    assert position_response.json()["position"] == 7

    combined_response = client.patch(
        f"/api/project-memos/{created['id']}",
        json={"content": "Combined", "position": 1},
    )
    assert combined_response.status_code == 200
    assert combined_response.json()["content"] == "Combined"
    assert combined_response.json()["position"] == 1
    assert combined_response.json()["updated_at"] > created["updated_at"]


@pytest.mark.parametrize("content", ["", "   "])
def test_blank_content_returns_422(
    client: TestClient,
    content: str,
) -> None:
    project = create_project(client)
    created = create_memo(client, project["id"])

    assert client.post(
        f"/api/projects/{project['id']}/memos",
        json={"content": content},
    ).status_code == 422
    assert client.patch(
        f"/api/project-memos/{created['id']}",
        json={"content": content},
    ).status_code == 422


def test_content_length_boundaries(client: TestClient) -> None:
    project = create_project(client)
    accepted = create_memo(client, project["id"], "a" * 5000)

    assert len(accepted["content"]) == 5000
    assert client.post(
        f"/api/projects/{project['id']}/memos",
        json={"content": "a" * 5001},
    ).status_code == 422
    assert client.patch(
        f"/api/project-memos/{accepted['id']}",
        json={"content": "a" * 5001},
    ).status_code == 422


def test_invalid_updates_return_expected_errors(client: TestClient) -> None:
    project = create_project(client)
    created = create_memo(client, project["id"])

    assert client.patch(
        f"/api/project-memos/{created['id']}",
        json={},
    ).status_code == 400
    assert client.patch(
        f"/api/project-memos/{created['id']}",
        json={"content": None},
    ).status_code == 422
    assert client.post(
        f"/api/projects/{project['id']}/memos",
        json={"content": "Invalid", "position": -1},
    ).status_code == 422
    assert client.patch(
        f"/api/project-memos/{created['id']}",
        json={"position": -1},
    ).status_code == 422


def test_delete_memo(client: TestClient) -> None:
    project = create_project(client)
    created = create_memo(client, project["id"])

    response = client.delete(f"/api/project-memos/{created['id']}")

    assert response.status_code == 204
    assert response.content == b""
    assert client.patch(
        f"/api/project-memos/{created['id']}",
        json={"content": "Gone"},
    ).status_code == 404
    assert client.delete(f"/api/project-memos/{created['id']}").status_code == 404


def test_missing_resources_return_404(client: TestClient) -> None:
    assert client.get("/api/projects/999999/memos").status_code == 404
    assert client.post(
        "/api/projects/999999/memos",
        json={"content": "Missing"},
    ).status_code == 404
    assert client.patch(
        "/api/project-memos/999999",
        json={"content": "Missing"},
    ).status_code == 404
    assert client.delete("/api/project-memos/999999").status_code == 404


def test_other_users_project_and_memo_are_hidden(
    client: TestClient,
    test_engine: Engine,
) -> None:
    assert client.get("/api/projects").status_code == 200
    with Session(test_engine) as session:
        other_user = User(email="memo-owner@editflow.local")
        session.add(other_user)
        session.commit()
        session.refresh(other_user)
        assert other_user.id is not None
        project = Project(user_id=other_user.id, title="Private memos")
        session.add(project)
        session.commit()
        session.refresh(project)
        assert project.id is not None
        memo = ProjectMemo(project_id=project.id, content="Private", position=0)
        session.add(memo)
        session.commit()
        session.refresh(memo)
        assert memo.id is not None
        project_id = project.id
        memo_id = memo.id

    assert client.get(f"/api/projects/{project_id}/memos").status_code == 404
    assert client.post(
        f"/api/projects/{project_id}/memos",
        json={"content": "Intrusion"},
    ).status_code == 404
    assert client.patch(
        f"/api/project-memos/{memo_id}",
        json={"content": "Take over"},
    ).status_code == 404
    assert client.delete(f"/api/project-memos/{memo_id}").status_code == 404


def test_project_delete_removes_memos(
    client: TestClient,
    test_engine: Engine,
) -> None:
    project = create_project(client)
    memo = create_memo(client, project["id"])

    assert client.delete(f"/api/projects/{project['id']}").status_code == 204

    with Session(test_engine) as session:
        assert session.get(ProjectMemo, memo["id"]) is None


def test_client_cannot_set_server_managed_fields(client: TestClient) -> None:
    project = create_project(client)
    response = client.post(
        f"/api/projects/{project['id']}/memos",
        json={
            "content": "Injected",
            "id": 999,
            "project_id": 999,
            "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
        },
    )
    assert response.status_code == 422
