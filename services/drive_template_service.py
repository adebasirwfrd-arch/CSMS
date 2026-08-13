import asyncio
import os
from typing import Dict, List, Optional, Tuple

import requests

from .google_drive import drive_service
from .logger_service import log_info, log_error, log_warning

GAS_URL = (
    "https://script.google.com/macros/s/"
    "AKfycbywzZs9ADxmgr9l3EFhzdbsmPjROj-Xh8APm04ecSYqIL4rUsaDUEh4CGarLDiV_j8MDA/exec"
)


def _gas_timeouts() -> Tuple[float, float]:
    """(connect_seconds, read_seconds) for GAS web-app trigger."""
    connect = float(os.getenv("GAS_CLONE_CONNECT_TIMEOUT", "15"))
    read = float(os.getenv("GAS_CLONE_READ_TIMEOUT", "90"))
    return connect, read


def _gas_max_retries() -> int:
    return max(1, int(os.getenv("GAS_CLONE_MAX_RETRIES", "3")))


def trigger_gas_clone(source_id: str, target_id: str, name: str) -> bool:
    """
    Fire-and-forget trigger to Google Apps Script clone webhook.
    Retries on timeout / connection errors. Returns True if HTTP accepted.
    """
    payload = {
        "sourceId": source_id,
        "destinationId": target_id,
        "projectTitle": name,
    }
    connect_timeout, read_timeout = _gas_timeouts()
    last_error: Optional[Exception] = None

    for attempt in range(1, _gas_max_retries() + 1):
        try:
            resp = requests.post(
                GAS_URL,
                json=payload,
                timeout=(connect_timeout, read_timeout),
                allow_redirects=True,
            )
            # GAS may return 200/302 even while clone continues server-side
            if resp.status_code < 500:
                log_info(
                    "TEMPLATE",
                    f"GAS trigger OK for {name} (attempt {attempt}, status={resp.status_code})",
                )
                return True
            last_error = RuntimeError(f"HTTP {resp.status_code}: {resp.text[:200]}")
        except requests.exceptions.Timeout as e:
            last_error = e
            log_warning(
                "TEMPLATE",
                f"GAS trigger timeout for {name} (attempt {attempt}/{_gas_max_retries()})",
            )
        except requests.exceptions.RequestException as e:
            last_error = e
            log_warning(
                "TEMPLATE",
                f"GAS trigger failed for {name} (attempt {attempt}/{_gas_max_retries()}): {e}",
            )

        if attempt < _gas_max_retries():
            import time

            time.sleep(min(2 ** (attempt - 1), 8))

    log_error(
        "TEMPLATE",
        f"GAS trigger exhausted retries for {name}: {last_error}",
        last_error,
        send_email=False,
    )
    return False


class DriveTemplateService:
    def __init__(self):
        self.master_template_id = "1lWxdLWnw3VBcpEsQJmzVPXzC4WbeS_3o"

    async def clone_template_to_project(
        self, project_folder_id: str, source_folder_id: str = None
    ):
        """
        Trigger PARALLEL Google Apps Script executions.
        Instead of 1 big clone, we split it by top-level folders (Element 0, 1, 2...).

        Args:
            project_folder_id: Destination folder (project or CLIENT_PRODUCTLINE template).
            source_folder_id: Source template folder; defaults to master_template_id.
        """
        source_id = source_folder_id or self.master_template_id

        log_info(
            "TEMPLATE",
            f"Parallel GAS clone dest={project_folder_id} source={source_id}",
        )

        try:
            elements = drive_service.fetch_files_in_folder(source_id)
            if not elements:
                log_error("TEMPLATE", "Master template is empty!", send_email=True)
                return

            element_folders = [
                e for e in elements if e["mimeType"] == "application/vnd.google-apps.folder"
            ]
            log_info(
                "TEMPLATE",
                f"Found {len(element_folders)} elements to clone in parallel.",
            )

            loop = asyncio.get_running_loop()
            tasks = []

            for element in element_folders:
                elem_name = drive_service._safe_drive_folder_name(element.get("name") or "")
                elem_id = element["id"]
                if not elem_name:
                    log_warning("TEMPLATE", "Skipping untitled template folder during clone")
                    continue

                dest_elem_id = await loop.run_in_executor(
                    None,
                    lambda n=elem_name, pid=project_folder_id: drive_service.find_or_create_folder(
                        n, pid
                    ),
                )

                if dest_elem_id:
                    log_info("TEMPLATE", f"Triggering GAS for: {elem_name}...")
                    tasks.append(
                        loop.run_in_executor(
                            None,
                            lambda s=elem_id, t=dest_elem_id, n=elem_name: trigger_gas_clone(
                                s, t, n
                            ),
                        )
                    )

            if not tasks:
                log_warning("TEMPLATE", "No element folders to clone")
                return

            results = await asyncio.gather(*tasks, return_exceptions=True)
            ok = sum(1 for r in results if r is True)
            failed = len(results) - ok
            exc_count = sum(1 for r in results if isinstance(r, Exception))

            log_info(
                "TEMPLATE",
                f"GAS triggers finished: {ok} ok, {failed} failed ({exc_count} exceptions)",
            )

            if ok == 0:
                log_error(
                    "TEMPLATE",
                    "All parallel GAS clone triggers failed — check GAS deployment / timeouts",
                    send_email=True,
                )
            elif failed > 0:
                log_warning(
                    "TEMPLATE",
                    f"{failed} GAS trigger(s) failed; clone may be incomplete — retry template generation",
                )

        except Exception as e:
            log_error("TEMPLATE", f"Error during parallel clone trigger: {e}", e, send_email=True)

    async def get_template_structure(self) -> List[Dict[str, str]]:
        """Scan the master template and return a flat list of folder hierarchy for task creation."""
        if not drive_service.enabled or not drive_service.service:
            return []

        log_info("TEMPLATE", "Scanning master template structure for task sync")
        tasks = []
        await self._scan_recursive(self.master_template_id, tasks)
        return tasks

    async def _scan_recursive(
        self, folder_id: str, tasks_list: List[Dict[str, str]], current_path: str = ""
    ):
        """Scan folder names to extract codes and titles for task metadata."""
        if not drive_service.enabled or not drive_service.service:
            log_warning("TEMPLATE", "Drive service not available for scanning")
            return

        all_items = drive_service.fetch_files_in_folder(folder_id)
        folders = [
            item
            for item in all_items
            if item.get("mimeType") == "application/vnd.google-apps.folder"
        ]

        folder_idx = 1

        for folder in folders:
            name = folder["name"]
            f_id = folder["id"]

            parts = name.split(" ", 1)
            code = parts[0]
            title = parts[1] if len(parts) > 1 else ""

            is_element_0 = current_path.upper() == "ELEMENT 0"
            if is_element_0 and not (any(c.isdigit() for c in code) and "." in code):
                code = f"0.{folder_idx}"
                title = name
                folder_idx += 1

            if any(c.isdigit() for c in code) and "." in code:
                element_num = code.split(".")[0]
                category_map = {
                    "0": "Core Documents",
                    "1": "Management",
                    "2": "Safety Signs",
                    "3": "HSE Facilities",
                    "4": "Safety Committee",
                    "5": "Inspection",
                    "6": "Security",
                }
                category = category_map.get(element_num, "Other")

                tasks_list.append(
                    {
                        "code": code,
                        "title": title.upper() if title else code,
                        "category": category,
                    }
                )

            await self._scan_recursive(f_id, tasks_list, name)


template_service = DriveTemplateService()
