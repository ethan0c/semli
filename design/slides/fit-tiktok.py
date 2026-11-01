"""Fit a raw iPhone screenshot into a 1080x1920 TikTok photo post, clear of what TikTok covers.

A 1320x2868 screenshot is taller than 9:16, so TikTok crops its top and bottom, and the caption
(bottom ~250 px) and button rail (right ~130 px) sit over what's left. This scales the screen
to sit inside those margins on a blurred copy of itself, with the status bar cropped off.

  python3 design/slides/fit-tiktok.py ~/Desktop/essay.png ...   # writes ~/Desktop/tiktok/<name>.png
  python3 design/slides/fit-tiktok.py --zones ...               # also draws TikTok's overlays, to check
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

W, H = 1080, 1920
SIDE = 110  # centred, so the right edge stays clear of the ~130 px button rail with the screen's own padding
TOP = 150  # under the Following / For You tabs
CROP_TOP = 200  # status bar off (on a 2868-tall screenshot)
RADIUS = 44


def fit(src: Path, zones: bool) -> Image.Image:
    shot = Image.open(src).convert('RGB')
    shot = shot.crop((0, round(CROP_TOP * shot.height / 2868), shot.width, shot.height))
    width = W - 2 * SIDE
    shot = shot.resize((width, round(shot.height * width / shot.width)), Image.LANCZOS)

    # The screen's empty left margin (sky into paper), stretched across, so nothing in the list tints it.
    edge = shot.crop((0, 0, 12, shot.height)).resize((1, shot.height), Image.BOX)
    canvas = edge.resize((W, shot.height), Image.BILINEAR).crop((0, -TOP, W, H - TOP))
    canvas.paste(edge.getpixel((0, 0)), (0, 0, W, TOP))
    canvas.paste(edge.getpixel((0, shot.height - 1)), (0, TOP + shot.height, W, H))

    mask = Image.new('L', shot.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, *shot.size), RADIUS, fill=255)
    shadow = Image.new('L', (W, H), 0)
    ImageDraw.Draw(shadow).rounded_rectangle((SIDE, TOP + 12, SIDE + shot.width, TOP + 12 + shot.height), RADIUS, fill=70)
    canvas.paste((0, 0, 0), (0, 0), shadow.filter(ImageFilter.GaussianBlur(24)))
    canvas.paste(shot, (SIDE, TOP), mask)

    if zones:
        d = ImageDraw.Draw(canvas, 'RGBA')
        d.rectangle((0, H - 250, W, H), fill=(255, 0, 0, 70))
        d.rectangle((W - 130, 520, W, H - 250), fill=(255, 0, 0, 70))
        d.rectangle((0, 0, W, 130), fill=(255, 0, 0, 70))
    return canvas


if __name__ == '__main__':
    args = sys.argv[1:]
    zones = '--zones' in args
    out = Path.home() / 'Desktop' / ('tiktok-zones' if zones else 'tiktok')
    out.mkdir(exist_ok=True)
    for a in (a for a in args if a != '--zones'):
        src = Path(a).expanduser()
        fit(src, zones).save(out / src.name)
        print(out / src.name)
