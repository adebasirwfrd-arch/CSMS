"""Scan matrix workbook for expiry dates due for 90-day email reminders."""
from __future__ import annotations

import re
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

# Default email lead time before EXPIRED column date
MATRIX_REMINDER_DAYS = 90
REMINDER_WINDOW = (88, 91)


def reminder_days_for_column(col: Dict[str, Any]) -> int:
    """Per-column reminder lead time (days before expiry)."""
    label = (col.get("label") or "").replace("*", "").strip().lower()
    if re.search(r"skck.*expir", label):
        return 30  # 1 bulan sebelum SKCK Expiry
    if re.search(
        r"mcu.*expir|hse passport.*expir|siml\s*expir|^sim\s*expir|"
        r"bst.*expir|sbtc.*expir|one\s*sika.*expir|t-bosiet.*expir|h2s.*expir|"
        r"sea survival.*expir|hse demo room.*expir|well control.*expir|first aid.*expir|"
        r"fire.*expir|ohc.*expir|forklift.*expir|radiation.*expir|handak.*expir|"
        r"k3 umum.*expir|tkpk.*expir|tkdn.*expir|hse 101.*expir|hse 201.*expir|hse 301.*expir|"
        r"other training expiry",
        label,
    ):
        return 90  # 3 bulan sebelum expiry (Pelatihan Wajib, MCU, HSE, SIML, dll.)
    return MATRIX_REMINDER_DAYS


def reminder_window_for_days(reminder_days: int) -> Tuple[int, int]:
    return (max(1, reminder_days - 2), reminder_days + 1)

SHEET_LABELS = {
    "employee_mandatory_training": "Pelatihan Wajib",
    "personnel_health": "Kesehatan Personel",
    "personnel_data_information": "Data Personel",
    "contract_information": "Kontrak",
    "emergency_contact_information": "Kontak Darurat",
}


def _parse_date(val: Any) -> Optional[date]:
    if not val:
        return None
    s = str(val).strip()
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        try:
            return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            return None
    m = re.match(r"^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$", s)
    if m:
        a, b, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        try:
            if a > 12:
                return date(y, b, a)
            if b > 12:
                return date(y, a, b)
            return date(y, b, a)
        except ValueError:
            return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).date()
    except ValueError:
        return None


def days_until(val: Any, today: Optional[date] = None) -> Optional[int]:
    d = _parse_date(val)
    if not d:
        return None
    today = today or date.today()
    return (d - today).days


def is_expiry_column(col: Dict[str, Any]) -> bool:
    label = (col.get("label") or "").replace("*", "").strip().lower()
    if label in ("client", "project", "no"):
        return False
    if re.search(
        r"training date|^mcu date$|booster.*date|skck date$|hse passport date|sim date$|siml(?:\s+\d+)?\s+date$|"
        r"bst training|sbtc date$|one\s*sika.*(train|traiin)|"
        r"t-bosiet date$|h2s training date$|sea survival training date$|"
        r"hse demo room training date$|well control training date$|first aid training date$|"
        r"fire training date$|ohc training date$|forklift training date$|radiation training date$|"
        r"handak training date$|k3 umum training date$|tkpk training date$|tkdn training date$|"
        r"hse 101 training date$|hse 201 training date$|hse 301 training date$|"
        r"others training date$|other training name$|.*training agency$|"
        r"contract start|review \(client\) date|follow up date|birth date",
        label,
        re.I,
    ) and not re.search(r"expir|expired|end date|berakhir|kadaluarsa", label, re.I):
        return False
    return bool(
        re.search(r"expir|expired|end date|berakhir|kadaluarsa", label, re.I)
        or (col.get("type") == "date" and re.search(r"expir|expired|end", label, re.I))
    )


def personnel_name(sheet: Dict[str, Any], row: Dict[str, Any]) -> str:
    cells = row.get("cells") or {}
    for col in sheet.get("columns") or []:
        if re.search(r"personnel name", col.get("label") or "", re.I):
            return (cells.get(col["id"]) or "").strip()
    return ""


def row_context(sheet: Dict[str, Any], row: Dict[str, Any]) -> Tuple[str, str, str, str]:
    cells = row.get("cells") or {}
    client, project, product_line = "", "", ""
    for col in sheet.get("columns") or []:
        lbl = (col.get("label") or "").replace("*", "").strip().lower()
        if lbl == "client":
            client = (cells.get(col["id"]) or "").strip()
        elif lbl == "project":
            project = (cells.get(col["id"]) or "").strip()
        elif re.search(r"product line", lbl):
            product_line = (cells.get(col["id"]) or "").strip()
    return personnel_name(sheet, row), client, project, product_line


def product_line_recipients(pl: Dict[str, Any]) -> List[str]:
    return [
        e.strip()
        for e in (
            pl.get("supervisor_email"),
            pl.get("hse_email"),
            pl.get("manager_email"),
            pl.get("coordinator_email"),
        )
        if e and str(e).strip()
    ]


def group_items_by_product_line(
    items: List[Dict[str, Any]], product_lines: List[Dict[str, Any]]
) -> Dict[str, Dict[str, Any]]:
    """Group expiry items by product line name; attach recipients from master data."""
    pl_by_name = {(pl.get("name") or "").strip().lower(): pl for pl in product_lines}
    groups: Dict[str, Dict[str, Any]] = {}
    for item in items:
        pl_key = (item.get("product_line") or "").strip().lower()
        if not pl_key:
            continue
        pl = pl_by_name.get(pl_key)
        if not pl:
            continue
        if pl_key not in groups:
            groups[pl_key] = {
                "product_line_name": pl.get("name") or item.get("product_line"),
                "recipients": product_line_recipients(pl),
                "items": [],
            }
        groups[pl_key]["items"].append(item)
    return groups


def collect_expiry_reminders(
    workbook: Dict[str, Any],
    reminder_days: int = MATRIX_REMINDER_DAYS,
    window: Tuple[int, int] = REMINDER_WINDOW,
    today: Optional[date] = None,
) -> List[Dict[str, Any]]:
    """Return items whose expiry falls in each column's reminder window."""
    today = today or date.today()
    items: List[Dict[str, Any]] = []
    for sheet in workbook.get("sheets") or []:
        sheet_label = SHEET_LABELS.get(sheet.get("id", ""), sheet.get("title") or sheet.get("name") or "")
        expiry_cols = [c for c in (sheet.get("columns") or []) if is_expiry_column(c)]
        for row in sheet.get("rows") or []:
            name, client, project, product_line = row_context(sheet, row)
            cells = row.get("cells") or {}
            for col in expiry_cols:
                col_reminder_days = reminder_days_for_column(col)
                lo, hi = reminder_window_for_days(col_reminder_days)
                raw = cells.get(col["id"])
                du = days_until(raw, today)
                if du is None or du < lo or du > hi:
                    continue
                expiry_d = _parse_date(raw)
                items.append(
                    {
                        "sheet_id": sheet.get("id"),
                        "sheet_label": sheet_label,
                        "row_id": row.get("id"),
                        "col_id": col.get("id"),
                        "column_label": (col.get("label") or "").replace("*", "").strip(),
                        "personnel_name": name or "—",
                        "client": client or "—",
                        "project": project or "—",
                        "product_line": product_line or "—",
                        "expiry_date": expiry_d.isoformat() if expiry_d else str(raw),
                        "days_until": du,
                        "reminder_days": col_reminder_days,
                    }
                )
    items.sort(key=lambda x: (x["days_until"], x["sheet_label"], x["personnel_name"]))
    return items
