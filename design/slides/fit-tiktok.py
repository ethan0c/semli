"""Fit a raw iPhone screenshot into a 1080x1920 TikTok photo post, clear of what TikTok covers.

A 1320x2868 screenshot is taller than 9:16, so TikTok crops its top and bottom, and the caption
(bottom ~250 px) and button rail (right ~130 px) sit over what's left. This scales the screen
to sit inside those margins on a blurred copy of itself, with the status bar cropped off.

  python3 design/slides/fit-tiktok.py ~/Desktop/essay.png ...   # writes ~/Desktop/tiktok/<name>.png
  python3 design/slides/fit-tiktok.py --zones ...               # also draws TikTok's overlays, to check
"""
import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

W, H = 1080, 1920
SIDE = 110  # centred, so the right edge stays clear of the ~130 px button rail with the screen's own padding
TOP = 150  # under the Following / For You tabs
CROP_TOP = 200  # status bar off (on a 2868-tall screenshot)
RADIUS = 44
BOTTOM = 270


def fit(src: Path, zones: bool) -> Image.Image:
    shot = Image.open(src).convert('RGB')
    shot = shot.crop((0, round(CROP_TOP * shot.height / 2868), shot.width, shot.height))
    # Fit vertically too: the old fixed width left the last rows under the caption.
    width = min(W - 2 * SIDE, int((H - TOP - BOTTOM) * shot.width / shot.height))
    shot = shot.resize((width, round(shot.height * width / shot.width)), Image.LANCZOS)
    left = (W - width) // 2

    # The screen's empty left margin (sky into paper), stretched across, so nothing in the list tints it.
    edge = shot.crop((0, 0, 12, shot.height)).resize((1, shot.height), Image.BOX)
    canvas = edge.resize((W, shot.height), Image.BILINEAR).crop((0, -TOP, W, H - TOP))
    canvas.paste(edge.getpixel((0, 0)), (0, 0, W, TOP))
    canvas.paste(edge.getpixel((0, shot.height - 1)), (0, TOP + shot.height, W, H))

    mask = Image.new('L', shot.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, *shot.size), RADIUS, fill=255)
    shadow = Image.new('L', (W, H), 0)
    ImageDraw.Draw(shadow).rounded_rectangle((left, TOP + 12, left + shot.width, TOP + 12 + shot.height), RADIUS, fill=70)
    canvas.paste((0, 0, 0), (0, 0), shadow.filter(ImageFilter.GaussianBlur(24)))
    canvas.paste(shot, (left, TOP), mask)

    if zones:
        d = ImageDraw.Draw(canvas, 'RGBA')
        d.rectangle((0, H - 250, W, H), fill=(255, 0, 0, 70))
        d.rectangle((W - 130, 520, W, H - 250), fill=(255, 0, 0, 70))
        d.rectangle((0, 0, W, 130), fill=(255, 0, 0, 70))
    return canvas


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--zones', action='store_true')
    parser.add_argument('--out', type=Path, help='Output folder (defaults to Desktop/tiktok)')
    parser.add_argument('screenshots', nargs='+', type=Path)
    args = parser.parse_args()
    out = (args.out or Path.home() / 'Desktop' / ('tiktok-zones' if args.zones else 'tiktok')).expanduser()
    out.mkdir(parents=True, exist_ok=True)
    for a in args.screenshots:
        src = a.expanduser()
        fit(src, args.zones).save(out / src.name)
        print(out / src.name)
