"""
Google Drive operations for Client + Product Line template folders.
"""
from typing import Optional, Tuple

from database import (
    get_client,
    get_product_line,
    get_client_product_template,
    upsert_client_product_template,
)
from services.google_drive import drive_service
from services.drive_template_service import template_service
from services.template_naming import build_template_folder_name
from services.logger_service import log_info, log_error, log_warning


def resolve_template_source_folder(
    client_id: int, product_line_id: int
) -> Tuple[Optional[str], Optional[str]]:
    """
    Resolve the Drive folder id to clone FROM for a client + product line pair.

    Returns:
        (drive_folder_id, template_folder_name) or (None, folder_name) if missing.
    """
    client = get_client(client_id)
    pl = get_product_line(product_line_id)
    if not client or not pl:
        return None, None

    folder_name = build_template_folder_name(client["name"], pl["name"])

    record = get_client_product_template(client_id, product_line_id)
    if record and record.get("drive_folder_id"):
        return record["drive_folder_id"], folder_name

    folder_id = drive_service.find_folder(folder_name)
    if folder_id:
        upsert_client_product_template(
            {
                "client_id": client_id,
                "product_line_id": product_line_id,
                "template_folder_name": folder_name,
                "drive_folder_id": folder_id,
            }
        )
        return folder_id, folder_name

    return None, folder_name


def template_folder_has_elements(folder_id: str) -> bool:
    """True if folder already has at least one ELEMENT* subfolder."""
    if not folder_id or not drive_service.enabled:
        return False
    items = drive_service.fetch_files_in_folder(folder_id)
    for item in items:
        name = (item.get("name") or "").upper()
        if item.get("mimeType") == "application/vnd.google-apps.folder" and name.startswith(
            "ELEMENT"
        ):
            return True
    return False


async def generate_client_product_template(client_id: int, product_line_id: int) -> dict:
    """
    Create or refresh CLIENTNAME_PRODUCTLINE under GOOGLE_DRIVE_FOLDER_ID
    by cloning the global master template into it.
    """
    client = get_client(client_id)
    pl = get_product_line(product_line_id)
    if not client or not pl:
        raise ValueError("Client or Product Line not found")

    folder_name = build_template_folder_name(client["name"], pl["name"])

    if not drive_service.enabled:
        raise RuntimeError("Google Drive is not configured or authenticated")

    template_folder_id = drive_service.find_or_create_folder(folder_name)
    if not template_folder_id:
        raise RuntimeError(f"Could not create template folder: {folder_name}")

    if not template_folder_has_elements(template_folder_id):
        log_info(
            "MASTER",
            f"Cloning master template into {folder_name} ({template_folder_id})",
        )
        await template_service.clone_template_to_project(
            template_folder_id,
            source_folder_id=template_service.master_template_id,
        )
    else:
        log_info("MASTER", f"Template folder already populated: {folder_name}")

    record = upsert_client_product_template(
        {
            "client_id": client_id,
            "product_line_id": product_line_id,
            "template_folder_name": folder_name,
            "drive_folder_id": template_folder_id,
        }
    )

    return {
        "status": "success",
        "template_folder_name": folder_name,
        "drive_folder_id": template_folder_id,
        "record": record,
        "message": f"Template folder '{folder_name}' is ready. GAS may still be copying subfolders.",
    }
