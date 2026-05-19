"""Helpers for Client + Product Line Drive template folder names."""
import re


def _sanitize_part(part: str) -> str:
    """Letters, numbers, underscore, hyphen; other chars → underscore."""
    part = (part or "").strip()
    part = re.sub(r"[^\w\-]+", "_", part, flags=re.UNICODE)
    part = re.sub(r"_+", "_", part).strip("_")
    return part


def build_template_folder_name(client_name: str, product_line_name: str) -> str:
    """
    Build a stable Drive folder name: CLIENTNAME_PRODUCTLINE
    """
    client_part = _sanitize_part(client_name)
    pl_part = _sanitize_part(product_line_name)
    if not client_part or not pl_part:
        raise ValueError("Client name and Product Line name are required")
    return f"{client_part}_{pl_part}"


def build_project_display_name(
    client_name: str, product_line_name: str, project_name: str
) -> str:
    """
    Canonical project name for DB list + Google Drive folder:
    CLIENTNAME_PRODUCTLINE_PROJECTNAME
    """
    client_part = _sanitize_part(client_name)
    pl_part = _sanitize_part(product_line_name)
    proj_part = _sanitize_part(project_name)
    if not client_part or not pl_part or not proj_part:
        raise ValueError("Client, Product Line, and project name are required")
    return f"{client_part}_{pl_part}_{proj_part}"
