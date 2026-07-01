"""Generate CSMS track report Excel and upload to Google Drive."""

from __future__ import annotations

import os
import tempfile
from datetime import datetime
from typing import Dict, List

try:
    from openpyxl import Workbook
except ImportError:
    Workbook = None

from services.logger_service import log_error, log_info, log_warning


def _writable_temp_path(filename: str) -> str:
    """Return a temp path that works on Vercel/Lambda (read-only cwd, /tmp writable)."""
    base = os.getenv("TMPDIR") or tempfile.gettempdir()
    return os.path.join(base, filename)


class ExcelSyncService:
    def __init__(self, drive_service):
        self.drive_service = drive_service
        self.temp_file = _writable_temp_path("CSMS_Report.xlsx")

    async def sync_to_drive(self, projects: List[Dict], tasks: List[Dict]) -> None:
        """Background-safe: never raises; logs and cleans up temp files."""
        if not self.drive_service.enabled:
            log_warning("EXCEL", "Drive not enabled, skipping Excel sync")
            return

        try:
            log_info("EXCEL", f"Generating Excel report at {self.temp_file}")
            self._generate_excel(projects, tasks)

            with open(self.temp_file, "rb") as fh:
                file_data = fh.read()

            await self.drive_service.upload_file_to_drive(
                file_data=file_data,
                filename=f"CSMS_Track_Report_{datetime.now().strftime('%Y-%m-%d')}.xlsx",
                project_name="CSMS_REPORTS",
            )
            log_info("EXCEL", "Excel report uploaded to Drive")
        except Exception as e:
            log_error("EXCEL", f"Excel sync failed (non-fatal): {e}", e, send_email=False)
        finally:
            try:
                if os.path.exists(self.temp_file):
                    os.remove(self.temp_file)
            except OSError as cleanup_err:
                log_warning("EXCEL", f"Could not remove temp file: {cleanup_err}")

    def _generate_excel(self, projects: List[Dict], tasks: List[Dict]) -> None:
        if not Workbook:
            log_warning("EXCEL", "openpyxl not installed; skipping Excel generation")
            return

        wb = Workbook()

        ws_p = wb.active
        ws_p.title = "Projects"
        headers_p = [
            "ID",
            "Name",
            "Status",
            "Start Date",
            "End Date",
            "Description",
            "Created At",
        ]
        ws_p.append(headers_p)

        for p in projects:
            ws_p.append(
                [
                    p.get("id"),
                    p.get("name"),
                    p.get("status"),
                    p.get("start_date"),
                    p.get("end_date"),
                    p.get("description"),
                    p.get("created_at"),
                ]
            )

        ws_t = wb.create_sheet("Tasks")
        headers_t = [
            "Project ID",
            "Task Title",
            "Code",
            "Category",
            "Status",
            "Attachment Info",
        ]
        ws_t.append(headers_t)

        for t in tasks:
            att_info = "Yes" if t.get("attachments") else "No"
            ws_t.append(
                [
                    t.get("project_id"),
                    t.get("title"),
                    t.get("code"),
                    t.get("category"),
                    t.get("status"),
                    att_info,
                ]
            )

        wb.save(self.temp_file)
