"""
RELIABLE Database Layer - Supabase is the SINGLE SOURCE OF TRUTH
- ALL reads go to Supabase (when enabled)
- ALL writes go to Supabase SYNCHRONOUSLY (will fail loudly if it fails)
- Local JSON is ONLY a fallback when Supabase is not configured
"""
import json
import os
from typing import List, Dict, Optional
import uuid
from datetime import datetime

# Try to import Supabase service
try:
    from services.supabase_service import supabase_service
    SUPABASE_ENABLED = supabase_service.enabled if supabase_service else False
except ImportError:
    supabase_service = None
    SUPABASE_ENABLED = False

# Import logger
from services.logger_service import log_db_operation, log_db_error, log_info, log_warning

log_info("DB", "========================================")
log_info("DB", f"Supabase enabled: {SUPABASE_ENABLED}")
if SUPABASE_ENABLED:
    log_info("DB", "MODE: Supabase is SINGLE SOURCE OF TRUTH")
    log_info("DB", "All reads/writes go directly to Supabase")
else:
    log_info("DB", "MODE: Local JSON fallback (Supabase not configured)")
log_info("DB", "========================================")

# Local JSON storage paths (fallback only)
DATA_DIR = os.path.join(os.path.dirname(__file__), "data")
PROJECTS_FILE = os.path.join(DATA_DIR, "projects.json")
TASKS_FILE = os.path.join(DATA_DIR, "tasks.json")
SCHEDULES_FILE = os.path.join(DATA_DIR, "schedules.json")
COMMENTS_FILE = os.path.join(DATA_DIR, "comments.json")
CSMS_PB_FILE = os.path.join(DATA_DIR, "csms_pb.json")
RELATED_DOCS_FILE = os.path.join(DATA_DIR, "related_docs.json")
LL_INDICATOR_FILE = os.path.join(DATA_DIR, "ll_indicator.json")
CLIENTS_FILE = os.path.join(DATA_DIR, "clients.json")
PRODUCT_LINES_FILE = os.path.join(DATA_DIR, "product_lines.json")
CLIENT_PRODUCT_TEMPLATES_FILE = os.path.join(DATA_DIR, "client_product_templates.json")


def _write_json_robust(filepath, data):
    """Write JSON with robust error handling for read-only systems"""
    try:
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)
    except OSError as e:
        log_db_error("WRITE_JSON", f"Failed to write to {filepath}: {e}")
        if e.errno == 30: # Read-only file system
            log_warning("DB", "REASON: Read-only file system (likely Vercel). Ensure Supabase is configured.")
        raise

class Database:
    """
    RELIABLE Database - Supabase as single source of truth
    - When Supabase enabled: ALL operations go to Supabase SYNCHRONOUSLY
    - When Supabase disabled: Falls back to local JSON
    """
    
    def __init__(self):
        try:
            os.makedirs(DATA_DIR, exist_ok=True)
        except OSError:
            pass # Likely read-only
        self._ensure_file(PROJECTS_FILE)
        self._ensure_file(TASKS_FILE)

    def _ensure_file(self, filepath):
        if not os.path.exists(filepath):
            try:
                with open(filepath, 'w') as f:
                    json.dump([], f)
            except OSError:
                log_warning("DB", f"Could not ensure file {filepath} (read-only environment)")

    def _read_json(self, filepath) -> List[Dict]:
        try:
            with open(filepath, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            return []

    def _write_json(self, filepath, data: List[Dict]):
        _write_json_robust(filepath, data)


    # ==================== PROJECTS ====================
    
    def get_projects(self) -> List[Dict]:
        """Get all projects from Supabase (or local fallback)"""
        if SUPABASE_ENABLED:
            return supabase_service.get_projects()
        return self._read_json(PROJECTS_FILE)

    def get_project(self, project_id: str) -> Optional[Dict]:
        """Get single project by ID"""
        if SUPABASE_ENABLED:
            return supabase_service.get_project(project_id)
        projects = self.get_projects()
        return next((p for p in projects if p['id'] == project_id), None)

    def create_project(self, project_data: Dict) -> Dict:
        """Create project - SYNCHRONOUS write to Supabase"""
        new_project = {
            "id": str(uuid.uuid4()),
            "created_at": datetime.now().isoformat(),
            **project_data
        }
        
        if SUPABASE_ENABLED:
            # SYNCHRONOUS - will raise exception if fails
            result = supabase_service.create_project(new_project)
            log_db_operation("CREATE", "project", result.get('id'), success=True)
            return result
        else:
            # Local fallback
            projects = self.get_projects()
            projects.append(new_project)
            self._write_json(PROJECTS_FILE, projects)
            return new_project

    def update_project(self, project_id: str, updates: Dict) -> Optional[Dict]:
        """Update project - SYNCHRONOUS write to Supabase"""
        if SUPABASE_ENABLED:
            # SYNCHRONOUS - will raise exception if fails
            result = supabase_service.update_project(project_id, updates)
            log_db_operation("UPDATE", "project", project_id, success=True)
            return result
        else:
            projects = self.get_projects()
            for i, p in enumerate(projects):
                if p['id'] == project_id:
                    projects[i] = {**p, **updates}
                    self._write_json(PROJECTS_FILE, projects)
                    return projects[i]
            return None

    def delete_project(self, project_id: str) -> bool:
        """Delete project - SYNCHRONOUS write to Supabase"""
        if SUPABASE_ENABLED:
            # SYNCHRONOUS - will raise exception if fails
            result = supabase_service.delete_project(project_id)
            log_db_operation("DELETE", "project", project_id, success=True)
            return result
        else:
            projects = [p for p in self.get_projects() if p['id'] != project_id]
            self._write_json(PROJECTS_FILE, projects)
            return True

    # ==================== TASKS ====================
    
    def get_tasks(self, project_id: str = None) -> List[Dict]:
        """Get all tasks from Supabase (or local fallback)"""
        if SUPABASE_ENABLED:
            return supabase_service.get_tasks(project_id)
        tasks = self._read_json(TASKS_FILE)
        return [t for t in tasks if t.get('project_id') == project_id] if project_id else tasks

    def get_task(self, task_id: str) -> Optional[Dict]:
        """Get single task by ID"""
        if SUPABASE_ENABLED:
            return supabase_service.get_task(task_id)
        tasks = self.get_tasks()
        return next((t for t in tasks if t['id'] == task_id), None)

    def create_task(self, task_data: Dict) -> Dict:
        """Create task - SYNCHRONOUS write to Supabase"""
        new_task = {
            "id": str(uuid.uuid4()),
            "status": "Upcoming",
            "created_at": datetime.now().isoformat(),
            "attachments": [],
            **task_data
        }
        
        if SUPABASE_ENABLED:
            # SYNCHRONOUS - will raise exception if fails
            result = supabase_service.create_task(new_task)
            print(f"[DB] Task created in Supabase: {result.get('id')}")
            return result
        else:
            tasks = self.get_tasks()
            tasks.append(new_task)
            self._write_json(TASKS_FILE, tasks)
            return new_task
    
    def batch_create_tasks(self, tasks_data: List[Dict]) -> List[Dict]:
        """Create multiple tasks - SYNCHRONOUS batch write to Supabase"""
        new_tasks = [
            {
                "id": str(uuid.uuid4()),
                "status": "Upcoming",
                "created_at": datetime.now().isoformat(),
                "attachments": [],
                **t
            } 
            for t in tasks_data
        ]
        
        if SUPABASE_ENABLED:
            # SYNCHRONOUS batch insert - will raise exception if fails
            result = supabase_service.batch_create_tasks(new_tasks)
            print(f"[DB] {len(result)} tasks created in Supabase (batch)")
            return result
        else:
            tasks = self.get_tasks()
            tasks.extend(new_tasks)
            self._write_json(TASKS_FILE, tasks)
            return new_tasks

    def update_task(self, task_id: str, updates: Dict) -> Optional[Dict]:
        """Update task - SYNCHRONOUS write to Supabase"""
        if SUPABASE_ENABLED:
            # SYNCHRONOUS - will raise exception if fails
            result = supabase_service.update_task(task_id, updates)
            print(f"[DB] Task updated in Supabase: {task_id}")
            return result
        else:
            tasks = self.get_tasks()
            for i, t in enumerate(tasks):
                if t['id'] == task_id:
                    tasks[i] = {**t, **updates}
                    self._write_json(TASKS_FILE, tasks)
                    return tasks[i]
            return None

    def delete_task(self, task_id: str) -> bool:
        """Delete task - SYNCHRONOUS write to Supabase"""
        if SUPABASE_ENABLED:
            # SYNCHRONOUS - will raise exception if fails
            result = supabase_service.delete_task(task_id)
            print(f"[DB] Task deleted from Supabase: {task_id}")
            return result
        else:
            tasks = [t for t in self.get_tasks() if t['id'] != task_id]
            self._write_json(TASKS_FILE, tasks)
            return True


# ==================== HELPER FUNCTIONS (for other data types) ====================
# These also use Supabase when enabled

def get_schedules() -> List[Dict]:
    if SUPABASE_ENABLED:
        return supabase_service.get_schedules()
    return json.load(open(SCHEDULES_FILE)) if os.path.exists(SCHEDULES_FILE) else []

def save_schedule(schedule: Dict):
    """Save single schedule - SYNCHRONOUS"""
    if SUPABASE_ENABLED:
        return supabase_service.save_schedule(schedule)
    schedules = get_schedules()
    schedules.append(schedule)
    _write_json_robust(SCHEDULES_FILE, schedules)

def delete_schedule(schedule_id: str):
    """Delete schedule - SYNCHRONOUS"""
    if SUPABASE_ENABLED:
        return supabase_service.delete_schedule(schedule_id)
    schedules = [s for s in get_schedules() if s.get('id') != schedule_id]
    _write_json_robust(SCHEDULES_FILE, schedules)

def save_schedules(schedules: List[Dict]):
    _write_json_robust(SCHEDULES_FILE, schedules)

def get_comments() -> List[Dict]:
    if SUPABASE_ENABLED:
        return supabase_service.get_comments()
    return json.load(open(COMMENTS_FILE)) if os.path.exists(COMMENTS_FILE) else []

def save_comment(comment: Dict):
    """Save single comment - SYNCHRONOUS"""
    if SUPABASE_ENABLED:
        return supabase_service.save_comment(comment)
    comments.append(comment)
    _write_json_robust(COMMENTS_FILE, comments)

def update_comment(comment_id: str, updates: Dict):
    """Update comment - SYNCHRONOUS"""
    if SUPABASE_ENABLED:
        return supabase_service.update_comment(comment_id, updates)
    comments = get_comments()
    for c in comments:
        if c.get('id') == comment_id:
            c.update(updates)
    _write_json_robust(COMMENTS_FILE, comments)

def delete_comment(comment_id: str):
    """Delete comment - SYNCHRONOUS"""
    if SUPABASE_ENABLED:
        return supabase_service.delete_comment(comment_id)
    comments = [c for c in get_comments() if c.get('id') != comment_id]
    _write_json_robust(COMMENTS_FILE, comments)

def save_comments(comments: List[Dict]):
    _write_json_robust(COMMENTS_FILE, comments)

def get_csms_pb_records() -> List[Dict]:
    if SUPABASE_ENABLED:
        return supabase_service.get_csms_pb_records()
    return json.load(open(CSMS_PB_FILE)) if os.path.exists(CSMS_PB_FILE) else []

def save_csms_pb(pb: Dict):
    """Save single CSMS PB - SYNCHRONOUS"""
    if SUPABASE_ENABLED:
        return supabase_service.save_csms_pb(pb)
    records.append(pb)
    _write_json_robust(CSMS_PB_FILE, records)

def update_csms_pb(pb_id: str, updates: Dict):
    """Update CSMS PB - SYNCHRONOUS"""
    if SUPABASE_ENABLED:
        return supabase_service.update_csms_pb(pb_id, updates)
    records = get_csms_pb_records()
    for r in records:
        if r.get('id') == pb_id:
            r.update(updates)
    _write_json_robust(CSMS_PB_FILE, records)

def delete_csms_pb(pb_id: str):
    """Delete CSMS PB - SYNCHRONOUS"""
    if SUPABASE_ENABLED:
        return supabase_service.delete_csms_pb(pb_id)
    records = [r for r in get_csms_pb_records() if r.get('id') != pb_id]
    _write_json_robust(CSMS_PB_FILE, records)

def save_csms_pb_records(records: List[Dict]):
    _write_json_robust(CSMS_PB_FILE, records)

def get_related_docs() -> List[Dict]:
    if SUPABASE_ENABLED:
        return supabase_service.get_related_docs()
    return json.load(open(RELATED_DOCS_FILE)) if os.path.exists(RELATED_DOCS_FILE) else []

def save_related_doc(doc: Dict):
    """Save single related doc - SYNCHRONOUS"""
    if SUPABASE_ENABLED:
        return supabase_service.save_related_doc(doc)
    docs = get_related_docs()
    docs.append(doc)
    _write_json_robust(RELATED_DOCS_FILE, docs)

def delete_related_doc(doc_id: str):
    """Delete related doc - SYNCHRONOUS"""
    if SUPABASE_ENABLED:
        return supabase_service.delete_related_doc(doc_id)
    docs = [d for d in get_related_docs() if d.get('id') != doc_id]
    _write_json_robust(RELATED_DOCS_FILE, docs)

def save_related_docs(docs: List[Dict]):
    _write_json_robust(RELATED_DOCS_FILE, docs)

def get_ll_indicators(project_id: str = None, year: int = None, month: int = None) -> List[Dict]:
    """Get LL indicators from Supabase (or local fallback)"""
    if SUPABASE_ENABLED:
        flat_data = supabase_service.get_ll_indicators(project_id, year, month)
        if not flat_data:
            return []
        
        # Group by project_id
        grouped = {}
        for item in flat_data:
            if not item: continue
            pid = item.get('project_id')
            if not pid: continue
            
            if pid not in grouped:
                grouped[pid] = {"project_id": pid, "lagging": [], "leading": []}
            
            indicator = {
                "id": item.get('id'),
                "name": item.get('name'),
                "target": item.get('target'),
                "actual": item.get('actual'),
                "icon": item.get('icon'),
                "intent": item.get('intent')
            }
            
            category = str(item.get('category') or '').lower()
            if 'lagging' in category:
                grouped[pid]['lagging'].append(indicator)
            elif 'leading' in category:
                grouped[pid]['leading'].append(indicator)
        
        return list(grouped.values())

    all_data = json.load(open(LL_INDICATOR_FILE)) if os.path.exists(LL_INDICATOR_FILE) else []
    filtered = all_data
    if project_id:
        filtered = [r for r in filtered if r.get('project_id') == project_id]
    if year:
        filtered = [r for r in filtered if r.get('year') == int(year)]
    if month:
        filtered = [r for r in filtered if r.get('month') == int(month)]
    return filtered

def save_ll_indicator(project_id: str, data: Dict):
    """Save/Update LL indicator data for a project - SYNCHRONOUS"""
    if SUPABASE_ENABLED:
        return supabase_service.save_ll_indicator(project_id, data)
    
    all_data = get_ll_indicators()
    # Find existing or append
    found = False
    for i, item in enumerate(all_data):
        if item.get('project_id') == project_id:
            all_data[i] = {**data, "project_id": project_id, "updated_at": datetime.now().isoformat()}
            found = True
            break
    
    if not found:
        all_data.append({**data, "project_id": project_id, "created_at": datetime.now().isoformat()})
    
    _write_json_robust(LL_INDICATOR_FILE, all_data)
    return True


# ==================== MASTER DATA (CLIENTS / PRODUCT LINES) ====================

def _next_serial_id(items: List[Dict]) -> int:
    if not items:
        return 1
    return max(int(i.get("id", 0)) for i in items) + 1


def get_clients() -> List[Dict]:
    if SUPABASE_ENABLED:
        return supabase_service.get_clients()
    return _read_json_list(CLIENTS_FILE)


def get_client(client_id: int) -> Optional[Dict]:
    if SUPABASE_ENABLED:
        return supabase_service.get_client(client_id)
    return next((c for c in get_clients() if c.get("id") == client_id), None)


def create_client(data: Dict) -> Dict:
    if SUPABASE_ENABLED:
        return supabase_service.create_client(data)
    clients = get_clients()
    new_client = {
        "id": _next_serial_id(clients),
        "created_at": datetime.now().isoformat(),
        **data,
    }
    clients.append(new_client)
    _write_json_robust(CLIENTS_FILE, clients)
    return new_client


def update_client(client_id: int, updates: Dict) -> Optional[Dict]:
    if SUPABASE_ENABLED:
        return supabase_service.update_client(client_id, updates)
    clients = get_clients()
    for i, c in enumerate(clients):
        if c.get("id") == client_id:
            clients[i] = {**c, **updates}
            _write_json_robust(CLIENTS_FILE, clients)
            return clients[i]
    return None


def delete_client(client_id: int) -> bool:
    if SUPABASE_ENABLED:
        return supabase_service.delete_client(client_id)
    clients = [c for c in get_clients() if c.get("id") != client_id]
    _write_json_robust(CLIENTS_FILE, clients)
    return True


def get_product_lines() -> List[Dict]:
    if SUPABASE_ENABLED:
        return supabase_service.get_product_lines()
    return _read_json_list(PRODUCT_LINES_FILE)


def get_product_line(product_line_id: int) -> Optional[Dict]:
    if SUPABASE_ENABLED:
        return supabase_service.get_product_line(product_line_id)
    return next(
        (p for p in get_product_lines() if p.get("id") == product_line_id), None
    )


def create_product_line(data: Dict) -> Dict:
    if SUPABASE_ENABLED:
        return supabase_service.create_product_line(data)
    lines = get_product_lines()
    new_line = {
        "id": _next_serial_id(lines),
        "created_at": datetime.now().isoformat(),
        **data,
    }
    lines.append(new_line)
    _write_json_robust(PRODUCT_LINES_FILE, lines)
    return new_line


def update_product_line(product_line_id: int, updates: Dict) -> Optional[Dict]:
    if SUPABASE_ENABLED:
        return supabase_service.update_product_line(product_line_id, updates)
    lines = get_product_lines()
    for i, p in enumerate(lines):
        if p.get("id") == product_line_id:
            lines[i] = {**p, **updates}
            _write_json_robust(PRODUCT_LINES_FILE, lines)
            return lines[i]
    return None


def delete_product_line(product_line_id: int) -> bool:
    if SUPABASE_ENABLED:
        return supabase_service.delete_product_line(product_line_id)
    lines = [p for p in get_product_lines() if p.get("id") != product_line_id]
    _write_json_robust(PRODUCT_LINES_FILE, lines)
    return True


def get_client_product_templates() -> List[Dict]:
    if SUPABASE_ENABLED:
        return supabase_service.get_client_product_templates()
    return _read_json_list(CLIENT_PRODUCT_TEMPLATES_FILE)


def get_client_product_template(
    client_id: int, product_line_id: int
) -> Optional[Dict]:
    if SUPABASE_ENABLED:
        return supabase_service.get_client_product_template(client_id, product_line_id)
    return next(
        (
            t
            for t in get_client_product_templates()
            if t.get("client_id") == client_id
            and t.get("product_line_id") == product_line_id
        ),
        None,
    )


def upsert_client_product_template(data: Dict) -> Dict:
    if SUPABASE_ENABLED:
        return supabase_service.upsert_client_product_template(data)
    templates = get_client_product_templates()
    found = False
    for i, t in enumerate(templates):
        if (
            t.get("client_id") == data.get("client_id")
            and t.get("product_line_id") == data.get("product_line_id")
        ):
            templates[i] = {**t, **data}
            found = True
            break
    if not found:
        templates.append(
            {
                "id": _next_serial_id(templates),
                "created_at": datetime.now().isoformat(),
                **data,
            }
        )
    _write_json_robust(CLIENT_PRODUCT_TEMPLATES_FILE, templates)
    return get_client_product_template(data["client_id"], data["product_line_id"]) or data


def _read_json_list(filepath: str) -> List[Dict]:
    try:
        if os.path.exists(filepath):
            with open(filepath, "r") as f:
                return json.load(f)
    except Exception:
        pass
    return []


_db = Database()


def get_projects_for_client_product_line(
    client_id: int, product_line_id: int
) -> List[Dict]:
    """Projects that share a client + product line (for template propagation)."""
    return [
        p
        for p in _db.get_projects()
        if p.get("client_id") == client_id
        and p.get("product_line_id") == product_line_id
    ]


def collect_protected_drive_file_ids(project_id: str) -> set:
    """Drive file IDs that must never be removed by template sync (app uploads)."""
    protected = set()
    for task in _db.get_tasks(project_id):
        attachments = task.get("attachments")
        if isinstance(attachments, str):
            try:
                attachments = json.loads(attachments)
            except Exception:
                attachments = []
        if not isinstance(attachments, list):
            continue
        for att in attachments:
            fid = att.get("file_id")
            if fid:
                protected.add(fid)
    return protected


def update_project_drive_folder(project_id: str, drive_folder_id: str) -> None:
    _db.update_project(project_id, {"drive_folder_id": drive_folder_id})


