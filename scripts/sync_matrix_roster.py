#!/usr/bin/env python3
"""Sync all product line employees into Matrix master rows (all sheets)."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from dotenv import load_dotenv

load_dotenv(ROOT / ".env")

from services.matrix_roster_sync import sync_all_product_line_rosters


def main() -> int:
    result = sync_all_product_line_rosters()
    print("Product lines:", result.get("product_lines"))
    print("Total added:", result.get("total_added"))
    print("Total updated:", result.get("total_updated"))
    print("Total removed:", result.get("total_removed"))
    for r in result.get("results") or []:
        if r.get("error"):
            print(f"  ERROR {r.get('product_line_name')}: {r['error']}")
        else:
            print(
                f"  {r.get('product_line_name')}: "
                f"+{r.get('added', 0)} ~{r.get('updated', 0)} -{r.get('removed', 0)} "
                f"({r.get('employees', 0)} employees)"
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
