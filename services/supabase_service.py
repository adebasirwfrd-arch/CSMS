"""
Supabase Database Service
Provides persistent storage for CSMS application data
"""
import os
from typing import List, Dict, Optional
from datetime import datetime
import json

try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False

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
            self.client = create_client(self.url, self.key)
            self.enabled = True
            self._log_info("SUPABASE", "Client initialized successfully!")
        except Exception as e:
            self._log_error("SUPABASE", f"Initialization failed: {e}", e)
            self.enabled = False
    
    # ==================== PROJECTS ====================
    
    def get_projects(self) -> List[Dict]:
        if not self.enabled:
            return []
        try:
            result = self.client.table('projects').select("*").execute()
            self._log_op("SELECT", "projects", success=True)
            return result.data or []
        except Exception as e:
            self._log_err("SELECT", "projects", e)
            return []
    
    def get_project(self, project_id: str) -> Optional[Dict]:
        if not self.enabled:
            return None
        try:
            result = self.client.table('projects').select("*").eq('id', project_id).execute()
            self._log_op("SELECT", "projects", project_id, success=True)
            return result.data[0] if result.data else None
        except Exception as e:
            self._log_err("SELECT", "projects", e)
            return None
    
    def create_project(self, project_data: Dict) -> Dict:
        self._log_info("SUPABASE", f"create_project called, enabled={self.enabled}")
        if not self.enabled:
            self._log_warn("SUPABASE", "Not enabled, returning data as-is")
            return project_data
        try:
            self._log_info("SUPABASE", "Inserting into projects table...")
            result = self.client.table('projects').insert(project_data).execute()
            if result.data:
                self._log_op("INSERT", "projects", result.data[0].get('id'), success=True)
                return result.data[0]
            else:
                self._log_warn("SUPABASE", "No data returned from insert")
                return project_data
        except Exception as e:
            self._log_err("INSERT", "projects", e)
            return project_data
    
    def update_project(self, project_id: str, updates: Dict) -> Optional[Dict]:
        if not self.enabled:
            return None
        try:
            result = self.client.table('projects').update(updates).eq('id', project_id).execute()
            return result.data[0] if result.data else None
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
                # Flat single item update
                if 'id' in data and data['id']:
                    update_data = {k: v for k, v in data.items() if k != 'id' and v is not None}
                    update_data['updated_at'] = datetime.now().isoformat()
                    update_data['project_id'] = project_id
                    self.client.table('ll_indicators').update(update_data).eq('id', data['id']).execute()
                else:
                    # For new single items
                    new_item = {**data, "project_id": project_id, "updated_at": datetime.now().isoformat()}
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

    # ===== OTP PROGRAMS =====
    def get_otp_programs(self, project_id: str, year: int = 2025) -> List[Dict]:
        """Get all OTP programs with their month data for a project/year."""
        if not self.enabled:
            return []
        try:
            # Fetch programs
            result = self.client.table('otp_programs').select("*").eq('project_id', project_id).eq('year', year).order('sort_order', desc=False).execute()
            programs = result.data or []

            # Fetch month data for all programs
            program_ids = [p['id'] for p in programs]
            if program_ids:
                month_result = self.client.table('otp_month_data').select("*").in_('program_id', program_ids).execute()
                month_data = month_result.data or []

                # Group month data by program_id
                month_map = {}
                for md in month_data:
                    pid = md['program_id']
                    if pid not in month_map:
                        month_map[pid] = {}
                    month_map[pid][md['month']] = md

                # Attach month data to programs
                for prog in programs:
                    prog['months'] = month_map.get(prog['id'], {})
                    # Calculate progress
                    total_plan = 0
                    total_actual = 0
                    for m in range(1, 13):
                        md = prog['months'].get(m, prog['months'].get(str(m), {}))
                        total_plan += int(md.get('plan', 0) or 0)
                        total_actual += int(md.get('actual', 0) or 0)
                    prog['progress'] = min(100, round((total_actual / total_plan * 100) if total_plan > 0 else 0))
            
            return programs
        except Exception as e:
            print(f"[ERROR] Error fetching OTP programs: {e}")
            import traceback
            traceback.print_exc()
            return []

    def save_otp_program(self, project_id: str, data: Dict) -> Dict:
        """Create or update an OTP program."""
        if not self.enabled:
            return {}
        try:
            if data.get('id'):
                # Update existing
                update_data = {k: v for k, v in data.items() if k != 'id' and v is not None}
                update_data['updated_at'] = datetime.now().isoformat()
                result = self.client.table('otp_programs').update(update_data).eq('id', data['id']).execute()
                return result.data[0] if result.data else {}
            else:
                # Create new
                new_data = {
                    'project_id': project_id,
                    'name': data.get('name', ''),
                    'guidance': data.get('guidance', ''),
                    'plan_type': data.get('plan_type', 'Annually'),
                    'due_date': data.get('due_date', ''),
                    'sort_order': data.get('sort_order', 0),
                    'year': data.get('year', 2025),
                    'created_at': datetime.now().isoformat(),
                    'updated_at': datetime.now().isoformat()
                }
                result = self.client.table('otp_programs').insert(new_data).execute()
                return result.data[0] if result.data else {}
        except Exception as e:
            print(f"[ERROR] Error saving OTP program: {e}")
            import traceback
            traceback.print_exc()
            return {}

    def save_otp_month_data(self, program_id: str, month: int, data: Dict) -> bool:
        """Upsert monthly data for an OTP program."""
        if not self.enabled:
            return False
        try:
            upsert_data = {
                'program_id': program_id,
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
            self.client.table('otp_month_data').upsert(upsert_data, on_conflict="program_id,month").execute()
            return True
        except Exception as e:
            print(f"[ERROR] Error saving OTP month data: {e}")
            import traceback
            traceback.print_exc()
            return False

    def delete_otp_program(self, program_id: str) -> bool:
        """Delete an OTP program (cascade deletes month data)."""
        if not self.enabled:
            return False
        try:
            self.client.table('otp_programs').delete().eq('id', program_id).execute()
            return True
        except Exception as e:
            print(f"[ERROR] Error deleting OTP program: {e}")
            return False

# Global instance
supabase_service = SupabaseService()
