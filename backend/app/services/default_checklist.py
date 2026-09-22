import json
from pathlib import Path
from typing import Any

from sqlmodel import Session

from app.models.checklist_item import ChecklistItem


def _load_default_checklist_template() -> tuple[dict[str, Any], ...]:
    template_path = Path(__file__).resolve().parents[3] / "shared" / "default-checklist.json"
    with template_path.open(encoding="utf-8") as template_file:
        return tuple(json.load(template_file))


DEFAULT_CHECKLIST_TEMPLATE = _load_default_checklist_template()


def add_default_checklist_items(
    session: Session,
    project_id: int,
) -> list[ChecklistItem]:
    items = [
        ChecklistItem(
            project_id=project_id,
            title=template_item["text"],
            description=None,
            is_completed=template_item["done"],
            position=position,
        )
        for position, template_item in enumerate(DEFAULT_CHECKLIST_TEMPLATE)
    ]
    session.add_all(items)
    return items
