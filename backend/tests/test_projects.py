from datetime import date

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlmodel import Session, select

from app.models.checklist_item import ChecklistItem
from app.models.project import Project
from app.models.saved_broll import SavedBroll
from app.models.saved_reference import SavedReference
from app.models.user import User
from app.services.users import DEVELOPMENT_USER_EMAIL


def create_project(client: TestClient, title: str = "Launch video") -> dict:
    response = client.post(
        "/api/projects",
        json={
            "title": title,
            "description": "Product launch edit",
            "client_name": "EditFlow",
            "status": "planning",
            "due_date": "2026-08-01",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_development_user_is_ensured_idempotently(
    client: TestClient, test_engine: Engine
) -> None:
    with Session(test_engine) as session:
        startup_users = session.exec(
            select(User).where(User.email == DEVELOPMENT_USER_EMAIL)
        ).all()

    assert len(startup_users) == 1
    assert client.get("/api/projects").status_code == 200
    assert client.get("/api/projects").status_code == 200

    with Session(test_engine) as session:
        users = session.exec(
            select(User).where(User.email == DEVELOPMENT_USER_EMAIL)
        ).all()

    assert len(users) == 1


def test_create_project_assigns_development_user(client: TestClient) -> None:
    project = create_project(client, "  Launch video  ")

    assert project["id"] > 0
    assert project["user_id"] > 0
    assert project["title"] == "Launch video"
    assert project["status"] == "planning"
    assert project["due_date"] == "2026-08-01"
    assert project["created_at"]
    assert project["updated_at"]
    assert project["reference_count"] == 0
    assert project["broll_count"] == 0
    assert project["checklist_total"] == 0
    assert project["checklist_completed"] == 0


def test_project_responses_include_scoped_child_counts(
    client: TestClient,
) -> None:
    first = create_project(client, "Counted")
    second = create_project(client, "Separate")
    first_id = first["id"]
    second_id = second["id"]

    for index in range(2):
        reference_response = client.post(
            f"/api/projects/{first_id}/references",
            json={
                "external_id": f"reference-{index}",
                "title": f"Reference {index}",
                "url": f"https://www.youtube.com/watch?v=reference-{index}",
            },
        )
        broll_response = client.post(
            f"/api/projects/{first_id}/brolls",
            json={
                "external_id": f"broll-{index}",
                "url": f"https://www.pexels.com/video/broll-{index}/",
            },
        )
        checklist_response = client.post(
            f"/api/projects/{first_id}/checklist-items",
            json={"title": f"Checklist {index}"},
        )
        assert reference_response.status_code == 201
        assert broll_response.status_code == 201
        assert checklist_response.status_code == 201
        if index == 0:
            completed_response = client.patch(
                f"/api/checklist-items/{checklist_response.json()['id']}",
                json={"is_completed": True},
            )
            assert completed_response.status_code == 200

    assert client.post(
        f"/api/projects/{second_id}/references",
        json={
            "external_id": "separate-reference",
            "title": "Separate reference",
            "url": "https://www.youtube.com/watch?v=separate-reference",
        },
    ).status_code == 201

    detail_response = client.get(f"/api/projects/{first_id}")
    assert detail_response.status_code == 200
    detail = detail_response.json()
    assert detail["reference_count"] == 2
    assert detail["broll_count"] == 2
    assert detail["checklist_total"] == 2
    assert detail["checklist_completed"] == 1

    listed = {
        project["id"]: project for project in client.get("/api/projects").json()
    }
    assert listed[first_id] == detail
    assert listed[second_id]["reference_count"] == 1
    assert listed[second_id]["broll_count"] == 0
    assert listed[second_id]["checklist_total"] == 0
    assert listed[second_id]["checklist_completed"] == 0

    update_response = client.patch(
        f"/api/projects/{first_id}",
        json={"title": "Counted after update"},
    )
    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["reference_count"] == 2
    assert updated["broll_count"] == 2
    assert updated["checklist_total"] == 2
    assert updated["checklist_completed"] == 1


def test_list_projects_returns_only_development_users_projects(
    client: TestClient, test_engine: Engine
) -> None:
    first = create_project(client, "First")
    second = create_project(client, "Second")

    with Session(test_engine) as session:
        other_user = User(email="other@editflow.local")
        session.add(other_user)
        session.commit()
        session.refresh(other_user)
        assert other_user.id is not None
        session.add(Project(user_id=other_user.id, title="Private"))
        session.commit()

    response = client.get("/api/projects")

    assert response.status_code == 200
    assert [project["id"] for project in response.json()] == [
        second["id"],
        first["id"],
    ]


def test_read_project(client: TestClient) -> None:
    created = create_project(client)

    response = client.get(f"/api/projects/{created['id']}")

    assert response.status_code == 200
    assert response.json() == created


def test_partially_update_project(client: TestClient) -> None:
    created = create_project(client)

    response = client.patch(
        f"/api/projects/{created['id']}",
        json={"title": "Revised launch", "status": "in_progress"},
    )

    assert response.status_code == 200
    updated = response.json()
    assert updated["title"] == "Revised launch"
    assert updated["status"] == "in_progress"
    assert updated["description"] == created["description"]
    assert updated["user_id"] == created["user_id"]
    assert updated["updated_at"] > created["updated_at"]


def test_delete_project_returns_204(client: TestClient) -> None:
    created = create_project(client)

    response = client.delete(f"/api/projects/{created['id']}")

    assert response.status_code == 204
    assert response.content == b""
    assert client.get(f"/api/projects/{created['id']}").status_code == 404


def test_delete_project_removes_its_child_data(
    client: TestClient,
    test_engine: Engine,
) -> None:
    created = create_project(client)
    project_id = created["id"]
    checklist_response = client.post(
        f"/api/projects/{project_id}/checklist-items",
        json={"title": "Child checklist item"},
    )
    reference_response = client.post(
        f"/api/projects/{project_id}/references",
        json={
            "external_id": "child-reference",
            "title": "Child reference",
            "url": "https://www.youtube.com/watch?v=child-reference",
        },
    )
    broll_response = client.post(
        f"/api/projects/{project_id}/brolls",
        json={
            "external_id": "child-broll",
            "url": "https://www.pexels.com/video/child-broll/",
        },
    )
    assert checklist_response.status_code == 201
    assert reference_response.status_code == 201
    assert broll_response.status_code == 201

    response = client.delete(f"/api/projects/{project_id}")

    assert response.status_code == 204
    with Session(test_engine) as session:
        assert session.get(ChecklistItem, checklist_response.json()["id"]) is None
        assert session.get(SavedReference, reference_response.json()["id"]) is None
        assert session.get(SavedBroll, broll_response.json()["id"]) is None


def test_read_missing_project_returns_404(client: TestClient) -> None:
    assert client.get("/api/projects/999999").status_code == 404


def test_invalid_status_returns_422(client: TestClient) -> None:
    response = client.post(
        "/api/projects",
        json={"title": "Invalid", "status": "reviewing"},
    )

    assert response.status_code == 422


@pytest.mark.parametrize("title", ["", "   "])
def test_empty_title_returns_422(client: TestClient, title: str) -> None:
    response = client.post("/api/projects", json={"title": title})

    assert response.status_code == 422


def test_other_users_project_is_hidden(
    client: TestClient, test_engine: Engine
) -> None:
    assert client.get("/api/projects").status_code == 200
    with Session(test_engine) as session:
        other_user = User(email="owner@editflow.local")
        session.add(other_user)
        session.commit()
        session.refresh(other_user)
        assert other_user.id is not None
        project = Project(
            user_id=other_user.id,
            title="Hidden project",
            due_date=date(2026, 9, 1),
        )
        session.add(project)
        session.commit()
        session.refresh(project)
        assert project.id is not None
        project_id = project.id

    assert client.get(f"/api/projects/{project_id}").status_code == 404
    assert (
        client.patch(
            f"/api/projects/{project_id}", json={"title": "Take over"}
        ).status_code
        == 404
    )
    assert client.delete(f"/api/projects/{project_id}").status_code == 404

    with Session(test_engine) as session:
        assert session.get(Project, project_id) is not None


def test_empty_patch_returns_400(client: TestClient) -> None:
    created = create_project(client)

    response = client.patch(f"/api/projects/{created['id']}", json={})

    assert response.status_code == 400


def test_client_cannot_set_server_managed_fields(client: TestClient) -> None:
    response = client.post(
        "/api/projects",
        json={"title": "Injected", "user_id": 999, "id": 999},
    )

    assert response.status_code == 422
