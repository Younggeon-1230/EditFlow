from collections.abc import Callable

from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlmodel import Session

from app.models.content_idea import ContentIdea
from app.models.project import Project


def test_protected_apis_require_authentication(
    anonymous_client: TestClient,
) -> None:
    assert anonymous_client.get("/api/projects").status_code == 401
    assert anonymous_client.get("/api/content-ideas").status_code == 401
    assert anonymous_client.get(
        "/api/external/youtube/search", params={"query": "editing"}
    ).status_code == 401
    assert anonymous_client.get(
        "/api/external/pexels/search", params={"query": "editing"}
    ).status_code == 401

    create_project = anonymous_client.post(
        "/api/projects",
        json={"title": "Must not be created"},
    )
    create_idea = anonymous_client.post(
        "/api/content-ideas",
        json={"title": "Must not be created", "platform": "youtube"},
    )
    recommendation = anonymous_client.post(
        "/api/content-ideas/recommendations",
        json={"topic": "Must not call provider"},
    )

    for response in (create_project, create_idea, recommendation):
        assert response.status_code == 401
        assert response.json()["detail"]["code"] == "authentication_required"


def test_project_children_are_isolated_between_authenticated_users(
    client: TestClient,
    authenticated_client_factory: Callable[[str], TestClient],
    test_engine: Engine,
) -> None:
    other = authenticated_client_factory("project-owner-b@example.com")
    project = client.post("/api/projects", json={"title": "A project"}).json()
    project_id = project["id"]
    checklist = client.post(
        f"/api/projects/{project_id}/checklist-items",
        json={"title": "A checklist"},
    ).json()
    memo = client.post(
        f"/api/projects/{project_id}/memos",
        json={"content": "A memo"},
    ).json()
    reference = client.post(
        f"/api/projects/{project_id}/references",
        json={
            "external_id": "a-reference",
            "title": "A reference",
            "url": "https://www.youtube.com/watch?v=a-reference",
        },
    ).json()
    broll = client.post(
        f"/api/projects/{project_id}/brolls",
        json={
            "external_id": "a-broll",
            "url": "https://www.pexels.com/video/a-broll/",
        },
    ).json()

    assert other.get("/api/projects").json() == []
    for method, path, body in (
        ("get", f"/api/projects/{project_id}", None),
        ("patch", f"/api/projects/{project_id}", {"title": "Take over"}),
        ("delete", f"/api/projects/{project_id}", None),
        ("get", f"/api/projects/{project_id}/checklist-items", None),
        ("post", f"/api/projects/{project_id}/checklist-items", {"title": "No"}),
        ("patch", f"/api/checklist-items/{checklist['id']}", {"is_completed": True}),
        ("delete", f"/api/checklist-items/{checklist['id']}", None),
        ("get", f"/api/projects/{project_id}/memos", None),
        ("patch", f"/api/project-memos/{memo['id']}", {"content": "No"}),
        ("delete", f"/api/project-memos/{memo['id']}", None),
        ("get", f"/api/projects/{project_id}/references", None),
        ("patch", f"/api/references/{reference['id']}", {"note": "No"}),
        ("delete", f"/api/references/{reference['id']}", None),
        ("get", f"/api/projects/{project_id}/brolls", None),
        ("patch", f"/api/brolls/{broll['id']}", {"note": "No"}),
        ("delete", f"/api/brolls/{broll['id']}", None),
    ):
        response = (
            getattr(other, method)(path, json=body)
            if body is not None
            else getattr(other, method)(path)
        )
        assert response.status_code == 404, (method, path, response.text)

    assert client.get(f"/api/projects/{project_id}").status_code == 200
    with Session(test_engine) as session:
        row = session.get(Project, project_id)
        assert row is not None
        assert row.user_id == project["user_id"]


def test_content_ideas_media_summary_and_conversion_are_user_scoped(
    client: TestClient,
    authenticated_client_factory: Callable[[str], TestClient],
    test_engine: Engine,
) -> None:
    other = authenticated_client_factory("idea-owner-b@example.com")
    idea = client.post(
        "/api/content-ideas",
        json={"title": "A idea", "platform": "youtube"},
    ).json()
    reference = client.post(
        f"/api/content-ideas/{idea['id']}/references",
        json={
            "external_id": "idea-a-reference",
            "title": "A reference",
            "url": "https://www.youtube.com/watch?v=idea-a-reference",
        },
    ).json()
    broll = client.post(
        f"/api/content-ideas/{idea['id']}/brolls",
        json={
            "external_id": "idea-a-broll",
            "url": "https://www.pexels.com/video/idea-a-broll/",
        },
    ).json()

    assert other.get("/api/content-ideas").json() == []
    assert other.get("/api/content-ideas/summary").json()["total"] == 0
    for method, path, body in (
        ("get", f"/api/content-ideas/{idea['id']}", None),
        ("patch", f"/api/content-ideas/{idea['id']}", {"title": "No"}),
        ("delete", f"/api/content-ideas/{idea['id']}", None),
        ("get", f"/api/content-ideas/{idea['id']}/references", None),
        (
            "post",
            f"/api/content-ideas/{idea['id']}/references",
            {
                "external_id": "no",
                "title": "No",
                "url": "https://example.com/no",
            },
        ),
        ("patch", f"/api/content-idea-references/{reference['id']}", {"note": "No"}),
        ("delete", f"/api/content-idea-references/{reference['id']}", None),
        ("get", f"/api/content-ideas/{idea['id']}/brolls", None),
        ("patch", f"/api/content-idea-brolls/{broll['id']}", {"note": "No"}),
        ("delete", f"/api/content-idea-brolls/{broll['id']}", None),
        (
            "post",
            f"/api/content-ideas/{idea['id']}/convert-to-project",
            {"title": "No"},
        ),
    ):
        response = (
            getattr(other, method)(path, json=body)
            if body is not None
            else getattr(other, method)(path)
        )
        assert response.status_code == 404, (method, path, response.text)

    other_idea = other.post(
        "/api/content-ideas",
        json={"title": "B idea", "platform": "youtube"},
    ).json()
    before_projects = len(other.get("/api/projects").json())
    mixed_selection = other.post(
        f"/api/content-ideas/{other_idea['id']}/convert-to-project",
        json={"title": "Must roll back", "selected_reference_ids": [reference["id"]]},
    )
    assert mixed_selection.status_code == 422
    assert len(other.get("/api/projects").json()) == before_projects
    with Session(test_engine) as session:
        row = session.get(ContentIdea, other_idea["id"])
        assert row is not None
        assert row.converted_project_id is None
        assert row.status == "idea"

    converted = client.post(
        f"/api/content-ideas/{idea['id']}/convert-to-project",
        json={
            "title": "A converted project",
            "selected_reference_ids": [reference["id"]],
            "selected_broll_ids": [broll["id"]],
        },
    )
    assert converted.status_code == 201
    assert converted.json()["project"]["user_id"] == idea["user_id"]


def test_cross_user_source_relation_is_not_returned_or_restored(
    client: TestClient,
    authenticated_client_factory: Callable[[str], TestClient],
    test_engine: Engine,
) -> None:
    other = authenticated_client_factory("corrupt-relation-owner-b@example.com")
    project = client.post(
        "/api/projects",
        json={"title": "A project"},
    ).json()
    other_idea = other.post(
        "/api/content-ideas",
        json={"title": "B idea", "platform": "youtube", "status": "archived"},
    ).json()
    with Session(test_engine) as session:
        row = session.get(ContentIdea, other_idea["id"])
        assert row is not None
        row.converted_project_id = project["id"]
        session.add(row)
        session.commit()

    source = client.get(
        f"/api/projects/{project['id']}/source-content-idea"
    )
    assert source.status_code == 200
    assert source.json() is None
    assert client.delete(f"/api/projects/{project['id']}").status_code == 204

    preserved = other.get(f"/api/content-ideas/{other_idea['id']}").json()
    assert preserved["status"] == "archived"
    assert preserved["converted_project_id"] is None
