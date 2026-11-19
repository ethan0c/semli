#!/usr/bin/env python3
"""Render one five-slide post for each faceless account on an Eastern date."""

from __future__ import annotations

import argparse
import json
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from ideas_v2 import GENERAL, HER
from render import HERE, render_deck


START = date(2026, 11, 20)
GENERAL_PHOTOS = [
    ("apps/mobile/assets/showcase/demo.jpg", "https://unsplash.com/photos/HNjWq8WPyoY"),
    ("apps/web/public/photos/table.jpg", "https://unsplash.com/photos/omeaHbEFlN4"),
    ("apps/web/public/photos/library.jpg", "https://unsplash.com/photos/PjpRF0LhBB8"),
    ("apps/web/public/photos/campus.jpg", "https://unsplash.com/photos/MUiv880yORo"),
    ("design/faceless/photos/pexels-4050302.jpg", "https://www.pexels.com/photo/faceless-lady-with-notebook-and-laptop-on-floor-at-home-4050302/"),
    ("design/faceless/photos/pexels-6392972.jpg", "https://www.pexels.com/photo/faceless-ethnic-female-freelancer-using-netbook-near-notepad-at-table-6392972/"),
    ("design/faceless/photos/pexels-6347906.jpg", "https://www.pexels.com/photo/unrecognizable-ethnic-woman-taking-notes-in-notebook-near-laptop-6347906/"),
]
HER_PHOTOS = [
    ("design/faceless/photos/pexels-19153042.jpg", "https://www.pexels.com/photo/woman-with-a-large-white-ribbonlooking-in-the-mirror-and-fixing-her-hair-19153042/"),
    ("design/faceless/photos/pexels-5591659.jpg", "https://www.pexels.com/photo/crop-woman-with-breakfast-in-bed-5591659/"),
    ("design/faceless/photos/pexels-6001390.jpg", "https://www.pexels.com/photo/faceless-female-journalist-writing-in-notebook-and-drinking-coffee-6001390/"),
    ("design/faceless/photos/pexels-4126732.jpg", "https://www.pexels.com/photo/anonymous-young-woman-sitting-on-floor-and-using-laptop-placed-on-armchair-4126732/"),
    ("design/faceless/photos/pexels-5591723.jpg", "https://www.pexels.com/photo/crop-woman-with-book-and-breakfast-5591723/"),
    ("design/faceless/photos/pexels-4916548.jpg", "https://www.pexels.com/photo/unrecognizable-female-sitting-in-cafe-with-coffee-4916548/"),
    ("design/faceless/photos/pexels-6874189.jpg", "https://www.pexels.com/photo/crop-faceless-woman-resting-on-bed-and-drinking-coffee-6874189/"),
]
TAGS = {
    "general": "#productivity #dailyroutine #gettingthingsdone",
    "her": "#productivity #habits #thatgirl",
}


def current_et_date() -> date:
    return datetime.now(ZoneInfo("America/New_York")).date()


def make_deck(account: str, ideas: list[tuple[str, ...]], day: date) -> dict:
    day_number = (day - START).days
    if day_number < 0:
        raise ValueError(f"The daily queue starts {START}")
    index = day_number % len(ideas)
    cycle = day_number // len(ideas)
    lines = ideas[index]
    photo_pool = GENERAL_PHOTOS if account == "general" else HER_PHOTOS
    photo_start = (index * 2 + cycle) % len(photo_pool)
    photos = [photo_pool[(photo_start + offset) % len(photo_pool)] for offset in range(5)]
    slides = [
        {"text": line, "photo": photo, "source": source}
        for line, (photo, source) in zip(lines, photos)
    ]
    return {
        "account": account,
        "style": "plain" if account == "general" else "her",
        "idea_number": index + 1,
        "cycle": cycle + 1,
        "caption": f"{lines[0]} {TAGS[account]}",
        "slides": slides,
    }


def prepare(day: date) -> list[Path]:
    decks = [make_deck("general", GENERAL, day), make_deck("her", HER, day)]
    output = HERE / "out" / day.isoformat()
    for deck in decks:
        folder = output / deck["account"]
        render_deck(deck, folder)
        (folder / "post.json").write_text(json.dumps({
            "date": day.isoformat(),
            "account": deck["account"],
            "idea_number": deck["idea_number"],
            "cycle": deck["cycle"],
        }, indent=2) + "\n")
    return [output / deck["account"] for deck in decks]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--date", type=date.fromisoformat, default=current_et_date())
    args = parser.parse_args()
    for folder in prepare(args.date):
        print(folder)


if __name__ == "__main__":
    main()
