# TikTok Sunday content batch

The November starter batch has 16 original fictional schedules, Nov 2–29, 2026: four posts a week. Read [the research](../../docs/tiktok-research-2026-11.md) and [the plan](../../docs/tiktok-plan.md) for the reasoning. This workflow is TikTok-only. Instagram is deferred for separate research and planning. All times use `America/New_York`.

Open [the review gallery](out/2026-11/review.html) or [the contact sheet](out/2026-11/contact-sheet.jpg). The user confirmed on Nov 1 that November’s TikToks are scheduled. These local files preserve the proposed copy and dates; actual scheduler entries have not been read back. Use them for reference and metrics rather than scheduling a duplicate batch. Nothing in these scripts posts to a social account.

## Prepare or refresh

```sh
# Captions, proposed queue, checklist and gallery. No simulator needed.
python3 design/social/batch.py

# Capture missing raw screenshots from the existing development build.
# Boot an iPhone simulator and connect the app to Metro on 8081 first.
python3 design/social/batch.py --capture

# Also produce silent 8-second videos if the scheduler needs video.
python3 design/social/batch.py --video

# Redo one screenshot after changing its joke; wait longer for a cold Metro.
python3 design/social/batch.py --capture --only batch-email --force --wait 25

# Pick a specific booted device if more than one simulator is running.
SIMULATOR_ID=<device-uuid> python3 design/social/batch.py --capture

# A later batch uses the same pipeline.
python3 design/social/batch.py --batch design/social/batches/next-batch.json
```

Requires Python 3.9+, Pillow, and Apple's simulator tools for capture. `--video` also requires FFmpeg. These dependencies were already available for the first export. Use `--out <folder>` to put generated files somewhere else. The capture restores the development command, clock and meme-backup files even if interrupted normally. It does not erase simulator data. Force-killing a process cannot run its cleanup; keep the simulator out of personal use during a batch and inspect it afterward.

If the dev-client launcher, onboarding, an account prompt, or Metro error appears, resolve it before capture. A screenshot command can succeed while capturing the wrong screen. Check the gallery after every run; recapture affected presets with `--force`. The script intentionally does not claim that a captured image has passed review.

## What gets exported

| File | Use |
|---|---|
| `<preset>/raw.png` | Real, unframed app screenshot; fictional sample records |
| `<preset>/tiktok.png` | 1080×1920, status bar removed, full app fitted clear of estimated UI zones |
| `<preset>/zones.png` | Same image with approximate TikTok overlay areas; preview only |
| `<preset>/silent-8s.mp4` | Optional 1080×1920 video fallback; no sound or performance claim |
| `<preset>/caption.txt` | Complete post caption; copy this file |
| `<preset>/hook.txt` | Optional native text in the platform composer |
| `review.html` | Local review gallery with dates, captions and asset links |
| `contact-sheet.jpg` | All captured TikTok frames together |
| `queue.json` | Proposed dates with Eastern and UTC timestamps, filenames and draft status |
| `upload-checklist.csv` | Manual checklist; **not** a vendor-specific bulk import format |
| `metrics.csv` | Blank TikTok observations at 48 hours and seven days; preserved on rerun |

The TikTok masks estimate UI coverage; actual caption length, app version and device change it. Check the destination preview. The small gallery images are browsing thumbnails; judge readability in the full-size files and on a phone.

Each caption stands on its own. The generator exports it once, without appending a second explanation or automatic hashtags. You can also add the optional hook with the platform's own text tools. Let the screenshot carry the rest of the joke. No rendered slide decks, generated people, or claims that a fictional schedule belongs to a real student.

## Add or change jokes

1. Add a uniquely named `batch-*` entry to `apps/mobile/src/lib/meme-presets.json`. Use five or six short rows so the joke fits without scrolling. Each row has `title`, `start`, optional `end`, optional `category` (`school`/`work`/`personal`), and optional `kind: "task"` for a deadline.
2. Add its ID, date, time, pillar, hook and caption to the batch manifest. `screen_date` can differ from the posting date for a clearly labeled look-ahead, such as Friday's agenda posted Wednesday.
3. Run the generator, then capture and inspect the new entry. A repeat in another month belongs in a separate manifest. One preset ID is allowed once per batch.

The original three presets still work:

```sh
zsh design/load-meme.sh --list
zsh design/load-meme.sh batch-group today 2026-11-13
zsh design/load-meme.sh comeback tomorrow
zsh design/load-meme.sh off

python3 design/slides/fit-tiktok.py --out /private/tmp/semli-fit screenshot.png
```

## Each Sunday

1. Log older post results. Leave unavailable metrics blank and record the observation age if it differs from the template. Put account-wide bio clicks in notes unless the platform actually attributes them to a post.
2. Check current trends, then select next week's four. Recheck the joke, actual dates, full-size image, caption and any sound. Keep later drafts replaceable.
3. Upload the TikTok file. Use one consistent format during the timing pilot. If using the silent MP4 fallback, update the recorded format and duration.
4. Set the proposed date/time from the queue, choose permitted audio and required brand disclosure, and verify the account handle. Confirm the entries in the scheduler afterward and save the scheduler IDs separately. The generator does not preserve manual edits to generated `queue.json`; edit the source manifest instead. It does preserve `metrics.csv`.

Post Bridge can handle scheduling once Semli's profiles are connected. Its current connected profiles are for another business. A successful export is not a successful upload or a scheduled post. If using native TikTok, inspect the account's actual scheduling horizon and photo support; public guides disagree between ten and thirty days. A seven-day rolling queue works within either horizon, with the rest prepared here.

The generator never changes its draft status to approved or scheduled. Human selection and the scheduler's read-back are the evidence for those steps.

The earlier Instagram images and metrics template are saved in [the archive](archive/instagram-2026-11). They are outside the active queue and are not a validated Instagram strategy.
