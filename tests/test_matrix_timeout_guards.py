"""Guards against matrix timeout email floods and unnecessary workbook loads."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.logger_service import _is_db_timeout_noise
from services.matrix_rbac import row_edit_needs_workbook


def test_detects_postgres_statement_timeout():
    assert _is_db_timeout_noise("{'message': 'canceling statement due to statement timeout'}")
    assert _is_db_timeout_noise("statement timeout")
    err = Exception("{'message': 'canceling statement due to conflict with recovery'}")
    assert _is_db_timeout_noise("Exception in /matrix/document/upload", err)
    assert not _is_db_timeout_noise("Drive folder not found")


def test_admin_and_pl_skip_full_workbook():
    assert row_edit_needs_workbook(None) is False
    assert row_edit_needs_workbook({"is_admin": True}) is False
    assert row_edit_needs_workbook({"access_to_pl": "Yes", "is_admin": False}) is False
    assert row_edit_needs_workbook({"access_personnel_only": "Yes", "is_admin": False}) is True
