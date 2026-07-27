from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlmodel import Session

from app.models.project import Project
from app.models.saved_reference import SavedReference
from app.models.user import User


def create_project(client: TestClient, title: str = "Reference project") -> dict:
    response = client.post("/api/projects", json={"title": title})
    assert response.status_code == 201
    return response.json()


def reference_payload(external_id: str = "video-123") -> dict:
    return {
        "external_id": external_id,
        "title": "Editing breakdown",
        "url": f"https://www.youtube.com/watch?v={external_id}",
        "thumbnail_url": f"https://img.youtube.com/{external_id}.jpg",
        "channel_title": "EditFlow Channel",
        "published_at": "2026-07-01T12:00:00Z",
        "note": "Useful pacing reference",
    }


def create_reference(
    client: TestClient,
    project_id: int,
    external_id: str = "video-123",
) -> dict:
    response = client.post(
        f"/api/projects/{project_id}/references",
        json=reference_payload(external_id),
    )
    assert response.status_code == 201
    return response.json()


def test_save_reference(client: TestClient) -> None:
    project = create_project(client)

    reference = create_reference(client, project["id"])

    assert reference["id"] > 0
    assert reference["project_id"] == project["id"]
    assert reference["provider"] == "youtube"
    assert reference["external_id"] == "video-123"
    assert reference["title"] == "Editing breakdown"
    assert reference["note"] == "Useful pacing reference"
    assert reference["created_at"]
    assert reference["updated_at"]


def test_list_references_is_project_scoped(client: TestClient) -> None:
    project = create_project(client)
    other_project = create_project(client, "Other project")
    expected = create_reference(client, project["id"], "expected")
    create_reference(client, other_project["id"], "hidden")

    response = client.get(f"/api/projects/{project['id']}/references")

    assert response.status_code == 200
    assert response.json() == [expected]


def test_list_references_orders_newest_first(client: TestClient) -> None:
    project = create_project(client)
    first = create_reference(client, project["id"], "first")
    second = create_reference(client, project["id"], "second")

    response = client.get(f"/api/projects/{project['id']}/references")

    assert response.status_code == 200
    assert [item["id"] for item in response.json()] == [
        second["id"],
        first["id"],
    ]


def test_update_and_clear_reference_note(client: TestClient) -> None:
    project = create_project(client)
    reference = create_reference(client, project["id"])

    updated_response = client.patch(
        f"/api/references/{reference['id']}",
        json={"note": "  Updated note  "},
    )
    cleared_response = client.patch(
        f"/api/references/{reference['id']}",
        json={"note": None},
    )

    assert updated_response.status_code == 200
    assert updated_response.json()["note"] == "Updated note"
    assert updated_response.json()["title"] == reference["title"]
    assert updated_response.json()["updated_at"] > reference["updated_at"]
    assert cleared_response.status_code == 200
    assert cleared_response.json()["note"] is None


def test_delete_reference_returns_204(client: TestClient) -> None:
    project = create_project(client)
    reference = create_reference(client, project["id"])

    response = client.delete(f"/api/references/{reference['id']}")

    assert response.status_code == 204
    assert response.content == b""
    assert (
        client.patch(
            f"/api/references/{reference['id']}",
            json={"note": "Missing"},
        ).status_code
        == 404
    )


def test_duplicate_reference_in_same_project_returns_409(
    client: TestClient,
) -> None:
    project = create_project(client)
    create_reference(client, project["id"], "duplicate")

    response = client.post(
        f"/api/projects/{project['id']}/references",
        json=reference_payload("duplicate"),
    )

    assert response.status_code == 409
    assert "already saved" in response.json()["detail"]


def test_same_reference_is_allowed_in_different_projects(
    client: TestClient,
) -> None:
    first_project = create_project(client, "First project")
    second_project = create_project(client, "Second project")

    first = create_reference(client, first_project["id"], "shared")
    second = create_reference(client, second_project["id"], "shared")

    assert first["external_id"] == second["external_id"]
    assert first["project_id"] != second["project_id"]


def test_save_reference_to_missing_project_returns_404(
    client: TestClient,
) -> None:
    response = client.post(
        "/api/projects/999999/references",
        json=reference_payload(),
    )

    assert response.status_code == 404


def test_missing_reference_update_and_delete_return_404(
    client: TestClient,
) -> None:
    assert (
        client.patch(
            "/api/references/999999",
            json={"note": "Missing"},
        ).status_code
        == 404
    )
    assert client.delete("/api/references/999999").status_code == 404


def test_other_users_references_are_hidden(
    client: TestClient,
    test_engine: Engine,
) -> None:
    assert client.get("/api/projects").status_code == 200
    with Session(test_engine) as session:
        other_user = User(email="reference-owner@editflow.local")
        session.add(other_user)
        session.commit()
        session.refresh(other_user)
        assert other_user.id is not None

        project = Project(user_id=other_user.id, title="Private references")
        session.add(project)
        session.commit()
        session.refresh(project)
        assert project.id is not None

        reference = SavedReference(
            project_id=project.id,
            external_id="private-video",
            title="Private video",
            url="https://www.youtube.com/watch?v=private-video",
        )
        session.add(reference)
        session.commit()
        session.refresh(reference)
        assert reference.id is not None
        project_id = project.id
        reference_id = reference.id

    assert client.get(f"/api/projects/{project_id}/references").status_code == 404
    assert (
        client.post(
            f"/api/projects/{project_id}/references",
            json=reference_payload("intrusion"),
        ).status_code
        == 404
    )
    assert (
        client.patch(
            f"/api/references/{reference_id}",
            json={"note": "Take over"},
        ).status_code
        == 404
    )
    assert client.delete(f"/api/references/{reference_id}").status_code == 404


def test_empty_reference_patch_returns_400(client: TestClient) -> None:
    project = create_project(client)
    reference = create_reference(client, project["id"])

    response = client.patch(f"/api/references/{reference['id']}", json={})

    assert response.status_code == 400


def test_reference_patch_rejects_metadata_changes(client: TestClient) -> None:
    project = create_project(client)
    reference = create_reference(client, project["id"])

    response = client.patch(
        f"/api/references/{reference['id']}",
        json={"title": "Changed title"},
    )

    assert response.status_code == 422


def test_invalid_reference_input_returns_422(client: TestClient) -> None:
    project = create_project(client)
    invalid_url = reference_payload()
    invalid_url["url"] = "not-a-url"

    invalid_response = client.post(
        f"/api/projects/{project['id']}/references",
        json=invalid_url,
    )
    missing_response = client.post(
        f"/api/projects/{project['id']}/references",
        json={"external_id": "missing-fields"},
    )
    provider_response = client.post(
        f"/api/projects/{project['id']}/references",
        json={**reference_payload("provider"), "provider": "other"},
    )

    assert invalid_response.status_code == 422
    assert missing_response.status_code == 422
    assert provider_response.status_code == 422
