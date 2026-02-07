"""
CSMS Activity Logger Service
============================
Centralized logging for the CSMS application.
Provides structured logging to both console and file with daily rotation.
"""
import logging
import os
from datetime import datetime
from logging.handlers import TimedRotatingFileHandler
from pathlib import Path

# Determine log directory (relative to project root)
PROJECT_ROOT = Path(__file__).parent.parent
LOG_DIR = PROJECT_ROOT / "logs"
LOG_FILE = LOG_DIR / "csms_activity.log"

# Ensure log directory exists
LOG_DIR.mkdir(exist_ok=True)

# Create custom formatter
class CSMSFormatter(logging.Formatter):
    """Custom formatter with module-aware formatting"""
    
    def format(self, record):
        # Add module context if not present
        if not hasattr(record, 'module_name'):
            record.module_name = record.name.upper()
        return super().format(record)

# Create the logger
def create_logger(name: str = "CSMS") -> logging.Logger:
    """
    Create and configure the application logger.
    
    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    
    # Avoid adding handlers multiple times
    if logger.handlers:
        return logger
    
    logger.setLevel(logging.DEBUG)
    
    # Console Handler - INFO and above
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_format = CSMSFormatter(
        fmt="[%(asctime)s] [%(levelname)s] [%(module_name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    console_handler.setFormatter(console_format)
    
    # File Handler - DEBUG and above with daily rotation
    file_handler = TimedRotatingFileHandler(
        filename=str(LOG_FILE),
        when="midnight",
        interval=1,
        backupCount=30,  # Keep 30 days of logs
        encoding="utf-8"
    )
    file_handler.setLevel(logging.DEBUG)
    file_format = CSMSFormatter(
        fmt="[%(asctime)s] [%(levelname)s] [%(module_name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    file_handler.setFormatter(file_format)
    file_handler.suffix = "%Y-%m-%d"
    
    # Add handlers
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)
    
    return logger

# Global logger instance
app_logger = create_logger()

# Helper functions for module-specific logging
def log_request(method: str, path: str, client_ip: str = "unknown"):
    """Log incoming HTTP request"""
    app_logger.info(f"[REQUEST] {method} {path} from {client_ip}", extra={"module_name": "HTTP"})

def log_response(status_code: int, duration_ms: float):
    """Log HTTP response"""
    app_logger.info(f"[RESPONSE] {status_code} ({duration_ms:.2f}ms)", extra={"module_name": "HTTP"})

def log_db_operation(operation: str, entity: str, entity_id: str = None, success: bool = True):
    """Log database operation"""
    status = "OK" if success else "FAIL"
    id_str = f" id={entity_id}" if entity_id else ""
    app_logger.info(f"[{operation}] {entity}{id_str} [{status}]", extra={"module_name": "DB"})

def log_db_error(operation: str, entity: str, error: Exception):
    """Log database error with traceback"""
    app_logger.exception(f"[{operation}] {entity} FAILED: {error}", extra={"module_name": "DB"})

def log_drive_operation(operation: str, details: str = "", success: bool = True):
    """Log Google Drive operation"""
    status = "OK" if success else "FAIL"
    app_logger.info(f"[{operation}] {details} [{status}]", extra={"module_name": "DRIVE"})

def log_drive_error(operation: str, error: Exception):
    """Log Google Drive error"""
    app_logger.exception(f"[{operation}] FAILED: {error}", extra={"module_name": "DRIVE"})

def log_supabase_operation(operation: str, table: str, record_id: str = None, success: bool = True):
    """Log Supabase operation"""
    status = "OK" if success else "FAIL"
    id_str = f" id={record_id}" if record_id else ""
    app_logger.info(f"[{operation}] {table}{id_str} [{status}]", extra={"module_name": "SUPABASE"})

def log_supabase_error(operation: str, table: str, error: Exception):
    """Log Supabase error"""
    app_logger.exception(f"[{operation}] {table} FAILED: {error}", extra={"module_name": "SUPABASE"})

def log_report(operation: str, details: str = "", success: bool = True):
    """Log report generation operation"""
    status = "OK" if success else "FAIL"
    app_logger.info(f"[{operation}] {details} [{status}]", extra={"module_name": "REPORT"})

def log_email(operation: str, recipient: str = "", success: bool = True):
    """Log email operation"""
    status = "OK" if success else "FAIL"
    app_logger.info(f"[{operation}] to={recipient} [{status}]", extra={"module_name": "EMAIL"})

# Email notification for errors (lazy import to avoid circular dependency)
_email_service = None

def _get_email_service():
    """Lazy load email service to avoid circular import"""
    global _email_service
    if _email_service is None:
        try:
            from services.email_service import email_service
            _email_service = email_service
        except ImportError:
            _email_service = None
    return _email_service

def log_error(module: str, message: str, error: Exception = None, send_email: bool = True, request_info: str = ""):
    """
    Generic error logging with optional email notification.
    
    Args:
        module: Module name where error occurred
        message: Error message
        error: Optional exception object
        send_email: If True, sends error notification email (default: True)
        request_info: Optional request context for email
    """
    import traceback
    
    if error:
        app_logger.exception(f"{message}: {error}", extra={"module_name": module.upper()})
        tb_str = traceback.format_exc()
    else:
        app_logger.error(message, extra={"module_name": module.upper()})
        tb_str = ""
    
    # Send email notification for errors
    if send_email:
        try:
            email_svc = _get_email_service()
            if email_svc:
                email_svc.send_error_notification(
                    error_message=str(error) if error else message,
                    error_location=f"{module.upper()} - {message[:50]}",
                    traceback_str=tb_str,
                    request_info=request_info
                )
        except Exception as email_err:
            # Don't fail if email fails, just log it
            app_logger.warning(f"Failed to send error email: {email_err}", extra={"module_name": "EMAIL"})

def log_critical_error(module: str, message: str, error: Exception, request_info: str = ""):
    """
    Log critical error and ALWAYS send email notification.
    Use this for errors that require immediate attention.
    """
    log_error(module, message, error, send_email=True, request_info=request_info)

def log_info(module: str, message: str):
    """Generic info logging"""
    app_logger.info(message, extra={"module_name": module.upper()})

def log_debug(module: str, message: str):
    """Generic debug logging"""
    app_logger.debug(message, extra={"module_name": module.upper()})

def log_warning(module: str, message: str):
    """Generic warning logging"""
    app_logger.warning(message, extra={"module_name": module.upper()})

# Log startup
app_logger.info("=" * 50, extra={"module_name": "SYSTEM"})
app_logger.info("CSMS Logger Service Initialized", extra={"module_name": "SYSTEM"})
app_logger.info(f"Log file: {LOG_FILE}", extra={"module_name": "SYSTEM"})
app_logger.info("=" * 50, extra={"module_name": "SYSTEM"})

