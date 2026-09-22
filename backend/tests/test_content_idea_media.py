import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlmodel import Session, select

from app.models.checklist_item import ChecklistItem
from app.models.content_idea import ContentIdea, ContentIdeaStatus
from app.models.content_idea_broll import ContentIdeaBroll
from app.models.content_idea_reference import ContentIdeaReference
from app.models.project import Project
from app.models.project_memo import ProjectMemo
from app.models.saved_broll import SavedBroll
from app.models.saved_reference import SavedReference
from app.models.user import User
from app.schemas.content_idea import ContentIdeaConversionCreate
from app.services import content_ideas as content_idea_service
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


def seed_conversion_media(
    client: TestClient,
    idea_id: int,
) -> tuple[list[dict], list[dict]]:
    references = [
        save_reference(client, idea_id, f"selected-video-{index}")
        for index in range(3)
    ]
    brolls = [
        save_broll(client, idea_id, f"selected-pexels-{index}")
        for index in range(3)
    ]
    return references, brolls


def convert_with_selection(
    client: TestClient,
    idea_id: int,
    **selection: object,
):
    return client.post(
        f"/api/content-ideas/{idea_id}/convert-to-project",
        json={"title": "Selective conversion", **selection},
    )


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


def test_explicit_null_selection_keeps_legacy_copy_all_behavior(
    client: TestClient,
) -> None:
    idea = create_idea(client)
    seed_conversion_media(client, idea["id"])

    response = convert_with_selection(
        client,
        idea["id"],
        selected_reference_ids=None,
        selected_broll_ids=None,
    )

    assert response.status_code == 201
    assert response.json()["project"]["reference_count"] == 3
    assert response.json()["project"]["broll_count"] == 3


@pytest.mark.parametrize(
    ("reference_indexes", "broll_indexes"),
    [
        ([0], [0, 1, 2]),
        ([0, 1, 2], [1]),
        ([0, 2], [1, 2]),
        ([], [0, 1, 2]),
        ([0, 1, 2], []),
        ([], []),
        ([0, 1, 2], [0, 1, 2]),
    ],
)
def test_explicit_media_selection_copies_exact_subset(
    client: TestClient,
    test_engine: Engine,
    reference_indexes: list[int],
    broll_indexes: list[int],
) -> None:
    idea = create_idea(client)
    references, brolls = seed_conversion_media(client, idea["id"])
    selected_references = [references[index] for index in reference_indexes]
    selected_brolls = [brolls[index] for index in broll_indexes]

    response = convert_with_selection(
        client,
        idea["id"],
        selected_reference_ids=[item["id"] for item in selected_references],
        selected_broll_ids=[item["id"] for item in selected_brolls],
    )

    assert response.status_code == 201, response.text
    project = response.json()["project"]
    assert project["reference_count"] == len(selected_references)
    assert project["broll_count"] == len(selected_brolls)
    with Session(test_engine) as session:
        copied_references = session.exec(
            select(SavedReference).where(SavedReference.project_id == project["id"])
        ).all()
        copied_brolls = session.exec(
            select(SavedBroll).where(SavedBroll.project_id == project["id"])
        ).all()
        assert {item.external_id for item in copied_references} == {
            item["external_id"] for item in selected_references
        }
        assert {item.external_id for item in copied_brolls} == {
            item["external_id"] for item in selected_brolls
        }
        assert len(session.exec(select(ContentIdeaReference)).all()) == 3
        assert len(session.exec(select(ContentIdeaBroll)).all()) == 3


@pytest.mark.parametrize(
    "payload",
    [
        {"selected_reference_ids": [0]},
        {"selected_reference_ids": [-1]},
        {"selected_reference_ids": ["1"]},
        {"selected_broll_ids": [True]},
        {"selected_broll_ids": [1, 1]},
    ],
)
def test_invalid_or_duplicate_selection_ids_are_rejected(
    client: TestClient,
    payload: dict,
) -> None:
    idea = create_idea(client)

    response = convert_with_selection(client, idea["id"], **payload)

    assert response.status_code == 422
    refreshed = client.get(f"/api/content-ideas/{idea['id']}").json()
    assert refreshed["status"] == "idea"
    assert refreshed["converted_project_id"] is None


def test_missing_other_idea_and_wrong_type_media_ids_reject_entire_request(
    client: TestClient,
) -> None:
    target = create_idea(client, "Target")
    other = create_idea(client, "Other")
    other_reference = save_reference(client, other["id"], "other-reference")
    other_broll = save_broll(client, other["id"], "other-broll")
    target_broll = save_broll(client, target["id"], "target-broll")

    for selection in (
        {"selected_reference_ids": [999999]},
        {"selected_broll_ids": [999999]},
        {"selected_reference_ids": [other_reference["id"]]},
        {"selected_broll_ids": [other_broll["id"]]},
        {"selected_reference_ids": [target_broll["id"]]},
    ):
        response = convert_with_selection(client, target["id"], **selection)
        assert response.status_code == 422
        assert "새로고침" in response.json()["detail"]

    refreshed = client.get(f"/api/content-ideas/{target['id']}").json()
    assert refreshed["status"] == "idea"
    assert refreshed["converted_project_id"] is None


def test_other_users_media_ids_are_rejected(
    client: TestClient,
    test_engine: Engine,
) -> None:
    target = create_idea(client)
    with Session(test_engine) as session:
        other_user = User(email="selection-owner@editflow.local")
        session.add(other_user)
        session.commit()
        session.refresh(other_user)
        other_idea = ContentIdea(
            user_id=other_user.id,
            title="Private selection",
            platform="youtube",
        )
        session.add(other_idea)
        session.commit()
        session.refresh(other_idea)
        private_reference = ContentIdeaReference(
            content_idea_id=other_idea.id,
            external_id="private-selection-reference",
            title="Private",
            url="https://youtube.com/private-selection",
        )
        private_broll = ContentIdeaBroll(
            content_idea_id=other_idea.id,
            external_id="private-selection-broll",
            url="https://pexels.com/private-selection",
        )
        session.add(private_reference)
        session.add(private_broll)
        session.commit()
        session.refresh(private_reference)
        session.refresh(private_broll)
        private_reference_id = private_reference.id
        private_broll_id = private_broll.id

    assert convert_with_selection(
        client,
        target["id"],
        selected_reference_ids=[private_reference_id],
    ).status_code == 422
    assert convert_with_selection(
        client,
        target["id"],
        selected_broll_ids=[private_broll_id],
    ).status_code == 422


@pytest.mark.parametrize("failing_model", [SavedReference, SavedBroll])
def test_selected_media_copy_failure_rolls_back_every_conversion_child(
    client: TestClient,
    test_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
    failing_model: type,
) -> None:
    idea = create_idea(client)
    references, brolls = seed_conversion_media(client, idea["id"])
    with Session(test_engine) as session:
        original_add = session.add

        def fail_selected_copy(instance: object) -> None:
            if isinstance(instance, failing_model):
                raise RuntimeError("forced selected media copy failure")
            original_add(instance)

        monkeypatch.setattr(session, "add", fail_selected_copy)
        with pytest.raises(RuntimeError, match="forced selected media copy failure"):
            convert_content_idea_to_project(
                session,
                idea["user_id"],
                idea["id"],
                ContentIdeaConversionCreate(
                    title="Selected media rollback",
                    selected_reference_ids=[item["id"] for item in references[:2]],
                    selected_broll_ids=[item["id"] for item in brolls[:2]],
                    create_default_checklist=True,
                    initial_memo="Rollback memo",
                ),
            )

    with Session(test_engine) as verification:
        idea_row = verification.get(ContentIdea, idea["id"])
        assert idea_row is not None
        assert idea_row.status == ContentIdeaStatus.IDEA
        assert idea_row.converted_project_id is None
        assert verification.exec(
            select(Project).where(Project.title == "Selected media rollback")
        ).one_or_none() is None
        assert verification.exec(select(SavedReference)).all() == []
        assert verification.exec(select(SavedBroll)).all() == []


@pytest.mark.parametrize("failure_stage", ["checklist", "memo", "relation"])
def test_setup_failure_rolls_back_selected_media_and_entire_conversion(
    client: TestClient,
    test_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
    failure_stage: str,
) -> None:
    idea = create_idea(client)
    references, brolls = seed_conversion_media(client, idea["id"])

    if failure_stage == "checklist":
        def fail_checklist(*_args: object) -> None:
            raise RuntimeError("forced setup failure")

        monkeypatch.setattr(
            content_idea_service,
            "add_default_checklist_items",
            fail_checklist,
        )
    elif failure_stage == "memo":
        def fail_memo(*_args: object) -> None:
            raise RuntimeError("forced setup failure")

        monkeypatch.setattr(content_idea_service, "_add_initial_memo", fail_memo)
    else:
        original_link = content_idea_service._link_content_idea_to_project

        def fail_relation(
            session: Session,
            idea_row: ContentIdea,
            project_id: int,
        ) -> None:
            original_link(session, idea_row, project_id)
            session.flush()
            raise RuntimeError("forced setup failure")

        monkeypatch.setattr(
            content_idea_service,
            "_link_content_idea_to_project",
            fail_relation,
        )

    with Session(test_engine) as session:
        with pytest.raises(RuntimeError, match="forced setup failure"):
            convert_content_idea_to_project(
                session,
                idea["user_id"],
                idea["id"],
                ContentIdeaConversionCreate(
                    title="Full rollback",
                    selected_reference_ids=[references[0]["id"]],
                    selected_broll_ids=[brolls[0]["id"]],
                    create_default_checklist=True,
                    initial_memo="Rollback memo",
                ),
            )

    with Session(test_engine) as verification:
        idea_row = verification.get(ContentIdea, idea["id"])
        assert idea_row is not None
        assert idea_row.status == ContentIdeaStatus.IDEA
        assert idea_row.converted_project_id is None
        assert verification.exec(
            select(Project).where(Project.title == "Full rollback")
        ).one_or_none() is None
        assert verification.exec(select(SavedReference)).all() == []
        assert verification.exec(select(SavedBroll)).all() == []
        assert verification.exec(select(ChecklistItem)).all() == []
        assert verification.exec(select(ProjectMemo)).all() == []


@pytest.mark.parametrize(
    (
        "reference_selection",
        "broll_selection",
        "create_checklist",
        "initial_memo",
        "expected_counts",
    ),
    [
        ("all", "all", True, None, (2, 2, True, False)),
        ("subset", "subset", True, None, (1, 1, True, False)),
        ("subset", "subset", False, "Memo", (1, 1, False, True)),
        ("none", "none", True, "Memo", (0, 0, True, True)),
        ("none", "none", False, None, (0, 0, False, False)),
    ],
)
def test_media_selection_combines_with_phase_83_setup_options(
    client: TestClient,
    reference_selection: str,
    broll_selection: str,
    create_checklist: bool,
    initial_memo: str | None,
    expected_counts: tuple[int, int, bool, bool],
) -> None:
    idea = create_idea(client)
    references = [save_reference(client, idea["id"], f"combo-ref-{i}") for i in range(2)]
    brolls = [save_broll(client, idea["id"], f"combo-broll-{i}") for i in range(2)]

    def selected_ids(items: list[dict], selection: str) -> list[int] | None:
        if selection == "all":
            return None
        if selection == "subset":
            return [items[0]["id"]]
        return []

    response = convert_with_selection(
        client,
        idea["id"],
        selected_reference_ids=selected_ids(references, reference_selection),
        selected_broll_ids=selected_ids(brolls, broll_selection),
        create_default_checklist=create_checklist,
        initial_memo=initial_memo,
    )

    assert response.status_code == 201, response.text
    project = response.json()["project"]
    reference_count, broll_count, has_checklist, has_memo = expected_counts
    assert project["reference_count"] == reference_count
    assert project["broll_count"] == broll_count
    assert (project["checklist_total"] > 0) is has_checklist
    assert bool(client.get(f"/api/projects/{project['id']}/memos").json()) is has_memo


def test_project_media_is_independent_and_reconversion_uses_new_subset(
    client: TestClient,
) -> None:
    idea = create_idea(client)
    references, brolls = seed_conversion_media(client, idea["id"])
    first = convert_with_selection(
        client,
        idea["id"],
        selected_reference_ids=[references[0]["id"], references[1]["id"]],
        selected_broll_ids=[brolls[0]["id"]],
    ).json()
    first_project_id = first["project"]["id"]
    project_references = client.get(
        f"/api/projects/{first_project_id}/references"
    ).json()

    assert client.delete(
        f"/api/references/{project_references[0]['id']}"
    ).status_code == 204
    assert len(client.get(f"/api/content-ideas/{idea['id']}/references").json()) == 3
    assert client.delete(f"/api/projects/{first_project_id}").status_code == 204
    assert len(client.get(f"/api/content-ideas/{idea['id']}/references").json()) == 3
    assert len(client.get(f"/api/content-ideas/{idea['id']}/brolls").json()) == 3

    second = convert_with_selection(
        client,
        idea["id"],
        selected_reference_ids=[references[1]["id"], references[2]["id"]],
        selected_broll_ids=[brolls[1]["id"], brolls[2]["id"]],
    )
    assert second.status_code == 201
    second_project_id = second.json()["project"]["id"]
    assert {
        item["external_id"]
        for item in client.get(f"/api/projects/{second_project_id}/references").json()
    } == {references[1]["external_id"], references[2]["external_id"]}
    assert {
        item["external_id"]
        for item in client.get(f"/api/projects/{second_project_id}/brolls").json()
    } == {brolls[1]["external_id"], brolls[2]["external_id"]}


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
