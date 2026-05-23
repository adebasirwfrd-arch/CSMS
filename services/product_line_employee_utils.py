"""Validation helpers for product line employee fields."""
from typing import Any, Dict, Optional

YES_NO_VALUES = frozenset({"Yes", "No", ""})


def normalize_yes_no(value: Any, default: str = "No") -> str:
    s = ("" if value is None else str(value)).strip()
    if not s or s == "-":
        return default
    low = s.lower()
    if low in ("yes", "y", "1", "true"):
        return "Yes"
    if low in ("no", "n", "0", "false"):
        return "No"
    if s in YES_NO_VALUES:
        return s
    return default


def sanitize_employee_payload(data: Dict[str, Any], *, partial: bool = False) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    if not partial or "row_no" in data:
        row_no = data.get("row_no")
        if row_no is None or row_no == "":
            out["row_no"] = None
        else:
            try:
                out["row_no"] = int(row_no)
            except (TypeError, ValueError):
                out["row_no"] = None
    text_fields = (
        "name",
        "job_family_description",
        "job_description",
        "email",
    )
    for field in text_fields:
        if not partial or field in data:
            out[field] = (data.get(field) or "").strip()
    yes_no_fields = ("access_to_pl", "access_personnel_only", "email_reminder")
    for field in yes_no_fields:
        if not partial or field in data:
            out[field] = normalize_yes_no(data.get(field))
    return out
