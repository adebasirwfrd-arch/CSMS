"""Helpers for Client + Product Line Drive template folder names."""
import re


def build_template_folder_name(client_name: str, product_line_name: str) -> str:
    """
    Build a stable Drive folder name: CLIENTNAME_PRODUCTLINE
    (non-alphanumeric characters collapsed to underscores).
    """
    def sanitize(part: str) -> str:
        part = (part or "").strip()
        part = re.sub(r"[^\w]+", "_", part, flags=re.UNICODE)
        part = re.sub(r"_+", "_", part).strip("_")
        return part

    client_part = sanitize(client_name)
    pl_part = sanitize(product_line_name)
    if not client_part or not pl_part:
        raise ValueError("Client name and Product Line name are required")
    return f"{client_part}_{pl_part}"
