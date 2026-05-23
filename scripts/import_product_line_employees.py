#!/usr/bin/env python3
"""Sync product lines + employee job data from Excel or seed JSON into DB."""
import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")

from database import (
    create_product_line,
    get_product_lines,
    replace_product_line_employees,
    SUPABASE_ENABLED,
)
from services.product_line_employee_import import (
    load_import_payload,
    sync_product_lines_and_employees,
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--excel",
        action="store_true",
        help="Read Blueprint/Employee_Job_Data_2026.xlsx instead of seed JSON",
    )
    args = parser.parse_args()
    payload = load_import_payload(use_excel=args.excel)
    result = sync_product_lines_and_employees(
        payload,
        create_product_line=create_product_line,
        get_product_lines=get_product_lines,
        replace_employees_for_product_line=replace_product_line_employees,
    )
    print("Supabase:", SUPABASE_ENABLED)
    print("Source:", result.get("source"))
    print("Product lines created:", result.get("product_lines_created"))
    print("Employees by product line:", result.get("employees_by_product_line"))
    if result.get("skipped_product_lines"):
        print("Skipped:", result.get("skipped_product_lines"))
    print("Total employees:", result.get("total_employees"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
