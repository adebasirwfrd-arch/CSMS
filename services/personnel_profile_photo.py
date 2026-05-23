"""Resolve personnel profile photo file id from Matrix workbook."""
from __future__ import annotations

import re
from typing import Any, Dict, Optional

PROFILE_SHEET_ID = "personnel_data_information"
_PHOTO_COL_ID = "col_photo"


def _find_personnel_name_col_id(sheet: Dict[str, Any]) -> Optional[str]:
    for col in sheet.get("columns", []):
        label = (col.get("label") or "").replace("*", "").strip().lower()
        if re.search(r"personnel\s*name", label, re.I):
            return col.get("id")
    return None


def _find_photo_col_id(sheet: Dict[str, Any]) -> Optional[str]:
    for col in sheet.get("columns", []):
        cid = col.get("id") or ""
        label = (col.get("label") or "").replace("*", "").strip().lower()
        if cid == _PHOTO_COL_ID or col.get("type") == "image" or "profile photo" in label:
            return cid
    return None


def get_profile_photo_file_id(personnel_name: str) -> str:
    """Return Google Drive file id for Matrix profile photo, or empty string."""
    key = (personnel_name or "").strip().lower()
    if not key:
        return ""
    try:
        from services.matrix_store import get_workbook

        workbook = get_workbook()
    except Exception:
        return ""

    for sheet in workbook.get("sheets", []):
        if sheet.get("id") != PROFILE_SHEET_ID:
            continue
        name_col = _find_personnel_name_col_id(sheet)
        photo_col = _find_photo_col_id(sheet)
        if not name_col or not photo_col:
            continue
        for row in sheet.get("rows", []):
            cells = row.get("cells") or {}
            name_val = (cells.get(name_col) or "").strip().lower()
            if name_val != key:
                continue
            file_id = (cells.get(photo_col) or "").strip()
            return file_id
    return ""
