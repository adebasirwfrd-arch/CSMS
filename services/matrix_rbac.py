"""Matrix workbook access control from personnel session."""
from __future__ import annotations

import copy
import re
from typing import Any, Dict, List, Optional, Set


def _yes(value: Any) -> bool:
    return str(value or "").strip().lower() in ("yes", "y", "true", "1")


def _norm(value: Any) -> str:
    return str(value or "").strip().lower()


def _col_by_pattern(columns: List[Dict[str, Any]], pattern: str) -> Optional[Dict[str, Any]]:
    rx = re.compile(pattern, re.I)
    for col in columns or []:
        label = (col.get("label") or "").replace("*", "").strip()
        if rx.search(label):
            return col
    return None


def _personnel_name_col(columns: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    return _col_by_pattern(columns, r"personnel\s*name")


def _product_line_col(columns: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    return _col_by_pattern(columns, r"product\s*line")


def _row_pl_name(row: Dict[str, Any], pl_col: Optional[Dict[str, Any]]) -> str:
    if not pl_col:
        return ""
    return str((row.get("cells") or {}).get(pl_col.get("id")) or "").strip()


def _row_personnel_name(
    sheet: Dict[str, Any],
    row: Dict[str, Any],
    profile_index: Dict[str, Dict[str, Any]],
) -> str:
    name_col = _personnel_name_col(sheet.get("columns") or [])
    if name_col:
        direct = str((row.get("cells") or {}).get(name_col.get("id")) or "").strip()
        if direct:
            return direct
    key = row.get("id")
    if key and key in profile_index:
        return profile_index[key].get("name") or ""
    return ""


def _build_profile_index(workbook: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    """Map row id -> {name, pl} from personnel_data_information sheet."""
    out: Dict[str, Dict[str, Any]] = {}
    for sheet in workbook.get("sheets") or []:
        if sheet.get("id") != "personnel_data_information":
            continue
        name_col = _personnel_name_col(sheet.get("columns") or [])
        pl_col = _product_line_col(sheet.get("columns") or [])
        if not name_col:
            continue
        for row in sheet.get("rows") or []:
            name = str((row.get("cells") or {}).get(name_col.get("id")) or "").strip()
            pl = _row_pl_name(row, pl_col)
            if row.get("id"):
                out[row["id"]] = {"name": name, "pl": pl}
    return out


def _row_matches_pl(row: Dict[str, Any], pl_col: Optional[Dict[str, Any]], pl_name: str) -> bool:
    if not pl_name:
        return True
    if not pl_col:
        return True
    return _norm(_row_pl_name(row, pl_col)) == _norm(pl_name)


def filter_workbook_for_session(
    workbook: Dict[str, Any], session: Dict[str, Any]
) -> Dict[str, Any]:
    """Return a copy of workbook with rows limited by RBAC."""
    if not workbook:
        return workbook
    if session.get("is_admin"):
        return workbook

    pl_name = (session.get("product_line_name") or "").strip()
    personnel_name = (session.get("personnel_name") or "").strip()

    if _yes(session.get("access_to_pl")):
        return _filter_by_product_line(copy.deepcopy(workbook), pl_name)

    if _yes(session.get("access_personnel_only")):
        return _filter_by_product_line_and_personnel(
            copy.deepcopy(workbook), pl_name, personnel_name
        )

    return {"sheets": [], "meta": workbook.get("meta")}


def _filter_by_product_line(workbook: Dict[str, Any], pl_name: str) -> Dict[str, Any]:
    if not pl_name:
        return workbook
    for sheet in workbook.get("sheets") or []:
        pl_col = _product_line_col(sheet.get("columns") or [])
        if not pl_col:
            sheet["rows"] = []
            continue
        sheet["rows"] = [
            r for r in sheet.get("rows") or [] if _row_matches_pl(r, pl_col, pl_name)
        ]
    return workbook


def _filter_by_product_line_and_personnel(
    workbook: Dict[str, Any], pl_name: str, personnel_name: str
) -> Dict[str, Any]:
    target = _norm(personnel_name)
    if not target:
        return {"sheets": [], "meta": workbook.get("meta")}

    profile_index = _build_profile_index(workbook)
    allowed_ids: Set[str] = set()
    for rid, info in profile_index.items():
        if _norm(info.get("name")) == target:
            if not pl_name or _norm(info.get("pl")) == _norm(pl_name):
                allowed_ids.add(rid)

    for sheet in workbook.get("sheets") or []:
        pl_col = _product_line_col(sheet.get("columns") or [])
        name_col = _personnel_name_col(sheet.get("columns") or [])
        kept: List[Dict[str, Any]] = []
        for row in sheet.get("rows") or []:
            if not _row_matches_pl(row, pl_col, pl_name):
                continue
            if name_col:
                rn = _norm((row.get("cells") or {}).get(name_col.get("id")))
                if rn == target:
                    kept.append(row)
                    continue
            pname = _row_personnel_name(sheet, row, profile_index)
            if _norm(pname) == target:
                kept.append(row)
                continue
            if row.get("id") in allowed_ids:
                kept.append(row)
        sheet["rows"] = kept
    return workbook


def _session_allows_matrix(session: Dict[str, Any]) -> bool:
    if session.get("is_admin"):
        return True
    return _yes(session.get("access_to_pl")) or _yes(session.get("access_personnel_only"))


def assert_matrix_access(session: Optional[Dict[str, Any]]) -> None:
    """Raise PermissionError when bearer session cannot use Matrix at all."""
    if not session:
        return
    if not _session_allows_matrix(session):
        raise PermissionError("Matrix access denied")


def assert_matrix_structure(session: Optional[Dict[str, Any]]) -> None:
    """Add/delete rows (global), columns, roster sync — admin only when authenticated."""
    if not session:
        return
    assert_matrix_access(session)
    if not session.get("is_admin"):
        raise PermissionError("Admin only")


def assert_matrix_row_edit(
    session: Optional[Dict[str, Any]],
    workbook: Dict[str, Any],
    sheet_id: str,
    row_id: str,
) -> None:
    if not session:
        return
    assert_matrix_access(session)
    if session.get("is_admin") or _yes(session.get("access_to_pl")):
        return
    if not _yes(session.get("access_personnel_only")):
        raise PermissionError("Matrix edit denied")

    profile_index = _build_profile_index(workbook)
    pl_name = (session.get("product_line_name") or "").strip()
    personnel_name = _norm(session.get("personnel_name") or "")
    if not personnel_name:
        raise PermissionError("Personnel name required")

    for sheet in workbook.get("sheets") or []:
        if sheet.get("id") != sheet_id:
            continue
        pl_col = _product_line_col(sheet.get("columns") or [])
        name_col = _personnel_name_col(sheet.get("columns") or [])
        for row in sheet.get("rows") or []:
            if row.get("id") != row_id:
                continue
            if not _row_matches_pl(row, pl_col, pl_name):
                raise PermissionError("Cannot edit other product line")
            if name_col:
                rn = _norm((row.get("cells") or {}).get(name_col.get("id")))
                if rn == personnel_name:
                    return
            pname = _row_personnel_name(sheet, row, profile_index)
            if _norm(pname) == personnel_name:
                return
            raise PermissionError("Can only edit your own personnel data")
    raise PermissionError("Row not found")
