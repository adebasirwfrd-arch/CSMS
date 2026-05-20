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
    add_column,
    add_row,
    delete_column,
    delete_row,
    get_sheet,
    get_workbook,
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


class RowCellsBody(BaseModel):
    cells: Dict[str, str] = Field(default_factory=dict)


class ColumnCreateBody(BaseModel):
    label: str
    type: str = "text"
    filterable: bool = True


class ColumnUpdateBody(BaseModel):
    label: Optional[str] = None
    type: Optional[str] = None
    filterable: Optional[bool] = None


@router.get("/matrix/workbook")
def matrix_workbook():
    return get_workbook()


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
        return add_column(sheet_id, body.label, body.type, body.filterable)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))


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
