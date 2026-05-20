"""
Supabase Database Service
Provides persistent storage for CSMS application data
"""
import os
import re
import time
import uuid
from typing import Any, Callable, Dict, List, Optional, TypeVar
from datetime import datetime
import json

try:
    import httpx
    from supabase import create_client, Client
    from supabase.lib.client_options import SyncClientOptions
    SUPABASE_AVAILABLE = True
except ImportError:
    httpx = None
    SUPABASE_AVAILABLE = False

T = TypeVar("T")

_RETRYABLE_SUPABASE_ERRORS: tuple = ()
if SUPABASE_AVAILABLE and httpx is not None:
    _RETRYABLE_SUPABASE_ERRORS = (
        httpx.RemoteProtocolError,
        httpx.ConnectError,
        httpx.ReadTimeout,
        httpx.WriteTimeout,
        httpx.PoolTimeout,
        httpx.NetworkError,
    )

# Import logger (delayed to avoid circular import)
def _get_logger():
    try:
        from services.logger_service import log_supabase_operation, log_supabase_error, log_info, log_warning, log_error
        return log_supabase_operation, log_supabase_error, log_info, log_warning, log_error
    except ImportError:
        # Fallback if logger not available
        def noop(*args, **kwargs): pass
        return noop, noop, noop, noop, noop

if not SUPABASE_AVAILABLE:
    print("[WARN] supabase-py not installed. Run: pip install supabase")

class SupabaseService:
    def __init__(self):
        self.url = os.getenv("SUPABASE_URL", "")
        self.key = os.getenv("SUPABASE_KEY", "")
        self.client: Optional[Client] = None
        self.enabled = False
        self._log_op, self._log_err, self._log_info, self._log_warn, self._log_error = _get_logger()
        
        self._log_info("SUPABASE", "Initializing Supabase Service...")
        self._log_info("SUPABASE", f"SUPABASE_URL: {self.url[:30] + '...' if self.url else 'NOT SET'}")
        self._log_info("SUPABASE", f"SUPABASE_KEY: {'SET' if self.key else 'NOT SET'}")
        
        if not SUPABASE_AVAILABLE:
            self._log_error("SUPABASE", "supabase-py package not installed")
            return
            
        if not self.url or not self.key:
            self._log_error("SUPABASE", "SUPABASE_URL or SUPABASE_KEY not set")
            return
        
        try:
            # HTTP/2 drops are common on serverless (Vercel) — force HTTP/1.1 + retries.
            httpx_client = httpx.Client(
                http2=False,
                timeout=httpx.Timeout(60.0, connect=15.0),
                transport=httpx.HTTPTransport(retries=2),
            )
            options = SyncClientOptions(
                httpx_client=httpx_client,
                postgrest_client_timeout=60,
            )
            self.client = create_client(self.url, self.key, options=options)
            self.enabled = True
            self._log_info("SUPABASE", "Client initialized successfully!")
        except Exception as e:
            self._log_error("SUPABASE", f"Initialization failed: {e}", e)
            self.enabled = False

    def _execute_with_retry(self, build_request: Callable[[], Any], op_name: str, retries: int = 3):
        """Retry transient Supabase/httpx disconnects (common on serverless)."""
        last_err: Optional[Exception] = None
        for attempt in range(retries):
            try:
                return build_request().execute()
            except _RETRYABLE_SUPABASE_ERRORS as e:
                last_err = e
                if attempt < retries - 1:
                    delay = 0.4 * (2 ** attempt)
                    self._log_warn(
                        "SUPABASE",
                        f"{op_name} disconnected (attempt {attempt + 1}/{retries}), retry in {delay:.1f}s",
                    )
                    time.sleep(delay)
                else:
                    self._log_err("SUPABASE", f"{op_name} failed after {retries} attempts", e)
                    raise
            except Exception:
                raise
        if last_err:
            raise last_err
        raise RuntimeError(f"{op_name}: retry loop ended unexpectedly")
    
    # ==================== PROJECTS ====================

    PROJECT_DB_COLUMNS = frozenset({
        "id",
        "name",
        "description",
        "status",
        "created_at",
        "updated_at",
        "well_name",
        "kontrak_no",
        "start_date",
        "end_date",
        "rig_down_date",
        "rig_down",
        "assigned_to",
        "pic_email",
        "pic_manager_email",
        "drive_folder_id",
        "client_id",
        "product_line_id",
    })

    def _normalize_project_row(self, row: Optional[Dict]) -> Optional[Dict]:
        if not row:
            return row
        out = dict(row)
        if out.get("rig_down") and not out.get("rig_down_date"):
            out["rig_down_date"] = out["rig_down"]
        if out.get("rig_down_date") and not out.get("rig_down"):
            out["rig_down"] = out["rig_down_date"]
        return out

    def _prepare_project_payload(self, data: Dict) -> Dict:
        row = self._normalize_project_row(dict(data)) or {}
        return {k: v for k, v in row.items() if k in self.PROJECT_DB_COLUMNS}
    
    def get_projects(self) -> List[Dict]:
        if not self.enabled:
            return []
        try:
            result = self.client.table('projects').select("*").execute()
            self._log_op("SELECT", "projects", success=True)
            return [self._normalize_project_row(p) for p in (result.data or [])]
        except Exception as e:
            self._log_err("SELECT", "projects", e)
            return []
    
    def get_project(self, project_id: str) -> Optional[Dict]:
        if not self.enabled:
            return None
        try:
            result = self.client.table('projects').select("*").eq('id', project_id).execute()
            self._log_op("SELECT", "projects", project_id, success=True)
            return self._normalize_project_row(result.data[0] if result.data else None)
        except Exception as e:
            self._log_err("SELECT", "projects", e)
            return None
    
    def create_project(self, project_data: Dict) -> Dict:
        self._log_info("SUPABASE", f"create_project called, enabled={self.enabled}")
        if not self.enabled:
            self._log_warn("SUPABASE", "Not enabled, returning data as-is")
            return project_data
        try:
            payload = self._prepare_project_payload(project_data)
            self._log_info("SUPABASE", f"Inserting into projects table: {list(payload.keys())}")
            result = self.client.table('projects').insert(payload).execute()
            if result.data:
                self._log_op("INSERT", "projects", result.data[0].get('id'), success=True)
                return self._normalize_project_row(result.data[0])
            else:
                self._log_warn("SUPABASE", "No data returned from insert")
                raise RuntimeError("Supabase insert returned no data")
        except Exception as e:
            self._log_err("INSERT", "projects", e)
            raise
    
    def update_project(self, project_id: str, updates: Dict) -> Optional[Dict]:
        if not self.enabled:
            return None
        try:
            payload = self._prepare_project_payload(updates)
            if not payload:
                return self.get_project(project_id)
            result = self.client.table('projects').update(payload).eq('id', project_id).execute()
            return self._normalize_project_row(result.data[0] if result.data else None)
        except Exception as e:
            print(f"[ERROR] Error updating project: {e}")
            return None
    
    def delete_project(self, project_id: str) -> bool:
        if not self.enabled:
            return False
        try:
            self.client.table('projects').delete().eq('id', project_id).execute()
            return True
        except Exception as e:
            print(f"[ERROR] Error deleting project: {e}")
            return False
    
    # ==================== TASKS ====================
    
    def get_tasks(self, project_id: str = None) -> List[Dict]:
        if not self.enabled:
            return []
        try:
            query = self.client.table('tasks').select("*")
            if project_id:
                query = query.eq('project_id', project_id)
            else:
                query = query.order('id').limit(10000) # Ensure we get all tasks, ordered
            result = query.execute()
            tasks = result.data or []
            # Parse attachments JSON for each task
            for task in tasks:
                if 'attachments' in task and isinstance(task['attachments'], str):
                    try:
                        task['attachments'] = json.loads(task['attachments'])
                    except:
                        task['attachments'] = []
            return tasks
        except Exception as e:
            print(f"[ERROR] Error fetching tasks: {e}")
            return []

    def get_task(self, task_id: str) -> Optional[Dict]:
        if not self.enabled:
            return None
        try:
            result = self.client.table('tasks').select("*").eq('id', task_id).execute()
            if not result.data: return None
            task = result.data[0]
            if 'attachments' in task and isinstance(task['attachments'], str):
                try:
                    task['attachments'] = json.loads(task['attachments'])
                except:
                    task['attachments'] = []
            return task
        except Exception as e:
            print(f"[ERROR] Error fetching single task: {e}")
            return None
    
    def create_task(self, task_data: Dict) -> Dict:
        print(f"[SUPABASE] create_task called, enabled={self.enabled}")
        if not self.enabled:
            return task_data
        try:
            # Convert attachments list to JSON string
            if 'attachments' in task_data and isinstance(task_data['attachments'], list):
                task_data['attachments'] = json.dumps(task_data['attachments'])
            print(f"[SUPABASE] Inserting task: {task_data.get('title', 'unknown')}")
            result = self.client.table('tasks').insert(task_data).execute()
            print(f"[SUPABASE] Task insert result: {result.data[0]['id'] if result.data else 'NO DATA'}")
            task = result.data[0] if result.data else task_data
            if 'attachments' in task and isinstance(task['attachments'], str):
                task['attachments'] = json.loads(task['attachments'])
            return task
        except Exception as e:
            print(f"[ERROR] Error creating task: {e}")
            import traceback
            traceback.print_exc()
            return task_data
    
    def update_task(self, task_id: str, updates: Dict) -> Optional[Dict]:
        if not self.enabled:
            return None
        try:
            if 'attachments' in updates and isinstance(updates['attachments'], list):
                updates['attachments'] = json.dumps(updates['attachments'])
            result = self.client.table('tasks').update(updates).eq('id', task_id).execute()
            task = result.data[0] if result.data else None
            if task and 'attachments' in task and isinstance(task['attachments'], str):
                task['attachments'] = json.loads(task['attachments'])
            return task
        except Exception as e:
            print(f"[ERROR] Error updating task: {e}")
            return None
    
    def batch_create_tasks(self, tasks: List[Dict]) -> List[Dict]:
        """Batch insert multiple tasks in a single API call - much faster!"""
        if not self.enabled or not tasks:
            return tasks
        try:
            # Convert attachments to JSON strings
            for task in tasks:
                if 'attachments' in task and isinstance(task['attachments'], list):
                    task['attachments'] = json.dumps(task['attachments'])
            
            print(f"[SUPABASE] Batch inserting {len(tasks)} tasks in ONE call...")
            result = self.client.table('tasks').insert(tasks).execute()
            print(f"[SUPABASE] Batch insert complete: {len(result.data) if result.data else 0} tasks created")
            
            # Parse attachments back for each task
            returned_tasks = result.data or tasks
            for task in returned_tasks:
                if 'attachments' in task and isinstance(task['attachments'], str):
                    try:
                        task['attachments'] = json.loads(task['attachments'])
                    except:
                        task['attachments'] = []
            return returned_tasks
        except Exception as e:
            print(f"[ERROR] Batch task insert failed: {e}")
            return tasks
    
    def delete_task(self, task_id: str) -> bool:
        if not self.enabled:
            return False
        try:
            self.client.table('tasks').delete().eq('id', task_id).execute()
            return True
        except Exception as e:
            print(f"[ERROR] Error deleting task: {e}")
            return False
    
    # ==================== SCHEDULES ====================
    
    def get_schedules(self) -> List[Dict]:
        if not self.enabled:
            return []
        try:
            result = self.client.table('schedules').select("*").execute()
            return result.data or []
        except Exception as e:
            print(f"[ERROR] Error fetching schedules: {e}")
            return []
    
    def save_schedule(self, schedule_data: Dict) -> Dict:
        if not self.enabled:
            return schedule_data
        try:
            result = self.client.table('schedules').insert(schedule_data).execute()
            return result.data[0] if result.data else schedule_data
        except Exception as e:
            print(f"[ERROR] Error creating schedule: {e}")
            return schedule_data
    
    def delete_schedule(self, schedule_id: str) -> bool:
        if not self.enabled:
            return False
        try:
            self.client.table('schedules').delete().eq('id', schedule_id).execute()
            return True
        except Exception as e:
            print(f"[ERROR] Error deleting schedule: {e}")
            return False
    
    # ==================== COMMENTS ====================
    
    def get_comments(self) -> List[Dict]:
        if not self.enabled:
            return []
        try:
            result = self.client.table('comments').select("*").order('created_at', desc=True).execute()
            comments = result.data or []
            for comment in comments:
                if 'replies' in comment and isinstance(comment['replies'], str):
                    try:
                        comment['replies'] = json.loads(comment['replies'])
                    except:
                        comment['replies'] = []
            return comments
        except Exception as e:
            print(f"[ERROR] Error fetching comments: {e}")
            return []
    
    def save_comment(self, comment_data: Dict) -> Dict:
        if not self.enabled:
            return comment_data
        try:
            if 'replies' in comment_data and isinstance(comment_data['replies'], list):
                comment_data['replies'] = json.dumps(comment_data['replies'])
            result = self.client.table('comments').insert(comment_data).execute()
            return result.data[0] if result.data else comment_data
        except Exception as e:
            print(f"[ERROR] Error creating comment: {e}")
            return comment_data
    
    def update_comment(self, comment_id: str, updates: Dict) -> Optional[Dict]:
        if not self.enabled:
            return None
        try:
            if 'replies' in updates and isinstance(updates['replies'], list):
                updates['replies'] = json.dumps(updates['replies'])
            result = self.client.table('comments').update(updates).eq('id', comment_id).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            print(f"[ERROR] Error updating comment: {e}")
            return None
    
    def delete_comment(self, comment_id: str) -> bool:
        if not self.enabled:
            return False
        try:
            self.client.table('comments').delete().eq('id', comment_id).execute()
            return True
        except Exception as e:
            print(f"[ERROR] Error deleting comment: {e}")
            return False
    
    # ==================== CSMS PB ====================
    
    def get_csms_pb_records(self) -> List[Dict]:
        if not self.enabled:
            return []
        try:
            result = self.client.table('csms_pb').select("*").execute()
            records = result.data or []
            for record in records:
                if 'attachments' in record and isinstance(record['attachments'], str):
                    try:
                        record['attachments'] = json.loads(record['attachments'])
                    except:
                        record['attachments'] = []
            return records
        except Exception as e:
            print(f"[ERROR] Error fetching CSMS PB: {e}")
            return []
    
    def save_csms_pb(self, pb_data: Dict) -> Dict:
        if not self.enabled:
            return pb_data
        try:
            if 'attachments' in pb_data and isinstance(pb_data['attachments'], list):
                pb_data['attachments'] = json.dumps(pb_data['attachments'])
            result = self.client.table('csms_pb').insert(pb_data).execute()
            return result.data[0] if result.data else pb_data
        except Exception as e:
            print(f"[ERROR] Error creating CSMS PB: {e}")
            return pb_data
    
    def update_csms_pb(self, pb_id: str, updates: Dict) -> Optional[Dict]:
        if not self.enabled:
            return None
        try:
            result = self.client.table('csms_pb').update(updates).eq('id', pb_id).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            print(f"[ERROR] Error updating CSMS PB: {e}")
            return None
    
    def delete_csms_pb(self, pb_id: str) -> bool:
        if not self.enabled:
            return False
        try:
            self.client.table('csms_pb').delete().eq('id', pb_id).execute()
            return True
        except Exception as e:
            print(f"[ERROR] Error deleting CSMS PB: {e}")
            return False
    
    # ==================== RELATED DOCS ====================
    
    def get_related_docs(self) -> List[Dict]:
        if not self.enabled:
            return []
        try:
            result = self.client.table('related_docs').select("*").execute()
            return result.data or []
        except Exception as e:
            print(f"[ERROR] Error fetching related docs: {e}")
            return []
    
    def save_related_doc(self, doc_data: Dict) -> Dict:
        if not self.enabled:
            return doc_data
        try:
            result = self.client.table('related_docs').insert(doc_data).execute()
            return result.data[0] if result.data else doc_data
        except Exception as e:
            print(f"[ERROR] Error creating related doc: {e}")
            return doc_data
    
    def delete_related_doc(self, doc_id: str) -> bool:
        if not self.enabled:
            return False
        try:
            self.client.table('related_docs').delete().eq('id', doc_id).execute()
            return True
        except Exception as e:
            print(f"[ERROR] Error deleting related doc: {e}")
            return False

    # ==================== LL INDICATORS ====================

    def get_ll_indicators(self, project_id: str = None, year: int = None, month: int = None) -> List[Dict]:
        if not self.enabled:
            return []
        try:
            query = self.client.table('ll_indicators').select("*")
            if project_id:
                query = query.eq('project_id', project_id)
            if year:
                query = query.eq('year', year)
            if month:
                query = query.eq('month', month)
            query = query.order('sort_order', desc=False)
            result = query.execute()
            return result.data or []
        except Exception as e:
            print(f"[ERROR] Error fetching LL indicators: {e}")
            return []

    def save_ll_indicator(self, project_id: str, data: Dict) -> bool:
        """
        Optimized batch upsert for LL indicators.
        Reduces network calls from ~68 to 1.
        """
        if not self.enabled:
            return False
        try:
            # If data has 'lagging' and 'leading' (old structure), we upsert multiple
            if 'lagging' in data or 'leading' in data:
                all_to_upsert = []
                for cat in ['lagging', 'leading']:
                    for idx, ind in enumerate(data.get(cat, [])):
                        # Ensure fields match table
                        item = {
                            "project_id": project_id,
                            "category": cat.capitalize(),
                            "name": ind.get('name'),
                            "target": ind.get('target'),
                            "actual": ind.get('actual', '0'),
                            "icon": ind.get('icon'),
                            "intent": ind.get('intent'),
                            "year": data.get('year', ind.get('year', 2025)),
                            "month": data.get('month', ind.get('month')),
                            "sort_order": ind.get('sort_order', idx + 1),
                            "updated_at": datetime.now().isoformat()
                        }
                        # If the indicator has an ID, include it for correct upserting
                        if ind.get('id'):
                            item['id'] = ind.get('id')
                            
                        all_to_upsert.append(item)
                
                if all_to_upsert:
                    print(f"[SUPABASE] Batch upserting {len(all_to_upsert)} LL indicators for project {project_id}")
                    # Using upsert with on_conflict logic (assumes unique constraint on project_id, name, cat, year, month or matching ID)
                    self.client.table('ll_indicators').upsert(all_to_upsert, on_conflict="project_id,category,name,year,month").execute()
                return True
            else:
                # Flat single item update/insert
                if data.get('id'):
                    allowed = (
                        'name', 'target', 'actual', 'icon', 'intent',
                        'year', 'month', 'sort_order', 'category'
                    )
                    update_data = {'updated_at': datetime.now().isoformat()}
                    for key in allowed:
                        if key not in data:
                            continue
                        val = data[key]
                        if key in ('target', 'actual'):
                            update_data[key] = '' if val is None else str(val)
                        elif val is not None and str(val).strip() != '':
                            update_data[key] = val
                    if not update_data.get('category'):
                        intent = str(data.get('intent') or '').lower()
                        update_data['category'] = 'Lagging' if 'negative' in intent else 'Leading'
                    result = (
                        self.client.table('ll_indicators')
                        .update(update_data)
                        .eq('id', data['id'])
                        .eq('project_id', project_id)
                        .execute()
                    )
                    if not result.data:
                        print(f"[SUPABASE] LL update returned no rows for id={data['id']}")
                        return False
                else:
                    new_item = {**data, "project_id": project_id, "updated_at": datetime.now().isoformat()}
                    if new_item.get('target') is not None:
                        new_item['target'] = str(new_item['target'])
                    if new_item.get('actual') is not None:
                        new_item['actual'] = str(new_item['actual'])
                    self.client.table('ll_indicators').insert(new_item).execute()
                return True
        except Exception as e:
            print(f"[ERROR] Error saving LL indicator: {e}")
            import traceback
            traceback.print_exc()
            return False

    def delete_ll_indicator(self, indicator_id: str) -> bool:
        if not self.enabled:
            return False
        try:
            self.client.table('ll_indicators').delete().eq('id', indicator_id).execute()
            return True
        except Exception as e:
            print(f"[ERROR] Error deleting LL indicator: {e}")
            return False

    # ===== OTP (uses ll_indicators table + otp_month_data) =====
    def get_otp_programs(self, project_id: str, year: int = 2025, month: int = None) -> List[Dict]:
        """Get LL indicators as OTP programs with their monthly data.

        OTP programs are scoped by project+year. Monthly plan/actual lives in
        otp_month_data; toolbar month filter is UI-only (not ll_indicators.month).
        """
        if not self.enabled:
            return []
        try:
            # Fetch all indicators for this project/year (ignore ll_indicators.month)
            query = self.client.table('ll_indicators').select("*").eq('project_id', project_id).eq('year', year)
            query = query.order('sort_order', desc=False)
            result = query.execute()
            indicators = result.data or []
            if not indicators:
                return []

            indicator_ids = [ind['id'] for ind in indicators]
            month_result = self.client.table('otp_month_data').select("*").in_('indicator_id', indicator_ids).execute()
            month_data = month_result.data or []

            month_map = {}
            for md in month_data:
                iid = md['indicator_id']
                if iid not in month_map:
                    month_map[iid] = {}
                month_map[iid][md['month']] = md

            # Merge LL rows that share the same program name (one row per month in LL)
            merged = {}
            for ind in indicators:
                key = (str(ind.get('category') or ''), ind.get('name') or '')
                if key not in merged:
                    merged[key] = {
                        **ind,
                        '_merge_ids': [ind['id']],
                        'months': dict(month_map.get(ind['id'], {})),
                    }
                else:
                    merged[key]['_merge_ids'].append(ind['id'])
                    for m_key, md in month_map.get(ind['id'], {}).items():
                        if m_key not in merged[key]['months']:
                            merged[key]['months'][m_key] = md

            programs = []
            for prog in merged.values():
                prog.pop('_merge_ids', None)
                total_plan = 0
                total_actual = 0
                for m in range(1, 13):
                    md = prog['months'].get(m, prog['months'].get(str(m), {}))
                    total_plan += int(md.get('plan', 0) or 0)
                    total_actual += int(md.get('actual', 0) or 0)
                prog['progress'] = min(100, round((total_actual / total_plan * 100) if total_plan > 0 else 0))
                programs.append(prog)

            programs.sort(key=lambda p: p.get('sort_order', 0) or 0)
            return programs
        except Exception as e:
            print(f"[ERROR] Error fetching OTP programs: {e}")
            import traceback
            traceback.print_exc()
            return []

    def get_otp_stats_summary(self, year: int) -> Dict:
        """Aggregate OTP stats in two queries (all projects for year)."""
        empty = {
            'total_programs': 0, 'avg_progress': 0, 'lagging': 0, 'leading': 0,
            'progress_buckets': [0, 0, 0, 0], 'top_programs': [],
        }
        if not self.enabled:
            return empty
        try:
            result = (
                self.client.table('ll_indicators')
                .select('id,name,category,sort_order,project_id')
                .eq('year', year)
                .execute()
            )
            indicators = result.data or []
            if not indicators:
                return empty

            ids = [ind['id'] for ind in indicators]
            month_result = (
                self.client.table('otp_month_data')
                .select('indicator_id,month,plan,actual')
                .in_('indicator_id', ids)
                .execute()
            )
            month_data = month_result.data or []
            month_map = {}
            for md in month_data:
                iid = md['indicator_id']
                if iid not in month_map:
                    month_map[iid] = {}
                month_map[iid][md['month']] = md

            merged = {}
            for ind in indicators:
                key = (str(ind.get('project_id') or ''), str(ind.get('category') or ''), ind.get('name') or '')
                if key not in merged:
                    merged[key] = {**ind, 'months': dict(month_map.get(ind['id'], {}))}
                else:
                    for m_key, md in month_map.get(ind['id'], {}).items():
                        if m_key not in merged[key]['months']:
                            merged[key]['months'][m_key] = md

            progress_vals = []
            top_programs = []
            buckets = [0, 0, 0, 0]
            lagging = leading = 0
            for prog in merged.values():
                if prog.get('category') == 'Lagging':
                    lagging += 1
                else:
                    leading += 1
                total_plan = total_actual = 0
                for m in range(1, 13):
                    md = prog['months'].get(m, prog['months'].get(str(m), {}))
                    total_plan += int(md.get('plan') or 0)
                    total_actual += int(md.get('actual') or 0)
                progress = min(100, round((total_actual / total_plan * 100) if total_plan > 0 else 0))
                progress_vals.append(progress)
                bi = min(3, int(progress // 25)) if progress < 100 else 3
                buckets[bi] += 1
                top_programs.append({'name': (prog.get('name') or '')[:24], 'progress': float(progress)})

            top_programs.sort(key=lambda x: -x['progress'])
            return {
                'total_programs': len(merged),
                'avg_progress': round(sum(progress_vals) / len(progress_vals), 1) if progress_vals else 0,
                'lagging': lagging,
                'leading': leading,
                'progress_buckets': buckets,
                'top_programs': top_programs[:8],
            }
        except Exception as e:
            print(f"[ERROR] get_otp_stats_summary: {e}")
            return empty

    def update_otp_program(self, project_id: str, program_id: str, data: Dict) -> bool:
        """Update OTP program metadata (ll_indicators row)."""
        if not self.enabled:
            return False
        try:
            allowed = ('name', 'target', 'category', 'icon', 'intent', 'sort_order', 'year')
            update_data = {'updated_at': datetime.now().isoformat()}
            for key in allowed:
                if key not in data:
                    continue
                val = data[key]
                if key in ('target',):
                    update_data[key] = '' if val is None else str(val)
                elif val is not None and str(val).strip() != '':
                    update_data[key] = val
            if not update_data.get('category') and data.get('intent'):
                intent = str(data.get('intent')).lower()
                update_data['category'] = 'Lagging' if 'negative' in intent else 'Leading'
            result = (
                self.client.table('ll_indicators')
                .update(update_data)
                .eq('id', program_id)
                .eq('project_id', project_id)
                .execute()
            )
            return bool(result.data)
        except Exception as e:
            print(f"[ERROR] Error updating OTP program: {e}")
            return False

    def delete_otp_program(self, program_id: str) -> bool:
        """Delete OTP program and its monthly data."""
        if not self.enabled:
            return False
        try:
            self.client.table('otp_month_data').delete().eq('indicator_id', program_id).execute()
            self.client.table('ll_indicators').delete().eq('id', program_id).execute()
            return True
        except Exception as e:
            print(f"[ERROR] Error deleting OTP program: {e}")
            return False

    def create_otp_program(self, project_id: str, data: Dict) -> Optional[Dict]:
        """Insert a new OTP program row and return created record."""
        if not self.enabled:
            return None
        try:
            payload = {
                "project_id": project_id,
                "name": data.get("name"),
                "category": data.get("category", "Leading"),
                "target": str(data.get("target", "0") or "0"),
                "actual": "0",
                "icon": data.get("icon", "📊"),
                "intent": data.get("intent", "positive"),
                "year": int(data.get("year") or 2025),
                "month": None,
                "sort_order": int(data.get("sort_order") or 0),
                "updated_at": datetime.now().isoformat(),
            }
            result = self.client.table('ll_indicators').insert(payload).execute()
            return result.data[0] if result.data else None
        except Exception as e:
            print(f"[ERROR] Error creating OTP program: {e}")
            return None

    def save_otp_month_data(self, indicator_id: str, month: int, data: Dict) -> bool:
        """Upsert monthly data for an OTP indicator."""
        if not self.enabled:
            return False
        try:
            upsert_data = {
                'indicator_id': indicator_id,
                'month': month,
                'plan': int(data.get('plan', 0) or 0),
                'actual': int(data.get('actual', 0) or 0),
                'wpts_id': data.get('wpts_id', ''),
                'plan_date': data.get('plan_date', ''),
                'impl_date': data.get('impl_date', ''),
                'pic_name': data.get('pic_name', ''),
                'pic_email': data.get('pic_email', ''),
                'pic_manager': data.get('pic_manager', ''),
                'pic_manager_email': data.get('pic_manager_email', ''),
                'updated_at': datetime.now().isoformat()
            }
            self.client.table('otp_month_data').upsert(upsert_data, on_conflict="indicator_id,month").execute()
            return True
        except Exception as e:
            print(f"[ERROR] Error saving OTP month data: {e}")
            import traceback
            traceback.print_exc()
            return False

    # ==================== CLIENTS ====================

    def get_clients(self) -> List[Dict]:
        if not self.enabled:
            return []
        try:
            result = self.client.table("clients").select("*").order("name").execute()
            return result.data or []
        except Exception as e:
            self._log_err("SELECT", "clients", e)
            return []

    def get_client(self, client_id: int) -> Optional[Dict]:
        if not self.enabled:
            return None
        try:
            result = (
                self.client.table("clients").select("*").eq("id", client_id).execute()
            )
            return result.data[0] if result.data else None
        except Exception as e:
            self._log_err("SELECT", "clients", e)
            return None

    def create_client(self, data: Dict) -> Dict:
        if not self.enabled:
            return data
        try:
            result = self.client.table("clients").insert(data).execute()
            return result.data[0] if result.data else data
        except Exception as e:
            self._log_err("INSERT", "clients", e)
            raise

    def update_client(self, client_id: int, updates: Dict) -> Optional[Dict]:
        if not self.enabled:
            return None
        try:
            result = (
                self.client.table("clients")
                .update(updates)
                .eq("id", client_id)
                .execute()
            )
            return result.data[0] if result.data else None
        except Exception as e:
            self._log_err("UPDATE", "clients", e)
            return None

    def delete_client(self, client_id: int) -> bool:
        if not self.enabled:
            return False
        try:
            self.client.table("clients").delete().eq("id", client_id).execute()
            return True
        except Exception as e:
            self._log_err("DELETE", "clients", e)
            return False

    # ==================== PRODUCT LINES ====================

    def get_product_lines(self) -> List[Dict]:
        if not self.enabled:
            return []
        try:
            result = (
                self.client.table("product_lines").select("*").order("name").execute()
            )
            return result.data or []
        except Exception as e:
            self._log_err("SELECT", "product_lines", e)
            return []

    def get_product_line(self, product_line_id: int) -> Optional[Dict]:
        if not self.enabled:
            return None
        try:
            result = (
                self.client.table("product_lines")
                .select("*")
                .eq("id", product_line_id)
                .execute()
            )
            return result.data[0] if result.data else None
        except Exception as e:
            self._log_err("SELECT", "product_lines", e)
            return None

    def create_product_line(self, data: Dict) -> Dict:
        if not self.enabled:
            return data
        try:
            result = self.client.table("product_lines").insert(data).execute()
            return result.data[0] if result.data else data
        except Exception as e:
            self._log_err("INSERT", "product_lines", e)
            raise

    def update_product_line(self, product_line_id: int, updates: Dict) -> Optional[Dict]:
        if not self.enabled:
            return None
        try:
            result = (
                self.client.table("product_lines")
                .update(updates)
                .eq("id", product_line_id)
                .execute()
            )
            return result.data[0] if result.data else None
        except Exception as e:
            self._log_err("UPDATE", "product_lines", e)
            return None

    def delete_product_line(self, product_line_id: int) -> bool:
        if not self.enabled:
            return False
        try:
            self.client.table("product_lines").delete().eq("id", product_line_id).execute()
            return True
        except Exception as e:
            self._log_err("DELETE", "product_lines", e)
            return False

    # ==================== CLIENT + PRODUCT LINE TEMPLATES ====================

    def get_client_product_templates(self) -> List[Dict]:
        if not self.enabled:
            return []
        try:
            result = (
                self.client.table("client_product_templates").select("*").execute()
            )
            return result.data or []
        except Exception as e:
            self._log_err("SELECT", "client_product_templates", e)
            return []

    def get_client_product_template(
        self, client_id: int, product_line_id: int
    ) -> Optional[Dict]:
        if not self.enabled:
            return None
        try:
            result = (
                self.client.table("client_product_templates")
                .select("*")
                .eq("client_id", client_id)
                .eq("product_line_id", product_line_id)
                .execute()
            )
            return result.data[0] if result.data else None
        except Exception as e:
            self._log_err("SELECT", "client_product_templates", e)
            return None

    def upsert_client_product_template(self, data: Dict) -> Dict:
        if not self.enabled:
            return data
        try:
            result = (
                self.client.table("client_product_templates")
                .upsert(data, on_conflict="client_id,product_line_id")
                .execute()
            )
            return result.data[0] if result.data else data
        except Exception as e:
            self._log_err("UPSERT", "client_product_templates", e)
            raise

    # ==================== PERSONNEL MATRIX (PTS Wells) ====================

    def _matrix_col_to_api(self, row: Dict) -> Dict:
        return {
            "id": row["id"],
            "key": row.get("col_key") or row["id"],
            "label": row.get("label", ""),
            "type": row.get("col_type") or "text",
            "filterable": bool(row.get("filterable", True)),
            "required": bool(row.get("is_required", False)),
            "index": row.get("sort_index") or 0,
        }

    def _matrix_row_to_api(self, row: Dict) -> Dict:
        cells = row.get("cells") or {}
        if isinstance(cells, str):
            try:
                cells = json.loads(cells)
            except Exception:
                cells = {}
        return {"id": row["id"], "cells": cells}

    def _matrix_sheet_to_api(self, sheet: Dict, columns: List[Dict], rows: List[Dict]) -> Dict:
        return {
            "id": sheet["id"],
            "name": sheet.get("name", ""),
            "title": sheet.get("title", ""),
            "columns": [self._matrix_col_to_api(c) for c in columns],
            "rows": [self._matrix_row_to_api(r) for r in rows],
        }

    def _fetch_matrix_rows(self, sheet_id: str) -> List[Dict]:
        page_size = 250
        offset = 0
        all_rows: List[Dict] = []
        while True:
            start = offset
            end = offset + page_size - 1

            def _build(start=start, end=end, sid=sheet_id):
                return (
                    self.client.table("matrix_rows")
                    .select("*")
                    .eq("sheet_id", sid)
                    .order("sort_order")
                    .range(start, end)
                )

            result = self._execute_with_retry(_build, f"matrix_rows:{sheet_id}:{start}")
            batch = result.data or []
            all_rows.extend(batch)
            if len(batch) < page_size:
                break
            offset += page_size
        return all_rows

    def get_matrix_workbook(self) -> Dict:
        if not self.enabled:
            return {"version": 1, "updated_at": datetime.utcnow().isoformat() + "Z", "sheets": []}
        try:
            sheets_r = self._execute_with_retry(
                lambda: self.client.table("matrix_sheets").select("*").order("sort_order"),
                "matrix_sheets",
            )
            sheets = sheets_r.data or []
            cols_by_sheet: Dict[str, List[Dict]] = {}
            cols_r = self._execute_with_retry(
                lambda: self.client.table("matrix_columns").select("*"),
                "matrix_columns:all",
            )
            for col in cols_r.data or []:
                cols_by_sheet.setdefault(col["sheet_id"], []).append(col)
            for sid in cols_by_sheet:
                cols_by_sheet[sid].sort(key=lambda x: x.get("sort_index", 0))

            out_sheets = []
            for s in sheets:
                sid = s["id"]
                cols = cols_by_sheet.get(sid, [])
                rows = self._fetch_matrix_rows(sid)
                out_sheets.append(self._matrix_sheet_to_api(s, cols, rows))
            updated = max(
                (s.get("updated_at") for s in sheets if s.get("updated_at")),
                default=datetime.utcnow().isoformat() + "Z",
            )
            return {"version": 1, "updated_at": str(updated), "sheets": out_sheets}
        except Exception as e:
            self._log_err("SELECT", "matrix_workbook", e)
            raise

    def get_matrix_sheet(self, sheet_id: str) -> Dict:
        wb = self.get_matrix_workbook()
        for s in wb.get("sheets", []):
            if s.get("id") == sheet_id:
                return s
        raise KeyError(f"Sheet not found: {sheet_id}")

    def seed_matrix_workbook(self, workbook: Dict) -> None:
        """Replace all matrix data from imported workbook (Excel / JSON)."""
        if not self.enabled:
            raise RuntimeError("Supabase not enabled")
        try:
            for i, sheet in enumerate(workbook.get("sheets", [])):
                sid = sheet["id"]
                self.client.table("matrix_sheets").upsert(
                    {
                        "id": sid,
                        "name": sheet.get("name", sid),
                        "title": sheet.get("title", ""),
                        "sort_order": i,
                        "updated_at": datetime.utcnow().isoformat(),
                    }
                ).execute()
                self.client.table("matrix_columns").delete().eq("sheet_id", sid).execute()
                self.client.table("matrix_rows").delete().eq("sheet_id", sid).execute()
                col_rows = []
                for col in sheet.get("columns", []):
                    col_rows.append(
                        {
                            "sheet_id": sid,
                            "id": col["id"],
                            "col_key": col.get("key", col["id"]),
                            "label": col.get("label", ""),
                            "col_type": col.get("type", "text"),
                            "filterable": bool(col.get("filterable", True)),
                            "is_required": bool(col.get("required", False)),
                            "sort_index": col.get("index", 0),
                        }
                    )
                if col_rows:
                    self.client.table("matrix_columns").insert(col_rows).execute()
                row_rows = []
                for j, row in enumerate(sheet.get("rows", [])):
                    row_rows.append(
                        {
                            "id": row["id"],
                            "sheet_id": sid,
                            "cells": row.get("cells") or {},
                            "sort_order": j,
                            "updated_at": datetime.utcnow().isoformat(),
                        }
                    )
                if row_rows:
                    self.client.table("matrix_rows").insert(row_rows).execute()
            self._log_op("SEED", "matrix_workbook", success=True)
        except Exception as e:
            self._log_err("SEED", "matrix_workbook", e)
            raise

    def add_matrix_row(self, sheet_id: str, cells: Optional[Dict[str, str]] = None) -> Dict:
        if not self.enabled:
            raise RuntimeError("Supabase not enabled")
        sheet = self.get_matrix_sheet(sheet_id)
        row_cells = {}
        for col in sheet.get("columns", []):
            cid = col["id"]
            row_cells[cid] = (cells or {}).get(cid, "")
        row_id = f"row_{uuid.uuid4().hex[:12]}"
        payload = {
            "id": row_id,
            "sheet_id": sheet_id,
            "cells": row_cells,
            "sort_order": len(sheet.get("rows", [])),
        }
        result = self.client.table("matrix_rows").insert(payload).execute()
        self.client.table("matrix_sheets").update(
            {"updated_at": datetime.utcnow().isoformat()}
        ).eq("id", sheet_id).execute()
        return self._matrix_row_to_api(result.data[0] if result.data else payload)

    def update_matrix_row(self, sheet_id: str, row_id: str, cells: Dict[str, str]) -> Dict:
        if not self.enabled:
            raise RuntimeError("Supabase not enabled")
        result = (
            self.client.table("matrix_rows")
            .select("*")
            .eq("id", row_id)
            .eq("sheet_id", sheet_id)
            .execute()
        )
        if not result.data:
            raise KeyError(f"Row not found: {row_id}")
        current = self._matrix_row_to_api(result.data[0])
        merged = {**current["cells"], **cells}
        upd = (
            self.client.table("matrix_rows")
            .update({"cells": merged, "updated_at": datetime.utcnow().isoformat()})
            .eq("id", row_id)
            .execute()
        )
        self.client.table("matrix_sheets").update(
            {"updated_at": datetime.utcnow().isoformat()}
        ).eq("id", sheet_id).execute()
        return self._matrix_row_to_api(upd.data[0] if upd.data else {"id": row_id, "cells": merged})

    def delete_matrix_row(self, sheet_id: str, row_id: str) -> bool:
        if not self.enabled:
            raise RuntimeError("Supabase not enabled")
        self.client.table("matrix_rows").delete().eq("id", row_id).eq("sheet_id", sheet_id).execute()
        self.client.table("matrix_sheets").update(
            {"updated_at": datetime.utcnow().isoformat()}
        ).eq("id", sheet_id).execute()
        return True

    def _is_expiry_date_column(self, label: str) -> bool:
        return bool(
            re.search(
                r"expir|expired|end date|berakhir|kadaluarsa",
                (label or "").replace("*", ""),
                re.I,
            )
        )

    def _list_matrix_columns_db(self, sheet_id: str) -> List[Dict]:
        result = (
            self.client.table("matrix_columns")
            .select("*")
            .eq("sheet_id", sheet_id)
            .execute()
        )
        rows = result.data or []
        rows.sort(key=lambda x: x.get("sort_index", 0))
        return rows

    def ensure_expiry_doc_columns_workbook(self) -> Dict:
        """Create missing Doc:* columns (background job / explicit client call)."""
        if not self.enabled:
            return {"created": 0, "skipped": True}
        created = 0
        sheets_r = self.client.table("matrix_sheets").select("id").execute()
        for s in sheets_r.data or []:
            sid = s["id"]
            columns = self._list_matrix_columns_db(sid)
            col_ids = {c.get("id") for c in columns if c.get("id")}
            norm_labels = {self._normalize_col_label(c.get("label", "")) for c in columns}
            for col in columns:
                label = col.get("label") or ""
                if not self._is_expiry_date_column(label):
                    continue
                doc_id = f"{col['id']}_doc"
                doc_label = f"Doc: {label.replace('*', '').strip()}"
                if doc_id in col_ids or self._normalize_col_label(doc_label) in norm_labels:
                    continue
                try:
                    self.add_matrix_column(
                        sheet_id,
                        doc_label,
                        "file",
                        False,
                        col_id=doc_id,
                        col_key=f"doc_{col.get('col_key') or col['id']}",
                        init_row_cells=False,
                    )
                    created += 1
                    col_ids.add(doc_id)
                    norm_labels.add(self._normalize_col_label(doc_label))
                except Exception as e:
                    self._log_err("ENSURE_DOC_COL", f"{sid}:{doc_id}", e)
        return {"created": created}

    def _normalize_col_label(self, label: str) -> str:
        return (label or "").replace("*", "").strip().lower()

    def _find_matrix_column_api(self, columns: List[Dict], label: str = None, col_id: str = None) -> Optional[Dict]:
        if col_id:
            for c in columns:
                if c.get("id") == col_id:
                    return c
        if label:
            target = self._normalize_col_label(label)
            for c in columns:
                if self._normalize_col_label(c.get("label", "")) == target:
                    return c
        return None

    def _next_matrix_col_id(self, existing_ids: set, preferred_id: Optional[str] = None) -> str:
        if preferred_id and preferred_id not in existing_ids:
            return preferred_id
        max_n = 0
        for cid in existing_ids:
            m = re.match(r"^col_(\d+)$", cid or "")
            if m:
                max_n = max(max_n, int(m.group(1)))
        for n in range(max_n + 1, max_n + 500):
            candidate = f"col_{n}"
            if candidate not in existing_ids:
                return candidate
        return f"col_{uuid.uuid4().hex[:8]}"

    def _is_duplicate_key_error(self, exc: Exception) -> bool:
        err = str(exc)
        if "23505" in err or "duplicate key" in err.lower():
            return True
        try:
            from postgrest.exceptions import APIError

            if isinstance(exc, APIError):
                detail = exc.args[0] if exc.args else {}
                if isinstance(detail, dict) and detail.get("code") == "23505":
                    return True
        except ImportError:
            pass
        return False

    def _get_matrix_column_db(
        self, sheet_id: str, col_id: Optional[str] = None, label: Optional[str] = None
    ) -> Optional[Dict]:
        """Read column from DB (avoids stale in-memory workbook during ensure-* flows)."""
        if not self.enabled:
            return None
        try:
            if col_id:
                result = (
                    self.client.table("matrix_columns")
                    .select("*")
                    .eq("sheet_id", sheet_id)
                    .eq("id", col_id)
                    .limit(1)
                    .execute()
                )
                if result.data:
                    return result.data[0]
            if label:
                target = self._normalize_col_label(label)
                result = (
                    self.client.table("matrix_columns")
                    .select("*")
                    .eq("sheet_id", sheet_id)
                    .execute()
                )
                for row in result.data or []:
                    if self._normalize_col_label(row.get("label")) == target:
                        return row
        except Exception as e:
            self._log_err("SELECT", "matrix_columns", e)
        return None

    def add_matrix_column(
        self,
        sheet_id: str,
        label: str,
        col_type: str = "text",
        filterable: bool = True,
        col_id: Optional[str] = None,
        col_key: Optional[str] = None,
        init_row_cells: bool = True,
    ) -> Dict:
        if not self.enabled:
            raise RuntimeError("Supabase not enabled")

        db_existing = self._get_matrix_column_db(sheet_id, col_id=col_id, label=label)
        if db_existing:
            return self._matrix_col_to_api(db_existing)

        columns_db = self._list_matrix_columns_db(sheet_id)
        columns = [self._matrix_col_to_api(c) for c in columns_db]
        existing = self._find_matrix_column_api(columns, label=label, col_id=col_id)
        if existing:
            return existing

        existing_ids = {c.get("id") for c in columns if c.get("id")}
        max_idx = max((c.get("index", 0) for c in columns), default=0)
        new_index = max_idx + 1
        new_id = self._next_matrix_col_id(existing_ids, col_id)
        key_base = (col_key or label).lower().replace("*", "").strip().replace(" ", "_")[:40]
        col_payload = {
            "sheet_id": sheet_id,
            "id": new_id,
            "col_key": col_key or f"{key_base}_{new_index}",
            "label": label,
            "col_type": col_type,
            "filterable": filterable,
            "is_required": "*" in label,
            "sort_index": new_index,
        }

        if self._get_matrix_column_db(sheet_id, col_id=new_id, label=label):
            return self._matrix_col_to_api(
                self._get_matrix_column_db(sheet_id, col_id=new_id, label=label)
            )

        try:
            result = (
                self.client.table("matrix_columns")
                .upsert(col_payload, on_conflict="sheet_id,id")
                .execute()
            )
        except Exception as e:
            if self._is_duplicate_key_error(e):
                db_col = self._get_matrix_column_db(
                    sheet_id, col_id=col_id or new_id, label=label
                )
                if db_col:
                    return self._matrix_col_to_api(db_col)
            self._log_err("UPSERT", "matrix_columns", e)
            raise
        if init_row_cells:
            rows_r = (
                self.client.table("matrix_rows").select("id,cells").eq("sheet_id", sheet_id).execute()
            )
            for row in rows_r.data or []:
                cells = row.get("cells") or {}
                if isinstance(cells, str):
                    try:
                        cells = json.loads(cells)
                    except Exception:
                        cells = {}
                if new_id not in cells:
                    cells[new_id] = ""
                    self.client.table("matrix_rows").update({"cells": cells}).eq("id", row["id"]).execute()
        self.client.table("matrix_sheets").update(
            {"updated_at": datetime.utcnow().isoformat()}
        ).eq("id", sheet_id).execute()
        row_out = result.data[0] if result.data else col_payload
        return self._matrix_col_to_api(row_out)

    def update_matrix_column(self, sheet_id: str, col_id: str, updates: Dict) -> Dict:
        if not self.enabled:
            raise RuntimeError("Supabase not enabled")
        result = (
            self.client.table("matrix_columns")
            .select("*")
            .eq("sheet_id", sheet_id)
            .eq("id", col_id)
            .execute()
        )
        if not result.data:
            raise KeyError(f"Column not found: {col_id}")
        col = result.data[0]
        patch: Dict = {}
        if updates.get("label"):
            patch["label"] = updates["label"]
            patch["is_required"] = "*" in updates["label"]
        if updates.get("type"):
            patch["col_type"] = updates["type"]
        if "filterable" in updates and updates["filterable"] is not None:
            patch["filterable"] = bool(updates["filterable"])
        if patch:
            upd = (
                self.client.table("matrix_columns")
                .update(patch)
                .eq("sheet_id", sheet_id)
                .eq("id", col_id)
                .execute()
            )
            col = upd.data[0] if upd.data else {**col, **patch}
        self.client.table("matrix_sheets").update(
            {"updated_at": datetime.utcnow().isoformat()}
        ).eq("id", sheet_id).execute()
        return self._matrix_col_to_api(col)

    def delete_matrix_column(self, sheet_id: str, col_id: str) -> bool:
        if not self.enabled:
            raise RuntimeError("Supabase not enabled")
        self.client.table("matrix_columns").delete().eq("sheet_id", sheet_id).eq("id", col_id).execute()
        rows_r = (
            self.client.table("matrix_rows").select("id,cells").eq("sheet_id", sheet_id).execute()
        )
        for row in rows_r.data or []:
            cells = row.get("cells") or {}
            if isinstance(cells, str):
                try:
                    cells = json.loads(cells)
                except Exception:
                    cells = {}
            cells.pop(col_id, None)
            self.client.table("matrix_rows").update({"cells": cells}).eq("id", row["id"]).execute()
        self.client.table("matrix_sheets").update(
            {"updated_at": datetime.utcnow().isoformat()}
        ).eq("id", sheet_id).execute()
        return True

    def filter_unsent_matrix_reminders(self, items: List[Dict]) -> List[Dict]:
        if not self.enabled or not items:
            return items
        try:
            result = self.client.table("matrix_reminder_log").select(
                "sheet_id,row_id,col_id,expiry_date,reminder_days"
            ).execute()
            sent = {
                (
                    r["sheet_id"],
                    r["row_id"],
                    r["col_id"],
                    str(r["expiry_date"])[:10],
                    r.get("reminder_days", 90),
                )
                for r in (result.data or [])
            }
            out = []
            for item in items:
                key = (
                    item["sheet_id"],
                    item["row_id"],
                    item["col_id"],
                    str(item["expiry_date"])[:10],
                    90,
                )
                if key not in sent:
                    out.append(item)
            return out
        except Exception as e:
            self._log_err("SELECT", "matrix_reminder_log", e)
            return items

    def log_matrix_reminders_sent(self, items: List[Dict]) -> None:
        if not self.enabled or not items:
            return
        try:
            rows = [
                {
                    "sheet_id": it["sheet_id"],
                    "row_id": it["row_id"],
                    "col_id": it["col_id"],
                    "expiry_date": str(it["expiry_date"])[:10],
                    "reminder_days": 90,
                }
                for it in items
            ]
            self.client.table("matrix_reminder_log").upsert(
                rows, on_conflict="sheet_id,row_id,col_id,expiry_date,reminder_days"
            ).execute()
        except Exception as e:
            self._log_err("UPSERT", "matrix_reminder_log", e)


# Global instance
supabase_service = SupabaseService()
