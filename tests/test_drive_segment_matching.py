"""Unit tests for universal Drive folder segment matching (all task codes)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services.google_drive import GoogleDriveService as G


def m(folder_name: str, segment_code: str) -> bool:
    return G._folder_matches_segment(folder_name, segment_code)


def test_normalize_task_code():
    assert G._normalize_task_code(" 4.3.2.2.5 ") == "4.3.2.2.5"
    assert G._normalize_task_code("1..2.3") == "1.2.3"


def test_segment_43_branch_siblings():
    assert m("4.3.2 PROGRAM KESELAMATAN", "4.3.2")
    assert m("4.3.2.2 SITE", "4.3.2.2")
    assert m("4.3.2.2.5 FOTO PTW", "4.3.2.2.5")
    assert not m("4.3.2.1 OFFICE", "4.3.2")
    assert not m("4.3.2.1 OFFICE", "4.3.2.2")
    assert not m("4.3.2.2.5 FOTO", "4.3.2.2")


def test_segment_11_vs_110():
    assert m("1.1 HSE Committee", "1.1")
    assert not m("1.10 Security", "1.1")
    assert not m("1.1.1 MWT REPORT", "1.1")
    assert m("1.1.1 MWT REPORT", "1.1.1")


def test_other_elements_and_depths():
    assert m("2.1 FACILITY", "2.1")
    assert not m("2.1.1 DETAIL", "2.1")
    assert m("6.4.1 PATROL", "6.4.1")
    assert m("0.1 BRIDGING DOC", "0.1")
    assert not m("0.10 OTHER", "0.1")


def test_exact_code_without_title():
    assert m("3.2", "3.2")
    assert not m("3.2.1", "3.2")
