"""API routes for Client, Product Line, and Drive template management."""
from fastapi import APIRouter, HTTPException, BackgroundTasks

from models.master_data import (
    Client,
    ClientCreate,
    ClientUpdate,
    ProductLine,
    ProductLineCreate,
    ProductLineUpdate,
    GenerateTemplateRequest,
)
from database import (
    get_clients,
    get_client,
    create_client,
    update_client,
    delete_client,
    get_product_lines,
    get_product_line,
    create_product_line,
    update_product_line,
    delete_product_line,
    get_client_product_templates,
)
from services.master_data_drive import generate_client_product_template
from services.logger_service import log_error, log_info

router = APIRouter(tags=["master-data"])


# ---------- Clients ----------

@router.get("/clients", response_model=list)
def list_clients():
    return get_clients()


@router.post("/clients", response_model=dict)
def add_client(body: ClientCreate):
    try:
        return create_client(body.dict())
    except Exception as e:
        log_error("MASTER", f"create_client failed: {e}", e)
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/clients/{client_id}", response_model=dict)
def edit_client(client_id: int, body: ClientUpdate):
    updates = {k: v for k, v in body.dict().items() if v is not None}
    result = update_client(client_id, updates)
    if not result:
        raise HTTPException(status_code=404, detail="Client not found")
    return result


@router.delete("/clients/{client_id}")
def remove_client(client_id: int):
    if not delete_client(client_id):
        raise HTTPException(status_code=404, detail="Client not found")
    return {"status": "deleted"}


# ---------- Product Lines ----------

@router.get("/product-lines", response_model=list)
def list_product_lines():
    return get_product_lines()


@router.post("/product-lines", response_model=dict)
def add_product_line(body: ProductLineCreate):
    try:
        return create_product_line(body.dict())
    except Exception as e:
        log_error("MASTER", f"create_product_line failed: {e}", e)
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/product-lines/{product_line_id}", response_model=dict)
def edit_product_line(product_line_id: int, body: ProductLineUpdate):
    updates = {k: v for k, v in body.dict().items() if v is not None}
    result = update_product_line(product_line_id, updates)
    if not result:
        raise HTTPException(status_code=404, detail="Product Line not found")
    return result


@router.delete("/product-lines/{product_line_id}")
def remove_product_line(product_line_id: int):
    if not delete_product_line(product_line_id):
        raise HTTPException(status_code=404, detail="Product Line not found")
    return {"status": "deleted"}


# ---------- Templates ----------

@router.get("/client-product-templates", response_model=list)
def list_client_product_templates():
    return get_client_product_templates()


@router.post("/generate-template")
async def generate_template(
    body: GenerateTemplateRequest, background_tasks: BackgroundTasks
):
    """Create CLIENTNAME_PRODUCTLINE folder under Drive root and clone master template."""
    client = get_client(body.client_id)
    pl = get_product_line(body.product_line_id)
    if not client or not pl:
        raise HTTPException(status_code=404, detail="Client or Product Line not found")

    async def _task():
        try:
            await generate_client_product_template(body.client_id, body.product_line_id)
        except Exception as e:
            log_error("MASTER", f"generate_template background failed: {e}", e)

    background_tasks.add_task(_task)
    log_info(
        "MASTER",
        f"Queued template generation for client={body.client_id} pl={body.product_line_id}",
    )
    return {
        "status": "started",
        "message": (
            f"Membuat folder template untuk {client['name']} + {pl['name']}. "
            "Proses clone berjalan di background (beberapa menit)."
        ),
    }
