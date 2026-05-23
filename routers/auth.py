"""Personnel Google Sign-In and onboarding."""
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from typing import Optional

from services.auth_service import (
    GOOGLE_CLIENT_ID,
    complete_onboarding,
    get_session_from_token,
    list_onboarding_personnel,
    list_onboarding_product_lines,
    login_with_google,
)
from services.logger_service import log_error, log_info

router = APIRouter(tags=["auth"])


class GoogleLoginBody(BaseModel):
    id_token: str


class OnboardBody(BaseModel):
    product_line_id: int
    employee_id: int


def _bearer_token(authorization: Optional[str] = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authorization required")
    return authorization[7:].strip()


@router.get("/auth/config")
def auth_config():
    return {
        "google_client_id": GOOGLE_CLIENT_ID,
        "google_enabled": bool(GOOGLE_CLIENT_ID),
    }


@router.post("/auth/google")
def auth_google_login(body: GoogleLoginBody):
    try:
        result = login_with_google(body.id_token)
        log_info("AUTH", f"Google login: {result['session'].get('email')} onboarded={not result['needs_onboarding']}")
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        log_error("AUTH", f"google login failed: {e}", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/auth/me")
def auth_me(authorization: Optional[str] = Header(None)):
    token = _bearer_token(authorization)
    try:
        session = get_session_from_token(token)
        needs_onboarding = not session.get("employee_id") or not session.get("onboarded")
        return {
            "session": session,
            "needs_onboarding": needs_onboarding,
        }
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/auth/onboarding/product-lines")
def auth_onboarding_product_lines(authorization: Optional[str] = Header(None)):
    _bearer_token(authorization)
    return list_onboarding_product_lines()


@router.get("/auth/onboarding/personnel")
def auth_onboarding_personnel(
    product_line_id: int,
    authorization: Optional[str] = Header(None),
):
    token = _bearer_token(authorization)
    try:
        session = get_session_from_token(token)
        return list_onboarding_personnel(product_line_id, session["email"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/auth/onboard")
def auth_onboard(body: OnboardBody, authorization: Optional[str] = Header(None)):
    token = _bearer_token(authorization)
    try:
        result = complete_onboarding(token, body.product_line_id, body.employee_id)
        log_info(
            "AUTH",
            f"Onboarded {result['session'].get('email')} as {result['session'].get('personnel_name')}",
        )
        from services.matrix_roster_sync import sync_product_line_roster_to_workbook

        try:
            sync_product_line_roster_to_workbook(body.product_line_id)
        except Exception as sync_err:
            log_error("AUTH", f"matrix sync after onboard: {sync_err}", sync_err)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        log_error("AUTH", f"onboard failed: {e}", e)
        raise HTTPException(status_code=500, detail=str(e))
