from concurrent.futures import ThreadPoolExecutor
from threading import Barrier, local

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.engine import Engine
from sqlmodel import Session, select

from app.models.checklist_item import ChecklistItem
from app.models.project import Project
from app.models.project_memo import ProjectMemo
from app.main import app
from app.schemas.project import LocalProjectImport
from app.services import projects as project_service


def import_payload(source_local_id: str = "local-project-1") -> dict:
    return {
        "source_local_id": source_local_id,
        "title": "Imported legacy project",
        "description": "Preserve this local source",
        "client_name": "Legacy client",
        "status": "in_progress",
        "due_date": "2026-10-20",
        "checklist_items": [
            {
                "title": "First local task",
                "description": None,
                "is_completed": True,
                "position": 0,
            },
            {
                "title": "Second local task",
                "description": "Keep the order",
                "is_completed": False,
                "position": 1,
            },
        ],
        "memos": [
            {"content": "First local memo", "position": 0},
            {"content": "Second local memo", "position": 1},
        ],
    }


def test_import_local_project_creates_owned_project_and_children_atomically(
    client: TestClient,
    test_engine: Engine,
) -> None:
    response = client.post("/api/projects/import-local", json=import_payload())

    assert response.status_code == 201
    project = response.json()
    current_user = client.get("/api/auth/me").json()
    assert project["user_id"] == current_user["id"]
    assert project["title"] == "Imported legacy project"
    assert project["checklist_total"] == 2
    assert project["checklist_completed"] == 1
    assert project["reference_count"] == 0
    assert project["broll_count"] == 0

    checklist = client.get(
        f"/api/projects/{project['id']}/checklist-items"
    ).json()
    memos = client.get(f"/api/projects/{project['id']}/memos").json()
    assert [item["title"] for item in checklist] == [
        "First local task",
        "Second local task",
    ]
    assert [item["position"] for item in checklist] == [0, 1]
    assert [memo["content"] for memo in memos] == [
        "First local memo",
        "Second local memo",
    ]

    with Session(test_engine) as session:
        stored = session.get(Project, project["id"])
        assert stored is not None
        assert stored.source_local_id == "local-project-1"


def test_import_retry_returns_existing_project_without_duplicate_children(
    client: TestClient,
    test_engine: Engine,
) -> None:
    first = client.post("/api/projects/import-local", json=import_payload())
    retry_payload = import_payload()
    retry_payload["title"] = "Changed after response loss"
    retry_payload["checklist_items"].append(
        {
            "title": "Must not duplicate",
            "is_completed": False,
            "position": 2,
        }
    )

    retry = client.post("/api/projects/import-local", json=retry_payload)

    assert first.status_code == 201
    assert retry.status_code == 200
    assert retry.json()["id"] == first.json()["id"]
    assert retry.json()["title"] == "Imported legacy project"
    assert retry.json()["checklist_total"] == 2
    with Session(test_engine) as session:
        assert len(session.exec(select(Project)).all()) == 1
        assert len(session.exec(select(ChecklistItem)).all()) == 2
        assert len(session.exec(select(ProjectMemo)).all()) == 2


def test_deleted_import_can_be_explicitly_imported_again(
    client: TestClient,
) -> None:
    first = client.post("/api/projects/import-local", json=import_payload())

    assert first.status_code == 201
    first_project_id = first.json()["id"]
    assert client.delete(f"/api/projects/{first_project_id}").status_code == 204

    reimport_payload = import_payload()
    reimport_payload["title"] = "Imported after deletion"
    imported_again = client.post(
        "/api/projects/import-local",
        json=reimport_payload,
    )

    assert imported_again.status_code == 201
    assert imported_again.json()["title"] == "Imported after deletion"
    assert imported_again.json()["checklist_total"] == 2
    assert len(client.get("/api/projects").json()) == 1


def test_source_local_id_is_scoped_to_current_user(
    client: TestClient,
    authenticated_client_factory,
) -> None:
    other_client = authenticated_client_factory("other-import@example.com")

    first = client.post("/api/projects/import-local", json=import_payload())
    second = other_client.post(
        "/api/projects/import-local",
        json=import_payload(),
    )

    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["id"] != second.json()["id"]
    assert [item["id"] for item in client.get("/api/projects").json()] == [
        first.json()["id"]
    ]
    assert [
        item["id"] for item in other_client.get("/api/projects").json()
    ] == [second.json()["id"]]


def test_concurrent_import_recovers_the_unique_project(
    client: TestClient,
    test_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user_id = client.get("/api/auth/me").json()["id"]
    import_data = LocalProjectImport.model_validate(import_payload("concurrent"))
    barrier = Barrier(2)
    thread_state = local()
    original_lookup = project_service.get_project_by_source_local_id

    def synchronized_first_lookup(session, target_user_id, source_local_id):
        result = original_lookup(session, target_user_id, source_local_id)
        if not getattr(thread_state, "synchronized", False):
            thread_state.synchronized = True
            barrier.wait(timeout=5)
        return result

    monkeypatch.setattr(
        project_service,
        "get_project_by_source_local_id",
        synchronized_first_lookup,
    )

    def run_import():
        with Session(test_engine) as session:
            return project_service.import_local_project(
                session,
                user_id,
                import_data,
            )

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: run_import(), range(2)))

    assert {project.id for project, _ in results} == {results[0][0].id}
    assert sorted(created for _, created in results) == [False, True]
    with Session(test_engine) as session:
        projects = session.exec(
            select(Project).where(Project.source_local_id == "concurrent")
        ).all()
        assert len(projects) == 1
        project_id = projects[0].id
        assert len(
            session.exec(
                select(ChecklistItem).where(
                    ChecklistItem.project_id == project_id
                )
            ).all()
        ) == 2


def test_import_child_failure_rolls_back_every_row(
    client: TestClient,
    test_engine: Engine,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fail_after_checklist(*_args, **_kwargs):
        raise RuntimeError("forced memo import failure")

    monkeypatch.setattr(project_service, "_add_import_memos", fail_after_checklist)

    with pytest.raises(RuntimeError, match="forced memo import failure"):
        client.post("/api/projects/import-local", json=import_payload("rollback"))

    with Session(test_engine) as session:
        assert session.exec(select(Project)).all() == []
        assert session.exec(select(ChecklistItem)).all() == []
        assert session.exec(select(ProjectMemo)).all() == []


@pytest.mark.parametrize(
    "changes",
    [
        {"source_local_id": ""},
        {"source_local_id": "x" * 201},
        {"title": ""},
        {"due_date": "not-a-date"},
        {"checklist_items": [{"title": "", "position": 0}]},
        {"memos": [{"content": "x" * 5001, "position": 0}]},
        {"backendProjectId": 999},
        {"references": [{"id": "legacy-reference"}]},
        {"brolls": [{"id": "legacy-broll"}]},
    ],
)
def test_invalid_or_foreign_import_fields_write_nothing(
    client: TestClient,
    test_engine: Engine,
    changes: dict,
) -> None:
    payload = {**import_payload("invalid"), **changes}

    response = client.post("/api/projects/import-local", json=payload)

    assert response.status_code == 422
    with Session(test_engine) as session:
        assert session.exec(select(Project)).all() == []


def test_import_requires_authentication_and_csrf(
    client: TestClient,
) -> None:
    with TestClient(app) as unauthenticated_client:
        assert unauthenticated_client.get("/api/auth/csrf").status_code == 204
        csrf_token = unauthenticated_client.cookies.get("editflow_csrf")
        assert unauthenticated_client.post(
            "/api/projects/import-local",
            json=import_payload(),
            headers={
                "Origin": "http://127.0.0.1:5173",
                "X-CSRF-Token": csrf_token,
            },
        ).status_code == 401
    assert TestClient.request(
        client,
        "POST",
        "/api/projects/import-local",
        json=import_payload(),
        headers={"Origin": "http://127.0.0.1:5173"},
    ).status_code == 403
