from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlmodel import Session

from app.models.project import Project
from app.models.saved_broll import SavedBroll
from app.models.user import User


def create_project(client: TestClient, title: str = "B-roll project") -> dict:
    response = client.post("/api/projects", json={"title": title})
    assert response.status_code == 201
    return response.json()


def broll_payload(external_id: str = "pexels-123") -> dict:
    return {
        "external_id": external_id,
        "title": "City aerial",
        "url": f"https://www.pexels.com/video/{external_id}/",
        "preview_url": f"https://videos.pexels.com/{external_id}.mp4",
        "thumbnail_url": f"https://images.pexels.com/{external_id}.jpg",
        "creator_name": "EditFlow Creator",
        "duration_seconds": 12,
        "width": 1920,
        "height": 1080,
        "note": "Opening shot",
    }


def create_broll(
    client: TestClient,
    project_id: int,
    external_id: str = "pexels-123",
) -> dict:
    response = client.post(
        f"/api/projects/{project_id}/brolls",
        json=broll_payload(external_id),
    )
    assert response.status_code == 201
    return response.json()


def test_save_broll(client: TestClient) -> None:
    project = create_project(client)

    broll = create_broll(client, project["id"])

    assert broll["id"] > 0
    assert broll["project_id"] == project["id"]
    assert broll["provider"] == "pexels"
    assert broll["external_id"] == "pexels-123"
    assert broll["duration_seconds"] == 12
    assert broll["width"] == 1920
    assert broll["height"] == 1080
    assert broll["created_at"]
    assert broll["updated_at"]


def test_list_brolls_is_project_scoped(client: TestClient) -> None:
    project = create_project(client)
    other_project = create_project(client, "Other project")
    expected = create_broll(client, project["id"], "expected")
    create_broll(client, other_project["id"], "hidden")

    response = client.get(f"/api/projects/{project['id']}/brolls")

    assert response.status_code == 200
    assert response.json() == [expected]


def test_list_brolls_orders_newest_first(client: TestClient) -> None:
    project = create_project(client)
    first = create_broll(client, project["id"], "first")
    second = create_broll(client, project["id"], "second")

    response = client.get(f"/api/projects/{project['id']}/brolls")

    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [
        second["id"],
        first["id"],
    ]


def test_update_broll_note(client: TestClient) -> None:
    project = create_project(client)
    broll = create_broll(client, project["id"])

    response = client.patch(
        f"/api/brolls/{broll['id']}",
        json={"note": "  Use after intro  "},
    )

    assert response.status_code == 200
    assert response.json()["note"] == "Use after intro"
    assert response.json()["title"] == broll["title"]
    assert response.json()["updated_at"] > broll["updated_at"]


def test_delete_broll_returns_204(client: TestClient) -> None:
    project = create_project(client)
    broll = create_broll(client, project["id"])

    response = client.delete(f"/api/brolls/{broll['id']}")

    assert response.status_code == 204
    assert response.content == b""
    assert (
        client.patch(
            f"/api/brolls/{broll['id']}",
            json={"note": "Missing"},
        ).status_code
        == 404
    )


def test_duplicate_broll_in_same_project_returns_409(
    client: TestClient,
) -> None:
    project = create_project(client)
    create_broll(client, project["id"], "duplicate")

    response = client.post(
        f"/api/projects/{project['id']}/brolls",
        json=broll_payload("duplicate"),
    )

    assert response.status_code == 409
    assert "already saved" in response.json()["detail"]


def test_same_broll_is_allowed_in_different_projects(
    client: TestClient,
) -> None:
    first_project = create_project(client, "First project")
    second_project = create_project(client, "Second project")

    first = create_broll(client, first_project["id"], "shared")
    second = create_broll(client, second_project["id"], "shared")

    assert first["external_id"] == second["external_id"]
    assert first["project_id"] != second["project_id"]


def test_save_broll_to_missing_project_returns_404(
    client: TestClient,
) -> None:
    response = client.post(
        "/api/projects/999999/brolls",
        json=broll_payload(),
    )

    assert response.status_code == 404


def test_missing_broll_update_and_delete_return_404(
    client: TestClient,
) -> None:
    assert (
        client.patch(
            "/api/brolls/999999",
            json={"note": "Missing"},
        ).status_code
        == 404
    )
    assert client.delete("/api/brolls/999999").status_code == 404


def test_other_users_brolls_are_hidden(
    client: TestClient,
    test_engine: Engine,
) -> None:
    assert client.get("/api/projects").status_code == 200
    with Session(test_engine) as session:
        other_user = User(email="broll-owner@editflow.local")
        session.add(other_user)
        session.commit()
        session.refresh(other_user)
        assert other_user.id is not None

        project = Project(user_id=other_user.id, title="Private B-rolls")
        session.add(project)
        session.commit()
        session.refresh(project)
        assert project.id is not None

        broll = SavedBroll(
            project_id=project.id,
            external_id="private-broll",
            url="https://www.pexels.com/video/private-broll/",
        )
        session.add(broll)
        session.commit()
        session.refresh(broll)
        assert broll.id is not None
        project_id = project.id
        broll_id = broll.id

    assert client.get(f"/api/projects/{project_id}/brolls").status_code == 404
    assert (
        client.post(
            f"/api/projects/{project_id}/brolls",
            json=broll_payload("intrusion"),
        ).status_code
        == 404
    )
    assert (
        client.patch(
            f"/api/brolls/{broll_id}",
            json={"note": "Take over"},
        ).status_code
        == 404
    )
    assert client.delete(f"/api/brolls/{broll_id}").status_code == 404


def test_negative_broll_dimensions_return_422(client: TestClient) -> None:
    project = create_project(client)

    for field_name in ("duration_seconds", "width", "height"):
        payload = broll_payload(field_name)
        payload[field_name] = -1
        response = client.post(
            f"/api/projects/{project['id']}/brolls",
            json=payload,
        )
        assert response.status_code == 422


def test_empty_broll_patch_returns_400(client: TestClient) -> None:
    project = create_project(client)
    broll = create_broll(client, project["id"])

    response = client.patch(f"/api/brolls/{broll['id']}", json={})

    assert response.status_code == 400


def test_invalid_broll_input_returns_422(client: TestClient) -> None:
    project = create_project(client)
    broll = create_broll(client, project["id"], "metadata-patch")
    invalid_url = broll_payload()
    invalid_url["preview_url"] = "not-a-url"

    invalid_response = client.post(
        f"/api/projects/{project['id']}/brolls",
        json=invalid_url,
    )
    missing_response = client.post(
        f"/api/projects/{project['id']}/brolls",
        json={"external_id": "missing-url"},
    )
    metadata_patch_response = client.patch(
        f"/api/brolls/{broll['id']}",
        json={"title": "Changed"},
    )

    assert invalid_response.status_code == 422
    assert missing_response.status_code == 422
    assert metadata_patch_response.status_code == 422
