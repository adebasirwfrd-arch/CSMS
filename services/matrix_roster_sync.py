"""Sync Master product_line_employees into Matrix workbook rows (preserve non-roster cells)."""
from __future__ import annotations

import re
from typing import Any, Dict, List, Optional, Set

from database import get_product_line, get_product_line_employees, get_product_lines
from services.matrix_store import (
    bulk_add_rows,
    bulk_delete_rows,
    get_workbook,
    update_row,
)

_PERSONNEL_NAME_RE = re.compile(r"personnel\s*name", re.I)
_POSITION_RE = re.compile(r"position", re.I)
_PRODUCT_LINE_RE = re.compile(r"product\s*line", re.I)
_CLIENT_RE = re.compile(r"^client", re.I)
_PROJECT_RE = re.compile(r"^project", re.I)
_NO_LABEL_RE = re.compile(r"^no$", re.I)


def _norm_name(value: str) -> str:
    return (value or "").strip().lower()


def _find_col_id(sheet: Dict[str, Any], pattern: re.Pattern) -> Optional[str]:
    for col in sheet.get("columns", []):
        label = (col.get("label") or "").replace("*", "").strip()
        if pattern.search(label):
            return col.get("id")
    return None


def _find_no_col_id(sheet: Dict[str, Any]) -> Optional[str]:
    for col in sheet.get("columns", []):
        label = (col.get("label") or "").replace("*", "").strip()
        if _NO_LABEL_RE.match(label):
            return col.get("id")
    return None


def _is_master_row(sheet: Dict[str, Any], row: Dict[str, Any]) -> bool:
    client_col = _find_col_id(sheet, _CLIENT_RE)
    project_col = _find_col_id(sheet, _PROJECT_RE)
    cells = row.get("cells") or {}
    if project_col and (cells.get(project_col) or "").strip():
        return False
    if client_col and (cells.get(client_col) or "").strip():
        return False
    return True


def _row_matches_pl(sheet: Dict[str, Any], row: Dict[str, Any], pl_name: str) -> bool:
    pl_col = _find_col_id(sheet, _PRODUCT_LINE_RE)
    if not pl_col or not pl_name:
        return True
    return (row.get("cells", {}).get(pl_col) or "").strip() == pl_name


def _roster_col_ids(sheet: Dict[str, Any]) -> Set[str]:
    ids: Set[str] = set()
    for finder in (
        _find_col_id(sheet, _PERSONNEL_NAME_RE),
        _find_col_id(sheet, _POSITION_RE),
        _find_col_id(sheet, _PRODUCT_LINE_RE),
        _find_no_col_id(sheet),
    ):
        if finder:
            ids.add(finder)
    return ids


def _is_roster_only_row(sheet: Dict[str, Any], row: Dict[str, Any]) -> bool:
    roster_ids = _roster_col_ids(sheet)
    cells = row.get("cells") or {}
    for col in sheet.get("columns", []):
        cid = col.get("id")
        if not cid or cid in roster_ids:
            continue
        if (cells.get(cid) or "").strip():
            return False
    return True


def _employee_key(emp: Dict[str, Any]) -> str:
    row_no = emp.get("row_no")
    if row_no is not None and str(row_no).strip() != "":
        return f"no:{row_no}"
    return f"name:{_norm_name(emp.get('name') or '')}"


def _row_key(sheet: Dict[str, Any], row: Dict[str, Any]) -> Optional[str]:
    cells = row.get("cells") or {}
    no_col = _find_no_col_id(sheet)
    if no_col:
        no_val = (cells.get(no_col) or "").strip()
        if no_val:
            return f"no:{no_val}"
    name_col = _find_col_id(sheet, _PERSONNEL_NAME_RE)
    if name_col:
        name = (cells.get(name_col) or "").strip()
        if name:
            return f"name:{_norm_name(name)}"
    return None


def _build_roster_cells(
    sheet: Dict[str, Any], emp: Dict[str, Any], pl_name: str
) -> Dict[str, str]:
    cells: Dict[str, str] = {}
    name_col = _find_col_id(sheet, _PERSONNEL_NAME_RE)
    pos_col = _find_col_id(sheet, _POSITION_RE)
    pl_col = _find_col_id(sheet, _PRODUCT_LINE_RE)
    no_col = _find_no_col_id(sheet)
    client_col = _find_col_id(sheet, _CLIENT_RE)
    project_col = _find_col_id(sheet, _PROJECT_RE)

    if name_col:
        cells[name_col] = (emp.get("name") or "").strip()
    if pos_col:
        cells[pos_col] = (emp.get("job_family_description") or "").strip()
    if pl_col:
        cells[pl_col] = pl_name
    if no_col and emp.get("row_no") is not None:
        cells[no_col] = str(emp.get("row_no"))
    if client_col:
        cells[client_col] = ""
    if project_col:
        cells[project_col] = ""
    return cells


def _index_master_rows(
    sheet: Dict[str, Any], pl_name: str
) -> Dict[str, Dict[str, Any]]:
    index: Dict[str, Dict[str, Any]] = {}
    for row in sheet.get("rows", []):
        if not _is_master_row(sheet, row):
            continue
        if not _row_matches_pl(sheet, row, pl_name):
            continue
        key = _row_key(sheet, row)
        if key:
            index[key] = row
    return index


def _sync_sheet_roster(
    sheet: Dict[str, Any],
    employees: List[Dict[str, Any]],
    pl_name: str,
) -> Dict[str, int]:
    sheet_id = sheet.get("id") or ""
    if not sheet_id or not _find_col_id(sheet, _PERSONNEL_NAME_RE):
        return {"added": 0, "updated": 0, "removed": 0}

    expected_keys = {_employee_key(e) for e in employees}
    index = _index_master_rows(sheet, pl_name)
    matched_row_ids: Set[str] = set()
    to_add: List[Dict[str, str]] = []
    updated = 0

    for emp in employees:
        key = _employee_key(emp)
        roster_cells = _build_roster_cells(sheet, emp, pl_name)
        if not roster_cells:
            continue

        existing = index.get(key)
        if not existing and key.startswith("name:"):
            for alt_key, alt_row in index.items():
                if alt_row.get("id") in matched_row_ids:
                    continue
                if alt_key.startswith("no:"):
                    existing = alt_row
                    break

        if existing:
            update_row(sheet_id, existing["id"], roster_cells)
            matched_row_ids.add(existing["id"])
            updated += 1
        else:
            to_add.append(roster_cells)

    added = bulk_add_rows(sheet_id, to_add) if to_add else 0

    to_remove: List[str] = []
    for key, row in index.items():
        if key in expected_keys or row.get("id") in matched_row_ids:
            continue
        if _is_roster_only_row(sheet, row):
            to_remove.append(row["id"])

    removed = bulk_delete_rows(sheet_id, to_remove) if to_remove else 0
    return {"added": added, "updated": updated, "removed": removed}


def sync_product_line_roster_to_workbook(
    product_line_id: int,
    workbook: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    pl = get_product_line(product_line_id)
    if not pl:
        raise ValueError(f"Product line not found: {product_line_id}")

    pl_name = (pl.get("name") or "").strip()
    employees = get_product_line_employees(product_line_id)
    wb = workbook if workbook is not None else get_workbook()

    added = updated = removed = 0
    per_sheet: Dict[str, Dict[str, int]] = {}

    for sheet in wb.get("sheets", []):
        stats = _sync_sheet_roster(sheet, employees, pl_name)
        if any(stats.values()):
            per_sheet[sheet.get("id") or ""] = stats
        added += stats["added"]
        updated += stats["updated"]
        removed += stats["removed"]

    return {
        "product_line_id": product_line_id,
        "product_line_name": pl_name,
        "employees": len(employees),
        "added": added,
        "updated": updated,
        "removed": removed,
        "sheets": per_sheet,
    }


def sync_all_product_line_rosters(
    workbook: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    results = []
    for pl in get_product_lines():
        pl_id = pl.get("id")
        if not pl_id:
            continue
        try:
            results.append(sync_product_line_roster_to_workbook(int(pl_id), workbook))
        except Exception as e:
            results.append(
                {
                    "product_line_id": pl_id,
                    "product_line_name": pl.get("name"),
                    "error": str(e),
                }
            )
    return {
        "product_lines": len(results),
        "results": results,
        "total_added": sum(r.get("added", 0) for r in results if "added" in r),
        "total_updated": sum(r.get("updated", 0) for r in results if "updated" in r),
        "total_removed": sum(r.get("removed", 0) for r in results if "removed" in r),
    }
