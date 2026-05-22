"""Server-side chart PNGs for matrix personnel PDF (Pillow)."""
from __future__ import annotations

import io
import re
from typing import Any, Dict, List, Tuple

from PIL import Image, ImageDraw, ImageFont

W, H = 460, 260
BG = (255, 255, 255)
INK = (26, 26, 26)
MUTED = (110, 110, 110)
GRID = (220, 224, 230)
BORDER = (200, 204, 212)
ACCENT = (196, 30, 58)
WHITE = (255, 255, 255)

PALETTE = [
    (70, 211, 105),
    (245, 166, 35),
    (231, 76, 60),
    (74, 144, 217),
    (155, 89, 182),
    (196, 30, 58),
    (26, 188, 156),
]

HEADER_H = 34
INNER_TOP = 40
INNER = (14, INNER_TOP, W - 14, H - 12)


def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    size = max(int(size), 8)
    names = (
        ["/System/Library/Fonts/Supplemental/Arial Bold.ttf", "Arial Bold.ttf", "DejaVuSans-Bold.ttf"]
        if bold
        else ["/System/Library/Fonts/Supplemental/Arial.ttf", "Arial.ttf", "DejaVuSans.ttf"]
    )
    for name in names:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _parse_int(val: Any) -> int:
    m = re.search(r"-?\d+", str(val or "0"))
    return int(m.group()) if m else 0


def _hex_rgb(hex_str: str, default=(196, 30, 58)) -> Tuple[int, int, int]:
    h = (hex_str or "").strip()
    if h.startswith("#") and len(h) >= 7:
        try:
            return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16))
        except ValueError:
            pass
    return default


def _png_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def _new_chart(title: str) -> Tuple[Image.Image, ImageDraw.ImageDraw]:
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    draw.rounded_rectangle([1, 1, W - 2, H - 2], radius=10, outline=BORDER, width=2)
    draw.rectangle([INNER[0], 34, INNER[2], HEADER_H + 6], fill=(248, 249, 251))
    draw.line([INNER[0], HEADER_H + 6, INNER[2], HEADER_H + 6], fill=GRID, width=1)
    draw.text((INNER[0] + 8, 10), title, fill=INK, font=_font(12, True))
    return img, draw


def compliance_chart(data: Dict[str, int]) -> bytes:
    img, draw = _new_chart("Status Compliance")
    vals = [
        ("Compliant", int(data.get("ok") or 0), PALETTE[0]),
        ("Akan Expired", int(data.get("soon") or 0), PALETTE[1]),
        ("Expired", int(data.get("expired") or 0), PALETTE[2]),
        ("Belum Ada Data", int(data.get("noData") or 0), (107, 114, 128)),
    ]
    total = sum(v[1] for v in vals) or 1
    cx, cy, r = 130, H // 2 + 18, 72
    start = -90
    for _label, val, color in vals:
        if val <= 0:
            continue
        sweep = max(360 * val / total, 4)
        draw.pieslice([cx - r, cy - r, cx + r, cy + r], start, start + sweep, fill=color, outline=WHITE)
        start += sweep
    lx, ly = 250, 52
    for label, val, color in vals:
        draw.rounded_rectangle([lx, ly, lx + 12, ly + 12], radius=2, fill=color)
        draw.text((lx + 18, ly - 1), f"{label}: {val}", fill=INK, font=_font(9))
        ly += 20
    return _png_bytes(img)


def kpi_bar_chart(kpis: List[Dict[str, Any]]) -> bytes:
    img, draw = _new_chart("Indikator KPI")
    items = [
        (
            (k.get("short_label") or k.get("label") or "")[:24],
            _parse_int(k.get("value")),
            _hex_rgb(k.get("color")),
        )
        for k in (kpis or [])[:7]
    ]
    if not items:
        draw.text((INNER[0], 90), "Tidak ada KPI", fill=MUTED, font=_font(10))
        return _png_bytes(img)
    max_v = max(v for _, v, _ in items) or 1
    left, top, bar_h = INNER[0] + 86, 48, 20
    gap = 6
    usable = INNER[2] - left - 8
    for i, (label, val, color) in enumerate(items):
        y = top + i * (bar_h + gap)
        if y + bar_h > H - 8:
            break
        bw = max(int((val / max_v) * usable), 3) if max_v else 3
        draw.text((INNER[0] + 4, y + 3), label[:14], fill=MUTED, font=_font(8))
        draw.rounded_rectangle([left, y, left + bw, y + bar_h], radius=4, fill=color)
        draw.text((left + bw + 5, y + 3), str(val), fill=INK, font=_font(9, True))
    return _png_bytes(img)


def expiry_stack_chart(stack: Dict[str, Any]) -> bytes:
    img, draw = _new_chart("Expiry per Kolom")
    labels = stack.get("labels") or []
    soon = stack.get("soon") or []
    expired = stack.get("expired") or []
    n = min(len(labels), 6) or 0
    if not n:
        draw.text((INNER[0], 90), "Tidak ada kolom expiry", fill=MUTED, font=_font(10))
        return _png_bytes(img)
    max_v = max([*(soon[:n]), *(expired[:n])], default=1) or 1
    chart_left, chart_bottom = INNER[0] + 8, H - 28
    chart_h = H - 98
    group_w = (INNER[2] - chart_left - 8) / n
    bar_w = min(group_w * 0.32, 18)
    for i in range(n):
        gx = chart_left + i * group_w + group_w / 2
        s_val = int(soon[i] if i < len(soon) else 0)
        e_val = int(expired[i] if i < len(expired) else 0)
        sh = int((s_val / max_v) * chart_h)
        eh = int((e_val / max_v) * chart_h)
        if sh:
            draw.rounded_rectangle(
                [gx - bar_w, chart_bottom - sh, gx - 2, chart_bottom],
                radius=2,
                fill=PALETTE[1],
            )
        if eh:
            draw.rounded_rectangle(
                [gx + 2, chart_bottom - eh, gx + bar_w, chart_bottom],
                radius=2,
                fill=PALETTE[2],
            )
        draw.text((gx - bar_w, chart_bottom + 2), str(labels[i])[:9], fill=MUTED, font=_font(8))
    draw.line([chart_left, chart_bottom, INNER[2] - 4, chart_bottom], fill=GRID, width=1)
    return _png_bytes(img)


def coverage_chart(coverage: Dict[str, Any]) -> bytes:
    img, draw = _new_chart("Kelengkapan Data")
    labels = coverage.get("labels") or []
    data = coverage.get("data") or []
    n = min(len(labels), len(data), 6)
    if not n:
        draw.text((INNER[0], 90), "Tidak ada data", fill=MUTED, font=_font(10))
        return _png_bytes(img)
    left, top, bar_h = INNER[0] + 4, 48, 18
    gap = 5
    for i in range(n):
        y = top + i * (bar_h + gap)
        if y + bar_h > H - 10:
            break
        pct = max(0, min(100, int(data[i])))
        color = PALETTE[i % len(PALETTE)]
        bw = int((INNER[2] - left - 50) * pct / 100)
        draw.text((left, y + 2), str(labels[i])[:14], fill=MUTED, font=_font(8))
        draw.rounded_rectangle([left + 108, y, left + 108 + max(bw, 2), y + bar_h], radius=3, fill=color)
        draw.text((INNER[2] - 38, y + 2), f"{pct}%", fill=INK, font=_font(8, True))
    return _png_bytes(img)


def person_expiry_chart(person: Dict[str, Any]) -> bytes:
    img, draw = _new_chart("Hari ke Expiry")
    labels = person.get("labels") or []
    days = person.get("days") or []
    n = min(len(labels), len(days), 8)
    if not n:
        draw.text((INNER[0], 90), "Tidak ada expiry terisi", fill=MUTED, font=_font(10))
        return _png_bytes(img)
    max_d = max(int(days[i]) for i in range(n)) or 1
    left, bottom = INNER[0] + 12, H - 30
    chart_w = INNER[2] - left - 12
    chart_h = H - 95
    points = []
    for i in range(n):
        x = left + int((i / max(n - 1, 1)) * chart_w)
        y = bottom - int((int(days[i]) / max_d) * chart_h)
        points.append((x, y))
        draw.ellipse([x - 5, y - 5, x + 5, y + 5], fill=ACCENT, outline=WHITE)
    if len(points) > 1:
        draw.line(points, fill=ACCENT, width=2)
    for i in range(n):
        x = left + int((i / max(n - 1, 1)) * chart_w)
        draw.text((x - 24, bottom + 3), str(labels[i])[:11], fill=MUTED, font=_font(8))
    draw.line([left, bottom, INNER[2] - 8, bottom], fill=GRID, width=1)
    draw.line([left, bottom, left, bottom - chart_h], fill=GRID, width=1)
    return _png_bytes(img)


def build_chart_pngs(chart_data: Dict[str, Any]) -> Dict[str, bytes]:
    out: Dict[str, bytes] = {}
    if chart_data.get("compliance"):
        out["compliance"] = compliance_chart(chart_data["compliance"])
    if chart_data.get("kpis"):
        out["kpi"] = kpi_bar_chart(chart_data["kpis"])
    if chart_data.get("expiry_stack"):
        out["expiryStack"] = expiry_stack_chart(chart_data["expiry_stack"])
    if chart_data.get("coverage"):
        out["coverage"] = coverage_chart(chart_data["coverage"])
    if chart_data.get("person_expiry"):
        out["personExpiry"] = person_expiry_chart(chart_data["person_expiry"])
    return out
