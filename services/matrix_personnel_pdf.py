"""Landscape personnel matrix report PDF (ReportLab)."""
from __future__ import annotations

import io
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from reportlab.graphics.charts.barcharts import VerticalBarChart
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics.shapes import Drawing, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    Image,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

from services.google_drive import drive_service

PAGE_SIZE = landscape(A4)
MARGIN_L = 1.2 * cm
MARGIN_R = 1.2 * cm
MARGIN_T = 1.0 * cm
MARGIN_B = 1.0 * cm

BRAND = colors.HexColor("#C41E3A")
INK = colors.HexColor("#1a1a1a")
MUTED = colors.HexColor("#5c5c5c")
LINE = colors.HexColor("#d8d8d8")
PANEL = colors.HexColor("#f4f5f7")
WHITE = colors.white
OK_C = colors.HexColor("#46D369")
SOON_C = colors.HexColor("#F5A623")
EXP_C = colors.HexColor("#e74c3c")
ND_C = colors.HexColor("#9b59b6")


def _safe_filename(name: str) -> str:
    s = re.sub(r'[\\/:*?"<>|]+', "-", (name or "Personnel").strip()) or "Personnel"
    return re.sub(r"\s+", "_", s)[:80]


def _hex_to_color(hex_str: str, default=INK):
    try:
        h = (hex_str or "").strip()
        if h.startswith("#") and len(h) >= 7:
            return colors.HexColor(h[:7])
    except Exception:
        pass
    return default


def _styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "MxTitle",
            parent=base["Heading1"],
            fontSize=18,
            leading=22,
            textColor=INK,
            spaceAfter=4,
            fontName="Helvetica-Bold",
        ),
        "sub": ParagraphStyle(
            "MxSub",
            parent=base["Normal"],
            fontSize=9,
            leading=12,
            textColor=MUTED,
            spaceAfter=8,
        ),
        "section": ParagraphStyle(
            "MxSection",
            parent=base["Heading2"],
            fontSize=11,
            leading=14,
            textColor=INK,
            spaceBefore=6,
            spaceAfter=6,
            fontName="Helvetica-Bold",
        ),
        "label": ParagraphStyle(
            "MxLabel",
            parent=base["Normal"],
            fontSize=8,
            leading=10,
            textColor=MUTED,
            fontName="Helvetica-Bold",
        ),
        "value": ParagraphStyle(
            "MxValue",
            parent=base["Normal"],
            fontSize=9,
            leading=11,
            textColor=INK,
        ),
        "cell": ParagraphStyle(
            "MxCell",
            parent=base["Normal"],
            fontSize=8,
            leading=10,
            textColor=INK,
        ),
        "cellHead": ParagraphStyle(
            "MxCellHead",
            parent=base["Normal"],
            fontSize=8,
            leading=10,
            textColor=WHITE,
            fontName="Helvetica-Bold",
        ),
    }


def _kpi_table(kpis: List[Dict[str, Any]], styles) -> Table:
    if not kpis:
        return Spacer(1, 4)
    usable = PAGE_SIZE[0] - MARGIN_L - MARGIN_R
    n = len(kpis)
    col_w = usable / max(n, 1)
    row_labels = []
    row_vals = []
    for k in kpis:
        accent_hex = (k.get("color") or "#C41E3A").strip()
        if not accent_hex.startswith("#"):
            accent_hex = "#C41E3A"
        row_labels.append(
            Paragraph(
                f'<font color="{accent_hex}">{k.get("label", "")}</font>',
                styles["label"],
            )
        )
        row_vals.append(Paragraph(f'<b>{k.get("value", "—")}</b>', styles["value"]))
    tbl = Table([row_labels, row_vals], colWidths=[col_w] * n, rowHeights=[14, 22])
    tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), PANEL),
                ("BOX", (0, 0), (-1, -1), 0.5, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, LINE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return tbl


def _profile_block(personnel: Dict[str, Any], styles, photo_bytes: Optional[bytes]) -> List[Any]:
    flow: List[Any] = []
    name = personnel.get("name") or "Personnel"
    pl = personnel.get("product_line") or ""
    pos = personnel.get("position") or ""
    fields = personnel.get("fields") or []

    if photo_bytes:
        try:
            img = Image(io.BytesIO(photo_bytes), width=2.2 * cm, height=2.2 * cm)
            img.hAlign = "CENTER"
            flow.append(img)
            flow.append(Spacer(1, 6))
        except Exception:
            pass

    flow.append(Paragraph(f"<b>{name}</b>", ParagraphStyle(
        "ProfName", parent=styles["value"], fontSize=12, alignment=TA_CENTER, spaceAfter=4,
    )))
    badges = " · ".join(x for x in [pl, pos] if x)
    if badges:
        flow.append(Paragraph(badges, ParagraphStyle(
            "ProfBadges", parent=styles["sub"], alignment=TA_CENTER, fontSize=8,
        )))
    flow.append(Spacer(1, 8))

    if fields:
        rows = [
            [
                Paragraph(str(f.get("label", "")), styles["label"]),
                Paragraph(str(f.get("value", "—")), styles["value"]),
            ]
            for f in fields[:14]
        ]
        ft = Table(rows, colWidths=[3.2 * cm, 4.8 * cm])
        ft.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 2),
        ]))
        flow.append(ft)
    return flow


def _compliance_pie(compliance: Dict[str, int]) -> Drawing:
    d = Drawing(200, 120)
    pie = Pie()
    pie.x = 55
    pie.y = 15
    pie.width = 90
    pie.height = 90
    data = [
        compliance.get("ok", 0),
        compliance.get("soon", 0),
        compliance.get("expired", 0),
        compliance.get("noData", 0),
    ]
    pie.data = data
    pie.labels = ["OK", "Soon", "Exp", "N/A"]
    pie.slices.strokeWidth = 0.5
    pie.slices[0].fillColor = OK_C
    pie.slices[1].fillColor = SOON_C
    pie.slices[2].fillColor = EXP_C
    pie.slices[3].fillColor = ND_C
    d.add(pie)
    d.add(String(10, 100, "Status Compliance", fontSize=9, fillColor=INK))
    return d


def _expiry_bar_chart(items: List[Dict[str, Any]]) -> Drawing:
    d = Drawing(280, 130)
    if not items:
        d.add(String(10, 60, "Tidak ada kolom expiry terisi", fontSize=8, fillColor=MUTED))
        return d
    top = items[:8]
    bc = VerticalBarChart()
    bc.x = 40
    bc.y = 20
    bc.height = 85
    bc.width = 220
    bc.data = [[max(i.get("days_until") or 0, 0) for i in top]]
    bc.categoryAxis.categoryNames = [
        (i.get("label") or "")[:12] for i in top
    ]
    bc.valueAxis.valueMin = 0
    bc.bars[0].fillColor = BRAND
    bc.barLabelFormat = "%d"
    d.add(bc)
    d.add(String(10, 115, "Hari hingga expiry (kolom terisi)", fontSize=9, fillColor=INK))
    return d


def _data_table(table: Dict[str, Any], styles) -> Table:
    columns = table.get("columns") or []
    values = table.get("values") or []
    if not columns:
        return Paragraph("<i>Tidak ada kolom terisi untuk ditampilkan.</i>", styles["sub"])

    headers = [Paragraph(c.get("label", ""), styles["cellHead"]) for c in columns]
    row = [Paragraph(str(v or "—"), styles["cell"]) for v in values]
    col_count = len(columns)
    usable = PAGE_SIZE[0] - MARGIN_L - MARGIN_R
    col_w = usable / col_count
    widths = [col_w] * col_count
    tbl = Table([headers, row], colWidths=widths, repeatRows=1)
    tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), INK),
                ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
                ("BACKGROUND", (0, 1), (-1, 1), WHITE),
                ("BOX", (0, 0), (-1, -1), 0.5, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, LINE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return tbl


def build_matrix_personnel_pdf(payload: Dict[str, Any]) -> bytes:
    """Build landscape PDF from client-assembled report payload."""
    styles = _styles()
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=PAGE_SIZE,
        leftMargin=MARGIN_L,
        rightMargin=MARGIN_R,
        topMargin=MARGIN_T,
        bottomMargin=MARGIN_B,
        title=payload.get("title") or "Personnel Report",
    )
    story: List[Any] = []

    title = payload.get("title") or "CERTIFICATION AND TRAINING"
    subtitle = payload.get("subtitle") or ""
    filters = payload.get("filters") or {}
    filter_line = " · ".join(
        f"{k}: {v}" for k, v in [
            ("Client", filters.get("client")),
            ("Product Line", filters.get("product_line")),
            ("Project", filters.get("project")),
            ("Sheet", filters.get("sheet")),
        ]
        if v
    )
    story.append(Paragraph(title.upper(), styles["title"]))
    story.append(Paragraph(subtitle, styles["sub"]))
    if filter_line:
        story.append(Paragraph(filter_line, styles["sub"]))
    story.append(Spacer(1, 6))

    kpis = payload.get("kpis") or []
    story.append(_kpi_table(kpis, styles))
    story.append(Spacer(1, 10))

    personnel = payload.get("personnel") or {}
    charts = payload.get("charts") or {}
    table = payload.get("table") or {}

    photo_bytes = None
    photo_id = personnel.get("photo_file_id")
    if photo_id and drive_service.enabled:
        try:
            photo_bytes = drive_service.download_file(photo_id)
        except Exception:
            photo_bytes = None

    profile_flow = _profile_block(personnel, styles, photo_bytes)
    pie = _compliance_pie(charts.get("compliance") or {})
    bar = _expiry_bar_chart(charts.get("expiry_days") or [])

    mid_w = PAGE_SIZE[0] - MARGIN_L - MARGIN_R
    left_w = 8.5 * cm
    right_w = mid_w - left_w - 0.4 * cm
    mid_tbl = Table(
        [[profile_flow, [pie, Spacer(1, 8), bar]]],
        colWidths=[left_w, right_w],
    )
    mid_tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("BACKGROUND", (0, 0), (0, 0), PANEL),
        ("BACKGROUND", (1, 0), (1, 0), WHITE),
        ("BOX", (0, 0), (-1, -1), 0.5, LINE),
        ("LEFTPADDING", (0, 0), (0, 0), 10),
        ("RIGHTPADDING", (0, 0), (0, 0), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    story.append(mid_tbl)
    story.append(Spacer(1, 10))

    table_title = table.get("title") or payload.get("tab_label") or "Data"
    story.append(Paragraph(table_title, styles["section"]))
    story.append(_data_table(table, styles))

    generated = datetime.now().strftime("%d/%m/%Y %H:%M")
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        f'<font size="7" color="#9ca3af">Generated by CSMS · {generated}</font>',
        styles["sub"],
    ))

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()


def suggested_download_name(payload: Dict[str, Any]) -> str:
    name = _safe_filename((payload.get("personnel") or {}).get("name"))
    sheet = _safe_filename(payload.get("tab_label") or "Report")
    date_s = datetime.now().strftime("%Y%m%d")
    return f"CSMS_{name}_{sheet}_{date_s}.pdf"
