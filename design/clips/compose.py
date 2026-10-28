#!/usr/bin/env python3
"""Faceless marketing clips: a simulator recording inside the site's iPhone frame, a caption on
paper above it, an end card with the site and the bio link. 1080x1920 for TikTok, Reels and Shorts.

    python3 design/clips/compose.py raw/ out/            # every clip in CLIPS with a raw file
    python3 design/clips/compose.py raw/ out/ shifts     # one clip
    python3 design/clips/compose.py raw/ out/ --music track.mp3   # a different music bed

Every clip fades in from black over the first second and out to the end card. The music bed is
design/clips/music/lofi-bed.wav (a placeholder from music.py) unless --music names another file;
it fades in with the picture and out with the end card. --no-music leaves the clip silent for a
sound added inside TikTok or Instagram.

`raw/<name>.mp4` are `xcrun simctl io booted recordVideo` captures (1320x2868) of the dev build
driven by the demo commands in apps/mobile/src/lib/dev.ts; see docs/launch-guide.md part 2 for
the setup and docs/marketing-500.md for where each clip goes. Geist, sentence case, ink on
paper, no gradients, no voice: captions are the whole script.

Needs ffmpeg and Pillow.
"""
from __future__ import annotations

import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
FONTS = ROOT / 'apps/mobile/assets/fonts'
FRAME = ROOT / 'apps/web/public/phones/iphone-frame.png'        # 944x1902, transparent screen
MASK = ROOT / 'apps/web/public/phones/iphone-screen-mask.png'   # 850x1814 at (47, 44)

MUSIC = Path(__file__).resolve().parent / 'music' / 'lofi-bed.wav'
FADE_IN = 1.0          # seconds from black
END_CARD = 3.0         # seconds the end card stays
W, H = 1080, 1920
PAPER, INK, INK2 = (250, 249, 246), (34, 35, 32), (104, 105, 99)
PHONE_W = 800                      # the frame's width on the canvas; it bleeds off the bottom
PHONE_TOP = 560
FPS = 30


@dataclass(frozen=True)
class Clip:
    name: str
    title: str          # the caption, two lines at most
    sub: str            # one quieter line under it
    raw: str            # which recording in raw/ (several clips can share one)
    start: float = 0    # seconds into the raw recording where the clip begins (skips the launch)
    end: float | None = None   # where it stops; None is the end of the recording
    hold: float = 3     # seconds the last frame stays before the end card (the simulator stops
                        # writing frames when the screen stops changing, so recordings end early)
    speed: float = 1.0  # >1 plays the screen faster; the demo's waits are real time


# The eight clips in docs/marketing-500.md, from six recordings: demo, demo-syllabus,
# review-update, list (then semli://plan), sample (then semli://plan), sample (then semli://paywall).
CLIPS = [
    Clip('shifts', 'Screenshot your work schedule. Done.', 'Semli reads every shift and asks only about the one with no time.', raw='shifts', start=25.5),
    Clip('syllabus', 'A syllabus becomes the whole semester.', 'Every exam, quiz and due date, read from the PDF and added in one tap.', raw='syllabus', start=7),
    Clip('update', 'New schedule? See only what changed.', 'Moved, new and dropped shifts, before anything is saved.', raw='update', start=7, hold=4),
    Clip('today', 'Know what matters today.', 'Classes, shifts and due dates ranked, with a countdown to what’s next.', raw='today', start=6),
    Clip('plan', 'Your whole week as a chart.', 'Lectures, shifts and study time on one timeline. Overlaps show in red.', raw='plan', start=11.5, hold=5),
    Clip('ask', 'Anything unclear gets a question, not a guess.', 'Friday’s shift had no time, so Semli asks. Nothing is saved until you confirm.', raw='shifts', start=31.5, end=38.5, hold=3),
    Clip('switch', 'Set up a semester in two minutes.', 'Not two hours. Calendar, to-dos and reminders stay free, for everyone.', raw='syllabus', start=7, speed=1.25),
    Clip('free', 'Calendar, to-dos, reminders: always free.', 'Plus is unlimited imports and Canvas sync. Student pricing, no proof needed.', raw='free', start=27, hold=5),
    # Recorded by hand (Oct 28, 2026): a shift lands on a class, the row turns red, the shift gets swapped.
    Clip('overlap', 'The shift that overlaps your lab, caught before you save it.', 'Work and classes on one week. Overlaps turn red, so you swap the shift, not the exam.', raw='overlap', start=3, hold=4),
]
END_TEXT = ('semli.app', 'Free on iPhone. Link in bio.')


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / f'Geist-{name}.ttf'), size)


def wrap(draw: ImageDraw.ImageDraw, text: str, f: ImageFont.FreeTypeFont, width: int) -> list[str]:
    words, lines, line = text.split(), [], ''
    for w in words:
        cand = f'{line} {w}'.strip()
        if draw.textlength(cand, font=f) <= width:
            line = cand
        else:
            lines.append(line)
            line = w
    if line:
        lines.append(line)
    return lines


def caption_card(clip: Clip) -> Image.Image:
    """Paper with the caption and the phone frame, screen cut out so the video shows through."""
    img = Image.new('RGBA', (W, H), PAPER + (255,))
    d = ImageDraw.Draw(img)
    margin = 72
    y = 150
    for line in wrap(d, clip.title, font('Medium', 72), W - 2 * margin):
        d.text((margin, y), line, font=font('Medium', 72), fill=INK)
        y += 82
    y += 14
    for line in wrap(d, clip.sub, font('Regular', 36), W - 2 * margin):
        d.text((margin, y), line, font=font('Regular', 36), fill=INK2)
        y += 46
    frame = Image.open(FRAME).convert('RGBA')
    scale = PHONE_W / frame.width
    frame = frame.resize((PHONE_W, round(frame.height * scale)), Image.LANCZOS)
    x = (W - PHONE_W) // 2
    # Punch the screen out of the paper too, so the video is the only thing in that box.
    mask = Image.open(MASK).getchannel('A').resize((round(850 * scale), round(1814 * scale)), Image.LANCZOS)
    hole = Image.new('L', (W, H), 255)
    hole.paste(Image.eval(mask, lambda v: 255 - v), (x + round(47 * scale), PHONE_TOP + round(44 * scale)))
    img.putalpha(hole)
    img.alpha_composite(frame, (x, PHONE_TOP))
    return img


def end_card() -> Image.Image:
    img = Image.new('RGB', (W, H), PAPER)
    d = ImageDraw.Draw(img)
    title, sub = END_TEXT
    tf, sf = font('Light', 104), font('Regular', 40)
    tw = d.textlength(title, font=tf)
    d.text(((W - tw) / 2, H / 2 - 110), title, font=tf, fill=INK)
    sw = d.textlength(sub, font=sf)
    d.text(((W - sw) / 2, H / 2 + 20), sub, font=sf, fill=INK2)
    return img


def render(clip: Clip, raw: Path, out: Path, music: Path | None) -> None:
    scale = PHONE_W / 944
    sw, sh = round(850 * scale), round(1814 * scale)
    sx, sy = (W - PHONE_W) // 2 + round(47 * scale), PHONE_TOP + round(44 * scale)
    with tempfile.TemporaryDirectory() as tmp:
        card = Path(tmp) / 'card.png'
        end = Path(tmp) / 'end.png'
        caption_card(clip).save(card)
        end_card().save(end)
        probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(raw)], capture_output=True, text=True, check=True)
        raw_end = clip.end if clip.end is not None else float(probe.stdout.strip())
        screen = (raw_end - clip.start) / clip.speed + clip.hold
        tempo = f'setpts={1 / clip.speed:.4f}*PTS,' if clip.speed != 1 else ''
        # The raw capture is 1320x2868 (the full status bar included); the mask box is 850x1814
        # of a 944x1902 frame, the same proportions, so a plain scale fits. tpad holds the last
        # frame; shortest=1 on the overlay then ends the screen part with it.
        filt = (
            f'color=c=0x{PAPER[0]:02x}{PAPER[1]:02x}{PAPER[2]:02x}:s={W}x{H}:r={FPS}[bg];'
            f'[0:v]{tempo}scale={sw}:{sh}:flags=lanczos,fps={FPS},tpad=stop_mode=clone:stop_duration={clip.hold}[scr];'
            f'[bg][scr]overlay={sx}:{sy}:shortest=1[v1];'
            f'[v1][1:v]overlay=0:0:shortest=1[v2];'
            f'[2:v]fps={FPS}[endv];'
            f'[v2][endv]xfade=transition=fade:duration=0.5:offset={max(screen - 0.5, 0.1):.2f},'
            f'fade=t=in:st=0:d={FADE_IN}[v]'
        )
        total = screen - 0.5 + END_CARD
        inputs = [
            '-ss', str(clip.start), '-to', str(raw_end), '-i', str(raw),
            '-loop', '1', '-t', str(screen + 1), '-i', str(card),
            '-loop', '1', '-t', str(END_CARD), '-i', str(end),
        ]
        audio: list[str] = ['-an']
        if music:
            inputs += ['-stream_loop', '-1', '-i', str(music)]
            filt += (
                f';[3:a]atrim=0:{total:.2f},asetpts=PTS-STARTPTS,'
                f'afade=t=in:st=0:d={FADE_IN + 0.5},afade=t=out:st={total - 1.5:.2f}:d=1.5,volume=0.9[a]'
            )
            audio = ['-map', '[a]', '-c:a', 'aac', '-b:a', '160k']
        subprocess.run([
            'ffmpeg', '-y', '-v', 'error', *inputs,
            '-filter_complex', filt, '-map', '[v]', *audio,
            '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20', '-movflags', '+faststart', '-shortest',
            str(out),
        ], check=True)


def main() -> None:
    args = sys.argv[1:]
    music: Path | None = MUSIC if MUSIC.exists() else None
    if '--no-music' in args:
        args.remove('--no-music')
        music = None
    if '--music' in args:
        i = args.index('--music')
        music = Path(args[i + 1])
        del args[i:i + 2]
    raw_dir, out_dir = Path(args[0]), Path(args[1])
    only = set(args[2:])
    out_dir.mkdir(parents=True, exist_ok=True)
    for clip in CLIPS:
        if only and clip.name not in only:
            continue
        raw = raw_dir / f'{clip.raw}.mp4'
        if not raw.exists():
            print(f'skip {clip.name}: no {raw}')
            continue
        out = out_dir / f'{clip.name}.mp4'
        render(clip, raw, out, music)
        print(f'wrote {out}')


if __name__ == '__main__':
    main()
