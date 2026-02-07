"""
CSMS Activity Logger Service
============================
Centralized logging for the CSMS application.
Provides structured logging to console (always) and file (when writable).
"""
import logging
import os
from datetime import datetime
from pathlib import Path
from collections import defaultdict
import time

# Check if we're in a serverless environment (Vercel)
IS_SERVERLESS = os.getenv('VERCEL', '') == '1' or os.getenv('AWS_LAMBDA_FUNCTION_NAME', '') != ''

# Determine log directory (relative to project root)
PROJECT_ROOT = Path(__file__).parent.parent
LOG_DIR = PROJECT_ROOT / "logs"
LOG_FILE = LOG_DIR / "csms_activity.log"

# Only try to create log directory if not serverless
FILE_LOGGING_ENABLED = False
if not IS_SERVERLESS:
    try:
        LOG_DIR.mkdir(exist_ok=True)
        # Test if writable
        test_file = LOG_DIR / ".write_test"
        test_file.touch()
        test_file.unlink()
        FILE_LOGGING_ENABLED = True
    except (OSError, PermissionError):
        FILE_LOGGING_ENABLED = False

# Rate limiting for error emails (prevent spam)
_error_email_timestamps = defaultdict(list)  # key: error_location -> list of timestamps
ERROR_EMAIL_RATE_LIMIT = 5  # max emails per error location
ERROR_EMAIL_RATE_WINDOW = 300  # within 5 minutes (300 seconds)

def _check_rate_limit(error_location: str) -> bool:
    """Check if we can send another error email for this location.
    Returns True if within rate limit, False if exceeded."""
    current_time = time.time()
    timestamps = _error_email_timestamps[error_location]
    
    # Remove timestamps older than the rate window
    _error_email_timestamps[error_location] = [
        ts for ts in timestamps if current_time - ts < ERROR_EMAIL_RATE_WINDOW
    ]
    
    # Check if under limit
    if len(_error_email_timestamps[error_location]) >= ERROR_EMAIL_RATE_LIMIT:
        return False
    
    # Add current timestamp
    _error_email_timestamps[error_location].append(current_time)
    return True

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
    
    # Console Handler - INFO and above (always enabled)
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_format = CSMSFormatter(
        fmt="[%(asctime)s] [%(levelname)s] [%(module_name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    console_handler.setFormatter(console_format)
    logger.addHandler(console_handler)
    
    # File Handler - Only if filesystem is writable (not on Vercel)
    if FILE_LOGGING_ENABLED:
        try:
            from logging.handlers import TimedRotatingFileHandler
            file_handler = TimedRotatingFileHandler(
                filename=str(LOG_FILE),
                when="midnight",
                interval=1,
                backupCount=30,
                encoding="utf-8"
            )
            file_handler.setLevel(logging.DEBUG)
            file_format = CSMSFormatter(
                fmt="[%(asctime)s] [%(levelname)s] [%(module_name)s] %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S"
            )
            file_handler.setFormatter(file_format)
            file_handler.suffix = "%Y-%m-%d"
            logger.addHandler(file_handler)
        except Exception as e:
            # Use basic logging if file handler fails
            logger.warning(f"Could not setup file logging: {e}")
    
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
_email_service_loaded = False  # Track if we've tried loading

def _get_email_service():
    """Lazy load email service to avoid circular import"""
    global _email_service, _email_service_loaded
    if not _email_service_loaded:
        _email_service_loaded = True
        try:
            from services.email_service import email_service
            _email_service = email_service
        except ImportError as e:
            app_logger.warning(f"Could not import email_service: {e}", extra={"module_name": "EMAIL"})
            _email_service = None
        except Exception as e:
            app_logger.warning(f"Error loading email_service: {e}", extra={"module_name": "EMAIL"})
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
    
    # Send email notification for errors (with rate limiting)
    if send_email:
        error_location = f"{module.upper()} - {message[:50]}"
        
        # Check rate limit before sending
        if not _check_rate_limit(error_location):
            app_logger.debug(f"Error email rate limit exceeded for: {error_location}", extra={"module_name": "EMAIL"})
            return
        
        try:
            email_svc = _get_email_service()
            if email_svc:
                email_svc.send_error_notification(
                    error_message=str(error) if error else message,
                    error_location=error_location,
                    traceback_str=tb_str,
                    request_info=request_info
                )
        except Exception as email_err:
            # Don't fail if email fails, just log it (without sending another email!)
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
app_logger.info(f"Serverless mode: {IS_SERVERLESS}", extra={"module_name": "SYSTEM"})
app_logger.info(f"File logging: {FILE_LOGGING_ENABLED}", extra={"module_name": "SYSTEM"})
app_logger.info("=" * 50, extra={"module_name": "SYSTEM"})

