"""Personnel Google Sign-In and onboarding."""
import urllib.parse

from fastapi import APIRouter, BackgroundTasks, Header, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional

from services.auth_service import (
    GOOGLE_CLIENT_ID,
    build_google_oauth_url,
    complete_onboarding,
    create_oauth_state,
    exchange_oauth_code,
    get_session_from_token,
    list_onboarding_personnel,
    list_onboarding_product_lines,
    login_with_google,
    public_base_url,
    verify_oauth_state,
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
        "google_oauth_redirect": True,
    }


@router.get("/auth/google/start")
def auth_google_start():
    """OAuth redirect flow for Android WebView / mobile (avoids GIS opening external Chrome)."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google login is not configured")
    try:
        state = create_oauth_state()
        url = build_google_oauth_url(state)
        log_info("AUTH", f"OAuth start redirect_uri={url.split('redirect_uri=')[1].split('&')[0] if 'redirect_uri=' in url else 'n/a'}")
        return RedirectResponse(url, status_code=302)
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        log_error("AUTH", f"google oauth start failed: {e}", e)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/auth/google/callback")
def auth_google_callback(
    code: str = "",
    state: str = "",
    error: str = "",
):
    """Google OAuth callback — redirect back to app with JWT in query string."""
    base = public_base_url()
    if error:
        q = urllib.parse.urlencode({"auth_error": error})
        return RedirectResponse(f"{base}/?{q}", status_code=302)
    if not code or not verify_oauth_state(state):
        q = urllib.parse.urlencode({"auth_error": "Sesi login tidak valid. Silakan coba lagi."})
        return RedirectResponse(f"{base}/?{q}", status_code=302)
    try:
        id_token = exchange_oauth_code(code)
        result = login_with_google(id_token)
        log_info("AUTH", f"OAuth callback ok: {result['session'].get('email')}")
        q = urllib.parse.urlencode(
            {
                "csms_token": result["token"],
                "needs_onboarding": "1" if result["needs_onboarding"] else "0",
                "auth_done": "1",
            }
        )
        return RedirectResponse(f"{base}/?{q}", status_code=302)
    except Exception as e:
        log_error("AUTH", f"google oauth callback failed: {e}", e)
        q = urllib.parse.urlencode({"auth_error": str(e)})
        return RedirectResponse(f"{base}/?{q}", status_code=302)


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
def auth_onboard(
    body: OnboardBody,
    background_tasks: BackgroundTasks,
    authorization: Optional[str] = Header(None),
):
    token = _bearer_token(authorization)
    try:
        result = complete_onboarding(token, body.product_line_id, body.employee_id)
        log_info(
            "AUTH",
            f"Onboarded {result['session'].get('email')} as {result['session'].get('personnel_name')}",
        )
        pl_id = body.product_line_id

        def _matrix_sync() -> None:
            try:
                from services.matrix_roster_sync import sync_product_line_roster_to_workbook

                sync_product_line_roster_to_workbook(pl_id)
            except Exception as sync_err:
                log_error("AUTH", f"matrix sync after onboard: {sync_err}", sync_err)

        background_tasks.add_task(_matrix_sync)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        log_error("AUTH", f"onboard failed: {e}", e)
        raise HTTPException(status_code=500, detail=str(e))
