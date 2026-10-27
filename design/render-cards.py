#!/usr/bin/env python3
"""Render the campus print pieces, one set per school: a 4 x 6 in hand-out postcard and a
letter-size flyer for bulletin boards.

The concept is "Buried? / Sorted." The front is a wall-to-wall pile of due-date stickers in the
app's class colors, pushed to print saturation and tilted every which way, burying the card. One
paper label sits on the pile with the wordmark, a giant "Buried?" in Geist Bold and the survey
number (83% of the students surveyed in early 2026 had missed or nearly missed an assignment
that got buried; docs/marketing-500.md). The back is lavender: the same stickers lined up
straight, "Sorted.", and a plain square QR with an uninterrupted quiet zone. The scan heading,
code, beta label, and URL share a left edge. "Turn your syllabus into a plan." sits beneath
"Sorted." The scan block and sorted stickers finish on the same bottom margin.
The stickers are the problem, the app is the fix, the code is the way there. The flyer is the
same on one portrait page: the pile on top, the sorted band below.

Oct 26, 2026, founder's call: maximalist, first-glance, the brand serif optional; only the
wordmark and the QR destination stay fixed. Geist Bold appears in print art only, like the italic in the
store captions. Sentence case throughout, never caps.

Postcard: landscape 152.4 x 101.6 mm with 3 mm bleed (1/8 in, what US and AliExpress postcard
shops ask for) and 5 mm safe. Flyer: portrait 8.5 x 11 in with 3 mm bleed; campus print shops
print it full bleed, an office printer leaves a thin white border, which is fine.

Every QR goes to semli.app/beta with a `?r=` tag, `<school>` on postcards and `<school>-flyer`
on flyers, so `select ref, count(*) from waitlist group by ref` shows which school, and which
piece, sends installs. Every school gets the same front.

    python3 design/render-cards.py                       # york, pomona, gatech
    python3 design/render-cards.py emory gsu             # one set per tag

Output in design/cards/out: <tag>-postcard.pdf (front, then back, 600 dpi) and <tag>-flyer.pdf
(300 dpi), plus postcard-front.png, <tag>-postcard-back.png and <tag>-flyer.png for shops that
want images, and postcard-preview.png and flyer-preview.png for a look at trim before ordering.
Needs Pillow and the repo's node_modules (toqr).
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
SCHOOLS = ["york", "pomona", "gatech"]  # docs/school-flyer-outreach.md

# The store art's caption type and colors, so the pieces and the listing match.
_spec = importlib.util.spec_from_file_location("store", ROOT / "design" / "render-screenshots.py")
store = sys.modules["store"] = importlib.util.module_from_spec(_spec)  # its dataclass looks itself up
_spec.loader.exec_module(store)
PAPER, INK, ACCENT, DARK_ACCENT = store.PAPER, store.INK, store.ACCENT, store.DARK_ACCENT
ON_DARK = (245, 244, 240)  # the store art's wordmark on a dark ground
ON_ACCENT_SECONDARY = (222, 214, 245)
BUTTER = (255, 226, 122)  # the back's accent on lavender
SS = 2  # drawn at twice the size and scaled down: Pillow does not antialias shapes

HOOK = "Buried?"
STAT = "83% of students we surveyed had missed or nearly missed an assignment that got buried."
FIX = "Sorted."
PAYOFF = "Turn your syllabus into a plan."
CTA = "Scan to try Semli"
BETA = "Free iPhone beta"
FLIP = "Flip for the fix"
MUTED = (104, 105, 99)
ROW = (240, 239, 235)
LINE = (229, 228, 222)
SOFT = (240, 236, 248)

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
FLYER = Format(215.9, 279.4, 300, safe=12)

# Sticker centers (mm from the trim's top left) and tilt, placed by hand like stickers on a laptop.
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


def caption(img: Image.Image, fmt: Format, text: str, left: int, top: int, width_mm: float, size_mm: float, color, accent) -> int:
    """The store caption: EB Garamond Regular, the ~accent~ in italic. Returns its bottom."""
    d = ImageDraw.Draw(img)
    f, af = store.serif(fmt.px(size_mm), 400), store.serif(fmt.px(size_mm), 400, italic=True)
    return store.rich_block(d, text, f, left, top, fmt.px(width_mm), fmt.px(size_mm), color, accent, "left", tracking=store.SERIF_TRACKING, accent_font=af)


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


def label(fmt: Format, width_mm: float, hook_mm: float, stat_mm: float, wordmark_mm: float,
          flip: bool = False) -> Image.Image:
    """The paper label on the pile: wordmark, the hook in Geist Bold, the survey line."""
    pad = fmt.px(6)
    probe = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    # Geist Bold against EB Garamond: the shout and the quiet fact. The serif runs a size up to match.
    hook_f, stat_f = store.font(fmt.px(hook_mm), "Bold"), store.serif(fmt.px(stat_mm), 500)
    inner = fmt.px(width_mm) - 2 * pad
    lines = store.wrap(probe, STAT, stat_f, inner)
    mark_h = round(wordmark_mm * 1132.05 / 3620.1)
    h = pad + fmt.px(mark_h + 4) + round(fmt.px(hook_mm) * 1.0) + fmt.px(3) + len(lines) * round(fmt.px(stat_mm) * 1.4) + pad
    if flip:
        h += fmt.px(9)
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
    y += round(fmt.px(hook_mm) * 1.0) + fmt.px(3)
    for line in lines:
        y += round(fmt.px(stat_mm) * 1.4)
        d.text((shadow_pad + pad, y - round(fmt.px(stat_mm) * 0.3)), line, font=stat_f, fill=INK, anchor="ls")
    if flip:
        flip_cue(d, fmt, shadow_pad + pad, shadow_pad + h - pad, 3.3)
    return out


def flip_cue(d: ImageDraw.ImageDraw, fmt: Format, left: int, baseline: int, size: float) -> None:
    """An explicit instruction and arrow, inside the card's safe area."""
    font = store.font(fmt.px(size), "Medium")
    d.text((left, baseline), FLIP, font=font, fill=ACCENT, anchor="ls")
    x = left + round(d.textlength(FLIP, font=font)) + fmt.px(2.5)
    y = baseline - fmt.px(size * 0.33)
    tip = x + fmt.px(size * 1.1)
    stroke = max(SS, fmt.px(0.25))
    d.line((x, y, tip, y), fill=ACCENT, width=stroke)
    d.line((tip - fmt.px(1.1), y - fmt.px(1.1), tip, y, tip - fmt.px(1.1), y + fmt.px(1.1)), fill=ACCENT, width=stroke)


def sorted_column(img: Image.Image, fmt: Format, k: float, left: int, top: int, count: int = 4,
                  width_mm: float = 40) -> int:
    """The week's plans lined up straight, as the app lists them. Returns the bottom."""
    y = top
    for i in SORTED[:count]:
        piece = sticker(fmt, k, *STICKERS[i], body_width_mm=width_mm)
        img.paste(piece, (left - fmt.px(2 * k), y), piece)
        y += piece.height - fmt.px(2.2 * k)
    return y


def scan_block(img: Image.Image, fmt: Format, center_x: float, bottom: float, panel: float,
               gap: float, lead: float, big: float, small: float, url: str,
               light: bool = False) -> None:
    """An invitation above a plain QR, with two compact lines below; all share a left edge."""
    top = bottom - lead - gap - panel
    left = fmt.edge(center_x - panel / 2)
    draw_qr(img, left, fmt.edge(top), fmt.px(panel), url)
    d = ImageDraw.Draw(img)
    for text, baseline, size, weight, color in (
        (CTA, top - lead, big, "Medium", INK if light else ON_DARK),
        (BETA, bottom - lead, small, "Regular", MUTED if light else ON_DARK),
        ("semli.app", bottom, small, "Regular", ACCENT if light else ON_ACCENT_SECONDARY),
    ):
        d.text((left, fmt.edge(baseline)), text,
               font=store.font(fmt.px(size), weight), fill=color, anchor="ls")


def postcard_front() -> Image.Image:
    f = POSTCARD
    img = f.canvas(INK)
    pile(img, f, 1.5, 5, 4)
    tag = label(f, 104, 22, 5.1, 22, flip=True)
    place(img, tag, f, f.trim_w / 2, f.trim_h / 2, -2)
    return img


def postcard_back(tag: str) -> Image.Image:
    f = POSTCARD
    img = f.canvas(ACCENT)
    inset = 8
    left = f.edge(inset)
    d = ImageDraw.Draw(img)
    d.text((left - f.px(0.8), f.edge(inset) + round(f.px(22) * 0.92)), FIX, font=store.font(f.px(22), "Bold"), fill=ON_DARK, anchor="ls")
    d.text((left, f.edge(36)), PAYOFF, font=store.font(f.px(3.8), "Medium"), fill=ON_DARK, anchor="ls")
    sorted_column(img, f, 1.1, left, f.edge(38))
    # Leave room between the headline and the scan block; keep the text inside the right inset.
    scan_block(img, f, f.trim_w - inset - 26, f.trim_h - inset, 38, 7, 6, 4.6, 3.1,
               f"{SITE_URL}/beta?r={tag}")
    return img


def flyer(tag: str) -> Image.Image:
    f = FLYER
    img = f.canvas(INK)
    band_mm = 172
    pile(img, f, 2.3, 4, 6)
    tag_img = label(f, 160, 36, 8.1, 36)
    place(img, tag_img, f, f.trim_w / 2, band_mm / 2, -2)
    d = ImageDraw.Draw(img)
    d.rectangle((0, f.edge(band_mm), img.width, img.height), fill=ACCENT)
    left = f.edge(f.safe)
    d.text((left - f.px(1), f.edge(band_mm + 5) + round(f.px(26) * 0.92)), FIX, font=store.font(f.px(26), "Bold"), fill=ON_DARK, anchor="ls")
    d.text((left, f.edge(band_mm + 36)), PAYOFF, font=store.font(f.px(4.6), "Medium"), fill=ON_DARK, anchor="ls")
    sorted_column(img, f, 1.4, left, f.edge(band_mm + 39), count=3, width_mm=56)
    scan_block(img, f, f.trim_w - f.safe - 29, f.trim_h - f.safe - 1, 50, 9, 8, 5.8, 3.7,
               f"{SITE_URL}/beta?r={tag}-flyer")
    return img


def finish(img: Image.Image) -> Image.Image:
    return img.resize((img.width // SS, img.height // SS), Image.LANCZOS)


def at_trim(img: Image.Image, fmt: Format) -> Image.Image:
    b = round(fmt.bleed / 25.4 * fmt.dpi)
    return img.crop((b, b, img.width - b, img.height - b))


def main(tags: list[str]) -> None:
    bad = [t for t in tags if not re.fullmatch(r"[\w.-]{1,57}", t)]
    if bad:
        sys.exit(f"tags must be letters, digits, dots, dashes or underscores (cleanRef drops others): {bad}")
    OUT.mkdir(parents=True, exist_ok=True)
    front = finish(postcard_front())
    front.save(OUT / "postcard-front.png", dpi=(POSTCARD.dpi,) * 2)
    for i, tag in enumerate(tags):
        back = finish(postcard_back(tag))
        back.save(OUT / f"{tag}-postcard-back.png", dpi=(POSTCARD.dpi,) * 2)
        front.save(OUT / f"{tag}-postcard.pdf", save_all=True, append_images=[back], resolution=POSTCARD.dpi)
        page = finish(flyer(tag))
        page.save(OUT / f"{tag}-flyer.png", dpi=(FLYER.dpi,) * 2)
        page.save(OUT / f"{tag}-flyer.pdf", resolution=FLYER.dpi)
        if i == 0:  # a look at trim before ordering, small enough to open anywhere
            sides = [at_trim(front, POSTCARD), at_trim(back, POSTCARD)]
            gap = 160
            preview = Image.new("RGB", (sides[0].width * 2 + gap * 3, sides[0].height + gap * 2), (214, 212, 206))
            for j, side in enumerate(sides):
                preview.paste(side, (gap + j * (side.width + gap), gap))
            preview.thumbnail((3000, 3000), Image.LANCZOS)
            preview.save(OUT / "postcard-preview.png")
            small = at_trim(page, FLYER)
            small.thumbnail((1400, 1400), Image.LANCZOS)
            small.save(OUT / "flyer-preview.png")
    print(f"wrote {OUT.relative_to(ROOT)}: " + ", ".join(f"{t}-postcard.pdf, {t}-flyer.pdf" for t in tags))


if __name__ == "__main__":
    main(sys.argv[1:] or SCHOOLS)
