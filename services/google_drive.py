"""
Google Drive Integration Service
Uses OAuth2 with credentials from environment variables
Fallback to Service Account if OAuth fails
"""
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaInMemoryUpload
from googleapiclient.errors import HttpError
import os
import json
import time
import ssl
import random
import socket
from pathlib import Path
from typing import List, Dict, Any, Tuple
from dotenv import load_dotenv
from services.logger_service import log_drive_operation, log_drive_error, log_info, log_warning, log_error

load_dotenv()

# Retry configuration for transient errors
MAX_RETRIES = 5
BASE_DELAY = 1  # seconds
MAX_DELAY = 32  # seconds

SCOPES = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive']

class GoogleDriveService:
    def __init__(self):
        self.folder_id = os.getenv("GOOGLE_DRIVE_FOLDER_ID", "")
        self.token_json = os.getenv("GOOGLE_TOKEN_JSON", "")
        self.credentials_json = os.getenv("GOOGLE_CREDENTIALS_JSON", "")
        self.service_account_json = os.getenv("SERVICE_ACCOUNT_JSON", "")
        self.service = None
        self.enabled = False
        self.folders_cache = {}
        self.auth_method = None  # Track which auth method was used
        
        log_info("DRIVE", "Initializing Google Drive Service...")
        log_info("DRIVE", f"FOLDER_ID: {self.folder_id[:20] + '...' if self.folder_id else 'NOT SET'}")
        log_info("DRIVE", f"TOKEN_JSON length: {len(self.token_json)} chars")
        log_info("DRIVE", f"SERVICE_ACCOUNT_JSON length: {len(self.service_account_json)} chars")
        
        if not self.folder_id:
            log_error("DRIVE", "GOOGLE_DRIVE_FOLDER_ID not set - cannot initialize Drive service")
            return
        
        # Try to initialize the service
        try:
            # Set default timeout for all internal socket operations
            socket.setdefaulttimeout(60) 
            self.service = self._get_drive_service()
            self.enabled = bool(self.service)
            if self.enabled:
                log_info("DRIVE", f"Service initialized via {self.auth_method}!")
        except Exception as e:
            log_drive_error("INIT", e)
            self.enabled = False
    
    def _execute_with_retry(self, request, operation_name="API_CALL"):
        """Execute a Google API request with exponential backoff retry for transient errors.
        
        Handles:
        - SSL errors (record layer failure, handshake failures)
        - Connection resets and timeouts
        - HTTP 5xx errors (server errors)
        - HTTP 429 (rate limiting)
        """
        last_exception = None
        
        for attempt in range(MAX_RETRIES):
            try:
                return request.execute()
            except ssl.SSLError as e:
                last_exception = e
                log_warning("DRIVE", f"[{operation_name}] SSL error on attempt {attempt + 1}/{MAX_RETRIES}: {e}")
            except ConnectionResetError as e:
                last_exception = e
                log_warning("DRIVE", f"[{operation_name}] Connection reset on attempt {attempt + 1}/{MAX_RETRIES}: {e}")
            except HttpError as e:
                if e.resp.status in [429, 500, 502, 503, 504]:
                    last_exception = e
                    log_warning("DRIVE", f"[{operation_name}] HTTP {e.resp.status} on attempt {attempt + 1}/{MAX_RETRIES}")
                else:
                    # Non-retryable HTTP error
                    raise
            except Exception as e:
                error_str = str(e).lower()
                if 'ssl' in error_str or 'connection' in error_str or 'timeout' in error_str:
                    last_exception = e
                    log_warning("DRIVE", f"[{operation_name}] Network error on attempt {attempt + 1}/{MAX_RETRIES}: {e}")
                else:
                    # Non-retryable error
                    raise
            
            # Calculate delay with exponential backoff and jitter
            if attempt < MAX_RETRIES - 1:
                delay = min(BASE_DELAY * (2 ** attempt) + random.uniform(0, 1), MAX_DELAY)
                log_info("DRIVE", f"[{operation_name}] Retrying in {delay:.1f}s...")
                time.sleep(delay)
        
        # All retries exhausted
        log_error("DRIVE", f"[{operation_name}] All {MAX_RETRIES} attempts failed. Last error: {last_exception}")
        raise last_exception
    def _get_drive_service(self):
        """Get Google Drive service - try Supabase, then OAuth Env, then Service Account fallback"""
        
        # Method 1: Try OAuth2 token (Persistent in Supabase preferred, then Environment)
        token_info = None
        source = "N/A"
        
        # A. Try Supabase first
        try:
            from services.supabase_service import supabase_service
            if supabase_service.enabled:
                token_info = supabase_service.get_config('google_drive_token')
                if token_info:
                    log_info("DRIVE", "Found OAuth token in Supabase storage")
                    source = "Supabase"
        except Exception as e:
            log_warning("DRIVE", f"Failed to fetch token from Supabase: {e}")

        # B. Fallback to Environment Variable
        if not token_info and self.token_json:
            try:
                token_info = json.loads(self.token_json)
                log_info("DRIVE", "Using OAuth token from Environment Variable")
                source = "EnvVar"
            except Exception as e:
                log_error("DRIVE", "Failed to parse GOOGLE_TOKEN_JSON", e)

        if token_info:
            try:
                # Create credentials object
                creds = Credentials.from_authorized_user_info(token_info, SCOPES)
                
                # Check if token needs refresh
                if creds and creds.expired and creds.refresh_token:
                    log_info("DRIVE", f"Refreshing expired OAuth token from {source}...")
                    try:
                        creds.refresh(Request())
                        log_info("DRIVE", "Token refreshed successfully")
                        
                        # Save THE NEW TOKEN back to Supabase for persistence
                        try:
                            new_token_info = {
                                "token": creds.token,
                                "refresh_token": creds.refresh_token,
                                "token_uri": creds.token_uri,
                                "client_id": creds.client_id,
                                "client_secret": creds.client_secret,
                                "scopes": creds.scopes
                            }
                            if supabase_service.enabled:
                                supabase_service.set_config('google_drive_token', new_token_info)
                                log_info("DRIVE", "Refreshed token persisted to Supabase")
                        except Exception as save_err:
                            log_warning("DRIVE", f"Refreshed token could not be saved to DB: {save_err}")
                            
                    except Exception as refresh_err:
                        log_error("DRIVE", f"Failed to refresh OAuth token: {refresh_err}. Source: {source}", send_email=True)
                        creds = None
                
                if creds and creds.valid:
                    log_info("DRIVE", f"OAuth credentials loaded from {source} and valid!")
                    self.auth_method = f"OAuth2 ({source})"
                    return build('drive', 'v3', credentials=creds)
                elif creds and not creds.valid:
                    log_warning("DRIVE", f"OAuth token from {source} is invalid/expired. Falling back.")
                    
            except Exception as e:
                log_warning("DRIVE", f"OAuth2 authentication failed ({source}): {e}")
        else:
            log_info("DRIVE", "GOOGLE_TOKEN_JSON not set, skipping OAuth2")
        
        # Method 2: Fallback to Service Account (NOTE: Cannot upload to personal Drive!)
        if self.service_account_json:
            try:
                log_info("DRIVE", "Attempting Service Account authentication...")
                log_warning("DRIVE", "NOTE: Service Account can only upload to Shared Drives, not personal Drive!")
                from google.oauth2 import service_account
                sa_info = json.loads(self.service_account_json)
                log_info("DRIVE", f"Service Account email: {sa_info.get('client_email', 'N/A')}")
                creds = service_account.Credentials.from_service_account_info(
                    sa_info, scopes=SCOPES
                )
                log_info("DRIVE", "Service Account credentials loaded")
                self.auth_method = "Service Account"
                return build('drive', 'v3', credentials=creds)
            except json.JSONDecodeError as e:
                log_error("DRIVE", "Failed to parse SERVICE_ACCOUNT_JSON", e, send_email=False)
            except Exception as e:
                log_error("DRIVE", f"Service Account authentication failed", e, send_email=True)
        else:
            log_info("DRIVE", "SERVICE_ACCOUNT_JSON not set, skipping Service Account")
        
        # Neither method worked
        log_error("DRIVE", "All authentication methods failed! Google Drive will be disabled.", send_email=True)
        return None
    
    def get_storage_quota(self) -> Dict:
        """Get Google Drive storage quota info."""
        if not self.service:
            return {"limit": "N/A", "usage": "N/A", "percent": "0%"}
        
        try:
            # Note: about().get() requires exactly one field or '*'
            about = self._execute_with_retry(self.service.about().get(fields="storageQuota"), "GET_QUOTA")
            quota = about.get('storageQuota', {})
            limit = int(quota.get('limit', 0))
            usage = int(quota.get('usage', 0))
            
            # Convert to GB for readability
            usage_gb = usage / (1024**3)
            limit_gb = limit / (1024**3)
            percent = (usage / limit * 100) if limit > 0 else 0
            
            return {
                "limit": f"{limit_gb:.2f} GB",
                "usage": f"{usage_gb:.2f} GB",
                "percent": f"{percent:.1f}%"
            }
        except Exception as e:
            log_warning("DRIVE", f"Failed to fetch storage quota: {e}")
            return {"error": str(e)}
    
    def find_or_create_folder(self, folder_name: str, parent_id: str = None, prefix_search: bool = False) -> str:
        """Find existing folder or create new one by name. 
           If prefix_search=True, matches folder starting with folder_name followed by a boundary.
           Uses case-insensitive search for Element and Project folders.
        """
        if not self.enabled or not self.service:
            print("[WARN] Drive not enabled")
            return None
        
        try:
            parent_id = parent_id or self.folder_id
            
            # Check cache (Exact match only for cache safety)
            cache_key = f"{parent_id}:{folder_name}"
            if not prefix_search and cache_key in self.folders_cache:
                print(f"[CACHE] Using cached folder: {folder_name}")
                return self.folders_cache[cache_key]
            
            # 1. SEARCH: We use a broader query and then filter in Python for reliability
            # Note:name contains '...' is case-insensitive in Drive API v3
            if prefix_search:
                # Search for anything containing the folder_name to be safe
                query = f"name contains '{folder_name}' and '{parent_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
            else:
                # Exact search (case-insensitive in some Drive configurations, but we'll verify)
                query = f"name = '{folder_name}' and '{parent_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
            
            search_request = self.service.files().list(
                q=query, 
                spaces='drive', 
                fields='files(id, name)',
                pageSize=100,
                supportsAllDrives=True
            )
            results = self._execute_with_retry(search_request, f"FIND_FOLDER_{folder_name[:15]}")
            files = results.get('files', [])
            
            # 2. FILTER: Precise matching in Python (Case-Insensitive)
            best_match = None
            target_lower = folder_name.lower()
            
            for f in files:
                name_lower = f['name'].lower()
                
                # A. EXACT MATCH
                if name_lower == target_lower:
                    best_match = f
                    break
                
                # B. CODE-AWARE MATCH (e.g., "2.1" matches "2.1 KEBIJAKAN HSE")
                # Detect codes like "4.3.2" or "0.1" at the start of name
                target_parts = target_lower.split(' ', 1)
                existing_parts = name_lower.split(' ', 1)
                
                target_code = target_parts[0]
                existing_code = existing_parts[0]
                
                # Check if both look like codes (digits and dots)
                is_target_code = any(c.isdigit() for c in target_code) and ('.' in target_code or target_code.isdigit())
                is_existing_code = any(c.isdigit() for c in existing_code) and ('.' in existing_code or existing_code.isdigit())
                
                if is_target_code and is_existing_code and target_code == existing_code:
                    print(f"[DRIVE] Code match found: '{f['name']}' matches target code '{target_code}'")
                    best_match = f
                    # If this is an exact code match, it's very likely what we want
                    if prefix_search:
                        break 

                # C. PREFIX MATCH (Fallback for non-coded folders)
                if prefix_search and not best_match:
                    if name_lower.startswith(target_lower):
                        remainder = f['name'][len(folder_name):]
                        if not remainder or remainder[0] in " .-_":
                            best_match = f
                            # Keep looking for an exact match or code match
            
            if best_match:
                folder_id = best_match['id']
                # Update cache only if exact case-insensitive match
                if best_match['name'].lower() == folder_name.lower():
                    self.folders_cache[cache_key] = folder_id
                
                print(f"[FOUND] Existing folder: {best_match['name']} (ID: {folder_id})")
                return folder_id
            
            # 3. CREATE: New folder if not found
            # If we were in prefix mode but didn't find anything, we create the literal name
            file_metadata = {
                'name': folder_name,
                'mimeType': 'application/vnd.google-apps.folder',
                'parents': [parent_id]
            }
            create_request = self.service.files().create(
                body=file_metadata, 
                fields='id',
                supportsAllDrives=True
            )
            file = self._execute_with_retry(create_request, f"CREATE_FOLDER_{folder_name[:15]}")
            folder_id = file.get('id')
            self.folders_cache[cache_key] = folder_id
            print(f"[CREATED] New folder: {folder_name} (ID: {folder_id})")
            return folder_id
            
        except Exception as e:
            print(f"[ERROR] Error finding/creating folder: {e}")
            return None
            
        except Exception as e:
            print(f"[ERROR] Error finding/creating folder: {e}")
            return None

    def create_nested_task_folder(self, project_name: str, task_code: str, task_title: str = "") -> str:
        """Create nested folder structure based on task code hierarchy.
        
        Structure: Project → Element X → X.Y → X.Y.Z → ... → Final TaskCode Title
        Creates full hierarchy for ALL levels in the task code.
        
        Examples:
        - "1.1.1" → Project/Element 1/1.1/1.1.1 MWT REPORT
        - "4.3.2.2.1" → Project/Element 4/4.3/4.3.2/4.3.2.2/4.3.2.2.1 FOTO_OBSERVATION_CARD
        """
        if not self.enabled or not self.service:
            log_warning("DRIVE", "Drive not enabled for nested folder creation")
            return None
        
        if not task_code:
            log_warning("DRIVE", "No task code provided, falling back to project folder")
            return self.find_or_create_folder(project_name)
        
        try:
            # 1. Create/find project folder
            project_folder_id = self.find_or_create_folder(project_name)
            if not project_folder_id:
                log_error("DRIVE", "Could not create project folder", send_email=False)
                return None
            
            # 2. Parse task code (e.g., "4.3.2.2.1" → ["4", "3", "2", "2", "1"])
            parts = task_code.split('.')
            if not parts:
                return project_folder_id
            
            # 3. Create Element folder (first part, e.g., "Element 4")
            element_folder_name = f"Element {parts[0]}"
            current_parent_id = self.find_or_create_folder(element_folder_name, project_folder_id)
            if not current_parent_id:
                log_error("DRIVE", f"Could not create element folder: {element_folder_name}", send_email=False)
                return project_folder_id
            
            log_drive_operation("NESTED", f"Created/found: {project_name}/{element_folder_name}")
            
            # 4. Create ALL intermediate folders for each level
            # e.g., "4.3.2.2.1" → create "4.3", "4.3.2", "4.3.2.2", then "4.3.2.2.1 Title"
            for i in range(1, len(parts)):
                folder_code = '.'.join(parts[:i+1])  # "4.3", "4.3.2", "4.3.2.2", "4.3.2.2.1"
                is_final = (folder_code == task_code)
                
                if is_final:
                    # Final folder: include title
                    if task_title:
                        safe_title = "".join(x for x in task_title if (x.isalnum() or x in "._- "))
                        folder_name = f"{folder_code} {safe_title}"
                    else:
                        folder_name = folder_code
                    current_parent_id = self.find_or_create_folder(folder_name, current_parent_id)
                else:
                    # Intermediate folder: use prefix search to find "4.3" or "4.3 SomeTitle"
                    temp_parent_id = self.find_or_create_folder(folder_code, current_parent_id, prefix_search=True)
                    
                    # DEFENSIVE CHECK: Verify the found folder actually starts with folder_code
                    # This prevents "2.1" matching "2.2" or other collisions
                    if temp_parent_id:
                        try:
                            folder_info = self.service.files().get(fileId=temp_parent_id, fields='name').execute()
                            found_name = folder_info.get('name', '').lower()
                            expected_prefix = folder_code.lower()
                            
                            # Boundary check on found name
                            valid = False
                            if found_name == expected_prefix:
                                valid = True
                            elif found_name.startswith(expected_prefix):
                                remainder = found_name[len(expected_prefix):]
                                if not remainder or remainder[0] in " .-_":
                                    valid = True
                            
                            if not valid:
                                log_warning("DRIVE", f"Folder collision detected! Found '{found_name}' when searching for '{folder_code}'. Forcing new folder creation.")
                                # Create a new folder with exactly the folder_code to avoid the mess
                                temp_parent_id = self.find_or_create_folder(folder_code, current_parent_id, prefix_search=False)
                        except Exception as e:
                            log_warning("DRIVE", f"Could not verify folder name for {temp_parent_id}: {e}")
                    
                    current_parent_id = temp_parent_id
                
                if not current_parent_id:
                    log_error("DRIVE", f"Could not resolve folder: {folder_code}", send_email=False)
                    return None
                log_info("DRIVE", f"[NESTED] Resolved level {folder_code} -> ID: {current_parent_id}")
            
            return current_parent_id
            
        except Exception as e:
            log_drive_error("NESTED_FOLDER", e)
            return None

    async def upload_file_to_drive(self, file_data: bytes, filename: str, project_name: str, task_code: str = None, task_title: str = "") -> dict:
        """Upload file to Google Drive folder with nested task folder structure.
        
        Returns: dict with 'success', 'file_id', 'folder_path', and 'project_folder_id' or None on failure
        """
        if not self.enabled or not self.service:
            log_warning("DRIVE", "Google Drive not enabled - cannot upload")
            return {"success": False, "file_id": None, "folder_path": None, "project_folder_id": None, "error": "Google Drive service not enabled or not initialized"}
        
        try:
            # Get project folder first (needed for Daftar Isi regeneration)
            project_folder_id = self.find_or_create_folder(project_name)
            
            # Use nested folder structure based on task code
            if task_code:
                target_folder_id = self.create_nested_task_folder(project_name, task_code, task_title)
                
                # Format folder path for debug/return info
                safe_title = "".join(x for x in task_title if (x.isalnum() or x in "._- ")) if task_title else ""
                folder_suffix = f" {safe_title}" if safe_title else ""
                folder_path = f"{project_name}/Element {task_code.split('.')[0]}/{task_code}{folder_suffix}"
            else:
                # Fallback to project folder only
                target_folder_id = project_folder_id
                folder_path = project_name
            
            if not target_folder_id:
                log_error("DRIVE", "Could not get target folder ID", send_email=False)
                return {"success": False, "file_id": None, "folder_path": None, "project_folder_id": None, "error": "Could not create or find target folder in Drive"}

            # Upload File to that folder
            file_metadata = {
                'name': filename,
                'parents': [target_folder_id]
            }
            
            media = MediaInMemoryUpload(file_data, resumable=True)
            
            # Use supportsAllDrives=True to support Shared Drives
            # This is REQUIRED for Service Account uploads to work properly
            file = self.service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id',
                supportsAllDrives=True
            ).execute()
            
            file_id = file.get('id')
            log_drive_operation("UPLOAD", f"{folder_path}/{filename} (ID: {file_id})", success=True)
            return {"success": True, "file_id": file_id, "folder_path": folder_path, "project_folder_id": project_folder_id}
            
        except Exception as e:
            log_drive_error("UPLOAD", e)
            return {"success": False, "file_id": None, "folder_path": None, "project_folder_id": None, "error": str(e)}

    def upload_file(self, filename: str, file_content: bytes, folder_name: str = None) -> str:
        """Upload file to Google Drive and return file ID
        
        Args:
            filename: Name of the file
            file_content: Binary content of the file
            folder_name: Optional subfolder name (creates under root CSMS folder)
        
        Returns:
            File ID if successful, None if failed
        """
        if not self.enabled or not self.service:
            print("[WARN] Google Drive not enabled, can't upload file")
            return None
        
        try:
            # Determine parent folder
            parent_id = self.folder_id
            if folder_name:
                # Create/find subfolder
                parent_id = self.find_or_create_folder(folder_name) or self.folder_id
            
            # Upload file
            file_metadata = {
                'name': filename,
                'parents': [parent_id]
            }
            
            media = MediaInMemoryUpload(file_content, resumable=True)
            
            file = self.service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id',
                supportsAllDrives=True
            ).execute()
            
            file_id = file.get('id')
            print(f"[OK] File uploaded: {filename} -> {file_id}")
            return file_id
            
        except Exception as e:
            print(f"[ERROR] Error uploading file: {e}")
            return None

    def get_resumable_upload_session(self, filename: str, mime_type: str, folder_name: str = "RelatedDocs", parent_id: str = None) -> Tuple[str, str]:
        """
        Initiate a resumable upload session and return the Location URL.
        Returns: (upload_url, file_id)
        """
        if not self.enabled or not self.service:
            log_error("DRIVE", "Drive not enabled for resumable upload")
            return None, None

        try:
            if not parent_id:
                parent_id = self.find_or_create_folder(folder_name) or self.folder_id
            
            # 1. Initiate resumable upload
            import requests # Using requests for the raw HTTP call
            from google.auth.transport.requests import Request
            
            file_metadata = {
                'name': filename,
                'parents': [parent_id]
            }
            
            # Since we want to return a URL the BROWSER can use, we need to be careful.
            # Google's resumable upload initiation returns a 'Location' header.
            # The client needs an access token to use that URL effectively if it's not a public session.
            # But we are using Service Account/OAuth from backend. 
            # A better way is for the backend to handle the proxying or use a signed URL if supported.
            # Google Drive doesn't exactly have "Signed URLs" like S3 in a simple way for non-public files.
            
            # ALTERNATIVE: Use the actual google-api-python-client to get the session URI
            from googleapiclient.http import MediaInMemoryUpload
            import io
            
            # This is a trick to get the resumable URI from the library
            media = MediaInMemoryUpload(b'', mimetype=mime_type, resumable=True)
            request = self.service.files().create(
                body=file_metadata,
                media_body=media,
                fields='id',
                supportsAllDrives=True
            )
            
            # Instead of executing, we extract the URI
            # The library internally builds the request.
            # We can use the library's internal structures or just perform the raw POST.
            
            # Let's do a raw POST to be sure we get the clean Location header
            # We need the current token
            if self.auth_method == "OAuth2":
                creds = self.service._http.credentials
                if creds.expired:
                    creds.refresh(Request())
                token = creds.token
            else:
                # Service Account
                creds = self.service._http.credentials
                creds.refresh(Request())
                token = creds.token

            headers = {
                "Authorization": f"Bearer {token}",
                "X-Upload-Content-Type": mime_type,
                "Content-Type": "application/json; charset=UTF-8"
            }
            
            url = "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable"
            payload = json.dumps(file_metadata)
            
            import requests
            response = requests.post(url, headers=headers, data=payload)
            
            if response.status_code == 200:
                upload_url = response.headers.get("Location")
                return upload_url, None # file_id is not created yet in v3 resumable
            else:
                log_error("DRIVE", f"Failed to initiate resumable upload: {response.text}")
                return None, None

        except Exception as e:
            log_error("DRIVE", f"Error in get_resumable_upload_session: {e}")
            return None, None

    def find_file_in_folder(self, filename: str, project_name: str) -> str:
        """Find a file by name in a project folder"""
        if not self.enabled or not self.service:
            return None
        
        try:
            # First find project folder
            project_folder_id = self.find_or_create_folder(project_name)
            if not project_folder_id:
                return None
            
            # Search for file
            query = f"name='{filename}' and '{project_folder_id}' in parents and trashed=false"
            results = self.service.files().list(q=query, spaces='drive', fields='files(id, name, mimeType)').execute()
            files = results.get('files', [])
            
            if files:
                return files[0]['id']
            return None
            
        except Exception as e:
            print(f"[ERROR] Error finding file: {e}")
            return None
    
    def _find_file_recursive(self, filename: str, folder_id: str, depth: int = 0) -> str:
        """Recursively search for a file in folder and all subfolders"""
        if depth > 5:  # Limit recursion depth
            return None
        
        try:
            # First search in current folder
            query = f"name='{filename}' and '{folder_id}' in parents and trashed=false and mimeType!='application/vnd.google-apps.folder'"
            results = self.service.files().list(
                q=query, 
                spaces='drive', 
                fields='files(id, name)',
                supportsAllDrives=True
            ).execute()
            files = results.get('files', [])
            
            if files:
                print(f"[FOUND] File '{filename}' at depth {depth}")
                return files[0]['id']
            
            # Get all subfolders
            folder_query = f"'{folder_id}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false"
            folder_results = self.service.files().list(
                q=folder_query, 
                spaces='drive', 
                fields='files(id, name)',
                supportsAllDrives=True
            ).execute()
            subfolders = folder_results.get('files', [])
            
            # Search in each subfolder
            for subfolder in subfolders:
                file_id = self._find_file_recursive(filename, subfolder['id'], depth + 1)
                if file_id:
                    return file_id
            
            return None
            
        except Exception as e:
            print(f"[ERROR] Recursive search error: {e}")
            return None
    
    def download_file(self, file_id: str) -> bytes:
        """Download a file from Google Drive by ID"""
        if not self.enabled or not self.service:
            return None
        
        last_exception = None
        for attempt in range(MAX_RETRIES):
            try:
                from googleapiclient.http import MediaIoBaseDownload
                import io
                
                request = self.service.files().get_media(
                    fileId=file_id,
                    supportsAllDrives=True
                )
                buffer = io.BytesIO()
                downloader = MediaIoBaseDownload(buffer, request)
                
                done = False
                while not done:
                    status, done = downloader.next_chunk()
                
                buffer.seek(0)
                return buffer.read()
                
            except Exception as e:
                error_str = str(e).lower()
                if 'ssl' in error_str or 'connection' in error_str or 'timeout' in error_str:
                    last_exception = e
                    log_warning("DRIVE", f"[DOWNLOAD] Network error on attempt {attempt + 1}/{MAX_RETRIES}: {e}")
                    if attempt < MAX_RETRIES - 1:
                        delay = min(BASE_DELAY * (2 ** attempt) + random.uniform(0, 1), MAX_DELAY)
                        time.sleep(delay)
                else:
                    print(f"[ERROR] Error downloading file: {e}")
                    return None
        
        log_error("DRIVE", f"[DOWNLOAD] All {MAX_RETRIES} attempts failed for file {file_id}")
        return None
    
    def get_files_in_project(self, project_name: str) -> list:
        """Get all files in a project folder"""
        if not self.enabled or not self.service:
            return []
        
        try:
            project_folder_id = self.find_or_create_folder(project_name)
            if not project_folder_id:
                return []
            
            results = self.service.files().list(
                q=query, 
                spaces='drive', 
                fields='files(id, name, mimeType)',
                supportsAllDrives=True
            ).execute()
            return results.get('files', [])
            
        except Exception as e:
            print(f"[ERROR] Error listing files: {e}")
            return []
    
    def export_file_as_pdf(self, file_id: str) -> bytes:
        """Export a Google Workspace file (Docs, Sheets, Slides) as PDF"""
        if not self.enabled or not self.service:
            return None
        
        try:
            request = self.service.files().export_media(
                fileId=file_id,
                mimeType='application/pdf'
            )
            from googleapiclient.http import MediaIoBaseDownload
            import io
            
            buffer = io.BytesIO()
            downloader = MediaIoBaseDownload(buffer, request)
            
            done = False
            while not done:
                status, done = downloader.next_chunk()
            
            buffer.seek(0)
            return buffer.read()
            
        except Exception as e:
            print(f"[ERROR] Error exporting file as PDF: {e}")
            return None
    
    def get_file_info(self, file_id: str) -> dict:
        """Get file metadata including mimeType"""
        if not self.enabled or not self.service:
            return None
        
        try:
            file = self.service.files().get(
                fileId=file_id, 
                fields='id, name, mimeType',
                supportsAllDrives=True
            ).execute()
            return file
        except Exception as e:
            print(f"[ERROR] Error getting file info: {e}")
            return None

    def convert_office_to_pdf(self, file_id: str, filename: str) -> bytes:
        """Convert an uploaded Office file to PDF using Google Drive conversion
        
        This works by:
        1. Making a copy of the file with Google's conversion (imports to Google format)
        2. Exporting that copy as PDF
        3. Deleting the temporary copy
        """
        if not self.enabled or not self.service:
            return None
        
        file_ext = filename.lower().split('.')[-1] if '.' in filename else ''
        
        # Map Office extensions to Google import types
        google_mime_types = {
            'docx': 'application/vnd.google-apps.document',
            'doc': 'application/vnd.google-apps.document',
            'xlsx': 'application/vnd.google-apps.spreadsheet',
            'xls': 'application/vnd.google-apps.spreadsheet',
            'pptx': 'application/vnd.google-apps.presentation',
            'ppt': 'application/vnd.google-apps.presentation',
        }
        
        target_mime = google_mime_types.get(file_ext)
        if not target_mime:
            print(f"[WARN] Unsupported file type for conversion: {file_ext}")
            return None
        
        temp_file_id = None
        try:
            # Step 1: Copy the file and convert to Google format
            copy_metadata = {
                'name': f'_temp_convert_{filename}',
                'mimeType': target_mime
            }
            copied_file = self.service.files().copy(
                fileId=file_id,
                body=copy_metadata,
                supportsAllDrives=True
            ).execute()
            temp_file_id = copied_file.get('id')
            print(f"[INFO] Created temp Google file: {temp_file_id}")
            
            # Step 2: Export as PDF
            from googleapiclient.http import MediaIoBaseDownload
            import io
            
            request = self.service.files().export_media(
                fileId=temp_file_id,
                mimeType='application/pdf',
                # supportsAllDrives=True # export_media might not support this, checking...
            )
            
            buffer = io.BytesIO()
            downloader = MediaIoBaseDownload(buffer, request)
            
            done = False
            while not done:
                status, done = downloader.next_chunk()
            
            buffer.seek(0)
            pdf_bytes = buffer.read()
            print(f"[OK] Converted {filename} to PDF ({len(pdf_bytes)} bytes)")
            
            return pdf_bytes
            
        except Exception as e:
            print(f"[ERROR] Error converting Office to PDF: {e}")
            return None
            
        finally:
            # Step 3: Delete the temporary file
            if temp_file_id:
                try:
                    self.service.files().delete(fileId=temp_file_id).execute()
                    print(f"[INFO] Deleted temp file: {temp_file_id}")
                except Exception as e:
                    print(f"[WARN] Could not delete temp file: {e}")
    async def copy_file(self, file_id: str, parent_id: str, new_name: str = None, skip_if_exists: bool = False) -> str:
        """Copy a file to a new location in Google Drive.
        If skip_if_exists is True, checks if a file with new_name already exists in parent_id.
        """
        if not self.enabled or not self.service:
            return None
        
        try:
            if skip_if_exists and new_name:
                # Basic check for existing file
                check_query = f"name = '{new_name}' and '{parent_id}' in parents and trashed = false"
                check_results = self.service.files().list(
                    q=check_query, 
                    fields="files(id)",
                    supportsAllDrives=True
                ).execute()
                if check_results.get('files'):
                    # print(f"[SKIP] File already exists: {new_name}")
                    return check_results.get('files')[0]['id']

            body = {'parents': [parent_id]}
            if new_name:
                body['name'] = new_name
                
            request = self.service.files().copy(
                fileId=file_id,
                body=body,
                fields='id',
                supportsAllDrives=True
            )
            copied_file = self._execute_with_retry(request, f"COPY_FILE_{new_name[:15] if new_name else file_id[:10]}")
            
            return copied_file.get('id')
        except Exception as e:
            log_error("DRIVE", f"Error copying file {file_id}: {e}", send_email=False)
            return None

    async def get_file_metadata(self, file_id: str) -> dict:
        """Get metadata for a specific file or folder."""
        if not self.enabled or not self.service:
            return None
            
        try:
            return self.service.files().get(
                fileId=file_id,
                fields='id, name, mimeType',
                supportsAllDrives=True
            ).execute()
        except Exception as e:
            log_error("DRIVE", f"Error getting metadata for {file_id}: {e}", send_email=False)
            return None

    def fetch_files_in_folder(self, folder_id: str) -> List[Dict[str, Any]]:
        """List ALL files and folders in a specific folder with name and mimeType.
        Handles pagination to ensure all items are fetched.
        """
        if not self.enabled or not self.service:
            return []
        try:
            query = f"'{folder_id}' in parents and trashed = false"
            all_files = []
            page_token = None
            
            while True:
                request = self.service.files().list(
                    q=query,
                    fields="nextPageToken, files(id, name, mimeType)",
                    supportsAllDrives=True,
                    includeItemsFromAllDrives=True,
                    pageToken=page_token,
                    pageSize=200  # Reduced from 1000 to avoid read timeouts
                )
                results = self._execute_with_retry(request, f"FETCH_FOLDER_{folder_id[:10]}")
                all_files.extend(results.get('files', []))
                
                page_token = results.get('nextPageToken')
                if not page_token:
                    break
                    
            return all_files
        except Exception as e:
            log_error("DRIVE", f"Error fetching files in folder {folder_id}: {e}")
            return []

# Singleton instance for consistent authentication and caching across services
drive_service = GoogleDriveService()
