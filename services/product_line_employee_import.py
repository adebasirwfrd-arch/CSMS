"""Import / sync product line employees from Excel or bundled seed JSON."""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_EXCEL = ROOT / "Blueprint" / "Employee_Job_Data_2026.xlsx"
SEED_JSON = ROOT / "data" / "product_line_employees_seed.json"


def _norm_name(value: str) -> str:
    return (value or "").strip().lower()


def _clean_cell(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float) and math.isnan(value):
        return ""
    if isinstance(value, float) and value == int(value):
        return str(int(value))
    return str(value).strip()


def load_seed_payload(path: Optional[Path] = None) -> Dict[str, Any]:
    seed_path = path or SEED_JSON
    with open(seed_path, encoding="utf-8") as f:
        return json.load(f)


def load_from_excel(excel_path: Optional[Path] = None) -> Dict[str, Any]:
    import pandas as pd

    xlsx = excel_path or DEFAULT_EXCEL
    if not xlsx.exists():
        raise FileNotFoundError(f"Excel not found: {xlsx}")
    df = pd.read_excel(xlsx)
    employees: List[Dict[str, Any]] = []
    for _, row in df.iterrows():
        row_no = row.get("NO")
        employees.append(
            {
                "product_line": _clean_cell(row.get("Product Line")),
                "row_no": int(row_no) if row_no is not None and not (
                    isinstance(row_no, float) and math.isnan(row_no)
                ) else None,
                "name": _clean_cell(row.get("NAME")),
                "job_family_description": _clean_cell(row.get("Job Family Description")),
                "job_description": _clean_cell(row.get("Job Description")),
                "access_to_pl": _clean_cell(row.get("ACCESS TO PL")),
                "access_personnel_only": _clean_cell(row.get("ACCESS PERSONNEL ONLY")),
                "email": _clean_cell(row.get("Email")),
            }
        )
    product_lines = sorted({e["product_line"] for e in employees if e["product_line"]})
    return {
        "source": str(xlsx.relative_to(ROOT)) if xlsx.is_relative_to(ROOT) else str(xlsx),
        "product_lines": product_lines,
        "employees": employees,
    }


def load_import_payload(
    *,
    use_excel: bool = False,
    excel_path: Optional[Path] = None,
    seed_path: Optional[Path] = None,
) -> Dict[str, Any]:
    if use_excel:
        try:
            return load_from_excel(excel_path)
        except FileNotFoundError:
            pass
    return load_seed_payload(seed_path)


def resolve_product_line_id(
    excel_name: str, product_lines: List[Dict[str, Any]]
) -> Optional[int]:
    key = _norm_name(excel_name)
    if not key:
        return None
    for pl in product_lines:
        if _norm_name(pl.get("name", "")) == key:
            return pl.get("id")
    return None


def sync_product_lines_and_employees(
    payload: Dict[str, Any],
    *,
    create_product_line,
    get_product_lines,
    replace_employees_for_product_line,
) -> Dict[str, Any]:
    """
    Ensure product lines from payload exist, then replace employee rows per line.
    """
    existing = get_product_lines()
    by_norm = {_norm_name(p.get("name", "")): p for p in existing}
    created_lines: List[str] = []
    updated_counts: Dict[str, int] = {}
    skipped: List[str] = []

    for pl_name in payload.get("product_lines") or []:
        key = _norm_name(pl_name)
        if not key:
            continue
        if key not in by_norm:
            created = create_product_line({"name": pl_name, "description": None})
            by_norm[key] = created
            created_lines.append(pl_name)

    all_lines = get_product_lines()
    employees = payload.get("employees") or []
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for emp in employees:
        pl_name = emp.get("product_line") or ""
        grouped.setdefault(pl_name, []).append(emp)

    for pl_name, rows in grouped.items():
        pl_id = resolve_product_line_id(pl_name, all_lines)
        if not pl_id:
            skipped.append(pl_name)
            continue
        sorted_rows = sorted(
            rows,
            key=lambda r: (r.get("row_no") is None, r.get("row_no") or 0, r.get("name") or ""),
        )
        records = [
            {
                "product_line_id": pl_id,
                "row_no": r.get("row_no"),
                "name": r.get("name") or "",
                "job_family_description": r.get("job_family_description") or "",
                "job_description": r.get("job_description") or "",
                "access_to_pl": r.get("access_to_pl") or "",
                "access_personnel_only": r.get("access_personnel_only") or "",
                "email": r.get("email") or "",
            }
            for r in sorted_rows
        ]
        replace_employees_for_product_line(pl_id, records)
        updated_counts[pl_name] = len(records)

    return {
        "source": payload.get("source"),
        "product_lines_created": created_lines,
        "employees_by_product_line": updated_counts,
        "skipped_product_lines": skipped,
        "total_employees": sum(updated_counts.values()),
    }
