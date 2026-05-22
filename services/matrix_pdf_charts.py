"""Server-side chart PNGs for matrix personnel PDF (Pillow)."""
from __future__ import annotations

import io
import re
from typing import Any, Dict, List, Tuple

from PIL import Image, ImageDraw, ImageFont

W, H = 520, 320
BG = (255, 255, 255)
INK = (26, 26, 26)
MUTED = (120, 120, 120)
GRID = (230, 230, 230)

PALETTE = [
    (70, 211, 105),
    (245, 166, 35),
    (231, 76, 60),
    (74, 144, 217),
    (155, 89, 182),
    (196, 30, 58),
    (26, 188, 156),
]


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
    img.save(buf, format="PNG")
    return buf.getvalue()


def _title(draw: ImageDraw.ImageDraw, text: str, y: int = 12) -> None:
    draw.text((16, y), text, fill=INK, font=_font(13, True))


def compliance_chart(data: Dict[str, int]) -> bytes:
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    _title(draw, "Status Compliance")
    vals = [
        ("Compliant", int(data.get("ok") or 0), PALETTE[0]),
        ("Akan Expired", int(data.get("soon") or 0), PALETTE[1]),
        ("Expired", int(data.get("expired") or 0), PALETTE[2]),
        ("Belum Ada Data", int(data.get("noData") or 0), (107, 114, 128)),
    ]
    total = sum(v[1] for v in vals) or 1
    cx, cy, r = 160, H // 2 + 10, 95
    start = -90
    for label, val, color in vals:
        if val <= 0:
            continue
        sweep = 360 * val / total
        draw.pieslice(
            [cx - r, cy - r, cx + r, cy + r],
            start,
            start + sweep,
            fill=color,
            outline=(255, 255, 255),
        )
        start += sweep
    lx = 300
    ly = 70
    for label, val, color in vals:
        draw.rectangle([lx, ly, lx + 14, ly + 14], fill=color)
        draw.text((lx + 20, ly - 1), f"{label}: {val}", fill=INK, font=_font(10))
        ly += 22
    return _png_bytes(img)


def kpi_bar_chart(kpis: List[Dict[str, Any]]) -> bytes:
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    _title(draw, "Indikator KPI")
    items = [
        (
            (k.get("short_label") or k.get("label") or "")[:28],
            _parse_int(k.get("value")),
            _hex_rgb(k.get("color")),
        )
        for k in (kpis or [])[:8]
    ]
    if not items:
        draw.text((16, 80), "Tidak ada KPI", fill=MUTED, font=_font(10))
        return _png_bytes(img)
    max_v = max(v for _, v, _ in items) or 1
    left, top, bar_h = 140, 48, 24
    gap = 8
    usable = W - left - 30
    for i, (label, val, color) in enumerate(items):
        y = top + i * (bar_h + gap)
        bw = int((val / max_v) * usable) if max_v else 0
        draw.text((16, y + 4), label, fill=MUTED, font=_font(8))
        draw.rounded_rectangle([left, y, left + max(bw, 2), y + bar_h], radius=4, fill=color)
        draw.text((left + bw + 6, y + 4), str(val), fill=INK, font=_font(9, True))
    return _png_bytes(img)


def expiry_stack_chart(stack: Dict[str, Any]) -> bytes:
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    _title(draw, "Expiry per Kolom")
    labels = stack.get("labels") or []
    soon = stack.get("soon") or []
    expired = stack.get("expired") or []
    n = min(len(labels), 8) or 0
    if not n:
        draw.text((16, 80), "Tidak ada kolom expiry", fill=MUTED, font=_font(10))
        return _png_bytes(img)
    max_v = max([*(soon[:n]), *(expired[:n])], default=1) or 1
    chart_left, chart_bottom = 50, H - 36
    chart_h = H - 90
    group_w = (W - chart_left - 20) / n
    bar_w = min(group_w * 0.35, 22)
    for i in range(n):
        gx = chart_left + i * group_w + group_w / 2
        s_val = int(soon[i] if i < len(soon) else 0)
        e_val = int(expired[i] if i < len(expired) else 0)
        sh = int((s_val / max_v) * chart_h)
        eh = int((e_val / max_v) * chart_h)
        if sh:
            draw.rectangle(
                [gx - bar_w, chart_bottom - sh, gx, chart_bottom],
                fill=PALETTE[1],
            )
        if eh:
            draw.rectangle(
                [gx, chart_bottom - eh, gx + bar_w, chart_bottom],
                fill=PALETTE[2],
            )
        lbl = str(labels[i])[:10]
        draw.text((max(4, gx - bar_w), chart_bottom + 4), lbl, fill=MUTED, font=_font(8))
    draw.line([chart_left, chart_bottom, W - 16, chart_bottom], fill=GRID, width=1)
    draw.rectangle([W - 120, 18, W - 106, 32], fill=PALETTE[1])
    draw.text((W - 100, 18), "Segera", fill=INK, font=_font(8))
    draw.rectangle([W - 120, 34, W - 106, 48], fill=PALETTE[2])
    draw.text((W - 100, 34), "Expired", fill=INK, font=_font(8))
    return _png_bytes(img)


def coverage_polar_chart(coverage: Dict[str, Any]) -> bytes:
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    _title(draw, "Kelengkapan Data")
    labels = coverage.get("labels") or []
    data = coverage.get("data") or []
    n = min(len(labels), len(data), 6)
    if not n:
        draw.text((16, 80), "Tidak ada data", fill=MUTED, font=_font(10))
        return _png_bytes(img)
    cx, cy, r = W // 2, H // 2 + 12, 100
    for i in range(n):
        pct = max(0, min(100, int(data[i])))
        sweep = 360 * pct / 100 / n
        color = PALETTE[i % len(PALETTE)]
        inner = r * (i + 1) / n
        outer = r * (i + 2) / n
        draw.pieslice(
            [cx - outer, cy - outer, cx + outer, cy + outer],
            -90 + i * (360 / n),
            -90 + (i + 1) * (360 / n),
            fill=(*color, 40) if False else color,
            outline=BG,
        )
    ly = 24
    for i in range(n):
        draw.rectangle([16, ly, 28, ly + 10], fill=PALETTE[i % len(PALETTE)])
        draw.text((34, ly - 1), f"{str(labels[i])[:16]}: {data[i]}%", fill=INK, font=_font(8))
        ly += 16
    return _png_bytes(img)


def person_expiry_chart(person: Dict[str, Any]) -> bytes:
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    name = (person.get("name") or "Personel")[:32]
    _title(draw, f"Hari ke Expiry — {name}")
    labels = person.get("labels") or []
    days = person.get("days") or []
    n = min(len(labels), len(days), 10)
    if not n:
        draw.text((16, 80), "Tidak ada expiry terisi", fill=MUTED, font=_font(10))
        return _png_bytes(img)
    max_d = max(int(days[i]) for i in range(n)) or 1
    left, bottom = 44, H - 40
    chart_w = W - left - 20
    chart_h = H - 100
    points = []
    for i in range(n):
        x = left + int((i / max(n - 1, 1)) * chart_w)
        y = bottom - int((int(days[i]) / max_d) * chart_h)
        points.append((x, y))
        draw.ellipse([x - 4, y - 4, x + 4, y + 4], fill=PALETTE[5])
        if i % 2 == 0:
            draw.text((x - 20, bottom + 4), str(labels[i])[:12], fill=MUTED, font=_font(8))
    if len(points) > 1:
        draw.line(points, fill=PALETTE[5], width=2)
    draw.line([left, bottom, W - 16, bottom], fill=GRID)
    draw.line([left, bottom, left, bottom - chart_h], fill=GRID)
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
        out["coverage"] = coverage_polar_chart(chart_data["coverage"])
    if chart_data.get("person_expiry"):
        out["personExpiry"] = person_expiry_chart(chart_data["person_expiry"])
    return out
