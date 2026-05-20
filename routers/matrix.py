"""HSE Personnel Matrix workbook API (admin UI)."""
import os
import re
from typing import Any, Dict, Optional

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


def _sanitize_folder_name(name: str) -> str:
    cleaned = re.sub(r'[\\/:*?"<>|]+', "-", (name or "").strip())
    return (cleaned[:120] or "Unknown Personnel")


def _personnel_photo_folder(personnel_name: str) -> str:
    folder_name = _sanitize_folder_name(personnel_name)
    parent_id = drive_service.find_or_create_folder(folder_name, parent_id=MATRIX_PROFILE_ROOT)
    if not parent_id:
        raise HTTPException(status_code=500, detail="Gagal membuat folder personel di Google Drive")
    return parent_id


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


def _format_doc_cell(file_id: str, filename: str) -> str:
    safe = re.sub(r'[\\/:*?"<>|]+', "-", (filename or "document").strip()) or "document"
    return f"{file_id}::{safe}"


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
        ok = email_service.send_matrix_expiry_reminder(
            recipients,
            pl_items,
            reminder_days=MATRIX_REMINDER_DAYS,
            product_line_name=pl_name,
        )
        if ok:
            sent_total += len(pl_items)
            sent_pl.append({"product_line": pl_name, "count": len(pl_items), "recipients": recipients})
            all_sent_items.extend(pl_items)

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
):
    if not drive_service.enabled:
        raise HTTPException(status_code=503, detail="Google Drive not configured")
    parent_id = _document_upload_folder(column_name, personnel_name)
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

        stored = _format_doc_cell(file_id, filename)
        update_row(sheet_id, row_id, {col_id: stored})
        return {"status": "complete", "file_id": file_id, "filename": filename, "stored": stored}
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
):
    """Direct upload — stored under root / {column_name} / {personnel_name}."""
    if not drive_service.enabled:
        raise HTTPException(status_code=503, detail="Google Drive not configured")
    content = await file.read()
    parent_id = _document_upload_folder(column_name, personnel_name)
    safe_name = re.sub(r'[\\/:*?"<>|]+', "-", file.filename or "document")
    file_id = drive_service.upload_file_to_parent(safe_name, content, parent_id)
    if not file_id:
        raise HTTPException(status_code=500, detail="Gagal mengunggah dokumen ke Google Drive")
    stored = _format_doc_cell(file_id, safe_name)
    update_row(sheet_id, row_id, {col_id: stored})
    return {"file_id": file_id, "filename": safe_name, "stored": stored}
