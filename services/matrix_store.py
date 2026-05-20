"""Personnel Matrix store — Supabase (primary) with JSON file fallback."""
from __future__ import annotations

import json
import uuid
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

MATRIX_FILE = Path(__file__).resolve().parent.parent / "data" / "matrix_workbook.json"

try:
    from services.supabase_service import supabase_service

    SUPABASE_MATRIX = bool(supabase_service and supabase_service.enabled)
except ImportError:
    supabase_service = None
    SUPABASE_MATRIX = False


def _now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _load_json() -> Dict[str, Any]:
    if not MATRIX_FILE.exists():
        return {"version": 1, "updated_at": _now(), "sheets": []}
    with open(MATRIX_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_json(data: Dict[str, Any]) -> Dict[str, Any]:
    MATRIX_FILE.parent.mkdir(parents=True, exist_ok=True)
    data["updated_at"] = _now()
    with open(MATRIX_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return data


def _find_sheet_json(data: Dict[str, Any], sheet_id: str) -> Dict[str, Any]:
    for sheet in data.get("sheets", []):
        if sheet.get("id") == sheet_id:
            return sheet
    raise KeyError(f"Sheet not found: {sheet_id}")


def seed_workbook(workbook: Dict[str, Any]) -> None:
    """Seed from Excel import — Supabase if enabled; JSON when local/writable."""
    if SUPABASE_MATRIX and supabase_service:
        supabase_service.seed_matrix_workbook(workbook)
        try:
            _save_json(workbook)
        except OSError:
            pass  # Vercel / read-only FS — Supabase is source of truth
    else:
        _save_json(workbook)


def get_workbook() -> Dict[str, Any]:
    if SUPABASE_MATRIX and supabase_service:
        return supabase_service.get_matrix_workbook()
    return _load_json()


def get_sheet(sheet_id: str) -> Dict[str, Any]:
    if SUPABASE_MATRIX and supabase_service:
        return supabase_service.get_matrix_sheet(sheet_id)
    data = _load_json()
    return deepcopy(_find_sheet_json(data, sheet_id))


def add_row(sheet_id: str, cells: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    if SUPABASE_MATRIX and supabase_service:
        return supabase_service.add_matrix_row(sheet_id, cells)
    data = _load_json()
    sheet = _find_sheet_json(data, sheet_id)
    row_cells = {}
    for col in sheet.get("columns", []):
        cid = col["id"]
        row_cells[cid] = (cells or {}).get(cid, "")
    row = {"id": f"row_{uuid.uuid4().hex[:12]}", "cells": row_cells}
    sheet.setdefault("rows", []).append(row)
    _save_json(data)
    return row


def update_row(sheet_id: str, row_id: str, cells: Dict[str, str]) -> Dict[str, Any]:
    if SUPABASE_MATRIX and supabase_service:
        return supabase_service.update_matrix_row(sheet_id, row_id, cells)
    data = _load_json()
    sheet = _find_sheet_json(data, sheet_id)
    for row in sheet.get("rows", []):
        if row.get("id") == row_id:
            row.setdefault("cells", {}).update(cells)
            _save_json(data)
            return row
    raise KeyError(f"Row not found: {row_id}")


def delete_row(sheet_id: str, row_id: str) -> bool:
    if SUPABASE_MATRIX and supabase_service:
        return supabase_service.delete_matrix_row(sheet_id, row_id)
    data = _load_json()
    sheet = _find_sheet_json(data, sheet_id)
    before = len(sheet.get("rows", []))
    sheet["rows"] = [r for r in sheet.get("rows", []) if r.get("id") != row_id]
    if len(sheet["rows"]) == before:
        raise KeyError(f"Row not found: {row_id}")
    _save_json(data)
    return True


def add_column(
    sheet_id: str,
    label: str,
    col_type: str = "text",
    filterable: bool = True,
) -> Dict[str, Any]:
    if SUPABASE_MATRIX and supabase_service:
        return supabase_service.add_matrix_column(sheet_id, label, col_type, filterable)
    data = _load_json()
    sheet = _find_sheet_json(data, sheet_id)
    cols = sheet.setdefault("columns", [])
    max_idx = max((c.get("index", i + 1) for i, c in enumerate(cols)), default=0)
    new_index = max_idx + 1
    col_id = f"col_{new_index}"
    key_base = label.lower().replace("*", "").strip().replace(" ", "_")[:40]
    col = {
        "id": col_id,
        "key": f"{key_base}_{new_index}",
        "label": label,
        "type": col_type,
        "filterable": filterable,
        "required": "*" in label,
        "index": new_index,
    }
    cols.append(col)
    for row in sheet.get("rows", []):
        row.setdefault("cells", {})[col_id] = ""
    _save_json(data)
    return col


def update_column(sheet_id: str, col_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    if SUPABASE_MATRIX and supabase_service:
        return supabase_service.update_matrix_column(sheet_id, col_id, updates)
    data = _load_json()
    sheet = _find_sheet_json(data, sheet_id)
    for col in sheet.get("columns", []):
        if col.get("id") == col_id:
            if "label" in updates and updates["label"]:
                col["label"] = updates["label"]
                col["required"] = "*" in col["label"]
            if "type" in updates and updates["type"]:
                col["type"] = updates["type"]
            if "filterable" in updates:
                col["filterable"] = bool(updates["filterable"])
            _save_json(data)
            return col
    raise KeyError(f"Column not found: {col_id}")


def delete_column(sheet_id: str, col_id: str) -> bool:
    if SUPABASE_MATRIX and supabase_service:
        return supabase_service.delete_matrix_column(sheet_id, col_id)
    data = _load_json()
    sheet = _find_sheet_json(data, sheet_id)
    before = len(sheet.get("columns", []))
    sheet["columns"] = [c for c in sheet.get("columns", []) if c.get("id") != col_id]
    if len(sheet["columns"]) == before:
        raise KeyError(f"Column not found: {col_id}")
    for row in sheet.get("rows", []):
        row.get("cells", {}).pop(col_id, None)
    _save_json(data)
    return True


def log_reminder_sent(items: list) -> None:
    if SUPABASE_MATRIX and supabase_service:
        supabase_service.log_matrix_reminders_sent(items)


def filter_unsent_reminders(items: list) -> list:
    if SUPABASE_MATRIX and supabase_service:
        return supabase_service.filter_unsent_matrix_reminders(items)
    return items
