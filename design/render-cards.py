#!/usr/bin/env python3
"""Render the January hand-out postcards: 4 x 6 in landscape, one PDF per line item.

The plan (docs/school-flyer-outreach.md, decided Oct 27, 2026) is 1,000 cards in five line items,
three fronts, one back system:

    tag        front                                     qty   who gets it
    york-e     E, "York, your syllabus is a to-do list"  200   York
    pomona-e   E, Pomona wording                         200   Pomona
    gatech-e   E, Georgia Tech wording                   200   Georgia Tech
    pile       the sticker pile and "Buried?" only       250   100 York, 75 Pomona, 75 Georgia Tech
    c          a sentence that finishes on the back      150   York

E names the school, so it is printed per school. The pile and C do not, so they are printed once
and the school is known from who hands them out. The fronts came out of the reference research
(the big apps print one line in the product's voice, about the reader, logo small, QR with a verb)
and the one-second flash test; see the card drafts artifact linked from the outreach doc.

E: paper, the wordmark, one EB Garamond line with the accent phrase in italic, as the store
captions do. C: paper, the wordmark, a serif sentence whose last word runs off the right trim,
Oatly's "continued on the other billboard" device; the back answers with "Thursday." Pile: the
previous maximalist front with the survey line and the flip cue removed, so the pile and the
question are the only two things on it. Every back is lavender with the same scan block in the
same place (a verb caption, a plain 38 mm QR panel with its quiet zone, the beta line and the
URL) and its own headline. Geist Bold appears in print art only, like the italic in the store
captions. Sentence case throughout, never caps.

Postcard: landscape 152.4 x 101.6 mm with 3 mm bleed and 5 mm safe. The C front's cut word ends
at the trim on purpose; a 1.5 mm cut either way still reads as cut, which the proof run checks.

Every QR goes to semli.app/beta?r=<tag>, so `select ref, count(*) from waitlist group by ref`
says which front and, for E, which school sent each install.

    python3 design/render-cards.py              # all five line items
    python3 design/render-cards.py pile c       # some of them

Output in design/cards/out: <tag>-postcard.pdf (front, then back, 600 dpi), <tag>-front.png and
<tag>-back.png for shops that want images, and preview.png with every pair at trim. The brand
direction with clouds and the letter-size flyer were dropped Oct 27, 2026 (posters are
club-only on most campuses); they are in the git history. Needs Pillow and the repo's
node_modules (toqr).
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import random
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "design" / "cards" / "out"
WORDMARK = ROOT / "design" / "wordmark.json"
SITE_URL = "https://www.semli.app"  # apps/web/lib/site.ts

# The store art's caption type and colors, so the pieces and the listing match.
_spec = importlib.util.spec_from_file_location("store", ROOT / "design" / "render-screenshots.py")
store = sys.modules["store"] = importlib.util.module_from_spec(_spec)  # its dataclass looks itself up
_spec.loader.exec_module(store)
PAPER, INK, ACCENT = store.PAPER, store.INK, store.ACCENT
ON_DARK = (245, 244, 240)  # the store art's wordmark on a dark ground
ON_ACCENT_SECONDARY = (222, 214, 245)
BUTTER = (255, 226, 122)  # the back's accent on lavender
MUTED = (104, 105, 99)
SS = 2  # drawn at twice the size and scaled down: Pillow does not antialias shapes

SCHOOLS = {"york": "York", "pomona": "Pomona", "gatech": "Georgia Tech"}  # tag stem, name on the card
LINE_ITEMS = ["york-e", "pomona-e", "gatech-e", "pile", "c"]  # docs/school-flyer-outreach.md

# Copy. The ~span~ is the accent phrase, EB Garamond Italic in lavender on paper or butter on lavender.
E_FRONT = "{school}, your syllabus is a ~to-do list~ now."
E_FOOT = "Spring 2027 · handed to you by someone who uses it"
E_BACK = "Every due date out of every syllabus, next to your shifts."
E_BACK_LINE = "Drop in the PDF, screenshot your shifts. Two minutes."
E_CTA = "Scan to set it up"
C_FRONT = "The assignment you're about to miss is on page 4 of a syllabus you haven't opened"
C_CUT = "since September, and it is due on "  # the last line, upright; the accent word runs off the trim
C_CUT_WORD = "Thursday."
C_CUT_SHOW = "Thu"  # what is left of it at the trim line
C_BACK_WORD = "Thursday."
C_BACK = "Semli opened the syllabus for you. Every due date, your shifts, one plan."
C_CTA = "Scan to see yours"
HOOK = "Buried?"
FIX = "Sorted."
PAYOFF = "Turn your syllabus into a plan."
PILE_CTA = "Scan to try Semli"
BETA = "Free iPhone beta"  # "Free on iPhone" after the App Store release

# (title, detail, fill, text): the class palette (packages/tokens) pushed to print saturation,
# text in each color's own ink; the behind-red and ink ones carry paper text.
RED, ON_RED = (196, 78, 38), (250, 249, 246)
STICKERS = [
    ("Bio exam", "Fri · BIOL 110", (143, 224, 184), (31, 90, 64)),
    ("Café shift", "4:00 to 9:00 pm", (255, 182, 138), (122, 62, 26)),
    ("Essay due", "Thu · ENGL 102", (255, 226, 122), (107, 79, 0)),
    ("Stats lecture", "9:00 am", (156, 200, 255), (31, 74, 128)),
    ("Due today", "Discussion post 4", RED, ON_RED),
    ("Study group", "7:00 pm", (195, 175, 248), (61, 43, 120)),
    ("Lab report", "Mon · CHEM 101", (230, 217, 207), (96, 69, 53)),
    ("Group project", "Sun · 11:59 pm", (255, 226, 122), (107, 79, 0)),
    ("Quiz 3", "Wed · PSYC 101", (143, 224, 184), (31, 90, 64)),
    ("Overlap", "Shift and study group", RED, ON_RED),
    ("Office hours", "Tue · 2:00 pm", (156, 200, 255), (31, 74, 128)),
    ("Reading", "Ch. 7 to 9", (230, 217, 207), (96, 69, 53)),
    ("Practice", "6:00 am", (255, 182, 138), (122, 62, 26)),
    ("Due tomorrow", "Problem set 5", RED, ON_RED),
]
# Round ones, one word each, for the gaps.
BADGES = [("Quiz!", (255, 226, 122), (107, 79, 0)), ("Late", RED, ON_RED), ("8 am", (156, 200, 255), (31, 74, 128)),
          ("Exam", (195, 175, 248), (61, 43, 120)), ("11:59", (34, 35, 32), (250, 249, 246)), ("Shift", (255, 182, 138), (122, 62, 26))]
# The four the back lines up: the ones a week actually has.
SORTED = [3, 1, 2, 5]
PILE_SEED = 7  # the pile is random but fixed; change the seed to reshuffle it


@dataclass(frozen=True)
class Format:
    trim_w: float  # mm
    trim_h: float
    dpi: int
    bleed: float = 3
    safe: float = 5

    def px(self, mm: float) -> int:
        return round(mm / 25.4 * self.dpi * SS)

    def edge(self, mm: float) -> int:
        """A distance from the trim line, in canvas pixels."""
        return self.px(self.bleed + mm)

    def canvas(self, color) -> Image.Image:
        return Image.new("RGB", (self.px(self.trim_w + 2 * self.bleed), self.px(self.trim_h + 2 * self.bleed)), color)


POSTCARD = Format(152.4, 101.6, 600)
INSET = 8  # mm from the trim to the wordmark and the headline's left edge
SCAN_CENTER = POSTCARD.trim_w - INSET - 26  # the scan block's center x, every back the same
SCAN_PANEL = 38  # the QR panel: a 29-module code at about 26 mm plus its quiet zone


def flatten(path: str) -> list[list[tuple[float, float]]]:
    """The wordmark's absolute M/L/H/V/Q/Z path as polygons, curves cut into 12 segments."""
    shapes, pts, x, y = [], [], 0.0, 0.0
    for cmd, args in re.findall(r"([MLHVQZ])([^MLHVQZ]*)", path):
        n = [float(v) for v in re.findall(r"-?[\d.]+", args)]
        if cmd == "M":
            if pts:
                shapes.append(pts)
            x, y = n[0], n[1]
            pts = [(x, y)]
        elif cmd == "L":
            x, y = n[0], n[1]
            pts.append((x, y))
        elif cmd == "H":
            x = n[0]
            pts.append((x, y))
        elif cmd == "V":
            y = n[0]
            pts.append((x, y))
        elif cmd == "Q":
            cx, cy, ex, ey = n
            for i in range(1, 13):
                t = i / 12
                pts.append(((1 - t) ** 2 * x + 2 * (1 - t) * t * cx + t * t * ex, (1 - t) ** 2 * y + 2 * (1 - t) * t * cy + t * t * ey))
            x, y = ex, ey
        elif cmd == "Z" and pts:
            shapes.append(pts)
            pts = []
    if pts:
        shapes.append(pts)
    return shapes


def draw_wordmark(img: Image.Image, left: int, top: int, width: int, letters, dots) -> None:
    """The letters and the two dots; counters (the e's eye) cut out even-odd."""
    wm = json.loads(WORDMARK.read_text())
    vx, vy, vw, vh = wm["viewBox"]
    s = width / vw
    size = (width, round(vh * s))
    mask = Image.new("1", size, 0)
    for shape in flatten(wm["letters"]):
        layer = Image.new("1", size, 0)
        ImageDraw.Draw(layer).polygon([((x - vx) * s, (y - vy) * s) for x, y in shape], fill=1)
        mask = Image.frombytes("1", size, bytes(a ^ b for a, b in zip(mask.tobytes(), layer.tobytes())))
    img.paste(letters, (left, top), mask)
    d = ImageDraw.Draw(img)
    for dot in wm["dots"]:
        cx, cy, r = left + (dot["cx"] - vx) * s, top + (dot["cy"] - vy) * s, dot["r"] * s
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=dots)


def wordmark(img: Image.Image, fmt: Format, light: bool) -> None:
    """Top left, 22 mm, inside the inset: ink and accent on paper, paper on lavender."""
    if light:
        draw_wordmark(img, fmt.edge(INSET), fmt.edge(INSET), fmt.px(22), INK, ACCENT)
    else:
        draw_wordmark(img, fmt.edge(INSET), fmt.edge(INSET), fmt.px(22), ON_DARK, ON_DARK)


def qr_modules(text: str) -> tuple[int, list[int]]:
    """Standard error correction M; the entire matrix is visible without a center overlay."""
    js = "const {toQR}=require('toqr');process.stdout.write(JSON.stringify(Array.from(toQR(process.argv[1],0))))"
    m = json.loads(subprocess.check_output(["node", "-e", js, text], cwd=ROOT))
    return round(len(m) ** 0.5), m


def draw_qr(img: Image.Image, left: int, top: int, width: int, text: str) -> None:
    """Square modules and finder patterns on paper, with at least four modules of quiet zone."""
    size, m = qr_modules(text)
    # Whole pixels after the final downsample keep every module the same size.
    u = width // ((size + 8) * SS) * SS
    if u < SS:
        raise ValueError("QR is too small for the output resolution")
    matrix_width = size * u
    ox = left + (width - matrix_width) // (2 * SS) * SS
    oy = top + (width - matrix_width) // (2 * SS) * SS
    d = ImageDraw.Draw(img)
    d.rectangle((left, top, left + width - 1, top + width - 1), fill=PAPER)
    for y in range(size):
        for x in range(size):
            if m[y * size + x]:
                d.rectangle((ox + x * u, oy + y * u, ox + (x + 1) * u - 1,
                             oy + (y + 1) * u - 1), fill=INK)


def serif_block(img: Image.Image, fmt: Format, text: str, left: float, top: float, width: float,
                size: float, color, accent, leading: float = 1.08) -> int:
    """A serif headline in mm: EB Garamond Regular, the ~accent~ in italic. Returns the next top."""
    d = ImageDraw.Draw(img)
    f, af = store.serif(fmt.px(size), 400), store.serif(fmt.px(size), 400, italic=True)
    return store.rich_block(d, text, f, fmt.edge(left), fmt.edge(top), fmt.px(width), round(fmt.px(size) * leading),
                            color, accent, "left", tracking=store.SERIF_TRACKING, accent_font=af)


def sticker(fmt: Format, k: float, title: str, detail: str, fill, text,
            body_width_mm: float | None = None) -> Image.Image:
    """One plan as a die-cut sticker, `k` times the business-card size it was drawn at: a held
    rectangle (not a pill; it does nothing) with a paper border and a soft drop shadow."""
    mm = lambda v: fmt.px(v * k)
    tf, df = store.font(mm(3.05), "Medium"), store.font(mm(2.1), "Regular")
    probe = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    w = round(max(probe.textlength(title, font=tf), probe.textlength(detail, font=df))) + mm(6)
    if body_width_mm is not None:
        w = max(w, fmt.px(body_width_mm))
    h, cut, pad = mm(9.2), mm(0.45), mm(2)
    out = Image.new("RGBA", (w + 2 * (cut + pad), h + 2 * (cut + pad)), (0, 0, 0, 0))
    shadow = Image.new("RGBA", out.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((pad, pad + mm(0.4), pad + w + 2 * cut, pad + h + 2 * cut + mm(0.4)), radius=mm(2.6), fill=(0, 0, 0, 65))
    out.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(mm(0.45))))
    d = ImageDraw.Draw(out)
    d.rounded_rectangle((pad, pad, pad + w + 2 * cut, pad + h + 2 * cut), radius=mm(2.6), fill=PAPER + (255,))
    d.rounded_rectangle((pad + cut, pad + cut, pad + cut + w, pad + cut + h), radius=mm(2), fill=fill + (255,))
    x = pad + cut + mm(3)
    d.text((x, pad + cut + mm(4.3)), title, font=tf, fill=text, anchor="ls")
    d.text((x, pad + cut + mm(7.4)), detail, font=df, fill=text, anchor="ls")
    return out


def badge(fmt: Format, k: float, word: str, fill, text) -> Image.Image:
    """A round sticker with one bold word."""
    mm = lambda v: fmt.px(v * k)
    r, cut, pad = mm(6.2), mm(0.7), mm(2)
    out = Image.new("RGBA", (2 * (r + cut + pad),) * 2, (0, 0, 0, 0))
    shadow = Image.new("RGBA", out.size, (0, 0, 0, 0))
    c = r + cut + pad
    ImageDraw.Draw(shadow).ellipse((pad, pad + mm(0.6), pad + 2 * (r + cut), pad + 2 * (r + cut) + mm(0.6)), fill=(0, 0, 0, 120))
    out.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(mm(0.6))))
    d = ImageDraw.Draw(out)
    d.ellipse((c - r - cut, c - r - cut, c + r + cut, c + r + cut), fill=PAPER + (255,))
    d.ellipse((c - r, c - r, c + r, c + r), fill=fill + (255,))
    d.text((c, c), word, font=store.font(mm(3.4), "Bold"), fill=text, anchor="mm")
    return out


def place(img: Image.Image, piece: Image.Image, fmt: Format, x: float, y: float, deg: float) -> None:
    """Centers a tilted piece on a point in mm from the trim's top left; off-trim is fine, the bleed
    carries it and the cut makes the pile feel bigger than the page."""
    p = piece.rotate(deg, resample=Image.BICUBIC, expand=True)
    img.paste(p, (fmt.edge(x) - p.width // 2, fmt.edge(y) - p.height // 2), p)


def pile(img: Image.Image, fmt: Format, k: float, cols: int, rows: int) -> None:
    """The sticker pile: a jittered grid over the whole page, every cell a tilted sticker or badge,
    the order shuffled so the colors mix. Seeded, so a rerun prints the same card."""
    rng = random.Random(PILE_SEED)
    w, h = fmt.trim_w, fmt.trim_h
    cells = [(c, r) for r in range(rows) for c in range(cols)]
    rng.shuffle(cells)
    pieces = [("s", *v) for v in STICKERS] + [("b", *v) for v in BADGES] * 2
    rng.shuffle(pieces)
    for i, (c, r) in enumerate(cells):
        kind, *v = pieces[i % len(pieces)]
        piece = sticker(fmt, k * rng.uniform(0.85, 1.2), *v) if kind == "s" else badge(fmt, k * rng.uniform(0.9, 1.3), *v)
        x = (c + 0.5) * w / cols + rng.uniform(-0.3, 0.3) * w / cols
        y = (r + 0.5) * h / rows + rng.uniform(-0.3, 0.3) * h / rows
        place(img, piece, fmt, x, y, rng.uniform(-22, 22))


def label(fmt: Format, width_mm: float, hook_mm: float, wordmark_mm: float) -> Image.Image:
    """The paper label on the pile: the wordmark and the hook in Geist Bold, nothing else."""
    pad = fmt.px(6)
    hook_f = store.font(fmt.px(hook_mm), "Bold")
    mark_h = round(wordmark_mm * 1132.05 / 3620.1)
    h = pad + fmt.px(mark_h + 4) + round(fmt.px(hook_mm) * 1.0) + pad
    shadow_pad = fmt.px(3)
    out = Image.new("RGBA", (fmt.px(width_mm) + 2 * shadow_pad, h + 2 * shadow_pad), (0, 0, 0, 0))
    shadow = Image.new("RGBA", out.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((shadow_pad, shadow_pad + fmt.px(1.2), shadow_pad + fmt.px(width_mm), shadow_pad + h + fmt.px(1.2)), radius=fmt.px(4), fill=(0, 0, 0, 150))
    out.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(fmt.px(1.2))))
    d = ImageDraw.Draw(out)
    d.rounded_rectangle((shadow_pad, shadow_pad, shadow_pad + fmt.px(width_mm), shadow_pad + h), radius=fmt.px(4), fill=PAPER + (255,))
    draw_wordmark(out, shadow_pad + pad, shadow_pad + pad, fmt.px(wordmark_mm), INK + (255,), ACCENT + (255,))
    y = shadow_pad + pad + fmt.px(mark_h + 4)
    d.text((shadow_pad + pad - fmt.px(hook_mm * 0.04), y + round(fmt.px(hook_mm) * 0.92)), HOOK, font=hook_f, fill=INK, anchor="ls")
    return out


def sorted_column(img: Image.Image, fmt: Format, k: float, left: int, top: int, count: int = 4,
                  width_mm: float = 40) -> int:
    """The week's plans lined up straight, as the app lists them. Returns the bottom."""
    y = top
    for i in SORTED[:count]:
        piece = sticker(fmt, k, *STICKERS[i], body_width_mm=width_mm)
        img.paste(piece, (left - fmt.px(2 * k), y), piece)
        y += piece.height - fmt.px(2.2 * k)
    return y


def scan_block(img: Image.Image, fmt: Format, cta: str, url: str) -> None:
    """The one scan block every back shares: a verb caption above a plain QR, the beta line and
    the URL below, all on one left edge, finishing on the bottom inset."""
    panel, gap, lead, big, small = SCAN_PANEL, 7, 6, 4.6, 3.1
    bottom = fmt.trim_h - INSET
    top = bottom - lead - gap - panel
    left = fmt.edge(SCAN_CENTER - panel / 2)
    draw_qr(img, left, fmt.edge(top), fmt.px(panel), url)
    d = ImageDraw.Draw(img)
    for text, baseline, size, weight, color in (
        (cta, top - lead, big, "Medium", ON_DARK),
        (BETA, bottom - lead, small, "Regular", ON_DARK),
        ("semli.app", bottom, small, "Regular", ON_ACCENT_SECONDARY),
    ):
        d.text((left, fmt.edge(baseline)), text, font=store.font(fmt.px(size), weight), fill=color, anchor="ls")


def beta_url(tag: str) -> str:
    return f"{SITE_URL}/beta?r={tag}"


# The fronts.

def pile_front() -> Image.Image:
    f = POSTCARD
    img = f.canvas(INK)
    pile(img, f, 1.5, 5, 4)
    tag = label(f, 100, 22, 22)
    place(img, tag, f, f.trim_w / 2, f.trim_h / 2, -2)
    return img


def named_front(school: str) -> Image.Image:
    f = POSTCARD
    img = f.canvas(PAPER)
    wordmark(img, f, light=True)
    serif_block(img, f, E_FRONT.format(school=SCHOOLS[school]), INSET, 26, f.trim_w - 2 * INSET, 17, INK, ACCENT)
    d = ImageDraw.Draw(img)
    d.text((f.edge(INSET), f.edge(f.trim_h - INSET)), E_FOOT, font=store.font(f.px(3.2), "Regular"), fill=MUTED, anchor="ls")
    return img


def continued_front() -> Image.Image:
    """The sentence runs off the right trim mid-word. The size is solved so that the visible part of
    the last word ends exactly on the trim line; the bleed carries the rest of the letter."""
    f = POSTCARD
    img = f.canvas(PAPER)
    wordmark(img, f, light=True)
    d = ImageDraw.Draw(img)
    probe = 100
    up, it = store.serif(probe, 400), store.serif(probe, 400, italic=True)
    width_at_probe = (store.tracked_len(d, C_CUT, up, store.SERIF_TRACKING)
                      + store.tracked_len(d, C_CUT_SHOW, it, store.SERIF_TRACKING))
    size = f.px(f.trim_w - INSET) * probe / width_at_probe  # canvas px, so the line is trim-wide
    up, it = store.serif(round(size), 400), store.serif(round(size), 400, italic=True)
    lead = round(size * 1.08)
    y = f.edge(30)
    for line in store.wrap(d, C_FRONT, up, f.px(f.trim_w - 2 * INSET)):
        store.draw_tracked(d, f.edge(INSET), y, line, up, INK, store.SERIF_TRACKING)
        y += lead
    x = f.edge(INSET) + store.draw_tracked(d, f.edge(INSET), y, C_CUT, up, INK, store.SERIF_TRACKING)
    store.draw_tracked(d, x, y, C_CUT_WORD, it, ACCENT, store.SERIF_TRACKING)  # clipped by the canvas
    return img


# The backs: lavender, the same scan block, their own headline.

def back(tag: str, cta: str) -> Image.Image:
    f = POSTCARD
    img = f.canvas(ACCENT)
    scan_block(img, f, cta, beta_url(tag))
    return img


def pile_back(tag: str) -> Image.Image:
    f = POSTCARD
    img = back(tag, PILE_CTA)
    left = f.edge(INSET)
    d = ImageDraw.Draw(img)
    d.text((left - f.px(0.8), f.edge(INSET) + round(f.px(22) * 0.92)), FIX, font=store.font(f.px(22), "Bold"), fill=ON_DARK, anchor="ls")
    d.text((left, f.edge(36)), PAYOFF, font=store.font(f.px(3.8), "Medium"), fill=ON_DARK, anchor="ls")
    sorted_column(img, f, 1.1, left, f.edge(38))
    return img


def named_back(tag: str) -> Image.Image:
    f = POSTCARD
    img = back(tag, E_CTA)
    wordmark(img, f, light=False)
    width = SCAN_CENTER - SCAN_PANEL / 2 - INSET - 6
    y = serif_block(img, f, E_BACK, INSET, 24, width, 9.5, ON_DARK, BUTTER)
    d = ImageDraw.Draw(img)
    d.text((f.edge(INSET), y + f.px(8)), E_BACK_LINE, font=store.font(f.px(3.4), "Regular"), fill=ON_ACCENT_SECONDARY, anchor="ls")
    return img


def continued_back(tag: str) -> Image.Image:
    f = POSTCARD
    img = back(tag, C_CTA)
    wordmark(img, f, light=False)
    width = SCAN_CENTER - SCAN_PANEL / 2 - INSET - 6
    d = ImageDraw.Draw(img)
    store.draw_tracked(d, f.edge(INSET - 0.5), f.edge(21), C_BACK_WORD, store.serif(f.px(22), 400, italic=True), BUTTER, store.SERIF_TRACKING)
    serif_block(img, f, C_BACK, INSET, 50, width, 8, ON_DARK, BUTTER)
    return img


def render(tag: str) -> tuple[Image.Image, Image.Image]:
    if tag == "pile":
        return pile_front(), pile_back(tag)
    if tag == "c":
        return continued_front(), continued_back(tag)
    stem, _, letter = tag.rpartition("-")
    if letter == "e" and stem in SCHOOLS:
        return named_front(stem), named_back(tag)
    sys.exit(f"unknown line item {tag!r}; expected one of {LINE_ITEMS}")


def finish(img: Image.Image) -> Image.Image:
    return img.resize((img.width // SS, img.height // SS), Image.LANCZOS)


def at_trim(img: Image.Image, fmt: Format) -> Image.Image:
    b = round(fmt.bleed / 25.4 * fmt.dpi)
    return img.crop((b, b, img.width - b, img.height - b))


def preview_sheet(pairs: list[tuple[str, Image.Image, Image.Image]]) -> Image.Image:
    """Every pair at trim, front beside back, one row per line item."""
    sides = [(tag, at_trim(fr, POSTCARD), at_trim(bk, POSTCARD)) for tag, fr, bk in pairs]
    w, h = sides[0][1].size
    gap, header = 120, 110
    sheet = Image.new("RGB", (2 * w + 3 * gap, len(sides) * (h + header + gap) + gap), (214, 212, 206))
    d = ImageDraw.Draw(sheet)
    for i, (tag, fr, bk) in enumerate(sides):
        y = gap + i * (h + header + gap)
        d.text((gap, y + 20), tag, font=store.font(64, "Medium"), fill=INK)
        sheet.paste(fr, (gap, y + header))
        sheet.paste(bk, (2 * gap + w, y + header))
    sheet.thumbnail((2400, 2400 * len(sides)), Image.LANCZOS)
    return sheet


def main(tags: list[str]) -> None:
    bad = [t for t in tags if not re.fullmatch(r"[\w.-]{1,57}", t)]
    if bad:
        sys.exit(f"tags must be letters, digits, dots, dashes or underscores (cleanRef drops others): {bad}")
    OUT.mkdir(parents=True, exist_ok=True)
    pairs = []
    for tag in tags:
        front, rear = (finish(side) for side in render(tag))
        front.save(OUT / f"{tag}-front.png", dpi=(POSTCARD.dpi,) * 2)
        rear.save(OUT / f"{tag}-back.png", dpi=(POSTCARD.dpi,) * 2)
        front.save(OUT / f"{tag}-postcard.pdf", save_all=True, append_images=[rear], resolution=POSTCARD.dpi)
        pairs.append((tag, front, rear))
        print(f"wrote {tag}-postcard.pdf", flush=True)
    preview_sheet(pairs).save(OUT / "preview.png")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("tags", nargs="*", help=f"line items to render (default: all of {', '.join(LINE_ITEMS)})")
    main(parser.parse_args().tags or LINE_ITEMS)
