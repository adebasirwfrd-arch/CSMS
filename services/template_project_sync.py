"""
Sync client template (modal) folders to project folders without removing app uploads.

Template files are tracked via Drive appProperties:
  csms_origin=template, csms_template_source_id=<source file id in modal>

Files uploaded through CSMS tasks use csms_origin=upload and/or appear in task attachments
(protected from deletion).
"""
from __future__ import annotations

from typing import Dict, List, Set, Any

from database import (
    get_projects_for_client_product_line,
    collect_protected_drive_file_ids,
    update_project_drive_folder,
)
from services.google_drive import drive_service
from services.logger_service import log_info, log_error, log_warning

FOLDER_MIME = "application/vnd.google-apps.folder"
APP_ORIGIN = "csms_origin"
APP_TEMPLATE_SOURCE = "csms_template_source_id"
ORIGIN_TEMPLATE = "template"
ORIGIN_UPLOAD = "upload"


def _app_props(item: Dict[str, Any]) -> Dict[str, str]:
    return item.get("appProperties") or {}


def _is_folder(item: Dict[str, Any]) -> bool:
    return item.get("mimeType") == FOLDER_MIME


async def sync_template_folder_to_project_folder(
    template_folder_id: str,
    project_folder_id: str,
    protected_file_ids: Set[str],
    stats: Dict[str, int],
) -> None:
    """Mirror one template folder level into the matching project folder."""
    if not template_folder_id or not project_folder_id:
        return

    tpl_items = drive_service.fetch_files_in_folder(template_folder_id, include_app_properties=True)
    proj_items = drive_service.fetch_files_in_folder(project_folder_id, include_app_properties=True)

    tpl_folders = [i for i in tpl_items if _is_folder(i)]
    tpl_files = [i for i in tpl_items if not _is_folder(i)]
    proj_files = [i for i in proj_items if not _is_folder(i)]

    tpl_by_name = {f["name"]: f for f in tpl_files}
    tpl_ids = {f["id"] for f in tpl_files}

    proj_by_name: Dict[str, Dict] = {}
    proj_by_source: Dict[str, Dict] = {}
    for f in proj_files:
        proj_by_name[f["name"]] = f
        src = _app_props(f).get(APP_TEMPLATE_SOURCE)
        if src:
            proj_by_source[src] = f

    # Add missing template files; link existing copies to template source ids
    for tpl_file in tpl_files:
        name = tpl_file["name"]
        src_id = tpl_file["id"]

        proj_file = proj_by_source.get(src_id)
        if not proj_file and name in proj_by_name:
            candidate = proj_by_name[name]
            cid = candidate["id"]
            props = _app_props(candidate)
            if cid not in protected_file_ids and props.get(APP_ORIGIN) != ORIGIN_UPLOAD:
                proj_file = candidate

        if not proj_file:
            new_id = await drive_service.copy_file_as_template(
                src_id, project_folder_id, name, src_id
            )
            if new_id:
                stats["added"] += 1
                log_info("TEMPLATE_SYNC", f"Added {name} -> {new_id}")
        else:
            pid = proj_file["id"]
            if pid not in protected_file_ids and _app_props(proj_file).get(APP_ORIGIN) != ORIGIN_UPLOAD:
                if drive_service.ensure_template_file_properties(pid, src_id):
                    stats["tagged"] += 1

    # Remove template-managed files deleted from modal; keep uploads & protected files
    for proj_file in proj_files:
        fid = proj_file["id"]
        if fid in protected_file_ids:
            continue

        props = _app_props(proj_file)
        if props.get(APP_ORIGIN) == ORIGIN_UPLOAD:
            continue

        src_id = props.get(APP_TEMPLATE_SOURCE)
        if src_id:
            if src_id not in tpl_ids:
                if drive_service.trash_file(fid):
                    stats["removed"] += 1
                    log_info("TEMPLATE_SYNC", f"Removed template file {proj_file.get('name')}")
            continue

        # Legacy GAS copies: tag when name still exists in modal; never delete untagged files
        name = proj_file.get("name")
        if name in tpl_by_name:
            tpl_src = tpl_by_name[name]["id"]
            if drive_service.ensure_template_file_properties(fid, tpl_src):
                stats["tagged"] += 1

    for tpl_sub in tpl_folders:
        sub_name = tpl_sub["name"]
        proj_sub_id = drive_service.find_or_create_folder(sub_name, project_folder_id)
        if proj_sub_id:
            await sync_template_folder_to_project_folder(
                tpl_sub["id"], proj_sub_id, protected_file_ids, stats
            )


async def propagate_template_to_project(
    template_folder_id: str, project: Dict[str, Any]
) -> Dict[str, int]:
    """Apply modal folder structure/files to one project folder."""
    stats = {"added": 0, "removed": 0, "tagged": 0, "skipped": 0}
    project_folder_id = project.get("drive_folder_id")
    if not project_folder_id:
        project_folder_id = drive_service.find_folder(project["name"])
        if project_folder_id:
            update_project_drive_folder(project["id"], project_folder_id)

    if not project_folder_id:
        log_warning(
            "TEMPLATE_SYNC",
            f"No Drive folder for project {project.get('name')}; skipping",
        )
        stats["skipped"] = 1
        return stats

    protected = collect_protected_drive_file_ids(project["id"])
    await sync_template_folder_to_project_folder(
        template_folder_id, project_folder_id, protected, stats
    )
    return stats


async def propagate_client_template_to_all_projects(
    client_id: int, product_line_id: int
) -> Dict[str, Any]:
    """
    Push modal (CLIENT_PRODUCTLINE) changes to every project with the same client + PL.
    """
    from services.master_data_drive import resolve_template_source_folder

    template_id, template_name = resolve_template_source_folder(client_id, product_line_id)
    if not template_id:
        raise ValueError(
            f"Folder template '{template_name or 'CLIENT_PRODUCTLINE'}' belum ada. "
            "Buat dulu di Master Data."
        )

    projects = get_projects_for_client_product_line(client_id, product_line_id)
    if not projects:
        return {
            "status": "success",
            "template_folder": template_name,
            "projects_updated": 0,
            "message": "Tidak ada proyek untuk kombinasi Client + Product Line ini.",
            "details": [],
        }

    if not drive_service.enabled:
        raise RuntimeError("Google Drive tidak aktif")

    totals = {"added": 0, "removed": 0, "tagged": 0, "skipped": 0}
    details: List[Dict[str, Any]] = []

    for project in projects:
        try:
            stats = await propagate_template_to_project(template_id, project)
            for k in totals:
                totals[k] += stats.get(k, 0)
            details.append({"project": project.get("name"), **stats})
            log_info("TEMPLATE_SYNC", f"Synced {project.get('name')}: {stats}")
        except Exception as e:
            log_error("TEMPLATE_SYNC", f"Failed {project.get('name')}: {e}", e)
            details.append(
                {"project": project.get("name"), "error": str(e)}
            )

    return {
        "status": "success",
        "template_folder": template_name,
        "template_folder_id": template_id,
        "projects_updated": len(projects),
        "totals": totals,
        "details": details,
        "message": (
            f"Sinkron selesai untuk {len(projects)} proyek "
            f"(+{totals['added']} file, -{totals['removed']} file template, "
            f"{totals['tagged']} ditandai)."
        ),
    }
