#!/usr/bin/env python3
"""Render and send today's two posts using Mac Messages.

Run with --dry-run to preview without touching Messages. The real run tracks
each outgoing item, so a retry does not intentionally resend completed items.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from datetime import date
from pathlib import Path

from daily import current_et_date, prepare
from render import HERE


RECIPIENT = HERE / ".recipient"
STATE = HERE / "state" / "delivery.json"
SCRIPT = HERE / "send.applescript"


def load_state() -> dict:
    if STATE.exists():
        return json.loads(STATE.read_text())
    return {}


def save_state(state: dict) -> None:
    STATE.parent.mkdir(parents=True, exist_ok=True)
    tmp = STATE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2) + "\n")
    tmp.replace(STATE)


def send(recipient: str, kind: str, value: str) -> None:
    subprocess.run(["osascript", str(SCRIPT), recipient, kind, value], check=True,
                   stdout=subprocess.DEVNULL)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--date", type=date.fromisoformat)
    args = parser.parse_args()
    if args.date and not args.dry_run:
        parser.error("--date is for dry runs only")
    day = args.date or current_et_date()
    folders = prepare(day)
    if args.dry_run:
        for folder in folders:
            print(f"{folder.name}: 5 images + caption ready at {folder}")
        return

    recipient = RECIPIENT.read_text().strip()
    if not (recipient.startswith("+1") and len(recipient) == 12 and recipient[1:].isdigit()):
        raise ValueError("Recipient file must contain one US phone number in +1 format")
    if os.environ.get("TZ") not in (None, "America/New_York"):
        raise ValueError("Unexpected timezone override")

    state = load_state()
    key = day.isoformat()
    completed = set(state.get(key, []))
    for folder in folders:
        name = "Next on the List" if folder.name == "general" else "Her Better Hours"
        caption = (folder / "caption.txt").read_text().strip()
        items = [(f"{folder.name}-intro", "text", f"{name}\nCaption: {caption}")]
        items += [(f"{folder.name}-{i:02d}", "file", str(folder / f"{i:02d}.jpg"))
                  for i in range(1, 6)]
        for item_key, kind, value in items:
            if item_key in completed:
                continue
            send(recipient, kind, value)
            completed.add(item_key)
            state[key] = sorted(completed)
            save_state(state)
    print(f"Sent today's two five-slide posts ({key})")


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"Daily faceless delivery failed: {exc}", file=sys.stderr)
        raise
