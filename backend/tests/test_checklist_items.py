import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlmodel import Session

from app.models.checklist_item import ChecklistItem
from app.models.project import Project
from app.models.user import User


def create_project(client: TestClient, title: str = "Checklist project") -> dict:
    response = client.post("/api/projects", json={"title": title})
    assert response.status_code == 201
    return response.json()


def create_checklist_item(
    client: TestClient,
    project_id: int,
    title: str = "Draft outline",
    **fields: object,
) -> dict:
    response = client.post(
        f"/api/projects/{project_id}/checklist-items",
        json={"title": title, **fields},
    )
    assert response.status_code == 201
    return response.json()


def test_create_checklist_item(client: TestClient) -> None:
    project = create_project(client)

    item = create_checklist_item(
        client,
        project["id"],
        "  Draft outline  ",
        description="First editing pass",
        is_completed=True,
        position=3,
    )

    assert item["id"] > 0
    assert item["project_id"] == project["id"]
    assert item["title"] == "Draft outline"
    assert item["description"] == "First editing pass"
    assert item["is_completed"] is True
    assert item["position"] == 3
    assert item["created_at"]
    assert item["updated_at"]


def test_omitted_position_uses_project_maximum_plus_one(
    client: TestClient,
) -> None:
    project = create_project(client)
    other_project = create_project(client, "Other project")
    create_checklist_item(client, project["id"], "First", position=4)

    second = create_checklist_item(client, project["id"], "Second")
    other_first = create_checklist_item(client, other_project["id"], "Other")

    assert second["position"] == 5
    assert other_first["position"] == 0


def test_list_returns_only_requested_projects_items(client: TestClient) -> None:
    project = create_project(client)
    other_project = create_project(client, "Other project")
    expected = create_checklist_item(client, project["id"], "Expected")
    create_checklist_item(client, other_project["id"], "Hidden")

    response = client.get(f"/api/projects/{project['id']}/checklist-items")

    assert response.status_code == 200
    assert response.json() == [expected]


def test_list_orders_by_position_then_id(client: TestClient) -> None:
    project = create_project(client)
    later_tie = create_checklist_item(
        client,
        project["id"],
        "Later tie",
        position=2,
    )
    first = create_checklist_item(client, project["id"], "First", position=0)
    last = create_checklist_item(client, project["id"], "Last", position=9)
    earlier_tie = create_checklist_item(
        client,
        project["id"],
        "Earlier tie",
        position=2,
    )

    response = client.get(f"/api/projects/{project['id']}/checklist-items")

    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [
        first["id"],
        later_tie["id"],
        earlier_tie["id"],
        last["id"],
    ]


def test_partially_update_checklist_item(client: TestClient) -> None:
    project = create_project(client)
    created = create_checklist_item(
        client,
        project["id"],
        description="Keep this",
        position=7,
    )

    response = client.patch(
        f"/api/checklist-items/{created['id']}",
        json={"title": "  Revised outline  "},
    )

    assert response.status_code == 200
    updated = response.json()
    assert updated["title"] == "Revised outline"
    assert updated["description"] == created["description"]
    assert updated["position"] == created["position"]
    assert updated["updated_at"] > created["updated_at"]


def test_update_completion_status(client: TestClient) -> None:
    project = create_project(client)
    created = create_checklist_item(client, project["id"])

    response = client.patch(
        f"/api/checklist-items/{created['id']}",
        json={"is_completed": True},
    )

    assert response.status_code == 200
    assert response.json()["is_completed"] is True


def test_update_position(client: TestClient) -> None:
    project = create_project(client)
    created = create_checklist_item(client, project["id"])

    response = client.patch(
        f"/api/checklist-items/{created['id']}",
        json={"position": 10},
    )

    assert response.status_code == 200
    assert response.json()["position"] == 10


def test_delete_checklist_item_returns_204(client: TestClient) -> None:
    project = create_project(client)
    created = create_checklist_item(client, project["id"])

    response = client.delete(f"/api/checklist-items/{created['id']}")

    assert response.status_code == 204
    assert response.content == b""
    assert (
        client.patch(
            f"/api/checklist-items/{created['id']}",
            json={"title": "Missing"},
        ).status_code
        == 404
    )


def test_create_for_missing_project_returns_404(client: TestClient) -> None:
    response = client.post(
        "/api/projects/999999/checklist-items",
        json={"title": "Missing project"},
    )

    assert response.status_code == 404


def test_missing_item_update_and_delete_return_404(client: TestClient) -> None:
    assert (
        client.patch(
            "/api/checklist-items/999999",
            json={"title": "Missing"},
        ).status_code
        == 404
    )
    assert client.delete("/api/checklist-items/999999").status_code == 404


def test_other_users_checklist_items_are_hidden(
    client: TestClient,
    test_engine: Engine,
) -> None:
    assert client.get("/api/projects").status_code == 200
    with Session(test_engine) as session:
        other_user = User(email="checklist-owner@editflow.local")
        session.add(other_user)
        session.commit()
        session.refresh(other_user)
        assert other_user.id is not None

        project = Project(user_id=other_user.id, title="Private project")
        session.add(project)
        session.commit()
        session.refresh(project)
        assert project.id is not None

        item = ChecklistItem(
            project_id=project.id,
            title="Private item",
            position=0,
        )
        session.add(item)
        session.commit()
        session.refresh(item)
        assert item.id is not None
        project_id = project.id
        item_id = item.id

    assert (
        client.get(f"/api/projects/{project_id}/checklist-items").status_code
        == 404
    )
    assert (
        client.post(
            f"/api/projects/{project_id}/checklist-items",
            json={"title": "Intrusion"},
        ).status_code
        == 404
    )
    assert (
        client.patch(
            f"/api/checklist-items/{item_id}",
            json={"title": "Take over"},
        ).status_code
        == 404
    )
    assert client.delete(f"/api/checklist-items/{item_id}").status_code == 404

    with Session(test_engine) as session:
        assert session.get(ChecklistItem, item_id) is not None


@pytest.mark.parametrize("title", ["", "   "])
def test_blank_title_returns_422(client: TestClient, title: str) -> None:
    project = create_project(client)

    response = client.post(
        f"/api/projects/{project['id']}/checklist-items",
        json={"title": title},
    )

    assert response.status_code == 422


def test_negative_position_returns_422(client: TestClient) -> None:
    project = create_project(client)
    created = create_checklist_item(client, project["id"])

    create_response = client.post(
        f"/api/projects/{project['id']}/checklist-items",
        json={"title": "Invalid", "position": -1},
    )
    update_response = client.patch(
        f"/api/checklist-items/{created['id']}",
        json={"position": -1},
    )

    assert create_response.status_code == 422
    assert update_response.status_code == 422


def test_empty_patch_returns_400(client: TestClient) -> None:
    project = create_project(client)
    created = create_checklist_item(client, project["id"])

    response = client.patch(f"/api/checklist-items/{created['id']}", json={})

    assert response.status_code == 400


def test_invalid_type_returns_422(client: TestClient) -> None:
    project = create_project(client)

    response = client.post(
        f"/api/projects/{project['id']}/checklist-items",
        json={"title": "Invalid", "is_completed": {"value": True}},
    )

    assert response.status_code == 422


def test_client_cannot_set_server_managed_fields(client: TestClient) -> None:
    project = create_project(client)

    response = client.post(
        f"/api/projects/{project['id']}/checklist-items",
        json={
            "title": "Injected",
            "id": 999,
            "project_id": 999,
            "created_at": "2026-01-01T00:00:00Z",
            "updated_at": "2026-01-01T00:00:00Z",
        },
    )

    assert response.status_code == 422
