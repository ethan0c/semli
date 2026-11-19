#!/usr/bin/env python3
"""Render five-slide faceless photo posts from licensed photos already in the repo."""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
W, H = 1080, 1920
FONT = ROOT / "apps/mobile/assets/fonts/Geist-SemiBold.ttf"
FONT_FALLBACK = ROOT / "apps/mobile/assets/fonts/Geist-Medium.ttf"


def fit_lines(draw: ImageDraw.ImageDraw, copy: str, width: int):
    for size in range(98, 57, -2):
        font = ImageFont.truetype(str(FONT if FONT.exists() else FONT_FALLBACK), size)
        lines: list[str] = []
        for paragraph in copy.split("\n"):
            words = paragraph.split()
            line = ""
            for word in words:
                candidate = f"{line} {word}".strip()
                if line and draw.textlength(candidate, font=font) > width:
                    lines.append(line)
                    line = word
                else:
                    line = candidate
            if line:
                lines.append(line)
        line_h = int(size * 1.13)
        if len(lines) <= 7 and len(lines) * line_h <= 770:
            return font, lines, line_h
    raise ValueError(f"Slide copy does not fit: {copy}")


def render_slide(slide: dict, number: int, style: str = "warm") -> Image.Image:
    photo = ROOT / slide["photo"]
    with Image.open(photo) as source:
        image = ImageOps.fit(source.convert("RGB"), (W, H), method=Image.Resampling.LANCZOS,
                             centering=tuple(slide.get("focus", [0.5, 0.5]))).convert("RGBA")
    shade = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    shade_draw = ImageDraw.Draw(shade)
    shade_draw.rectangle((0, 0, W, H), fill=(8, 8, 10, 100 if style == "her" else 112))
    shade_draw.rectangle((0, 490, W, 1510), fill=(22, 5, 12, 80) if style == "her" else (8, 8, 10, 65))
    image = Image.alpha_composite(image, shade)
    draw = ImageDraw.Draw(image)
    font, lines, line_h = fit_lines(draw, slide["text"], 840)
    block_h = len(lines) * line_h
    y = max(610, min(1280 - block_h, 970 - block_h // 2))
    for line in lines:
        x = (W - draw.textlength(line, font=font)) / 2
        draw.text((x + 2, y + 4), line, font=font, fill=(0, 0, 0, 175), stroke_width=2)
        color = (255, 242, 190, 255) if style == "her" else (255, 255, 250, 255)
        draw.text((x, y), line, font=font, fill=color)
        y += line_h
    if style == "warm":
        small = ImageFont.truetype(str(FONT_FALLBACK), 32)
        draw.text((72, 120), f"{number}/5", font=small, fill=(255, 255, 255, 215))
    return image.convert("RGB")


def render_deck(deck: dict, output: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)
    thumbs = []
    for i, slide in enumerate(deck["slides"], 1):
        image = render_slide(slide, i, deck.get("style", "warm"))
        image.save(output / f"{i:02d}.jpg", quality=90, subsampling=0)
        thumbs.append(ImageOps.fit(image, (216, 384)))
    contact = Image.new("RGB", (216 * 5, 384), "#111")
    for i, thumb in enumerate(thumbs):
        contact.paste(thumb, (i * 216, 0))
    contact.save(output / "preview.jpg", quality=88)
    (output / "caption.txt").write_text(deck["caption"].strip() + "\n")
    (output / "sources.json").write_text(json.dumps([
        {"slide": i, "photo": slide["photo"], "source": slide["source"]}
        for i, slide in enumerate(deck["slides"], 1)
    ], indent=2) + "\n")


def main() -> None:
    manifest = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "sample.json"
    data = json.loads(manifest.read_text())
    for deck in data["decks"]:
        target = HERE / "out" / data["date"] / deck["slug"]
        render_deck(deck, target)
        print(target)


if __name__ == "__main__":
    main()
