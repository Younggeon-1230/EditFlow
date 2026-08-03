import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlmodel import Session, select

from app.models.content_idea import ContentIdea, ContentIdeaStatus
from app.models.content_idea_broll import ContentIdeaBroll
from app.models.content_idea_reference import ContentIdeaReference
from app.models.project import Project
from app.models.saved_broll import SavedBroll
from app.models.saved_reference import SavedReference
from app.models.user import User
from app.schemas.content_idea import ContentIdeaConversionCreate
from app.services.content_ideas import convert_content_idea_to_project


def create_idea(client: TestClient, title: str = "Media idea", status: str = "idea") -> dict:
    response = client.post(
        "/api/content-ideas",
        json={"title": title, "platform": "youtube", "status": status},
    )
    assert response.status_code == 201
    return response.json()


def reference_payload(external_id: str = "video-1") -> dict:
    return {
        "external_id": external_id,
        "title": f"Reference {external_id}",
        "url": f"https://youtube.com/watch?v={external_id}",
        "thumbnail_url": f"https://img.youtube.com/{external_id}.jpg",
        "channel_title": "Channel",
        "published_at": "2026-08-01T12:00:00Z",
        "note": "Reference note",
    }


def broll_payload(external_id: str = "pexels-1") -> dict:
    return {
        "external_id": external_id,
        "title": f"B-roll {external_id}",
        "url": f"https://pexels.com/video/{external_id}/",
        "preview_url": f"https://videos.pexels.com/{external_id}.mp4",
        "thumbnail_url": f"https://images.pexels.com/{external_id}.jpg",
        "creator_name": "Creator",
        "duration_seconds": 12,
        "width": 1920,
        "height": 1080,
        "note": "B-roll note",
    }


def save_reference(client: TestClient, idea_id: int, external_id: str = "video-1") -> dict:
    response = client.post(
        f"/api/content-ideas/{idea_id}/references",
        json=reference_payload(external_id),
    )
    assert response.status_code == 201, response.text
    return response.json()


def save_broll(client: TestClient, idea_id: int, external_id: str = "pexels-1") -> dict:
    response = client.post(
        f"/api/content-ideas/{idea_id}/brolls",
        json=broll_payload(external_id),
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_reference_crud_sorting_and_note_policy(client: TestClient) -> None:
    idea = create_idea(client)
    assert client.get(f"/api/content-ideas/{idea['id']}/references").json() == []
    first = save_reference(client, idea["id"], "first")
    second = save_reference(client, idea["id"], "second")
    listed = client.get(f"/api/content-ideas/{idea['id']}/references").json()
    assert [item["id"] for item in listed] == [second["id"], first["id"]]
    assert first["provider"] == "youtube"
    assert first["content_idea_id"] == idea["id"]
    assert first["note"] == "Reference note"

    updated = client.patch(
        f"/api/content-idea-references/{first['id']}",
        json={"note": "  Updated  "},
    )
    assert updated.status_code == 200
    assert updated.json()["note"] == "Updated"
    cleared = client.patch(
        f"/api/content-idea-references/{first['id']}",
        json={"note": "   "},
    )
    assert cleared.json()["note"] is None
    assert client.patch(f"/api/content-idea-references/{first['id']}", json={}).status_code == 400
    assert client.patch(
        f"/api/content-idea-references/{first['id']}",
        json={"title": "Injected"},
    ).status_code == 422
    assert client.delete(f"/api/content-idea-references/{first['id']}").status_code == 204
    assert client.delete(f"/api/content-idea-references/{first['id']}").status_code == 404


def test_broll_crud_sorting_and_note_policy(client: TestClient) -> None:
    idea = create_idea(client)
    assert client.get(f"/api/content-ideas/{idea['id']}/brolls").json() == []
    first = save_broll(client, idea["id"], "first")
    second = save_broll(client, idea["id"], "second")
    listed = client.get(f"/api/content-ideas/{idea['id']}/brolls").json()
    assert [item["id"] for item in listed] == [second["id"], first["id"]]
    assert first["provider"] == "pexels"
    assert first["duration_seconds"] == 12
    assert first["width"] == 1920
    assert first["height"] == 1080
    updated = client.patch(
        f"/api/content-idea-brolls/{first['id']}",
        json={"note": "   "},
    )
    assert updated.status_code == 200
    assert updated.json()["note"] is None
    assert client.patch(f"/api/content-idea-brolls/{first['id']}", json={}).status_code == 400
    assert client.patch(
        f"/api/content-idea-brolls/{first['id']}",
        json={"width": 4},
    ).status_code == 422
    assert client.delete(f"/api/content-idea-brolls/{first['id']}").status_code == 204
    assert client.get(f"/api/content-ideas/{idea['id']}/brolls").json() == [second]


@pytest.mark.parametrize("resource", ["references", "brolls"])
def test_duplicate_is_scoped_to_content_idea(client: TestClient, resource: str) -> None:
    first = create_idea(client, "First")
    second = create_idea(client, "Second")
    payload = reference_payload("same") if resource == "references" else broll_payload("same")
    assert client.post(f"/api/content-ideas/{first['id']}/{resource}", json=payload).status_code == 201
    duplicate = client.post(f"/api/content-ideas/{first['id']}/{resource}", json=payload)
    assert duplicate.status_code == 409
    assert client.post(f"/api/content-ideas/{second['id']}/{resource}", json=payload).status_code == 201


@pytest.mark.parametrize("status", ["converted", "archived"])
def test_media_crud_is_allowed_for_every_idea_status(client: TestClient, status: str) -> None:
    idea = create_idea(client, status=status)
    reference = save_reference(client, idea["id"])
    broll = save_broll(client, idea["id"])
    assert client.patch(
        f"/api/content-idea-references/{reference['id']}", json={"note": "ok"}
    ).status_code == 200
    assert client.delete(f"/api/content-idea-brolls/{broll['id']}").status_code == 204


def test_missing_and_other_user_ownership_returns_404(
    client: TestClient,
    test_engine: Engine,
) -> None:
    assert client.get("/api/content-ideas/999999/references").status_code == 404
    assert client.post("/api/content-ideas/999999/brolls", json=broll_payload()).status_code == 404
    with Session(test_engine) as session:
        other = User(email="media-owner@editflow.local")
        session.add(other)
        session.commit()
        session.refresh(other)
        idea = ContentIdea(user_id=other.id, title="Private", platform="youtube")
        session.add(idea)
        session.commit()
        session.refresh(idea)
        reference = ContentIdeaReference(
            content_idea_id=idea.id,
            external_id="private-ref",
            title="Private",
            url="https://youtube.com/private",
        )
        broll = ContentIdeaBroll(
            content_idea_id=idea.id,
            external_id="private-broll",
            url="https://pexels.com/private",
        )
        session.add(reference)
        session.add(broll)
        session.commit()
        session.refresh(reference)
        session.refresh(broll)
        ids = idea.id, reference.id, broll.id

    idea_id, reference_id, broll_id = ids
    assert client.get(f"/api/content-ideas/{idea_id}/references").status_code == 404
    assert client.patch(f"/api/content-idea-references/{reference_id}", json={"note": "x"}).status_code == 404
    assert client.delete(f"/api/content-idea-brolls/{broll_id}").status_code == 404


@pytest.mark.parametrize(
    ("resource", "payload"),
    [
        ("references", {"external_id": "x", "title": "x", "url": "invalid"}),
        ("references", {**reference_payload(), "note": "x" * 5001}),
        ("brolls", {**broll_payload(), "duration_seconds": -1}),
        ("brolls", {**broll_payload(), "width": -1}),
        ("brolls", {**broll_payload(), "content_idea_id": 2}),
    ],
)
def test_media_validation(client: TestClient, resource: str, payload: dict) -> None:
    idea = create_idea(client)
    assert client.post(f"/api/content-ideas/{idea['id']}/{resource}", json=payload).status_code == 422


def test_deleting_idea_deletes_only_its_media(
    client: TestClient,
    test_engine: Engine,
) -> None:
    deleted = create_idea(client, "Deleted")
    retained = create_idea(client, "Retained")
    deleted_reference = save_reference(client, deleted["id"], "deleted")
    deleted_broll = save_broll(client, deleted["id"], "deleted")
    retained_reference = save_reference(client, retained["id"], "retained")
    retained_broll = save_broll(client, retained["id"], "retained")

    assert client.delete(f"/api/content-ideas/{deleted['id']}").status_code == 204
    with Session(test_engine) as session:
        assert session.get(ContentIdeaReference, deleted_reference["id"]) is None
        assert session.get(ContentIdeaBroll, deleted_broll["id"]) is None
        assert session.get(ContentIdeaReference, retained_reference["id"]) is not None
        assert session.get(ContentIdeaBroll, retained_broll["id"]) is not None


def test_conversion_copies_media_and_preserves_originals(
    client: TestClient,
    test_engine: Engine,
) -> None:
    idea = create_idea(client)
    references = [save_reference(client, idea["id"], f"video-{i}") for i in range(2)]
    brolls = [save_broll(client, idea["id"], f"pexels-{i}") for i in range(2)]

    response = client.post(
        f"/api/content-ideas/{idea['id']}/convert-to-project",
        json={"title": "Converted with media"},
    )
    assert response.status_code == 201, response.text
    project = response.json()["project"]
    assert project["reference_count"] == 2
    assert project["broll_count"] == 2
    assert project["checklist_total"] == 0

    with Session(test_engine) as session:
        saved_references = list(
            session.exec(select(SavedReference).where(SavedReference.project_id == project["id"])).all()
        )
        saved_brolls = list(
            session.exec(select(SavedBroll).where(SavedBroll.project_id == project["id"])).all()
        )
        assert {item.external_id for item in saved_references} == {item["external_id"] for item in references}
        assert {item.note for item in saved_references} == {"Reference note"}
        assert {item.external_id for item in saved_brolls} == {item["external_id"] for item in brolls}
        assert {item.preview_url for item in saved_brolls} == {item["preview_url"] for item in brolls}
        assert len(session.exec(select(ContentIdeaReference)).all()) == 2
        assert len(session.exec(select(ContentIdeaBroll)).all()) == 2


def test_project_delete_preserves_media_and_reconversion_copies_again(client: TestClient) -> None:
    idea = create_idea(client)
    save_reference(client, idea["id"])
    save_broll(client, idea["id"])
    first = client.post(
        f"/api/content-ideas/{idea['id']}/convert-to-project",
        json={"title": "First conversion"},
    ).json()
    assert client.delete(f"/api/projects/{first['project']['id']}").status_code == 204
    restored = client.get(f"/api/content-ideas/{idea['id']}").json()
    assert restored["status"] == "ready"
    assert len(client.get(f"/api/content-ideas/{idea['id']}/references").json()) == 1
    assert len(client.get(f"/api/content-ideas/{idea['id']}/brolls").json()) == 1
    second = client.post(
        f"/api/content-ideas/{idea['id']}/convert-to-project",
        json={"title": "Second conversion"},
    )
    assert second.status_code == 201
    assert second.json()["project"]["reference_count"] == 1
    assert second.json()["project"]["broll_count"] == 1
    assert client.post(
        f"/api/content-ideas/{idea['id']}/convert-to-project",
        json={"title": "Duplicate"},
    ).status_code == 409


def test_copy_failure_rolls_back_project_and_conversion(
    client: TestClient,
    test_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    idea = create_idea(client)
    save_reference(client, idea["id"])
    with Session(test_engine) as session:
        original_add = session.add

        def fail_saved_reference(instance: object) -> None:
            if isinstance(instance, SavedReference):
                raise RuntimeError("forced copy failure")
            original_add(instance)

        monkeypatch.setattr(session, "add", fail_saved_reference)
        with pytest.raises(RuntimeError, match="forced copy failure"):
            convert_content_idea_to_project(
                session,
                idea["user_id"],
                idea["id"],
                ContentIdeaConversionCreate(title="Rollback conversion"),
            )

    with Session(test_engine) as session:
        row = session.get(ContentIdea, idea["id"])
        assert row is not None
        assert row.status == ContentIdeaStatus.IDEA
        assert row.converted_project_id is None
        assert session.exec(select(Project).where(Project.title == "Rollback conversion")).one_or_none() is None


def test_openapi_exposes_media_crud_and_conflicts(client: TestClient) -> None:
    schema = client.get("/openapi.json").json()
    for path in (
        "/api/content-ideas/{idea_id}/references",
        "/api/content-ideas/{idea_id}/brolls",
    ):
        assert set(schema["paths"][path]) >= {"get", "post"}
        assert "409" in schema["paths"][path]["post"]["responses"]
    assert set(schema["paths"]["/api/content-idea-references/{reference_id}"]) >= {"patch", "delete"}
    assert set(schema["paths"]["/api/content-idea-brolls/{broll_id}"]) >= {"patch", "delete"}
