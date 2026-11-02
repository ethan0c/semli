"""Prepare a TikTok Sunday batch, capture real simulator screens, and build a local review gallery.

python3 design/social/batch.py                         # captions, queue, gallery; no simulator
python3 design/social/batch.py --capture               # capture missing screens, restore dev files
python3 design/social/batch.py --capture --only batch-email --force
python3 design/social/batch.py --video                 # optional silent 8s videos from the PNGs

Nothing here uploads, publishes, or schedules a post. The queue contains proposed times.
Requires Pillow; capture requires a running Semli development build and Metro on port 8081.
"""
import argparse
import csv
import html
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import time
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[2]
PRESETS = ROOT / 'apps/mobile/src/lib/meme-presets.json'
spec = importlib.util.spec_from_file_location('fit_tiktok', ROOT / 'design/slides/fit-tiktok.py')
fitter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fitter)


def run(*args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def load_batch(path):
    batch = json.loads(path.read_text())
    zone = ZoneInfo(batch['timezone'])
    presets = {p['id'] for p in json.loads(PRESETS.read_text())}
    seen = set()
    for p in batch['posts']:
        if p['preset'] not in presets:
            raise ValueError(f"Unknown preset: {p['preset']}")
        if p['preset'] in seen:
            raise ValueError(f"Duplicate preset: {p['preset']}; use a new batch for repeats")
        seen.add(p['preset'])
        p['scheduled_at'] = datetime.fromisoformat(f"{p['date']}T{p['time']}").replace(tzinfo=zone).isoformat()
        p['scheduled_at_utc'] = datetime.fromisoformat(p['scheduled_at']).astimezone(timezone.utc).isoformat()
        datetime.fromisoformat(p.get('screen_date', p['date']))
        if len(p['caption']) > 2200:
            raise ValueError(f"Caption too long: {p['preset']}")
    return batch


def capture(posts, out, args):
    device = os.environ.get('SIMULATOR_ID', 'booted')
    container = run('xcrun', 'simctl', 'get_app_container', device, 'app.semli.mobile', 'data', capture_output=True, text=True).stdout.strip()
    folder = Path(container) / 'Documents'
    # Preserve the exact state at entry, including an earlier load-meme.sh session.
    names = ['dev-command.txt', 'dev-clock.txt', 'dev-meme-backup.json']
    backup = {name: (folder / name).read_bytes() if (folder / name).exists() else None for name in names}
    # Ctrl-C/SIGTERM both pass through finally so a stopped batch restores the dev files.
    def interrupted(*_):
        raise KeyboardInterrupt
    previous = signal.signal(signal.SIGTERM, interrupted)
    try:
        for p in posts:
            dest = out / p['preset'] / 'raw.png'
            if dest.exists() and not args.force:
                continue
            print(f"Capturing {p['preset']} ({p.get('screen_date', p['date'])})", flush=True)
            run('zsh', str(ROOT / 'design/load-meme.sh'), p['preset'], 'today', p.get('screen_date', p['date']))
            time.sleep(args.wait)
            run('xcrun', 'simctl', 'io', device, 'screenshot', str(dest))
    finally:
        for name, data in backup.items():
            target = folder / name
            if data is None:
                target.unlink(missing_ok=True)
            else:
                target.write_bytes(data)
        subprocess.run(['xcrun', 'simctl', 'terminate', device, 'app.semli.mobile'], capture_output=True)
        subprocess.run(['xcrun', 'simctl', 'launch', device, 'app.semli.mobile'], capture_output=True)
        signal.signal(signal.SIGTERM, previous)


def package(batch, out, video=False):
    from PIL import Image, ImageDraw, ImageFont
    cards = []
    queue = []
    thumbs = []
    font = ImageFont.truetype(str(ROOT / 'design/fonts/Geist[wght].ttf'), 20)
    for p in batch['posts']:
        name = p['preset']
        folder = out / name
        folder.mkdir(parents=True, exist_ok=True)
        caption = p['caption']
        (folder / 'caption.txt').write_text(caption + '\n')
        (folder / 'hook.txt').write_text(p['hook'] + '\n')
        raw = folder / 'raw.png'
        image_path = folder / 'tiktok.png'
        if raw.exists():
            fitter.fit(raw, False).save(image_path)
            fitter.fit(raw, True).save(folder / 'zones.png')
            image = Image.open(image_path)
            image.resize((270, 480)).save(folder / 'preview.jpg')
            thumb = Image.new('RGB', (300, 555), '#f4f2ec')
            thumb.paste(image.resize((270, 480)), (15, 0))
            draw = ImageDraw.Draw(thumb)
            draw.text((15, 490), p['date'] + ' ' + p['time'], fill='#252525', font=font)
            draw.text((15, 520), name.removeprefix('batch-'), fill='#252525', font=font)
            thumbs.append(thumb)
            if video:
                run('ffmpeg', '-loglevel', 'error', '-y', '-loop', '1', '-i', str(image_path), '-t', '8', '-r', '30', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(folder / 'silent-8s.mp4'))
        q = {**p, 'status': 'needs_human_review' if raw.exists() else 'needs_capture',
             'caption': caption, 'asset': str(image_path.relative_to(out)) if raw.exists() else None,
             'platforms': ['tiktok'], 'format': 'photo',
             'published_post_id': None}
        queue.append(q)
        media = f'<img loading="lazy" src="{name}/preview.jpg" alt="{html.escape(p["hook"], quote=True)}">' if raw.exists() else '<p>Screenshot pending</p>'
        hook_note = f'<p>Optional on-screen text: {html.escape(p["hook"])}</p>' if p['hook'] != caption else ''
        cards.append(f'<article><h2>{html.escape(p["date"])} · {p["time"]} ET</h2>{media}<h3>{html.escape(caption)}</h3>{hook_note}<p><code>{name}</code> · {q["status"]}</p><p><a href="{name}/tiktok.png">TikTok</a> · <a href="{name}/zones.png">Overlay check</a> · <a href="{name}/caption.txt">Caption</a></p></article>')
    (out / 'queue.json').write_text(json.dumps({'name': batch['name'], 'timezone': batch['timezone'], 'status': 'draft', 'posts': queue}, ensure_ascii=False, indent=2) + '\n')
    # Manual upload checklist, deliberately not advertised as any vendor's CSV import schema.
    fields = ['preset', 'scheduled_at', 'scheduled_at_utc', 'pillar', 'format', 'status', 'asset', 'caption']
    with (out / 'upload-checklist.csv').open('w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fields, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(queue)
    # Preserve observations between runs. One row per post AND platform AND observation age.
    metrics = out / 'metrics.csv'
    if not metrics.exists():
        with metrics.open('w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['preset','platform','age_hours','actual_published_at','format','duration_seconds','paid','views','likes','comments','saves','shares','average_watch_seconds','completion_percent','profile_visits','bio_clicks','notes'])
            for p in batch['posts']:
                for age in [48, 168]:
                    writer.writerow([p['preset'], 'tiktok', age] + [''] * 14)
    (out / 'review.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Semli TikTok content review</title><style>body{font:16px system-ui;max-width:1450px;margin:32px auto;padding:0 24px;background:#f4f2ec;color:#252525}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:24px}article{background:white;padding:20px;border-radius:12px}img{width:100%;max-width:270px;display:block;margin:auto}h2{font-size:18px}h3{font-size:20px}a{color:#254563}code{overflow-wrap:anywhere}</style><h1>Semli · November TikTok batch</h1><p>16 draft posts · America/New_York · Proposed times, nothing scheduled. Review the joke, screenshot, caption and overlay preview before uploading. Each post has one complete caption; optional on-screen text is saved separately. Images contain fictional schedules.</p><main>' + ''.join(cards) + '</main></html>')
    if thumbs:
        sheet = Image.new('RGB', (1200, ((len(thumbs) + 3) // 4) * 555), '#f4f2ec')
        for i, thumb in enumerate(thumbs):
            sheet.paste(thumb, ((i % 4) * 300, (i // 4) * 555))
        sheet.save(out / 'contact-sheet.jpg')
    print(f"Prepared {len(queue)} posts: {out / 'review.html'}", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--batch', type=Path, default=Path(__file__).parent / 'batches/2026-11.json')
    parser.add_argument('--out', type=Path)
    parser.add_argument('--capture', action='store_true')
    parser.add_argument('--only', nargs='+', help='Capture only these preset IDs')
    parser.add_argument('--force', action='store_true', help='Recapture existing raw screens')
    parser.add_argument('--wait', type=float, default=12, help='Seconds after each launch; increase for a cold Metro')
    parser.add_argument('--video', action='store_true', help='Also export silent 8s MP4s; use a separate format cohort')
    args = parser.parse_args()
    batch = load_batch(args.batch)
    if args.wait <= 0 or args.wait > 60:
        parser.error('--wait must be between 0 and 60 seconds')
    if args.only and set(args.only) - {p['preset'] for p in batch['posts']}:
        parser.error('--only contains unknown preset IDs')
    out = (args.out or Path(__file__).parent / 'out' / batch['name']).resolve()
    out.mkdir(parents=True, exist_ok=True)
    for p in batch['posts']:
        (out / p['preset']).mkdir(exist_ok=True)
    if args.capture:
        capture([p for p in batch['posts'] if not args.only or p['preset'] in args.only], out, args)
    package(batch, out, args.video)


if __name__ == '__main__':
    main()
