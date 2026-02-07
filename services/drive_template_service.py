import asyncio
from typing import List, Dict, Any
from .google_drive import drive_service
from .logger_service import log_info, log_error, log_warning, log_drive_operation

class DriveTemplateService:
    def __init__(self):
        self.master_template_id = "1lWxdLWnw3VBcpEsQJmzVPXzC4WbeS_3o"

    async def clone_template_to_project(self, project_folder_id: str):
        """Clone the entire master template to a new project folder in the background."""
        if not drive_service.enabled or not drive_service.service:
            log_warning("TEMPLATE", "Drive service not enabled, skipping template clone")
            return

        log_info("TEMPLATE", f"Starting background clone of master template to project folder: {project_folder_id}")
        try:
            await self._clone_recursive(self.master_template_id, project_folder_id)
            log_info("TEMPLATE", "Background template clone completed successfully")
        except Exception as e:
            log_error("TEMPLATE", f"Error during background template clone: {e}", send_email=True)

    async def _clone_recursive(self, source_id: str, target_parent_id: str):
        """Recursively copy folders and files from source to target."""
        # 1. List all items in source folder
        query = f"'{source_id}' in parents and trashed = false"
        results = drive_service.service.files().list(
            q=query,
            fields="files(id, name, mimeType)",
            supportsAllDrives=True,
            includeItemsFromAllDrives=True
        ).execute()
        
        items = results.get('files', [])
        
        for item in items:
            item_id = item['id']
            item_name = item['name']
            item_mime = item['mimeType']
            
            if item_mime == 'application/vnd.google-apps.folder':
                # Create corresponding folder in target
                new_folder_id = drive_service.find_or_create_folder(item_name, target_parent_id)
                if new_folder_id:
                    # Recurse into the new folder
                    await self._clone_recursive(item_id, new_folder_id)
            else:
                # Copy file
                await drive_service.copy_file(item_id, target_parent_id, item_name)
                # Small sleep to be nice to API rate limits
                await asyncio.sleep(0.1)

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
        query = f"'{folder_id}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false"
        results = drive_service.service.files().list(
            q=query,
            fields="files(id, name)",
            supportsAllDrives=True,
            includeItemsFromAllDrives=True
        ).execute()
        
        folders = results.get('files', [])
        
        for folder in folders:
            name = folder['name']
            folder_id = folder['id']
            
            # Simple heuristic to identify task folders (e.g., "1.1.1 MWT REPORT")
            # We look for a pattern like "X.Y.Z Title"
            parts = name.split(' ', 1)
            code = parts[0]
            title = parts[1] if len(parts) > 1 else ""
            
            # Check if it looks like a code (contains digits and dots)
            if any(c.isdigit() for c in code) and '.' in code:
                # Determine category based on first part
                category = "General"
                element_num = code.split('.')[0]
                category_map = {
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
            await self._scan_recursive(folder_id, tasks_list, name)

# Singleton instance
template_service = DriveTemplateService()
