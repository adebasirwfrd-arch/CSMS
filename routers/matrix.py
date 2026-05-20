"""HSE Personnel Matrix workbook API (admin UI)."""
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

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
