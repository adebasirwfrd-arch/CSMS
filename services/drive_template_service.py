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
        log_info("TEMPLATE", f"Scanning source folder {source_id}...")
        source_items = drive_service.fetch_files_in_folder(source_id)
        if not source_items:
            return

        # 2. List all items in target folder to avoid duplicates (idempotency)
        target_items = drive_service.fetch_files_in_folder(target_parent_id)
        target_names = {item['name']: item['id'] for item in target_items}

        folders_to_recurse = []
        files_to_copy = []

        for item in source_items:
            item_id = item['id']
            item_name = item['name']
            item_mime = item['mimeType']
            
            if item_mime == 'application/vnd.google-apps.folder':
                # Check if folder already exists in target
                if item_name in target_names:
                    new_folder_id = target_names[item_name]
                    log_info("TEMPLATE", f"Folder already exists, skipping creation: {item_name}")
                else:
                    new_folder_id = drive_service.find_or_create_folder(item_name, target_parent_id)
                    log_info("TEMPLATE", f"Created folder: {item_name}")
                
                if new_folder_id:
                    folders_to_recurse.append((item_id, new_folder_id))
            else:
                # Check if file already exists
                if item_name in target_names:
                    # log_info("TEMPLATE", f"File already exists, skipping copy: {item_name}")
                    pass
                else:
                    files_to_copy.append((item_id, target_parent_id, item_name))

        # 3. Copy files in parallel (batches of 5 to avoid rate limits)
        if files_to_copy:
            log_info("TEMPLATE", f"Copying {len(files_to_copy)} files to {target_parent_id}...")
            batch_size = 5
            for i in range(0, len(files_to_copy), batch_size):
                batch = files_to_copy[i:i + batch_size]
                tasks = [drive_service.copy_file(fid, pid, name) for fid, pid, name in batch]
                await asyncio.gather(*tasks)
                # Small gap between batches
                await asyncio.sleep(0.2)

        # 4. Recurse into folders (sequential recursion to avoid deep concurrency issues)
        for s_id, t_id in folders_to_recurse:
            await self._clone_recursive(s_id, t_id)


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
