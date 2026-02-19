import asyncio
from typing import List, Dict, Any
from .google_drive import drive_service
from .logger_service import log_info, log_error, log_warning, log_drive_operation

class DriveTemplateService:
    def __init__(self):
        self.master_template_id = "1lWxdLWnw3VBcpEsQJmzVPXzC4WbeS_3o"

    async def clone_template_to_project(self, project_folder_id: str):
        """
        Trigger Google Apps Script to clone template in the background.
        This is a Fire-and-Forget operation to prevent Vercel timeouts.
        """
        GAS_URL = "https://script.google.com/macros/s/AKfycbywzZs9ADxmgr9l3EFhzdbsmPjROj-Xh8APm04ecSYqIL4rUsaDUEh4CGarLDiV_j8MDA/exec"
        
        log_info("TEMPLATE", f"Triggering GAS WebHook for folder: {project_folder_id}")
        
        try:
            # We use a thread to send the request so it's non-blocking for asyncio
            # Although standard requests.post is blocking, the GAS script returns immediately
            # so it's very fast (<1s).
            
            payload = {
                "sourceId": self.master_template_id,
                "destinationId": project_folder_id,
                "projectTitle": "New Project" # Optional metadata
            }
            
            def send_webhook():
                import requests
                response = requests.post(GAS_URL, json=payload, timeout=10)
                return response
            
            loop = asyncio.get_running_loop()
            resp = await loop.run_in_executor(None, send_webhook)
            
            if resp.status_code == 200:
                log_info("TEMPLATE", f"GAS WebHook triggered successfully: {resp.text}")
            else:
                log_error("TEMPLATE", f"GAS WebHook failed: {resp.status_code} - {resp.text}")

        except Exception as e:
            log_error("TEMPLATE", f"Error triggering GAS WebHook: {e}", send_email=True)

    # _clone_recursive and other helper methods are no longer needed
    # but we keep get_template_structure for reading task lists (which is fast/read-only)

    async def get_template_structure(self) -> List[Dict[str, str]]:
        """Scan the master template and return a flat list of folder hierarchy for task creation."""
        if not drive_service.enabled or not drive_service.service:
            return []

        log_info("TEMPLATE", "Scanning master template structure for task sync")
        tasks = []
        await self._scan_recursive(self.master_template_id, tasks)
        return tasks



    async def _scan_recursive(self, folder_id: str, tasks_list: List[Dict[str, str]], current_path: str = ""):
        """Scan folder names to extract codes and titles for task metadata."""
        if not drive_service.enabled or not drive_service.service:
            log_warning("TEMPLATE", "Drive service not available for scanning")
            return
            
        # Use the helper method instead of direct service call
        all_items = drive_service.fetch_files_in_folder(folder_id)
        folders = [item for item in all_items if item.get('mimeType') == 'application/vnd.google-apps.folder']
        
        # Counter for synthetic codes (specifically for ELEMENT 0 or folders without codes)
        folder_idx = 1
        
        for folder in folders:
            name = folder['name']
            f_id = folder['id']
            
            # Simple heuristic to identify task folders (e.g., "1.1.1 MWT REPORT")
            # We look for a pattern like "X.Y.Z Title"
            parts = name.split(' ', 1)
            code = parts[0]
            title = parts[1] if len(parts) > 1 else ""
            
            # SPECIAL CASE: Element 0 folders often don't have codes in name (e.g. "BRIDGING DOC")
            # We assign them a code like "0.1", "0.2"...
            is_element_0 = current_path.upper() == "ELEMENT 0"
            if is_element_0 and not (any(c.isdigit() for c in code) and '.' in code):
                code = f"0.{folder_idx}"
                title = name # Use full name as title
                folder_idx += 1

            # Check if it looks like a code (contains digits and dots)
            if any(c.isdigit() for c in code) and '.' in code:
                # Determine category based on first part
                category = "General"
                element_num = code.split('.')[0]
                category_map = {
                    "0": "Core Documents",
                    "1": "Management",
                    "2": "Safety Signs",
                    "3": "HSE Facilities",
                    "4": "Safety Committee",
                    "5": "Inspection",
                    "6": "Security"
                }
                category = category_map.get(element_num, "Other")
                
                tasks_list.append({
                    "code": code,
                    "title": title.upper() if title else code,
                    "category": category
                })
            
            # Recurse
            await self._scan_recursive(f_id, tasks_list, name)

# Singleton instance
template_service = DriveTemplateService()
