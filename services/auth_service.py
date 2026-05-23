"""Google Sign-In verification and personnel session tokens."""
from __future__ import annotations

import os
import re
import time
from typing import Any, Dict, List, Optional, Tuple

from database import (
    get_product_line,
    get_product_line_employee,
    get_product_line_employees,
    get_product_lines,
    update_product_line_employee,
)
from services.personnel_profile_photo import get_profile_photo_file_id
from services.product_line_employee_utils import normalize_yes_no, sanitize_employee_payload

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "").strip()
AUTH_SECRET = os.getenv("CSMS_AUTH_SECRET", os.getenv("SUPABASE_KEY", "csms-dev-secret-change-me"))
TOKEN_TTL_SECONDS = int(os.getenv("CSMS_AUTH_TOKEN_TTL_DAYS", "365")) * 86400


def _admin_emails() -> set:
    raw = os.getenv("CSMS_ADMIN_EMAILS", "")
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


def is_admin_email(email: str) -> bool:
    return (email or "").strip().lower() in _admin_emails()


def verify_google_id_token(id_token: str) -> Dict[str, Any]:
    if not GOOGLE_CLIENT_ID:
        raise ValueError("GOOGLE_CLIENT_ID is not configured on the server")
    try:
        from google.auth.transport import requests as google_requests
        from google.oauth2 import id_token as google_id_token
    except ImportError as e:
        raise ValueError("google-auth package is required") from e

    idinfo = google_id_token.verify_oauth2_token(
        id_token, google_requests.Request(), GOOGLE_CLIENT_ID
    )
    if idinfo.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise ValueError("Invalid token issuer")
    email = (idinfo.get("email") or "").strip().lower()
    if not email:
        raise ValueError("Google account has no email")
    if not idinfo.get("email_verified"):
        raise ValueError("Google email is not verified")
    return {
        "email": email,
        "name": (idinfo.get("name") or "").strip(),
        "picture": idinfo.get("picture") or "",
        "sub": idinfo.get("sub") or "",
    }


def _sign_payload(payload: Dict[str, Any]) -> str:
    import jwt

    payload = {**payload, "exp": int(time.time()) + TOKEN_TTL_SECONDS}
    return jwt.encode(payload, AUTH_SECRET, algorithm="HS256")


def _decode_token(token: str) -> Dict[str, Any]:
    import jwt

    return jwt.decode(token, AUTH_SECRET, algorithms=["HS256"])


def find_employee_by_email(email: str) -> Optional[Dict[str, Any]]:
    key = (email or "").strip().lower()
    if not key:
        return None
    for emp in get_product_line_employees():
        if (emp.get("email") or "").strip().lower() == key:
            return emp
    return None


def employee_still_valid(employee_id: int, email: str) -> bool:
    emp = get_product_line_employee(employee_id)
    if not emp:
        return False
    stored = (emp.get("email") or "").strip().lower()
    return stored == (email or "").strip().lower()


def is_operations_management(job_family: str) -> bool:
    jf = (job_family or "").upper().replace("  ", " ")
    return "OPERATION" in jf and "MANAGEMENT" in jf


def default_access_for_employee(emp: Dict[str, Any]) -> Dict[str, str]:
    if is_operations_management(emp.get("job_family_description") or ""):
        return {"access_to_pl": "Yes", "access_personnel_only": "No"}
    return {"access_to_pl": "No", "access_personnel_only": "Yes"}


def build_session_from_employee(
    emp: Dict[str, Any], google_profile: Dict[str, Any]
) -> Dict[str, Any]:
    pl = get_product_line(emp.get("product_line_id"))
    personnel_name = emp.get("name") or ""
    return {
        "email": google_profile["email"],
        "name": google_profile.get("name") or personnel_name,
        "picture": google_profile.get("picture") or "",
        "profile_photo_file_id": get_profile_photo_file_id(personnel_name),
        "sub": google_profile.get("sub") or "",
        "employee_id": emp.get("id"),
        "product_line_id": emp.get("product_line_id"),
        "product_line_name": (pl or {}).get("name") or "",
        "personnel_name": personnel_name,
        "access_to_pl": normalize_yes_no(emp.get("access_to_pl")),
        "access_personnel_only": normalize_yes_no(emp.get("access_personnel_only")),
        "onboarded": True,
        "is_admin": is_admin_email(google_profile["email"]),
    }


def login_with_google(id_token: str) -> Dict[str, Any]:
    profile = verify_google_id_token(id_token)
    emp = find_employee_by_email(profile["email"])
    if emp:
        session = build_session_from_employee(emp, profile)
        token = _sign_payload(session)
        return {"token": token, "session": session, "needs_onboarding": False}

    session = {
        "email": profile["email"],
        "name": profile.get("name") or "",
        "picture": profile.get("picture") or "",
        "sub": profile.get("sub") or "",
        "employee_id": None,
        "product_line_id": None,
        "product_line_name": "",
        "personnel_name": "",
        "onboarded": False,
        "is_admin": is_admin_email(profile["email"]),
    }
    token = _sign_payload(session)
    return {"token": token, "session": session, "needs_onboarding": True}


def get_session_from_token(token: str) -> Dict[str, Any]:
    payload = _decode_token(token)
    email = (payload.get("email") or "").strip().lower()
    if not email:
        raise ValueError("Invalid session")

    employee_id = payload.get("employee_id")
    if employee_id:
        if not employee_still_valid(int(employee_id), email):
            raise ValueError(
                "Personnel tidak terdaftar lagi. Hubungi admin atau pilih ulang setelah login."
            )
        emp = get_product_line_employee(int(employee_id))
        profile = {
            "email": email,
            "name": payload.get("name") or "",
            "picture": payload.get("picture") or "",
            "sub": payload.get("sub") or "",
        }
        session = build_session_from_employee(emp, profile)
        return session

    if payload.get("onboarded"):
        raise ValueError("Session tidak valid. Silakan login ulang.")

    return {
        "email": email,
        "name": payload.get("name") or "",
        "picture": payload.get("picture") or "",
        "sub": payload.get("sub") or "",
        "employee_id": None,
        "product_line_id": None,
        "onboarded": False,
        "is_admin": is_admin_email(email),
    }


def list_onboarding_product_lines() -> List[Dict[str, Any]]:
    lines = get_product_lines()
    counts: Dict[int, int] = {}
    for emp in get_product_line_employees():
        pl_id = emp.get("product_line_id")
        if pl_id:
            counts[pl_id] = counts.get(pl_id, 0) + 1
    out = []
    for pl in lines:
        pl_id = pl.get("id")
        if counts.get(pl_id, 0) > 0:
            out.append(
                {
                    "id": pl_id,
                    "name": pl.get("name"),
                    "employee_count": counts.get(pl_id, 0),
                }
            )
    return sorted(out, key=lambda x: (x.get("name") or "").lower())


def list_onboarding_personnel(
    product_line_id: int, email: str
) -> List[Dict[str, Any]]:
    email_key = (email or "").strip().lower()
    rows = get_product_line_employees(product_line_id)
    out = []
    for emp in rows:
        stored = (emp.get("email") or "").strip().lower()
        if stored and stored != email_key:
            continue
        out.append(
            {
                "id": emp.get("id"),
                "row_no": emp.get("row_no"),
                "name": emp.get("name"),
                "job_family_description": emp.get("job_family_description"),
                "job_description": emp.get("job_description"),
                "email": emp.get("email") or "",
            }
        )
    return sorted(
        out,
        key=lambda r: (r.get("row_no") is None, r.get("row_no") or 0, r.get("name") or ""),
    )


def complete_onboarding(
    token: str, product_line_id: int, employee_id: int
) -> Dict[str, Any]:
    session = get_session_from_token(token)
    email = session["email"]
    if session.get("employee_id") and session.get("onboarded"):
        emp = get_product_line_employee(int(session["employee_id"]))
        if emp:
            profile = {
                "email": email,
                "name": session.get("name") or "",
                "picture": session.get("picture") or "",
                "sub": session.get("sub") or "",
            }
            full = build_session_from_employee(emp, profile)
            return {"token": _sign_payload(full), "session": full}

    emp = get_product_line_employee(employee_id)
    if not emp or emp.get("product_line_id") != product_line_id:
        raise ValueError("Karyawan tidak ditemukan untuk product line ini")

    stored = (emp.get("email") or "").strip().lower()
    if stored and stored != email:
        raise ValueError("Nama ini sudah terhubung ke email lain")

    access = default_access_for_employee(emp)
    updates = sanitize_employee_payload(
        {
            "email": email,
            **access,
        },
        partial=True,
    )
    updated = update_product_line_employee(employee_id, updates)
    if not updated:
        raise ValueError("Gagal memperbarui data karyawan")

    profile = {
        "email": email,
        "name": session.get("name") or "",
        "picture": session.get("picture") or "",
        "sub": session.get("sub") or "",
    }
    full_session = build_session_from_employee(updated, profile)
    new_token = _sign_payload(full_session)
    return {"token": new_token, "session": full_session}
