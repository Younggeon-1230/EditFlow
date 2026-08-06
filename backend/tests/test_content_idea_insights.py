from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlmodel import Session, select

from app.models.content_idea import ContentIdea
from app.models.content_idea_broll import ContentIdeaBroll
from app.models.content_idea_reference import ContentIdeaReference
from app.models.user import User, utc_now


def create_idea(client: TestClient, title: str, **fields: object) -> dict:
    response = client.post(
        "/api/content-ideas",
        json={"title": title, "platform": "youtube", **fields},
    )
    assert response.status_code == 201, response.text
    return response.json()


@pytest.mark.parametrize(
    ("sort", "expected"),
    [
        ("created_desc", ["High", "Low", "Medium newer", "Medium older"]),
        ("created_asc", ["Medium older", "Medium newer", "Low", "High"]),
        ("updated_desc", ["High", "Low", "Medium newer", "Medium older"]),
        ("updated_asc", ["Medium older", "Medium newer", "Low", "High"]),
        ("title_asc", ["High", "Low", "Medium newer", "Medium older"]),
        ("title_desc", ["Medium older", "Medium newer", "Low", "High"]),
        ("priority_desc", ["High", "Medium newer", "Medium older", "Low"]),
        ("priority_asc", ["Low", "Medium newer", "Medium older", "High"]),
    ],
)
def test_content_idea_sorting(
    client: TestClient,
    test_engine: Engine,
    sort: str,
    expected: list[str],
) -> None:
    ideas = [
        create_idea(client, "Medium older", priority="medium"),
        create_idea(client, "Medium newer", priority="medium"),
        create_idea(client, "Low", priority="low"),
        create_idea(client, "High", priority="high"),
    ]
    base = utc_now() - timedelta(days=1)
    with Session(test_engine) as session:
        for index, idea in enumerate(ideas):
            row = session.get(ContentIdea, idea["id"])
            assert row is not None
            row.created_at = base + timedelta(minutes=index)
            row.updated_at = base + timedelta(minutes=index)
            session.add(row)
        session.commit()

    response = client.get("/api/content-ideas", params={"sort": sort})
    assert response.status_code == 200
    assert [idea["title"] for idea in response.json()] == expected


def test_sort_combines_with_filters_search_and_rejects_invalid_value(
    client: TestClient,
) -> None:
    create_idea(client, "Alpha ready", status="ready")
    create_idea(client, "Beta ready", status="ready")
    create_idea(client, "Alpha draft", status="idea")

    response = client.get(
        "/api/content-ideas",
        params={"status": "ready", "search": "ready", "sort": "title_desc"},
    )
    assert [idea["title"] for idea in response.json()] == ["Beta ready", "Alpha ready"]
    assert client.get(
        "/api/content-ideas", params={"sort": "DROP TABLE content_ideas"}
    ).status_code == 422


def test_empty_content_idea_summary(client: TestClient) -> None:
    response = client.get("/api/content-ideas/summary")
    assert response.status_code == 200
    assert response.json() == {
        "total": 0,
        "by_status": {"idea": 0, "researching": 0, "ready": 0, "converted": 0, "archived": 0},
        "by_priority": {"low": 0, "medium": 0, "high": 0},
        "by_platform": {"youtube": 0, "shorts": 0, "instagram": 0, "tiktok": 0, "blog": 0, "other": 0},
        "by_source": {"manual": 0, "ai": 0},
        "converted_count": 0,
        "ready_count": 0,
        "active_count": 0,
        "with_reference_count": 0,
        "with_broll_count": 0,
        "with_any_media_count": 0,
        "latest_updated_at": None,
    }


def test_content_idea_summary_counts_distinct_media_and_scopes_user(
    client: TestClient,
    test_engine: Engine,
) -> None:
    project_response = client.post("/api/projects", json={"title": "Converted"})
    assert project_response.status_code == 201
    project_id = project_response.json()["id"]
    idea = create_idea(client, "Idea", priority="low", platform="blog")
    researching = create_idea(client, "Researching", status="researching", priority="high", platform="shorts")
    ready = create_idea(client, "Ready", status="ready", priority="medium", platform="instagram")
    converted = create_idea(client, "Converted", status="converted", priority="medium", platform="tiktok")
    archived = create_idea(client, "Archived", status="archived", priority="medium", platform="other")
    latest = utc_now() + timedelta(minutes=5)

    with Session(test_engine) as session:
        converted_row = session.get(ContentIdea, converted["id"])
        latest_row = session.get(ContentIdea, archived["id"])
        assert converted_row is not None and latest_row is not None
        converted_row.converted_project_id = project_id
        latest_row.updated_at = latest
        session.add(converted_row)
        session.add(latest_row)
        session.add(ContentIdeaReference(content_idea_id=idea["id"], external_id="r1", title="R1", url="https://example.com/r1"))
        session.add(ContentIdeaReference(content_idea_id=idea["id"], external_id="r2", title="R2", url="https://example.com/r2"))
        session.add(ContentIdeaReference(content_idea_id=ready["id"], external_id="r3", title="R3", url="https://example.com/r3"))
        session.add(ContentIdeaBroll(content_idea_id=idea["id"], external_id="b1", url="https://example.com/b1"))
        session.add(ContentIdeaBroll(content_idea_id=researching["id"], external_id="b2", url="https://example.com/b2"))
        other = User(email="summary-other@editflow.local")
        session.add(other)
        session.flush()
        other_idea = ContentIdea(user_id=other.id, title="Private", platform="youtube")
        session.add(other_idea)
        session.flush()
        session.add(ContentIdeaReference(content_idea_id=other_idea.id, external_id="private", title="Private", url="https://example.com/private"))
        session.commit()

    summary = client.get("/api/content-ideas/summary").json()
    assert summary["total"] == 5
    assert summary["by_status"] == {"idea": 1, "researching": 1, "ready": 1, "converted": 1, "archived": 1}
    assert summary["by_priority"] == {"low": 1, "medium": 3, "high": 1}
    assert summary["by_platform"] == {"youtube": 0, "shorts": 1, "instagram": 1, "tiktok": 1, "blog": 1, "other": 1}
    assert summary["by_source"] == {"manual": 5, "ai": 0}
    assert summary["converted_count"] == 1
    assert summary["ready_count"] == 1
    assert summary["active_count"] == 3
    assert summary["with_reference_count"] == 2
    assert summary["with_broll_count"] == 2
    assert summary["with_any_media_count"] == 3
    assert datetime.fromisoformat(summary["latest_updated_at"]).replace(
        tzinfo=latest.tzinfo
    ) == latest


def test_summary_tracks_deletion_conversion_and_project_restore(
    client: TestClient,
) -> None:
    removable = create_idea(client, "Remove me")
    ready = create_idea(client, "Convert me", status="ready")
    assert client.get("/api/content-ideas/summary").json()["total"] == 2

    assert client.delete(f"/api/content-ideas/{removable['id']}").status_code == 204
    after_delete = client.get("/api/content-ideas/summary").json()
    assert after_delete["total"] == 1
    assert after_delete["ready_count"] == 1

    conversion = client.post(
        f"/api/content-ideas/{ready['id']}/convert-to-project",
        json={"title": "Converted project"},
    )
    assert conversion.status_code == 201
    project_id = conversion.json()["project"]["id"]
    after_conversion = client.get("/api/content-ideas/summary").json()
    assert after_conversion["ready_count"] == 0
    assert after_conversion["converted_count"] == 1

    assert client.delete(f"/api/projects/{project_id}").status_code == 204
    after_project_delete = client.get("/api/content-ideas/summary").json()
    assert after_project_delete["ready_count"] == 1
    assert after_project_delete["converted_count"] == 0


def test_summary_route_and_sort_enum_are_exposed_in_openapi(client: TestClient) -> None:
    schema = client.get("/openapi.json").json()
    assert "/api/content-ideas/summary" in schema["paths"]
    sort_parameter = next(
        parameter
        for parameter in schema["paths"]["/api/content-ideas"]["get"]["parameters"]
        if parameter["name"] == "sort"
    )
    sort_schema = sort_parameter["schema"]
    enum_schema = schema["components"]["schemas"][sort_schema["$ref"].split("/")[-1]]
    assert set(enum_schema["enum"]) == {
        "created_desc", "created_asc", "updated_desc", "updated_asc",
        "priority_desc", "priority_asc", "title_asc", "title_desc",
    }
