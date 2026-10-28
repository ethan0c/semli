#!/usr/bin/env python3
"""Two screenshots of a scheduling app, for the recordings: Campus Café's week, the way a
manager's app or a group chat would show it. They go into the simulator's photo library
(`xcrun simctl addmedia booted ...`) so the Add tab's "Recent screenshots" row has something
real to tap. The shifts match store/sample.ts: `next` is the week after the pinned clock
(Monday Oct 19, 2026), `update` is the same week read again after the manager changed it.

    python3 design/clips/fake-screenshot.py            # writes design/clips/shots/{next,update}.png
"""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent.parent
FONTS = ROOT / 'apps/mobile/assets/fonts'
OUT = Path(__file__).resolve().parent / 'shots'
W, H = 1179, 2556  # an iPhone screenshot

# A plain scheduling app: white, grey rules, a teal brand mark. Nothing of Semli's own look.
BG, INK, GREY, RULE, BRAND, TINT = (255, 255, 255), (28, 28, 30), (120, 120, 128), (229, 229, 234), (0, 122, 110), (230, 244, 241)

WEEKS = {
    'next': ('Oct 26 – Nov 1', [
        ('Mon', '26', '4:00 PM – 10:00 PM', 'Barista'),
        ('Tue', '27', '4:00 PM – 10:00 PM', 'Barista'),
        ('Wed', '28', None, None),
        ('Thu', '29', '4:00 PM – 10:00 PM', 'Barista'),
        ('Fri', '30', 'Shift · time TBD', 'Barista'),
        ('Sat', '31', '9:00 AM – 3:00 PM', 'Barista'),
        ('Sun', '1', '11:00 AM – 5:00 PM', 'Barista'),
    ]),
    'update': ('Oct 19 – 25', [
        ('Mon', '19', '4:00 PM – 10:00 PM', 'Barista'),
        ('Tue', '20', '4:00 PM – 10:00 PM', 'Barista'),
        ('Wed', '21', '5:00 PM – 9:00 PM', 'Barista'),
        ('Thu', '22', '5:00 PM – 11:00 PM', 'Barista'),
        ('Fri', '23', None, None),
        ('Sat', '24', None, None),
        ('Sun', '25', '11:00 AM – 5:00 PM', 'Barista'),
    ]),
}


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / f'Geist-{name}.ttf'), size)


def render(name: str) -> Image.Image:
    title, days = WEEKS[name]
    img = Image.new('RGB', (W, H), BG)
    d = ImageDraw.Draw(img)
    # Status bar, the generic kind.
    d.text((88, 62), '9:41', font=font('SemiBold', 44), fill=INK)
    d.rounded_rectangle((1010, 70, 1090, 106), radius=10, outline=INK, width=4)
    d.rectangle((1018, 78, 1082, 98), fill=INK)
    # Header: back chevron, the employer, the week.
    d.line((70, 230, 100, 200, 70, 230, 100, 260), fill=BRAND, width=6)
    d.text((140, 178), 'Campus Café', font=font('SemiBold', 56), fill=INK)
    d.text((140, 250), f'My schedule · {title}', font=font('Regular', 40), fill=GREY)
    d.rounded_rectangle((900, 190, 1100, 270), radius=40, fill=TINT)
    d.text((936, 208), 'Week', font=font('Medium', 38), fill=BRAND)
    d.line((0, 330, W, 330), fill=RULE, width=2)
    y = 330
    row = 240
    for day, num, when, role in days:
        d.text((70, y + 52), day, font=font('Medium', 40), fill=GREY)
        d.text((70, y + 104), num, font=font('Regular', 64), fill=INK)
        if when:
            d.rounded_rectangle((260, y + 40, W - 70, y + row - 40), radius=28, fill=TINT)
            d.text((300, y + 70), when, font=font('Medium', 44), fill=INK)
            d.text((300, y + 134), f'{role} · Front counter', font=font('Regular', 36), fill=GREY)
        else:
            d.text((300, y + 96), 'Off', font=font('Regular', 40), fill=GREY)
        y += row
        d.line((260, y, W, y), fill=RULE, width=2)
    total = sum(1 for _, _, w, _ in days if w)
    d.text((70, y + 60), f'{total} shifts this week', font=font('Regular', 40), fill=GREY)
    # A tab bar.
    d.line((0, H - 220, W, H - 220), fill=RULE, width=2)
    for i, label in enumerate(['Schedule', 'Swaps', 'Messages', 'Me']):
        x = 70 + i * 280
        d.rounded_rectangle((x + 60, H - 180, x + 120, H - 120), radius=14, fill=BRAND if i == 0 else RULE)
        d.text((x + 40, H - 100), label, font=font('Regular', 30), fill=BRAND if i == 0 else GREY)
    return img


if __name__ == '__main__':
    OUT.mkdir(exist_ok=True)
    for name in WEEKS:
        render(name).save(OUT / f'{name}.png')
        print(f'wrote {OUT / name}.png')
