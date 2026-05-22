"""HSE Personnel Matrix workbook API (admin UI)."""
import io
import os
import re
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import requests
from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from services.google_drive import drive_service
from services.matrix_store import (
    SUPABASE_MATRIX,
    add_column,
    add_row,
    delete_column,
    delete_row,
    ensure_doc_columns,
    filter_unsent_reminders,
    get_sheet,
    get_workbook,
    log_reminder_sent,
    seed_workbook,
    update_column,
    update_row,
)

router = APIRouter(tags=["matrix"])

MATRIX_PROFILE_ROOT = os.getenv(
    "MATRIX_PROFILE_PHOTOS_FOLDER_ID",
    "1FXk8egsOPNfNpclsis4tjL_QHazXcxwU",
)

PERSONNEL_HEALTH_SHEET_ID = "personnel_health"
PROFILE_SHEET_ID = "personnel_data_information"
EMERGENCY_CONTACT_SHEET_ID = "emergency_contact_information"
TRAINING_SHEET_ID = "employee_mandatory_training"
PELATIHAN_DRIVE_FOLDER = "PELATIHAN"
# Longest token first so HSE 301 matches before HSE 101 / HSE
_PELATIHAN_FILE_PREFIXES: List[Tuple[str, str]] = [
    ("hse 301", "HSE 301"),
    ("hse 201", "HSE 201"),
    ("hse 101", "HSE 101"),
    ("hse demo room", "HSE DEMO ROOM"),
    ("sea survival", "SEA SURVIVAL"),
    ("well control", "WELL CONTROL"),
    ("first aid", "FIRST AID"),
    ("k3 umum", "K3 UMUM"),
    ("t-bosiet", "T-BOSIET"),
    ("one sika", "ONE SIKA"),
    ("radiation", "RADIATION"),
    ("forklift", "FORKLIFT"),
    ("handak", "HANDAK"),
    ("sbtc", "SBTC"),
    ("h2s", "H2S"),
    ("fire", "FIRE"),
    ("tkpk", "TKPK"),
    ("tkdn", "TKDN"),
    ("bst", "BST"),
    ("ohc", "OHC"),
]
_MCU_EXPIRY_LABEL_RE = re.compile(r"mcu\s*expired", re.I)
_MCU_DOC_KEY_RE = re.compile(r"doc_.*mcu.*expired|mcu.*expired.*doc", re.I)
_MCU_RESULT_DOC_RE = re.compile(r"mcu\s*result\s*doc", re.I)
_MCU_REVIEW_RESULTS_RE = re.compile(r"mcu\s*review\s*results", re.I)
_MCU_REVIEW_CLIENT_DATE_RE = re.compile(r"mcu\s*review\s*\(client\)\s*date", re.I)
DATA_PERSONEL_DRIVE_FOLDER = "DATA PERSONEL"
_CV_DOC_RE = re.compile(r"^cv$", re.I)
_SKCK_EXPIRY_RE = re.compile(r"skck.*expir", re.I)
_SKCK_DOC_KEY_RE = re.compile(r"doc_.*skck.*expir|skck.*expir.*doc", re.I)
_KTP_UPLOAD_RE = re.compile(r"upload\s*ktp", re.I)
_HSE_PASSPORT_EXPIRY_RE = re.compile(r"hse passport.*expir", re.I)
_HSE_PASSPORT_DOC_KEY_RE = re.compile(r"doc_.*hse passport.*expir|hse passport.*expir.*doc", re.I)
_SIM_EXPIRY_RE = re.compile(r"sim\s*expir", re.I)
_SIM_UPLOAD_RE = re.compile(r"upload\s*sim$", re.I)
_BPJS_UPLOAD_RE = re.compile(r"upload\s*bpjs", re.I)
_BPJS_NUMBER_RE = re.compile(r"bpjs\s*number", re.I)
_INSURANCE_UPLOAD_RE = re.compile(r"upload\s*insurance", re.I)
_OTHER_INSURANCE_NUMBER_RE = re.compile(r"other\s*insurance\s*number", re.I)
_SIML_UPLOAD_RE = re.compile(r"upload\s*siml(?:\s+(\d+))?$", re.I)
_SIML_EXPIRY_RE = re.compile(r"siml(?:\s+\d+)?\s*expir", re.I)
_SIML_LOCATION_RE = re.compile(r"siml(?:\s+\d+)?\s*location", re.I)
_SIML_SLOT_COUNT = 5
_MCU_MONTH_ABBR = ("JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC")
_WCAP_TRAINING_SUMMARY_RE = re.compile(r"upload\s*wcap\s*training\s*summary", re.I)
WCAP_UPLOAD_COL_ID = "col_wcap_training_summary"
_OTHER_TRAINING_CERT_RE = re.compile(r"upload\s*other\s*training\s*certificate", re.I)
OTHER_TRAINING_NAME_COL_ID = "col_other_training_name"
OTHER_TRAINING_EXPIRY_COL_ID = "col_other_training_expiry"
OTHER_TRAINING_UPLOAD_COL_ID = "col_other_training_cert_doc"


def _sanitize_folder_name(name: str) -> str:
    cleaned = re.sub(r'[\\/:*?"<>|]+', "-", (name or "").strip())
    return (cleaned[:120] or "Unknown Personnel")


def _personnel_photo_folder(personnel_name: str) -> str:
    folder_name = _sanitize_folder_name(personnel_name)
    parent_id = drive_service.find_or_create_folder(folder_name, parent_id=MATRIX_PROFILE_ROOT)
    if not parent_id:
        raise HTTPException(status_code=500, detail="Gagal membuat folder personel di Google Drive")
    return parent_id


def _resolve_product_line_folder_name(
    sheet: Dict[str, Any],
    row: Optional[Dict[str, Any]],
    personnel_name: str,
    product_line_hint: str = "",
) -> str:
    """Full product line name for Drive folder (not abbreviated code)."""
    hint = (product_line_hint or "").strip()
    if hint:
        return _sanitize_folder_name(hint)

    if row:
        pl_col = _find_product_line_col_id(sheet)
        if pl_col:
            val = (row.get("cells", {}).get(pl_col) or "").strip()
            if val:
                return _sanitize_folder_name(val)

    try:
        workbook = get_workbook()
        for sh in workbook.get("sheets", []):
            if sh.get("id") != PROFILE_SHEET_ID:
                continue
            prow = _find_row_by_personnel_name(sh, personnel_name)
            if not prow:
                continue
            pl_col2 = _find_product_line_col_id(sh)
            if pl_col2:
                val = (prow.get("cells", {}).get(pl_col2) or "").strip()
                if val:
                    return _sanitize_folder_name(val)
            break
    except Exception:
        pass

    return "Unknown Product Line"


def _data_personel_personnel_folder(personnel_name: str, product_line_name: str = "") -> str:
    """MATRIX ATTACHMENT / DATA PERSONEL / {product_line} / {personnel_name}."""
    data_parent = drive_service.find_or_create_folder(
        DATA_PERSONEL_DRIVE_FOLDER, parent_id=MATRIX_PROFILE_ROOT
    )
    if not data_parent:
        raise HTTPException(status_code=500, detail="Gagal membuat folder DATA PERSONEL di Google Drive")
    pl_folder = _sanitize_folder_name(product_line_name) or "Unknown Product Line"
    pl_parent = drive_service.find_or_create_folder(pl_folder, parent_id=data_parent)
    if not pl_parent:
        raise HTTPException(status_code=500, detail="Gagal membuat folder Product Line DATA PERSONEL di Google Drive")
    person_folder = _sanitize_folder_name(personnel_name)
    personnel_parent = drive_service.find_or_create_folder(person_folder, parent_id=pl_parent)
    if not personnel_parent:
        raise HTTPException(status_code=500, detail="Gagal membuat folder personel DATA PERSONEL di Google Drive")
    return personnel_parent


def _pelatihan_personnel_folder(personnel_name: str, product_line_name: str = "") -> str:
    """MATRIX ATTACHMENT / PELATIHAN / {product_line} / {personnel_name}."""
    pelatihan_parent = drive_service.find_or_create_folder(PELATIHAN_DRIVE_FOLDER, parent_id=MATRIX_PROFILE_ROOT)
    if not pelatihan_parent:
        raise HTTPException(status_code=500, detail="Gagal membuat folder PELATIHAN di Google Drive")
    pl_folder = _sanitize_folder_name(product_line_name) or "Unknown Product Line"
    pl_parent = drive_service.find_or_create_folder(pl_folder, parent_id=pelatihan_parent)
    if not pl_parent:
        raise HTTPException(status_code=500, detail="Gagal membuat folder Product Line PELATIHAN di Google Drive")
    person_folder = _sanitize_folder_name(personnel_name)
    personnel_parent = drive_service.find_or_create_folder(person_folder, parent_id=pl_parent)
    if not personnel_parent:
        raise HTTPException(status_code=500, detail="Gagal membuat folder personel PELATIHAN di Google Drive")
    return personnel_parent


def _resolve_upload_folder_name(
    column_name: str,
    sheet_id: str = "",
    col_id: str = "",
    sheet: Optional[Dict[str, Any]] = None,
) -> str:
    """Personnel docs → DATA PERSONEL / {product_line} / {personnel_name}."""
    if sheet_id == PERSONNEL_HEALTH_SHEET_ID and (
        _is_mcu_doc_upload(sheet_id, col_id, column_name, sheet)
        or _is_mcu_result_doc_upload(sheet_id, col_id, column_name, sheet)
    ):
        return DATA_PERSONEL_DRIVE_FOLDER
    if sheet_id == PROFILE_SHEET_ID and (
        _is_cv_doc_upload(sheet_id, col_id, column_name, sheet)
        or _is_skck_doc_upload(sheet_id, col_id, column_name, sheet)
        or _is_ktp_upload_doc_upload(sheet_id, col_id, column_name, sheet)
        or _is_hse_passport_doc_upload(sheet_id, col_id, column_name, sheet)
        or _is_sim_upload_doc_upload(sheet_id, col_id, column_name, sheet)
        or _is_siml_upload_doc_upload(sheet_id, col_id, column_name, sheet)
    ):
        return DATA_PERSONEL_DRIVE_FOLDER
    if sheet_id == EMERGENCY_CONTACT_SHEET_ID and (
        _is_bpjs_upload_doc_upload(sheet_id, col_id, column_name, sheet)
        or _is_insurance_upload_doc_upload(sheet_id, col_id, column_name, sheet)
    ):
        return DATA_PERSONEL_DRIVE_FOLDER
    if sheet_id == TRAINING_SHEET_ID and (
        _is_pelatihan_training_doc_upload(sheet_id, col_id, column_name, sheet)
        or _is_wcap_training_summary_upload(sheet_id, col_id, column_name, sheet)
        or _is_other_training_cert_upload(sheet_id, col_id, column_name, sheet)
    ):
        return PELATIHAN_DRIVE_FOLDER
    return column_name


def _document_upload_folder(column_name: str, personnel_name: str) -> str:
    """Root / {column_name} / {personnel_name} — nested under same root as profile photos."""
    col_folder = _sanitize_folder_name(column_name)
    person_folder = _sanitize_folder_name(personnel_name)
    column_parent = drive_service.find_or_create_folder(col_folder, parent_id=MATRIX_PROFILE_ROOT)
    if not column_parent:
        raise HTTPException(status_code=500, detail="Gagal membuat folder kolom di Google Drive")
    personnel_parent = drive_service.find_or_create_folder(person_folder, parent_id=column_parent)
    if not personnel_parent:
        raise HTTPException(status_code=500, detail="Gagal membuat folder personel di Google Drive")
    return personnel_parent


def _document_upload_parent_for_matrix(
    column_name: str,
    personnel_name: str,
    sheet_id: str = "",
    col_id: str = "",
    product_line: str = "",
    row_id: str = "",
) -> str:
    sheet = None
    row = None
    if sheet_id:
        try:
            sheet = get_sheet(sheet_id)
            if row_id:
                row = next((r for r in sheet.get("rows", []) if r.get("id") == row_id), None)
        except KeyError:
            pass
    folder = _resolve_upload_folder_name(column_name, sheet_id, col_id, sheet)
    if folder in (PELATIHAN_DRIVE_FOLDER, DATA_PERSONEL_DRIVE_FOLDER):
        pl_folder = _resolve_product_line_folder_name(
            sheet or {},
            row,
            personnel_name,
            product_line_hint=product_line,
        )
        if folder == PELATIHAN_DRIVE_FOLDER:
            return _pelatihan_personnel_folder(personnel_name, pl_folder)
        return _data_personel_personnel_folder(personnel_name, pl_folder)
    return _document_upload_folder(folder, personnel_name)


def _pelatihan_file_prefix_from_label(label: str) -> Optional[str]:
    text = (label or "").replace("*", "").strip().lower()
    if not re.search(r"expir", text):
        return None
    for token, prefix in _PELATIHAN_FILE_PREFIXES:
        if token in text:
            return prefix
    return None


def _pelatihan_doc_prefix(
    sheet_id: str,
    col_id: str,
    column_name: str,
    sheet: Optional[Dict[str, Any]] = None,
) -> Optional[str]:
    text = (column_name or "").strip()
    hit = _pelatihan_file_prefix_from_label(text)
    if hit:
        return hit
    if not sheet or not col_id:
        return None
    col = next((c for c in sheet.get("columns", []) if c.get("id") == col_id), None)
    if not col:
        return None
    label = (col.get("label") or "").replace("Doc:", "", 1).replace("*", "").strip()
    hit = _pelatihan_file_prefix_from_label(label)
    if hit:
        return hit
    if col_id.endswith("_doc"):
        exp_id = col_id[:-4]
        exp_col = next((c for c in sheet.get("columns", []) if c.get("id") == exp_id), None)
        if exp_col:
            return _pelatihan_file_prefix_from_label((exp_col.get("label") or "").replace("*", "").strip())
    return None


def _is_other_training_cert_upload(
    sheet_id: str,
    col_id: str,
    column_name: str,
    sheet: Optional[Dict[str, Any]] = None,
) -> bool:
    if sheet_id != TRAINING_SHEET_ID:
        return False
    if col_id == OTHER_TRAINING_UPLOAD_COL_ID:
        return True
    if _OTHER_TRAINING_CERT_RE.search(column_name or ""):
        return True
    if sheet and col_id:
        col = next((c for c in sheet.get("columns", []) if c.get("id") == col_id), None)
        if col and _OTHER_TRAINING_CERT_RE.search((col.get("label") or "")):
            return True
    return False


def _find_other_training_name_col_id(sheet: Dict[str, Any]) -> Optional[str]:
    for col in sheet.get("columns", []):
        if col.get("id") == OTHER_TRAINING_NAME_COL_ID:
            return col.get("id")
        label = (col.get("label") or "").replace("*", "").strip()
        if re.match(r"^other training name$", label, re.I):
            return col.get("id")
    return None


def _find_other_training_expiry_col_id(sheet: Dict[str, Any]) -> Optional[str]:
    for col in sheet.get("columns", []):
        if col.get("id") == OTHER_TRAINING_EXPIRY_COL_ID:
            return col.get("id")
        label = (col.get("label") or "").replace("*", "").strip()
        if re.search(r"other training expiry date", label, re.I):
            return col.get("id")
    return None


def _sanitize_training_name_for_file(name: str) -> str:
    cleaned = re.sub(r'[\\/:*?"<>|]+', "-", (name or "").strip())
    return (cleaned or "OTHER TRAINING").upper()


def _build_other_training_cert_filename(
    sheet: Dict[str, Any],
    row: Dict[str, Any],
    original_filename: str,
    personnel_name: str,
    product_line_hint: str = "",
) -> str:
    name_col = _find_other_training_name_col_id(sheet)
    cells = row.get("cells") or {}
    training_name = _sanitize_training_name_for_file(
        cells.get(name_col, "") if name_col else ""
    )
    pname_col = _find_personnel_name_col_id(sheet)
    pname = (cells.get(pname_col) if pname_col else None) or personnel_name or ""
    pname = re.sub(r'[\\/:*?"<>|]+', "-", pname.strip()) or "Unknown Personnel"
    pl_code = _resolve_product_line_code(sheet, row, pname, product_line_hint)
    expiry_col = _find_other_training_expiry_col_id(sheet)
    expiry_raw = cells.get(expiry_col, "") if expiry_col else ""
    suffix = _format_mcu_expiry_suffix(str(expiry_raw))
    ext = ""
    orig = original_filename or ""
    if "." in orig:
        ext = orig.rsplit(".", 1)[-1].strip().lower()
    base = f"{training_name}_{pl_code}_{pname}_{suffix}"
    return f"{base}.{ext}" if ext else base


def _is_wcap_training_summary_upload(
    sheet_id: str,
    col_id: str,
    column_name: str,
    sheet: Optional[Dict[str, Any]] = None,
) -> bool:
    if sheet_id != TRAINING_SHEET_ID:
        return False
    if col_id == WCAP_UPLOAD_COL_ID:
        return True
    if _WCAP_TRAINING_SUMMARY_RE.search(column_name or ""):
        return True
    if sheet and col_id:
        col = next((c for c in sheet.get("columns", []) if c.get("id") == col_id), None)
        if col and _WCAP_TRAINING_SUMMARY_RE.search((col.get("label") or "")):
            return True
    return False


def _is_pelatihan_training_doc_upload(
    sheet_id: str,
    col_id: str,
    column_name: str,
    sheet: Optional[Dict[str, Any]] = None,
) -> bool:
    if sheet_id != TRAINING_SHEET_ID:
        return False
    return _pelatihan_doc_prefix(sheet_id, col_id, column_name, sheet) is not None


def _build_wcap_training_summary_filename(
    sheet: Dict[str, Any],
    row: Dict[str, Any],
    original_filename: str,
    personnel_name: str,
    product_line_hint: str = "",
) -> str:
    name_col = _find_personnel_name_col_id(sheet)
    cells = row.get("cells") or {}
    pname = (cells.get(name_col) if name_col else None) or personnel_name or ""
    pname = re.sub(r'[\\/:*?"<>|]+', "-", pname.strip()) or "Unknown Personnel"
    pl_code = _resolve_product_line_code(sheet, row, pname, product_line_hint)
    ext = ""
    orig = original_filename or ""
    if "." in orig:
        ext = orig.rsplit(".", 1)[-1].strip().lower()
    base = f"WCAP_{pl_code}_{pname}"
    return f"{base}.{ext}" if ext else base


def _find_training_expiry_col_id(sheet: Dict[str, Any], prefix: str) -> Optional[str]:
    for col in sheet.get("columns", []):
        if col.get("type") != "date":
            continue
        label = (col.get("label") or "").replace("*", "").strip()
        if _pelatihan_file_prefix_from_label(label) == prefix:
            return col.get("id")
    return None


def _build_pelatihan_upload_filename(
    sheet: Dict[str, Any],
    row: Dict[str, Any],
    original_filename: str,
    personnel_name: str,
    product_line_hint: str = "",
    col_id: str = "",
    column_name: str = "",
    sheet_id: str = "",
) -> str:
    prefix = _pelatihan_doc_prefix(sheet_id, col_id, column_name, sheet) or "DOC"
    name_col = _find_personnel_name_col_id(sheet)
    cells = row.get("cells") or {}
    pname = (cells.get(name_col) if name_col else None) or personnel_name or ""
    pname = re.sub(r'[\\/:*?"<>|]+', "-", pname.strip()) or "Unknown Personnel"

    pl_code = _resolve_product_line_code(sheet, row, pname, product_line_hint)

    expiry_col = _find_training_expiry_col_id(sheet, prefix)
    expiry_raw = cells.get(expiry_col, "") if expiry_col else ""
    suffix = _format_mcu_expiry_suffix(str(expiry_raw))

    ext = ""
    orig = original_filename or ""
    if "." in orig:
        ext = orig.rsplit(".", 1)[-1].strip().lower()
    base = f"{prefix}_{pl_code}_{pname}_{suffix}"
    return f"{base}.{ext}" if ext else base


def _format_doc_cell(file_id: str, filename: str) -> str:
    safe = re.sub(r'[\\/:*?"<>|]+', "-", (filename or "document").strip()) or "document"
    return f"{file_id}::{safe}"


def _sanitize_doc_filename(name: str) -> str:
    return re.sub(r'[\\/:*?"<>|]+', "-", (name or "document").strip()) or "document"


def _parse_matrix_date(value: str) -> Optional[date]:
    s = (value or "").strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(s[:10] if fmt == "%Y-%m-%d" else s, fmt).date()
        except ValueError:
            continue
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        try:
            return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            return None
    return None


def _format_mcu_expiry_suffix(value: str) -> str:
    """MCU Expired date → MAY27 (3-letter month + 2-digit year)."""
    d = _parse_matrix_date(value)
    if not d:
        return "UNKNOWN"
    return f"{_MCU_MONTH_ABBR[d.month - 1]}{d.year % 100:02d}"


def _abbreviate_product_line(name: str) -> str:
    s = re.sub(r'[\\/:*?"<>|]+', "-", (name or "").strip())
    if not s:
        return "UNKNOWN"
    if len(s) <= 6 and " " not in s:
        return s.upper()
    words = re.findall(r"[A-Za-z0-9]+", s)
    if not words:
        return "UNKNOWN"
    return "".join(w[0].upper() for w in words if w)[:12] or "UNKNOWN"


def _find_product_line_col_id(sheet: Dict[str, Any]) -> Optional[str]:
    for col in sheet.get("columns", []):
        if re.search(r"product\s*line", col.get("label", ""), re.I):
            return col.get("id")
    return None


def _find_row_by_personnel_name(sheet: Dict[str, Any], personnel_name: str) -> Optional[Dict[str, Any]]:
    name_col = _find_personnel_name_col_id(sheet)
    if not name_col or not personnel_name:
        return None
    key = personnel_name.strip().lower()
    for row in sheet.get("rows", []):
        val = (row.get("cells", {}).get(name_col) or "").strip().lower()
        if val == key:
            return row
    return None


def _resolve_product_line_code(
    sheet: Dict[str, Any],
    row: Dict[str, Any],
    personnel_name: str,
    product_line_hint: str = "",
) -> str:
    hint = (product_line_hint or "").strip()
    if hint:
        return _abbreviate_product_line(hint)

    pl_col = _find_product_line_col_id(sheet)
    if pl_col:
        val = (row.get("cells", {}).get(pl_col) or "").strip()
        if val:
            return _abbreviate_product_line(val)

    try:
        workbook = get_workbook()
        for sh in workbook.get("sheets", []):
            if sh.get("id") != PROFILE_SHEET_ID:
                continue
            prow = _find_row_by_personnel_name(sh, personnel_name)
            if not prow:
                continue
            pl_col2 = _find_product_line_col_id(sh)
            if pl_col2:
                val = (prow.get("cells", {}).get(pl_col2) or "").strip()
                if val:
                    return _abbreviate_product_line(val)
            break
    except Exception:
        pass

    return "UNKNOWN"


def _is_skck_doc_upload(
    sheet_id: str,
    col_id: str,
    column_name: str,
    sheet: Optional[Dict[str, Any]] = None,
) -> bool:
    if sheet_id != PROFILE_SHEET_ID:
        return False
    if _SKCK_EXPIRY_RE.search((column_name or "").strip()):
        return True
    if col_id and col_id.endswith("_doc"):
        exp_id = col_id[:-4]
        if sheet:
            exp_col = next((c for c in sheet.get("columns", []) if c.get("id") == exp_id), None)
            if exp_col and _SKCK_EXPIRY_RE.search((exp_col.get("label") or "").replace("*", "")):
                return True
    if sheet and col_id:
        col = next((c for c in sheet.get("columns", []) if c.get("id") == col_id), None)
        if col:
            label = (col.get("label") or "").replace("Doc:", "", 1).replace("*", "").strip()
            key = (col.get("key") or "").lower()
            if _SKCK_EXPIRY_RE.search(label):
                return True
            if _SKCK_DOC_KEY_RE.search(key):
                return True
    return False


def _find_skck_expired_col_id(sheet: Dict[str, Any]) -> Optional[str]:
    for col in sheet.get("columns", []):
        label = (col.get("label") or "").replace("*", "").strip()
        if col.get("type") == "date" and _SKCK_EXPIRY_RE.search(label):
            return col.get("id")
    return None


def _build_skck_upload_filename(
    sheet: Dict[str, Any],
    row: Dict[str, Any],
    original_filename: str,
    personnel_name: str,
    product_line_hint: str = "",
) -> str:
    name_col = _find_personnel_name_col_id(sheet)
    cells = row.get("cells") or {}
    pname = (cells.get(name_col) if name_col else None) or personnel_name or ""
    pname = re.sub(r'[\\/:*?"<>|]+', "-", pname.strip()) or "Unknown Personnel"

    pl_code = _resolve_product_line_code(sheet, row, pname, product_line_hint)

    expiry_col = _find_skck_expired_col_id(sheet)
    expiry_raw = cells.get(expiry_col, "") if expiry_col else ""
    suffix = _format_mcu_expiry_suffix(str(expiry_raw))

    ext = ""
    orig = original_filename or ""
    if "." in orig:
        ext = orig.rsplit(".", 1)[-1].strip().lower()
    base = f"SKCK_{pl_code}_{pname}_{suffix}"
    return f"{base}.{ext}" if ext else base


def _is_hse_passport_doc_upload(
    sheet_id: str,
    col_id: str,
    column_name: str,
    sheet: Optional[Dict[str, Any]] = None,
) -> bool:
    if sheet_id != PROFILE_SHEET_ID:
        return False
    if _HSE_PASSPORT_EXPIRY_RE.search((column_name or "").strip()):
        return True
    if col_id and col_id.endswith("_doc"):
        exp_id = col_id[:-4]
        if sheet:
            exp_col = next((c for c in sheet.get("columns", []) if c.get("id") == exp_id), None)
            if exp_col and _HSE_PASSPORT_EXPIRY_RE.search((exp_col.get("label") or "").replace("*", "")):
                return True
    if sheet and col_id:
        col = next((c for c in sheet.get("columns", []) if c.get("id") == col_id), None)
        if col:
            label = (col.get("label") or "").replace("Doc:", "", 1).replace("*", "").strip()
            key = (col.get("key") or "").lower()
            if _HSE_PASSPORT_EXPIRY_RE.search(label):
                return True
            if _HSE_PASSPORT_DOC_KEY_RE.search(key):
                return True
    return False


def _find_hse_passport_expired_col_id(sheet: Dict[str, Any]) -> Optional[str]:
    for col in sheet.get("columns", []):
        label = (col.get("label") or "").replace("*", "").strip()
        if col.get("type") == "date" and _HSE_PASSPORT_EXPIRY_RE.search(label):
            return col.get("id")
    return None


def _build_hse_passport_upload_filename(
    sheet: Dict[str, Any],
    row: Dict[str, Any],
    original_filename: str,
    personnel_name: str,
    product_line_hint: str = "",
) -> str:
    name_col = _find_personnel_name_col_id(sheet)
    cells = row.get("cells") or {}
    pname = (cells.get(name_col) if name_col else None) or personnel_name or ""
    pname = re.sub(r'[\\/:*?"<>|]+', "-", pname.strip()) or "Unknown Personnel"

    pl_code = _resolve_product_line_code(sheet, row, pname, product_line_hint)

    expiry_col = _find_hse_passport_expired_col_id(sheet)
    expiry_raw = cells.get(expiry_col, "") if expiry_col else ""
    suffix = _format_mcu_expiry_suffix(str(expiry_raw))

    ext = ""
    orig = original_filename or ""
    if "." in orig:
        ext = orig.rsplit(".", 1)[-1].strip().lower()
    base = f"HSE PASSPORT_{pl_code}_{pname}_{suffix}"
    return f"{base}.{ext}" if ext else base


def _is_sim_upload_doc_upload(
    sheet_id: str,
    col_id: str,
    column_name: str,
    sheet: Optional[Dict[str, Any]] = None,
) -> bool:
    if sheet_id != PROFILE_SHEET_ID:
        return False
    if _SIM_UPLOAD_RE.search((column_name or "").strip()):
        return True
    if sheet and col_id:
        col = next((c for c in sheet.get("columns", []) if c.get("id") == col_id), None)
        if col:
            label = (col.get("label") or "").replace("*", "").strip()
            key = (col.get("key") or "").lower()
            if _SIM_UPLOAD_RE.search(label):
                return True
            if col_id == "col_sim_upload_doc" or "doc_sim" in key:
                return True
    return False


def _find_sim_expiry_col_id(sheet: Dict[str, Any]) -> Optional[str]:
    for col in sheet.get("columns", []):
        label = (col.get("label") or "").replace("*", "").strip()
        if col.get("type") == "date" and _SIM_EXPIRY_RE.search(label):
            return col.get("id")
    return None


def _build_sim_upload_filename(
    sheet: Dict[str, Any],
    row: Dict[str, Any],
    original_filename: str,
    personnel_name: str,
    product_line_hint: str = "",
) -> str:
    name_col = _find_personnel_name_col_id(sheet)
    cells = row.get("cells") or {}
    pname = (cells.get(name_col) if name_col else None) or personnel_name or ""
    pname = re.sub(r'[\\/:*?"<>|]+', "-", pname.strip()) or "Unknown Personnel"

    pl_code = _resolve_product_line_code(sheet, row, pname, product_line_hint)

    expiry_col = _find_sim_expiry_col_id(sheet)
    expiry_raw = cells.get(expiry_col, "") if expiry_col else ""
    suffix = _format_mcu_expiry_suffix(str(expiry_raw))

    ext = ""
    orig = original_filename or ""
    if "." in orig:
        ext = orig.rsplit(".", 1)[-1].strip().lower()
    base = f"SIM_{pl_code}_{pname}_{suffix}"
    return f"{base}.{ext}" if ext else base


def _sanitize_doc_segment(value: str) -> str:
    cleaned = re.sub(r'[\\/:*?"<>|]+', "-", (value or "").strip())
    return cleaned or "UNKNOWN"


def _siml_id_tag(slot: int) -> str:
    return "" if slot == 1 else str(slot)


def _siml_expected_col_id(slot: int, field: str) -> str:
    tag = _siml_id_tag(slot)
    if field == "upload":
        return f"col_siml{tag}_upload_doc"
    return f"col_siml{tag}_{field}"


def _parse_siml_slot(col_id: str = "", label: str = "") -> int:
    cid = (col_id or "").strip()
    m = re.match(r"^col_siml(\d*)_", cid)
    if m:
        return int(m.group(1)) if m.group(1) else 1
    text = (label or "").strip()
    um = _SIML_UPLOAD_RE.search(text)
    if um:
        return int(um.group(1)) if um.group(1) else 1
    return 1


def _is_siml_upload_doc_upload(
    sheet_id: str,
    col_id: str,
    column_name: str,
    sheet: Optional[Dict[str, Any]] = None,
) -> bool:
    if sheet_id != PROFILE_SHEET_ID:
        return False
    if _SIML_UPLOAD_RE.search((column_name or "").strip()):
        return True
    if sheet and col_id:
        col = next((c for c in sheet.get("columns", []) if c.get("id") == col_id), None)
        if col:
            label = (col.get("label") or "").replace("*", "").strip()
            key = (col.get("key") or "").lower()
            if _SIML_UPLOAD_RE.search(label):
                return True
            if re.match(r"^col_siml\d*_upload_doc$", col_id or "") or re.match(r"^doc_siml\d*_upload$", key):
                return True
    return False


def _find_siml_col_id_for_slot(sheet: Dict[str, Any], slot: int, field: str) -> Optional[str]:
    expected = _siml_expected_col_id(slot, field)
    for col in sheet.get("columns", []):
        if col.get("id") == expected:
            return col.get("id")
    for col in sheet.get("columns", []):
        label = (col.get("label") or "").replace("*", "").strip()
        if field == "location" and _SIML_LOCATION_RE.search(label):
            if slot == 1 and re.match(r"^SIML\s+Location$", label, re.I):
                return col.get("id")
            if slot > 1 and re.match(rf"^SIML\s+{slot}\s+Location$", label, re.I):
                return col.get("id")
        if field == "expiry" and col.get("type") == "date" and _SIML_EXPIRY_RE.search(label):
            if slot == 1 and re.match(r"^SIML\s+Expiry\s+Date$", label, re.I):
                return col.get("id")
            if slot > 1 and re.match(rf"^SIML\s+{slot}\s+Expiry\s+Date$", label, re.I):
                return col.get("id")
    return None


def _build_siml_upload_filename(
    sheet: Dict[str, Any],
    row: Dict[str, Any],
    original_filename: str,
    personnel_name: str,
    product_line_hint: str = "",
    col_id: str = "",
    column_name: str = "",
) -> str:
    name_col = _find_personnel_name_col_id(sheet)
    cells = row.get("cells") or {}
    pname = (cells.get(name_col) if name_col else None) or personnel_name or ""
    pname = _sanitize_doc_segment(pname)

    pl_code = _resolve_product_line_code(sheet, row, pname, product_line_hint)

    slot = _parse_siml_slot(col_id, column_name)
    loc_col = _find_siml_col_id_for_slot(sheet, slot, "location")
    location = _sanitize_doc_segment(cells.get(loc_col, "") if loc_col else "")

    expiry_col = _find_siml_col_id_for_slot(sheet, slot, "expiry")
    expiry_raw = cells.get(expiry_col, "") if expiry_col else ""
    suffix = _format_mcu_expiry_suffix(str(expiry_raw))

    ext = ""
    orig = original_filename or ""
    if "." in orig:
        ext = orig.rsplit(".", 1)[-1].strip().lower()
    base = f"SIML_{location}_{pl_code}_{pname}_{suffix}"
    return f"{base}.{ext}" if ext else base


def _sanitize_bpjs_number(value: str) -> str:
    cleaned = re.sub(r'[\\/:*?"<>|]+', "-", (value or "").strip())
    return cleaned or "UNKNOWN"


def _find_bpjs_number_col_id(sheet: Dict[str, Any]) -> Optional[str]:
    for col in sheet.get("columns", []):
        if _BPJS_NUMBER_RE.search((col.get("label") or "").replace("*", "")):
            return col.get("id")
    return None


def _is_bpjs_upload_doc_upload(
    sheet_id: str,
    col_id: str,
    column_name: str,
    sheet: Optional[Dict[str, Any]] = None,
) -> bool:
    if sheet_id != EMERGENCY_CONTACT_SHEET_ID:
        return False
    if _BPJS_UPLOAD_RE.search((column_name or "").strip()):
        return True
    if sheet and col_id:
        col = next((c for c in sheet.get("columns", []) if c.get("id") == col_id), None)
        if col:
            label = (col.get("label") or "").replace("*", "").strip()
            key = (col.get("key") or "").lower()
            if _BPJS_UPLOAD_RE.search(label):
                return True
            if col_id == "col_bpjs_upload_doc" or "doc_bpjs" in key:
                return True
    return False


def _build_bpjs_upload_filename(
    sheet: Dict[str, Any],
    row: Dict[str, Any],
    original_filename: str,
    personnel_name: str,
    product_line_hint: str = "",
) -> str:
    name_col = _find_personnel_name_col_id(sheet)
    cells = row.get("cells") or {}
    pname = (cells.get(name_col) if name_col else None) or personnel_name or ""
    pname = re.sub(r'[\\/:*?"<>|]+', "-", pname.strip()) or "Unknown Personnel"

    pl_code = _resolve_product_line_code(sheet, row, pname, product_line_hint)

    bpjs_col = _find_bpjs_number_col_id(sheet)
    bpjs_raw = cells.get(bpjs_col, "") if bpjs_col else ""
    bpjs_num = _sanitize_bpjs_number(str(bpjs_raw))

    ext = ""
    orig = original_filename or ""
    if "." in orig:
        ext = orig.rsplit(".", 1)[-1].strip().lower()
    base = f"BPJS_{pl_code}_{pname}_{bpjs_num}"
    return f"{base}.{ext}" if ext else base


def _sanitize_insurance_number(value: str) -> str:
    cleaned = re.sub(r'[\\/:*?"<>|]+', "-", (value or "").strip())
    return cleaned or "UNKNOWN"


def _find_other_insurance_number_col_id(sheet: Dict[str, Any]) -> Optional[str]:
    for col in sheet.get("columns", []):
        if _OTHER_INSURANCE_NUMBER_RE.search((col.get("label") or "").replace("*", "")):
            return col.get("id")
    return None


def _is_insurance_upload_doc_upload(
    sheet_id: str,
    col_id: str,
    column_name: str,
    sheet: Optional[Dict[str, Any]] = None,
) -> bool:
    if sheet_id != EMERGENCY_CONTACT_SHEET_ID:
        return False
    if _INSURANCE_UPLOAD_RE.search((column_name or "").strip()):
        return True
    if sheet and col_id:
        col = next((c for c in sheet.get("columns", []) if c.get("id") == col_id), None)
        if col:
            label = (col.get("label") or "").replace("*", "").strip()
            key = (col.get("key") or "").lower()
            if _INSURANCE_UPLOAD_RE.search(label):
                return True
            if col_id == "col_insurance_upload_doc" or "doc_insurance" in key:
                return True
    return False


def _build_insurance_upload_filename(
    sheet: Dict[str, Any],
    row: Dict[str, Any],
    original_filename: str,
    personnel_name: str,
    product_line_hint: str = "",
) -> str:
    name_col = _find_personnel_name_col_id(sheet)
    cells = row.get("cells") or {}
    pname = (cells.get(name_col) if name_col else None) or personnel_name or ""
    pname = re.sub(r'[\\/:*?"<>|]+', "-", pname.strip()) or "Unknown Personnel"

    pl_code = _resolve_product_line_code(sheet, row, pname, product_line_hint)

    ins_col = _find_other_insurance_number_col_id(sheet)
    ins_raw = cells.get(ins_col, "") if ins_col else ""
    ins_num = _sanitize_insurance_number(str(ins_raw))

    ext = ""
    orig = original_filename or ""
    if "." in orig:
        ext = orig.rsplit(".", 1)[-1].strip().lower()
    base = f"INSURANCE_{pl_code}_{pname}_{ins_num}"
    return f"{base}.{ext}" if ext else base


def _is_ktp_upload_doc_upload(
    sheet_id: str,
    col_id: str,
    column_name: str,
    sheet: Optional[Dict[str, Any]] = None,
) -> bool:
    if sheet_id != PROFILE_SHEET_ID:
        return False
    if _KTP_UPLOAD_RE.search((column_name or "").strip()):
        return True
    if sheet and col_id:
        col = next((c for c in sheet.get("columns", []) if c.get("id") == col_id), None)
        if col:
            label = (col.get("label") or "").replace("*", "").strip()
            key = (col.get("key") or "").lower()
            if _KTP_UPLOAD_RE.search(label):
                return True
            if col_id == "col_ktp_upload_doc" or "doc_ktp" in key:
                return True
    return False


def _build_ktp_upload_filename(
    sheet: Dict[str, Any],
    row: Dict[str, Any],
    original_filename: str,
    personnel_name: str,
    product_line_hint: str = "",
) -> str:
    name_col = _find_personnel_name_col_id(sheet)
    cells = row.get("cells") or {}
    pname = (cells.get(name_col) if name_col else None) or personnel_name or ""
    pname = re.sub(r'[\\/:*?"<>|]+', "-", pname.strip()) or "Unknown Personnel"

    pl_code = _resolve_product_line_code(sheet, row, pname, product_line_hint)

    ext = ""
    orig = original_filename or ""
    if "." in orig:
        ext = orig.rsplit(".", 1)[-1].strip().lower()
    base = f"KTP_{pl_code}_{pname}"
    return f"{base}.{ext}" if ext else base


def _is_cv_doc_upload(
    sheet_id: str,
    col_id: str,
    column_name: str,
    sheet: Optional[Dict[str, Any]] = None,
) -> bool:
    if sheet_id != PROFILE_SHEET_ID:
        return False
    if _CV_DOC_RE.search((column_name or "").strip()):
        return True
    if sheet and col_id:
        col = next((c for c in sheet.get("columns", []) if c.get("id") == col_id), None)
        if col:
            label = (col.get("label") or "").replace("*", "").strip()
            key = (col.get("key") or "").lower()
            if _CV_DOC_RE.search(label):
                return True
            if col_id == "col_cv_doc" or "doc_cv" in key:
                return True
    return False


def _find_position_col_id(sheet: Dict[str, Any]) -> Optional[str]:
    for col in sheet.get("columns", []):
        if re.search(r"position", col.get("label", ""), re.I):
            return col.get("id")
    return None


def _build_cv_upload_filename(
    sheet: Dict[str, Any],
    row: Dict[str, Any],
    original_filename: str,
    personnel_name: str,
    product_line_hint: str = "",
) -> str:
    name_col = _find_personnel_name_col_id(sheet)
    cells = row.get("cells") or {}
    pname = (cells.get(name_col) if name_col else None) or personnel_name or ""
    pname = re.sub(r'[\\/:*?"<>|]+', "-", pname.strip()) or "Unknown Personnel"

    pl_code = _resolve_product_line_code(sheet, row, pname, product_line_hint)

    pos_col = _find_position_col_id(sheet)
    position_raw = (cells.get(pos_col) if pos_col else "") or ""
    position = re.sub(r'[\\/:*?"<>|]+', "-", str(position_raw).strip()).upper() or "UNKNOWN"

    ext = ""
    orig = original_filename or ""
    if "." in orig:
        ext = orig.rsplit(".", 1)[-1].strip().lower()
    base = f"CV_{pl_code}_{pname}_{position}"
    return f"{base}.{ext}" if ext else base


def _is_mcu_result_doc_upload(
    sheet_id: str,
    col_id: str,
    column_name: str,
    sheet: Optional[Dict[str, Any]] = None,
) -> bool:
    if sheet_id != PERSONNEL_HEALTH_SHEET_ID:
        return False
    if _MCU_RESULT_DOC_RE.search((column_name or "").strip()):
        return True
    if sheet and col_id:
        col = next((c for c in sheet.get("columns", []) if c.get("id") == col_id), None)
        if col:
            label = (col.get("label") or "").replace("*", "").strip()
            key = (col.get("key") or "").lower()
            if _MCU_RESULT_DOC_RE.search(label):
                return True
            if "mcu_result_doc" in key:
                return True
    return False


def _is_mcu_doc_upload(
    sheet_id: str,
    col_id: str,
    column_name: str,
    sheet: Optional[Dict[str, Any]] = None,
) -> bool:
    if sheet_id != PERSONNEL_HEALTH_SHEET_ID:
        return False
    if _MCU_EXPIRY_LABEL_RE.search((column_name or "").strip()):
        return True
    if col_id and col_id.endswith("_doc"):
        exp_id = col_id[:-4]
        if sheet:
            exp_col = next((c for c in sheet.get("columns", []) if c.get("id") == exp_id), None)
            if exp_col and _MCU_EXPIRY_LABEL_RE.search((exp_col.get("label") or "").replace("*", "")):
                return True
    if sheet and col_id:
        col = next((c for c in sheet.get("columns", []) if c.get("id") == col_id), None)
        if col:
            label = (col.get("label") or "").replace("Doc:", "", 1).replace("*", "").strip()
            key = (col.get("key") or "").lower()
            if _MCU_EXPIRY_LABEL_RE.search(label):
                return True
            if _MCU_DOC_KEY_RE.search(key):
                return True
    return False


def _find_personnel_name_col_id(sheet: Dict[str, Any]) -> Optional[str]:
    for col in sheet.get("columns", []):
        if re.search(r"personnel\s*name", col.get("label", ""), re.I):
            return col.get("id")
    return None


def _find_mcu_expired_col_id(sheet: Dict[str, Any]) -> Optional[str]:
    for col in sheet.get("columns", []):
        label = (col.get("label") or "").replace("*", "").strip()
        if col.get("type") == "date" and _MCU_EXPIRY_LABEL_RE.search(label):
            return col.get("id")
    return None


def _find_col_id_by_label(sheet: Dict[str, Any], pattern: re.Pattern) -> Optional[str]:
    for col in sheet.get("columns", []):
        label = (col.get("label") or "").replace("*", "").strip()
        if pattern.search(label):
            return col.get("id")
    return None


def _build_mcu_review_upload_filename(
    sheet: Dict[str, Any],
    row: Dict[str, Any],
    original_filename: str,
    personnel_name: str,
    product_line_hint: str = "",
) -> str:
    name_col = _find_personnel_name_col_id(sheet)
    cells = row.get("cells") or {}
    pname = (cells.get(name_col) if name_col else None) or personnel_name or ""
    pname = re.sub(r'[\\/:*?"<>|]+', "-", pname.strip()) or "Unknown Personnel"

    pl_code = _resolve_product_line_code(sheet, row, pname, product_line_hint)

    date_col = _find_col_id_by_label(sheet, _MCU_REVIEW_CLIENT_DATE_RE)
    date_raw = cells.get(date_col, "") if date_col else ""
    date_suffix = _format_mcu_expiry_suffix(str(date_raw))

    result_col = _find_col_id_by_label(sheet, _MCU_REVIEW_RESULTS_RE)
    result_raw = (cells.get(result_col, "") if result_col else "") or ""
    result_code = re.sub(r'[\\/:*?"<>|]+', "-", str(result_raw).strip()).upper() or "UNKNOWN"

    ext = ""
    orig = original_filename or ""
    if "." in orig:
        ext = orig.rsplit(".", 1)[-1].strip().lower()
    base = f"MCU REVIEW_{pl_code}_{pname}_{date_suffix}_{result_code}"
    return f"{base}.{ext}" if ext else base


def _build_mcu_upload_filename(
    sheet: Dict[str, Any],
    row: Dict[str, Any],
    original_filename: str,
    personnel_name: str,
    product_line_hint: str = "",
) -> str:
    name_col = _find_personnel_name_col_id(sheet)
    cells = row.get("cells") or {}
    pname = (cells.get(name_col) if name_col else None) or personnel_name or ""
    pname = re.sub(r'[\\/:*?"<>|]+', "-", pname.strip()) or "Unknown Personnel"

    pl_code = _resolve_product_line_code(sheet, row, pname, product_line_hint)

    expiry_col = _find_mcu_expired_col_id(sheet)
    expiry_raw = cells.get(expiry_col, "") if expiry_col else ""
    suffix = _format_mcu_expiry_suffix(str(expiry_raw))

    ext = ""
    orig = original_filename or ""
    if "." in orig:
        ext = orig.rsplit(".", 1)[-1].strip().lower()
    base = f"MCU_{pl_code}_{pname}_{suffix}"
    return f"{base}.{ext}" if ext else base


def _resolve_matrix_document_filename(
    sheet_id: str,
    row_id: str,
    col_id: str,
    personnel_name: str,
    column_name: str,
    original_filename: str,
    product_line: str = "",
) -> str:
    try:
        sheet = get_sheet(sheet_id)
    except KeyError:
        return _sanitize_doc_filename(original_filename)

    row = next((r for r in sheet.get("rows", []) if r.get("id") == row_id), None)
    if not row:
        return _sanitize_doc_filename(original_filename)

    if _is_wcap_training_summary_upload(sheet_id, col_id, column_name, sheet):
        return _build_wcap_training_summary_filename(
            sheet,
            row,
            original_filename,
            personnel_name,
            product_line_hint=product_line,
        )

    if _is_other_training_cert_upload(sheet_id, col_id, column_name, sheet):
        return _build_other_training_cert_filename(
            sheet,
            row,
            original_filename,
            personnel_name,
            product_line_hint=product_line,
        )

    if _is_pelatihan_training_doc_upload(sheet_id, col_id, column_name, sheet):
        return _build_pelatihan_upload_filename(
            sheet,
            row,
            original_filename,
            personnel_name,
            product_line_hint=product_line,
            col_id=col_id,
            column_name=column_name,
            sheet_id=sheet_id,
        )

    if _is_cv_doc_upload(sheet_id, col_id, column_name, sheet):
        return _build_cv_upload_filename(
            sheet, row, original_filename, personnel_name, product_line_hint=product_line
        )

    if _is_ktp_upload_doc_upload(sheet_id, col_id, column_name, sheet):
        return _build_ktp_upload_filename(
            sheet, row, original_filename, personnel_name, product_line_hint=product_line
        )

    if _is_sim_upload_doc_upload(sheet_id, col_id, column_name, sheet):
        return _build_sim_upload_filename(
            sheet, row, original_filename, personnel_name, product_line_hint=product_line
        )

    if _is_bpjs_upload_doc_upload(sheet_id, col_id, column_name, sheet):
        return _build_bpjs_upload_filename(
            sheet, row, original_filename, personnel_name, product_line_hint=product_line
        )

    if _is_insurance_upload_doc_upload(sheet_id, col_id, column_name, sheet):
        return _build_insurance_upload_filename(
            sheet, row, original_filename, personnel_name, product_line_hint=product_line
        )

    if _is_siml_upload_doc_upload(sheet_id, col_id, column_name, sheet):
        return _build_siml_upload_filename(
            sheet,
            row,
            original_filename,
            personnel_name,
            product_line_hint=product_line,
            col_id=col_id,
            column_name=column_name,
        )

    if _is_skck_doc_upload(sheet_id, col_id, column_name, sheet):
        return _build_skck_upload_filename(
            sheet, row, original_filename, personnel_name, product_line_hint=product_line
        )

    if _is_hse_passport_doc_upload(sheet_id, col_id, column_name, sheet):
        return _build_hse_passport_upload_filename(
            sheet, row, original_filename, personnel_name, product_line_hint=product_line
        )

    if _is_mcu_result_doc_upload(sheet_id, col_id, column_name, sheet):
        return _build_mcu_review_upload_filename(
            sheet, row, original_filename, personnel_name, product_line_hint=product_line
        )

    if _is_mcu_doc_upload(sheet_id, col_id, column_name, sheet):
        return _build_mcu_upload_filename(
            sheet, row, original_filename, personnel_name, product_line_hint=product_line
        )

    return _sanitize_doc_filename(original_filename)


class RowCellsBody(BaseModel):
    cells: Dict[str, str] = Field(default_factory=dict)


class ColumnCreateBody(BaseModel):
    label: str
    type: str = "text"
    filterable: bool = True
    col_id: Optional[str] = None
    col_key: Optional[str] = None


class ColumnUpdateBody(BaseModel):
    label: Optional[str] = None
    type: Optional[str] = None
    filterable: Optional[bool] = None


@router.get("/matrix/expiry-reminders/preview")
def matrix_expiry_reminders_preview():
    """Diagnose which matrix rows qualify for the 90-day email reminder."""
    from database import get_product_lines
    from services.email_service import email_service
    from services.matrix_expiry_reminder import (
        MATRIX_REMINDER_DAYS,
        REMINDER_WINDOW,
        collect_expiry_reminders,
        group_items_by_product_line,
        product_line_recipients,
    )

    today = date.today()
    product_lines = get_product_lines()
    workbook = get_workbook()
    all_items = collect_expiry_reminders(workbook, reminder_days=MATRIX_REMINDER_DAYS)
    pending = filter_unsent_reminders(all_items) if all_items else []
    groups = group_items_by_product_line(pending, product_lines) if pending else {}

    pl_email_status = []
    for pl in product_lines:
        name = (pl.get("name") or "").strip()
        recipients = [
            e
            for e in (
                pl.get("supervisor_email"),
                pl.get("hse_email"),
                pl.get("manager_email"),
                pl.get("coordinator_email"),
            )
            if e and str(e).strip()
        ]
        pl_email_status.append(
            {
                "product_line": name,
                "has_recipients": bool(recipients),
                "recipients": recipients,
            }
        )

    target_expiry = today + timedelta(days=MATRIX_REMINDER_DAYS)
    pl_by_name = {(pl.get("name") or "").strip().lower(): pl for pl in product_lines}
    skipped_no_email = []
    seen_pl = set()
    for item in pending:
        pl_key = (item.get("product_line") or "").strip().lower()
        if not pl_key or pl_key in seen_pl:
            continue
        seen_pl.add(pl_key)
        pl = pl_by_name.get(pl_key)
        if not pl or not product_line_recipients(pl):
            skipped_no_email.append(item.get("product_line"))

    return {
        "today": today.isoformat(),
        "reminder_days": MATRIX_REMINDER_DAYS,
        "window_days": {"min": REMINDER_WINDOW[0], "max": REMINDER_WINDOW[1]},
        "target_expiry_example": target_expiry.isoformat(),
        "brevo_configured": bool(email_service.api_key),
        "scans_column": "Kolom EXPIRED (bukan tanggal awal / MCU Date)",
        "cron": "0 7 * * * UTC → /matrix/send-expiry-reminders",
        "qualified_count": len(all_items),
        "pending_send_count": len(pending),
        "sendable_product_lines": len(groups),
        "qualified_items": all_items[:50],
        "pending_items": pending[:50],
        "product_lines": pl_email_status,
        "skipped_no_email": skipped_no_email,
        "how_to_test": [
            f"1. Isi MCU Expired* ≈ {MATRIX_REMINDER_DAYS} hari dari hari ini (contoh: {target_expiry.isoformat()})",
            "2. Bukan MCU Date — hanya kolom berlabel Expired/Expiry",
            "3. Baris harus punya Product Line yang sama dengan Master + email terisi",
            f"4. GET /matrix/send-expiry-reminders?force=true untuk kirim manual (uji)",
        ],
    }


@router.post("/matrix/send-expiry-reminders/test")
@router.get("/matrix/send-expiry-reminders/test")
def matrix_send_expiry_reminders_test(to: Optional[str] = None):
    """Kirim satu email contoh (format reminder) ke alamat `to` untuk uji Brevo."""
    from services.email_service import email_service

    if not email_service.api_key:
        raise HTTPException(
            status_code=503,
            detail="BREVO_API_KEY tidak dikonfigurasi di server",
        )

    recipient = (to or "").strip() or "ade.basir@weatherford.com"
    today = date.today()
    sample_expiry = today + timedelta(days=90)
    sample_items = [
        {
            "sheet_label": "Kesehatan Personel",
            "personnel_name": "SAMPLE — Tes Reminder MCU",
            "column_label": "MCU Expired",
            "expiry_date": sample_expiry.isoformat(),
            "days_until": 90,
            "client": "SAMPLE CLIENT",
            "project": "SAMPLE PROJECT",
            "product_line": "HSE",
        },
        {
            "sheet_label": "Pelatihan Wajib",
            "personnel_name": "SAMPLE — Tes Reminder BST",
            "column_label": "BST Expiry Date",
            "expiry_date": (sample_expiry + timedelta(days=1)).isoformat(),
            "days_until": 91,
            "client": "SAMPLE CLIENT",
            "project": "SAMPLE PROJECT",
            "product_line": "HSE",
        },
    ]

    ok = email_service.send_matrix_expiry_reminder(
        [recipient],
        sample_items,
        reminder_days=90,
        product_line_name="HSE (TEST)",
    )
    if not ok:
        raise HTTPException(status_code=502, detail="Brevo menolak pengiriman — cek log server")

    return {
        "sent": True,
        "test": True,
        "recipient": recipient,
        "subject": f"[CSMS Matrix HSE (TEST)] Reminder — {len(sample_items)} dokumen akan expired (90 hari)",
        "sample_items": sample_items,
        "message": f"Email contoh terkirim ke {recipient}. Cek inbox/spam.",
    }


@router.post("/matrix/send-expiry-reminders")
@router.get("/matrix/send-expiry-reminders")
def matrix_send_expiry_reminders(force: bool = False):
    """Send Brevo email digest per Product Line for matrix items expiring in ~90 days."""
    from database import get_product_lines
    from services.email_service import email_service
    from services.matrix_expiry_reminder import (
        MATRIX_REMINDER_DAYS,
        collect_expiry_reminders,
        group_items_by_product_line,
    )

    if not email_service.api_key:
        return {"sent": False, "message": "Brevo API key tidak dikonfigurasi", "count": 0}

    product_lines = get_product_lines()
    workbook = get_workbook()
    items = collect_expiry_reminders(workbook, reminder_days=MATRIX_REMINDER_DAYS)
    if not force:
        items = filter_unsent_reminders(items)
    if not items:
        return {
            "sent": False,
            "message": f"Tidak ada kolom yang akan expired ~{MATRIX_REMINDER_DAYS} hari",
            "count": 0,
        }

    groups = group_items_by_product_line(items, product_lines)
    sent_total = 0
    sent_pl = []
    skipped = []
    all_sent_items = []

    for pl_key, group in groups.items():
        recipients = group["recipients"]
        pl_items = group["items"]
        pl_name = group["product_line_name"]
        if not recipients:
            skipped.append({"product_line": pl_name, "reason": "belum ada email penerima"})
            continue
        by_reminder_days: Dict[int, list] = {}
        for it in pl_items:
            rd = int(it.get("reminder_days") or MATRIX_REMINDER_DAYS)
            by_reminder_days.setdefault(rd, []).append(it)
        pl_sent = 0
        for rd, day_items in by_reminder_days.items():
            ok = email_service.send_matrix_expiry_reminder(
                recipients,
                day_items,
                reminder_days=rd,
                product_line_name=pl_name,
            )
            if ok:
                pl_sent += len(day_items)
                all_sent_items.extend(day_items)
        if pl_sent:
            sent_total += pl_sent
            sent_pl.append({"product_line": pl_name, "count": pl_sent, "recipients": recipients})

    if all_sent_items:
        log_reminder_sent(all_sent_items)

    if sent_pl:
        return {
            "sent": True,
            "message": f"Email reminder terkirim untuk {len(sent_pl)} product line",
            "count": sent_total,
            "product_lines": sent_pl,
            "skipped": skipped,
        }

    return {
        "sent": False,
        "message": "Tidak ada email terkirim — pastikan Product Line di Master sudah diisi email",
        "count": 0,
        "skipped": skipped,
    }


class MatrixPersonnelReportBody(BaseModel):
    title: str = "CERTIFICATION AND TRAINING"
    subtitle: str = ""
    tab_label: str = ""
    sheet_id: str = ""
    filters: Dict[str, str] = {}
    kpis: List[Dict[str, Any]] = []
    personnel: Dict[str, Any] = {}
    table: Dict[str, Any] = {}
    charts: Dict[str, Any] = {}
    chart_images: Dict[str, str] = {}
    chart_data: Dict[str, Any] = {}


@router.post("/matrix/personnel-report/pdf")
def matrix_personnel_report_pdf(body: MatrixPersonnelReportBody):
    """Landscape PDF report for selected personnel row and active sheet/filters."""
    from services.matrix_personnel_pdf import build_matrix_personnel_pdf, suggested_download_name

    try:
        data = body.model_dump()
        pdf_bytes = build_matrix_personnel_pdf(data)
        filename = suggested_download_name(data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gagal membuat PDF: {e}") from e
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/matrix/workbook")
def matrix_workbook():
    return get_workbook()


@router.post("/matrix/ensure-doc-columns")
def matrix_ensure_doc_columns():
    """Create missing Doc:* columns without blocking workbook load."""
    try:
        return ensure_doc_columns()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/matrix/status")
def matrix_status():
    """Report whether matrix CRUD persists to Supabase or local JSON fallback."""
    return {
        "storage": "supabase" if SUPABASE_MATRIX else "json",
        "persisted": bool(SUPABASE_MATRIX),
    }


@router.post("/matrix/seed")
def matrix_seed_from_json():
    """Re-load workbook from data/matrix_workbook.json into Supabase (after SQL migration)."""
    from pathlib import Path
    import json

    path = Path(__file__).resolve().parent.parent / "data" / "matrix_workbook.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="matrix_workbook.json not found")
    workbook = json.loads(path.read_text(encoding="utf-8"))
    try:
        from services.matrix_store import SUPABASE_MATRIX, seed_workbook
        from services.supabase_service import supabase_service

        if not SUPABASE_MATRIX:
            raise HTTPException(
                status_code=503,
                detail="Supabase not configured (SUPABASE_URL / SUPABASE_KEY)",
            )
        supabase_service.seed_matrix_workbook(workbook)
    except HTTPException:
        raise
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return {"ok": True, "sheets": len(workbook.get("sheets", []))}


@router.get("/matrix/sheets/{sheet_id}")
def matrix_sheet(sheet_id: str):
    try:
        return get_sheet(sheet_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Sheet not found")


@router.post("/matrix/sheets/{sheet_id}/rows")
def matrix_add_row(sheet_id: str, body: RowCellsBody):
    try:
        return add_row(sheet_id, body.cells)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/matrix/sheets/{sheet_id}/rows/{row_id}")
def matrix_update_row(sheet_id: str, row_id: str, body: RowCellsBody):
    try:
        return update_row(sheet_id, row_id, body.cells)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/matrix/sheets/{sheet_id}/rows/{row_id}")
def matrix_delete_row(sheet_id: str, row_id: str):
    try:
        delete_row(sheet_id, row_id)
        return {"ok": True}
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/matrix/sheets/{sheet_id}/columns")
def matrix_add_column(sheet_id: str, body: ColumnCreateBody):
    try:
        return add_column(
            sheet_id,
            body.label,
            body.type,
            body.filterable,
            col_id=body.col_id,
            col_key=body.col_key,
        )
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        if "23505" in str(e) or "duplicate key" in str(e).lower():
            from services.supabase_service import supabase_service

            if supabase_service.enabled:
                db_col = supabase_service._get_matrix_column_db(
                    sheet_id, col_id=body.col_id, label=body.label
                )
                if db_col:
                    return supabase_service._matrix_col_to_api(db_col)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/matrix/sheets/{sheet_id}/columns/{col_id}")
def matrix_update_column(sheet_id: str, col_id: str, body: ColumnUpdateBody):
    try:
        return update_column(sheet_id, col_id, body.dict(exclude_none=True))
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/matrix/sheets/{sheet_id}/columns/{col_id}")
def matrix_delete_column(sheet_id: str, col_id: str):
    try:
        delete_column(sheet_id, col_id)
        return {"ok": True}
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/matrix/profile-photo/view/{file_id}")
async def matrix_view_profile_photo(file_id: str):
    """Stream profile photo inline (for img tags)."""
    if not drive_service.enabled or not drive_service.service:
        raise HTTPException(status_code=503, detail="Google Drive not configured")
    try:
        import io
        from googleapiclient.http import MediaIoBaseDownload

        meta = drive_service.service.files().get(fileId=file_id, fields="name,mimeType").execute()
        request = drive_service.service.files().get_media(fileId=file_id)
        buf = io.BytesIO()
        downloader = MediaIoBaseDownload(buf, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type=meta.get("mimeType", "image/jpeg"),
            headers={"Content-Disposition": f'inline; filename="{meta.get("name", "photo")}"'},
        )
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Photo not found: {e}")


@router.post("/matrix/profile-photo/initiate-upload")
def matrix_initiate_profile_upload(
    filename: str = Form(...),
    mime_type: str = Form(default="image/jpeg"),
    personnel_name: str = Form(...),
):
    if not drive_service.enabled:
        raise HTTPException(status_code=503, detail="Google Drive not configured")
    parent_id = _personnel_photo_folder(personnel_name)
    upload_url, _ = drive_service.get_resumable_upload_session(filename, mime_type, parent_id=parent_id)
    if not upload_url:
        raise HTTPException(status_code=500, detail="Gagal memulai upload ke Google Drive")
    return {"upload_url": upload_url}


@router.post("/matrix/profile-photo/upload-chunk")
async def matrix_profile_upload_chunk(
    sheet_id: str = Form(...),
    row_id: str = Form(...),
    col_id: str = Form(default="col_photo"),
    personnel_name: str = Form(...),
    filename: str = Form(...),
    upload_url: str = Form(...),
    chunk_index: int = Form(...),
    total_chunks: int = Form(...),
    start_byte: int = Form(...),
    total_size: int = Form(...),
    chunk_file: UploadFile = File(...),
):
    try:
        chunk_data = await chunk_file.read()
        chunk_size = len(chunk_data)
        end_byte = start_byte + chunk_size - 1
        headers = {
            "Content-Range": f"bytes {start_byte}-{end_byte}/{total_size}",
            "Content-Length": str(chunk_size),
        }
        response = requests.put(upload_url, headers=headers, data=chunk_data)
        if response.status_code not in (200, 201, 308):
            raise HTTPException(status_code=response.status_code, detail=response.text)

        if chunk_index != total_chunks - 1:
            return {"status": "chunk_accepted", "next_expected": end_byte + 1}

        res_data = response.json()
        file_id = res_data.get("id")
        if not file_id:
            raise HTTPException(status_code=500, detail="Upload selesai tanpa file_id dari Google Drive")

        update_row(sheet_id, row_id, {col_id: file_id})
        return {"status": "complete", "file_id": file_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/matrix/profile-photo/upload")
async def matrix_profile_upload_simple(
    sheet_id: str = Form(...),
    row_id: str = Form(...),
    col_id: str = Form(default="col_photo"),
    personnel_name: str = Form(...),
    file: UploadFile = File(...),
):
    """Direct upload for small profile photos."""
    if not drive_service.enabled:
        raise HTTPException(status_code=503, detail="Google Drive not configured")
    content = await file.read()
    parent_id = _personnel_photo_folder(personnel_name)
    safe_name = re.sub(r'[\\/:*?"<>|]+', "-", file.filename or "profile.jpg")
    file_id = drive_service.upload_file_to_parent(safe_name, content, parent_id)
    if not file_id:
        raise HTTPException(status_code=500, detail="Gagal mengunggah foto ke Google Drive")
    update_row(sheet_id, row_id, {col_id: file_id})
    return {"file_id": file_id}


@router.get("/matrix/document/view/{file_id}")
async def matrix_view_document(file_id: str):
    """Stream uploaded matrix document (inline or download)."""
    if not drive_service.enabled or not drive_service.service:
        raise HTTPException(status_code=503, detail="Google Drive not configured")
    try:
        import io
        from googleapiclient.http import MediaIoBaseDownload

        meta = drive_service.service.files().get(fileId=file_id, fields="name,mimeType").execute()
        request = drive_service.service.files().get_media(fileId=file_id)
        buf = io.BytesIO()
        downloader = MediaIoBaseDownload(buf, request)
        done = False
        while not done:
            _, done = downloader.next_chunk()
        buf.seek(0)
        filename = meta.get("name", "document")
        return StreamingResponse(
            buf,
            media_type=meta.get("mimeType", "application/octet-stream"),
            headers={"Content-Disposition": f'inline; filename="{filename}"'},
        )
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Document not found: {e}")


@router.post("/matrix/document/initiate-upload")
def matrix_initiate_document_upload(
    filename: str = Form(...),
    mime_type: str = Form(default="application/octet-stream"),
    personnel_name: str = Form(...),
    column_name: str = Form(...),
    sheet_id: Optional[str] = Form(default=None),
    row_id: Optional[str] = Form(default=None),
    col_id: Optional[str] = Form(default=None),
    product_line: Optional[str] = Form(default=None),
):
    if not drive_service.enabled:
        raise HTTPException(status_code=503, detail="Google Drive not configured")
    if sheet_id and row_id and col_id:
        filename = _resolve_matrix_document_filename(
            sheet_id, row_id, col_id, personnel_name, column_name, filename,
            product_line=product_line or "",
        )
    else:
        filename = _sanitize_doc_filename(filename)
    parent_id = _document_upload_parent_for_matrix(
        column_name,
        personnel_name,
        sheet_id or "",
        col_id or "",
        product_line=product_line or "",
        row_id=row_id or "",
    )
    upload_url, _ = drive_service.get_resumable_upload_session(filename, mime_type, parent_id=parent_id)
    if not upload_url:
        raise HTTPException(status_code=500, detail="Gagal memulai upload ke Google Drive")
    return {"upload_url": upload_url}


@router.post("/matrix/document/upload-chunk")
async def matrix_document_upload_chunk(
    sheet_id: str = Form(...),
    row_id: str = Form(...),
    col_id: str = Form(...),
    personnel_name: str = Form(...),
    column_name: str = Form(...),
    filename: str = Form(...),
    upload_url: str = Form(...),
    chunk_index: int = Form(...),
    total_chunks: int = Form(...),
    start_byte: int = Form(...),
    total_size: int = Form(...),
    chunk_file: UploadFile = File(...),
    product_line: Optional[str] = Form(default=None),
):
    try:
        chunk_data = await chunk_file.read()
        chunk_size = len(chunk_data)
        end_byte = start_byte + chunk_size - 1
        headers = {
            "Content-Range": f"bytes {start_byte}-{end_byte}/{total_size}",
            "Content-Length": str(chunk_size),
        }
        response = requests.put(upload_url, headers=headers, data=chunk_data)
        if response.status_code not in (200, 201, 308):
            raise HTTPException(status_code=response.status_code, detail=response.text)

        if chunk_index != total_chunks - 1:
            return {"status": "chunk_accepted", "next_expected": end_byte + 1}

        res_data = response.json()
        file_id = res_data.get("id")
        if not file_id:
            raise HTTPException(status_code=500, detail="Upload selesai tanpa file_id dari Google Drive")

        stored_name = _resolve_matrix_document_filename(
            sheet_id, row_id, col_id, personnel_name, column_name, filename,
            product_line=product_line or "",
        )
        stored = _format_doc_cell(file_id, stored_name)
        update_row(sheet_id, row_id, {col_id: stored})
        return {"status": "complete", "file_id": file_id, "filename": stored_name, "stored": stored}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/matrix/document/upload")
async def matrix_document_upload_simple(
    sheet_id: str = Form(...),
    row_id: str = Form(...),
    col_id: str = Form(...),
    personnel_name: str = Form(...),
    column_name: str = Form(...),
    file: UploadFile = File(...),
    product_line: Optional[str] = Form(default=None),
):
    """Direct upload — stored under root / {column_name} / {personnel_name}."""
    if not drive_service.enabled:
        raise HTTPException(status_code=503, detail="Google Drive not configured")
    content = await file.read()
    parent_id = _document_upload_parent_for_matrix(
        column_name,
        personnel_name,
        sheet_id,
        col_id,
        product_line=product_line or "",
        row_id=row_id,
    )
    safe_name = _resolve_matrix_document_filename(
        sheet_id,
        row_id,
        col_id,
        personnel_name,
        column_name,
        file.filename or "document",
        product_line=product_line or "",
    )
    file_id = drive_service.upload_file_to_parent(safe_name, content, parent_id)
    if not file_id:
        raise HTTPException(status_code=500, detail="Gagal mengunggah dokumen ke Google Drive")
    stored = _format_doc_cell(file_id, safe_name)
    update_row(sheet_id, row_id, {col_id: stored})
    return {"file_id": file_id, "filename": safe_name, "stored": stored}
