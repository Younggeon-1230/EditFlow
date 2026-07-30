from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlmodel import Session, select

from app.models.content_idea import ContentIdea, ContentIdeaSource
from app.models.user import User, utc_now


def create_idea(
    client: TestClient,
    title: str = "YouTube editing workflow",
    **fields: object,
) -> dict:
    response = client.post(
        "/api/content-ideas",
        json={"title": title, "platform": "youtube", **fields},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_empty_list_and_create_with_defaults(client: TestClient) -> None:
    assert client.get("/api/content-ideas").json() == []

    idea = create_idea(
        client,
        "  편집 시간을 줄이는 법  ",
        description="  초보 편집자를 위한 내용  ",
        tags=[" 편집 ", "", "EDITING", "편집", "workflow"],
        target_audience="  초보 편집자  ",
        content_format="  tutorial  ",
    )

    assert idea["id"] > 0
    assert idea["title"] == "편집 시간을 줄이는 법"
    assert idea["description"] == "초보 편집자를 위한 내용"
    assert idea["platform"] == "youtube"
    assert idea["status"] == "idea"
    assert idea["priority"] == "medium"
    assert idea["tags"] == ["편집", "EDITING", "workflow"]
    assert idea["target_audience"] == "초보 편집자"
    assert idea["content_format"] == "tutorial"
    assert idea["source"] == "manual"
    assert idea["converted_project_id"] is None
    assert idea["created_at"]
    assert idea["updated_at"]


def test_tags_are_stored_as_json_and_empty_tags_as_null(
    client: TestClient,
    test_engine: Engine,
) -> None:
    tagged = create_idea(client, tags=["Korean", "한글"])
    empty = create_idea(client, "Empty tags", tags=[])

    with Session(test_engine) as session:
        tagged_row = session.get(ContentIdea, tagged["id"])
        empty_row = session.get(ContentIdea, empty["id"])
        assert tagged_row is not None
        assert tagged_row.tags == '["Korean", "한글"]'
        assert empty_row is not None
        assert empty_row.tags is None


def test_maximum_text_and_tag_boundaries_are_accepted(
    client: TestClient,
) -> None:
    idea = create_idea(
        client,
        "t" * 200,
        description="d" * 5000,
        target_audience="a" * 500,
        content_format="f" * 100,
        tags=[f"{index:02d}-" + ("x" * 47) for index in range(20)],
    )

    assert len(idea["title"]) == 200
    assert len(idea["description"]) == 5000
    assert len(idea["target_audience"]) == 500
    assert len(idea["content_format"]) == 100
    assert len(idea["tags"]) == 20
    assert all(len(tag) == 50 for tag in idea["tags"])


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("title", ""),
        ("title", " " * 3),
        ("title", "a" * 201),
        ("description", "a" * 5001),
        ("target_audience", "a" * 501),
        ("content_format", "a" * 101),
    ],
)
def test_text_validation(client: TestClient, field: str, value: str) -> None:
    payload = {"title": "Valid", "platform": "youtube", field: value}
    assert client.post("/api/content-ideas", json=payload).status_code == 422


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("platform", "podcast"),
        ("status", "draft"),
        ("priority", "urgent"),
    ],
)
def test_enum_validation(client: TestClient, field: str, value: str) -> None:
    payload = {"title": "Valid", "platform": "youtube", field: value}
    assert client.post("/api/content-ideas", json=payload).status_code == 422


def test_tag_limits_and_type_validation(client: TestClient) -> None:
    base = {"title": "Valid", "platform": "youtube"}

    assert client.post(
        "/api/content-ideas",
        json={**base, "tags": [f"tag-{index}" for index in range(21)]},
    ).status_code == 422
    assert client.post(
        "/api/content-ideas",
        json={**base, "tags": ["a" * 51]},
    ).status_code == 422
    assert client.post(
        "/api/content-ideas",
        json={**base, "tags": "not-a-list"},
    ).status_code == 422


def test_list_filters_search_and_default_order(
    client: TestClient,
    test_engine: Engine,
) -> None:
    first = create_idea(
        client,
        "Camera basics",
        platform="blog",
        status="researching",
        priority="low",
        description="Lighting notes",
    )
    second = create_idea(
        client,
        "KOREAN editing",
        status="ready",
        priority="high",
        description="자막 workflow",
    )
    with Session(test_engine) as session:
        first_row = session.get(ContentIdea, first["id"])
        assert first_row is not None
        first_row.created_at = utc_now() - timedelta(days=1)
        session.add(first_row)
        session.commit()

    all_ideas = client.get("/api/content-ideas").json()
    assert [idea["id"] for idea in all_ideas] == [second["id"], first["id"]]
    assert [idea["id"] for idea in client.get(
        "/api/content-ideas", params={"status": "ready"}
    ).json()] == [second["id"]]
    assert [idea["id"] for idea in client.get(
        "/api/content-ideas", params={"platform": "blog"}
    ).json()] == [first["id"]]
    assert [idea["id"] for idea in client.get(
        "/api/content-ideas", params={"priority": "high"}
    ).json()] == [second["id"]]
    assert [idea["id"] for idea in client.get(
        "/api/content-ideas", params={"source": "manual"}
    ).json()] == [second["id"], first["id"]]
    assert [idea["id"] for idea in client.get(
        "/api/content-ideas", params={"search": "korean"}
    ).json()] == [second["id"]]
    assert [idea["id"] for idea in client.get(
        "/api/content-ideas", params={"search": "자막"}
    ).json()] == [second["id"]]
    assert len(client.get(
        "/api/content-ideas", params={"search": "   "}
    ).json()) == 2


def test_search_treats_sql_wildcards_as_text(client: TestClient) -> None:
    percent = create_idea(client, "Growth 100%")
    create_idea(client, "Growth 100x")

    result = client.get(
        "/api/content-ideas",
        params={"search": "100%"},
    ).json()
    assert [idea["id"] for idea in result] == [percent["id"]]


def test_get_and_partial_update(client: TestClient) -> None:
    created = create_idea(
        client,
        tags=["original"],
        description="Original",
        target_audience="Editors",
    )

    assert client.get(
        f"/api/content-ideas/{created['id']}"
    ).json() == created

    response = client.patch(
        f"/api/content-ideas/{created['id']}",
        json={
            "title": "  Revised  ",
            "status": "ready",
            "priority": "high",
            "tags": ["New", "new", " 한글 "],
            "description": "   ",
            "target_audience": None,
        },
    )

    assert response.status_code == 200
    updated = response.json()
    assert updated["title"] == "Revised"
    assert updated["status"] == "ready"
    assert updated["priority"] == "high"
    assert updated["tags"] == ["New", "한글"]
    assert updated["description"] is None
    assert updated["target_audience"] is None
    assert updated["platform"] == "youtube"
    assert updated["updated_at"] > created["updated_at"]

    cleared = client.patch(
        f"/api/content-ideas/{created['id']}",
        json={"tags": None},
    )
    assert cleared.status_code == 200
    assert cleared.json()["tags"] == []


def test_invalid_and_server_managed_fields_are_rejected(
    client: TestClient,
) -> None:
    created = create_idea(client)
    assert client.patch(
        f"/api/content-ideas/{created['id']}", json={}
    ).status_code == 400

    for field in ("title", "platform", "status", "priority"):
        assert client.patch(
            f"/api/content-ideas/{created['id']}",
            json={field: None},
        ).status_code == 422

    managed = {
        "source": "ai",
        "user_id": 99,
        "converted_project_id": 99,
        "created_at": "2026-01-01T00:00:00Z",
    }
    assert client.post(
        "/api/content-ideas",
        json={"title": "Injected", "platform": "youtube", **managed},
    ).status_code == 422
    assert client.patch(
        f"/api/content-ideas/{created['id']}",
        json={"source": "ai"},
    ).status_code == 422


def test_missing_and_other_users_ideas_are_hidden(
    client: TestClient,
    test_engine: Engine,
) -> None:
    assert client.get("/api/content-ideas").status_code == 200
    with Session(test_engine) as session:
        other_user = User(email="idea-owner@editflow.local")
        session.add(other_user)
        session.commit()
        session.refresh(other_user)
        assert other_user.id is not None
        private_idea = ContentIdea(
            user_id=other_user.id,
            title="Private idea",
            platform="youtube",
        )
        session.add(private_idea)
        session.commit()
        session.refresh(private_idea)
        assert private_idea.id is not None
        private_id = private_idea.id

    assert client.get("/api/content-ideas").json() == []
    assert client.get(f"/api/content-ideas/{private_id}").status_code == 404
    assert client.patch(
        f"/api/content-ideas/{private_id}",
        json={"title": "Take over"},
    ).status_code == 404
    assert client.delete(f"/api/content-ideas/{private_id}").status_code == 404
    assert client.get("/api/content-ideas/999999").status_code == 404


def test_source_filter_supports_future_ai_rows(
    client: TestClient,
    test_engine: Engine,
) -> None:
    manual = create_idea(client)
    with Session(test_engine) as session:
        user = session.exec(select(User).where(User.id == manual["user_id"])).one()
        ai_idea = ContentIdea(
            user_id=user.id,
            title="Generated idea",
            platform="shorts",
            source=ContentIdeaSource.AI,
        )
        session.add(ai_idea)
        session.commit()
        session.refresh(ai_idea)
        assert ai_idea.id is not None
        ai_id = ai_idea.id

    result = client.get(
        "/api/content-ideas",
        params={"source": "ai"},
    ).json()
    assert [idea["id"] for idea in result] == [ai_id]


def test_delete_content_idea(client: TestClient) -> None:
    created = create_idea(client)

    response = client.delete(f"/api/content-ideas/{created['id']}")

    assert response.status_code == 204
    assert response.content == b""
    assert client.get(f"/api/content-ideas/{created['id']}").status_code == 404


def test_project_deletion_only_clears_conversion_link(
    client: TestClient,
    test_engine: Engine,
) -> None:
    project_response = client.post(
        "/api/projects",
        json={"title": "Converted project"},
    )
    assert project_response.status_code == 201
    project = project_response.json()
    idea = create_idea(client)
    with Session(test_engine) as session:
        idea_row = session.get(ContentIdea, idea["id"])
        assert idea_row is not None
        idea_row.converted_project_id = project["id"]
        session.add(idea_row)
        session.commit()

    assert client.delete(f"/api/projects/{project['id']}").status_code == 204

    response = client.get(f"/api/content-ideas/{idea['id']}")
    assert response.status_code == 200
    assert response.json()["converted_project_id"] is None


def test_openapi_exposes_content_idea_crud_and_filters(
    client: TestClient,
) -> None:
    schema = client.get("/openapi.json").json()
    collection = schema["paths"]["/api/content-ideas"]
    detail = schema["paths"]["/api/content-ideas/{idea_id}"]

    assert set(collection) >= {"get", "post"}
    assert set(detail) >= {"get", "patch", "delete"}
    assert collection["get"]["tags"] == ["Content Ideas"]
    parameter_names = {
        parameter["name"] for parameter in collection["get"]["parameters"]
    }
    assert parameter_names == {
        "status",
        "platform",
        "priority",
        "source",
        "search",
    }
