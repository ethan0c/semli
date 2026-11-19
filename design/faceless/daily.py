#!/usr/bin/env python3
"""Render one five-slide post for each faceless account on an Eastern date."""

from __future__ import annotations

import argparse
import json
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from ideas_v2 import GENERAL
from her_detail import HER
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
    ("design/faceless/photos/pexels-8085261.jpg", "https://www.pexels.com/photo/woman-in-black-shirt-reading-a-book-8085261/"),
    ("design/faceless/photos/pexels-7594142.jpg", "https://www.pexels.com/photo/unrecognizable-student-with-laptop-studying-in-library-7594142/"),
    ("design/faceless/photos/pexels-6001390.jpg", "https://www.pexels.com/photo/faceless-female-journalist-writing-in-notebook-and-drinking-coffee-6001390/"),
    ("design/faceless/photos/pexels-4126732.jpg", "https://www.pexels.com/photo/anonymous-young-woman-sitting-on-floor-and-using-laptop-placed-on-armchair-4126732/"),
    ("design/faceless/photos/pexels-26093502.jpg", "https://www.pexels.com/photo/hands-of-a-woman-writing-in-a-note-pad-in-front-of-a-laptop-26093502/"),
    ("design/faceless/photos/pexels-8085259.jpg", "https://www.pexels.com/photo/a-woman-writing-on-a-notebook-8085259/"),
    ("design/faceless/photos/pexels-4916548.jpg", "https://www.pexels.com/photo/unrecognizable-female-sitting-in-cafe-with-coffee-4916548/"),
    ("design/faceless/photos/pexels-6392972.jpg", "https://www.pexels.com/photo/faceless-ethnic-female-freelancer-using-netbook-near-notepad-at-table-6392972/"),
    ("design/faceless/photos/pexels-6347906.jpg", "https://www.pexels.com/photo/unrecognizable-ethnic-woman-taking-notes-in-notebook-near-laptop-6347906/"),
    ("design/faceless/photos/pexels-4050302.jpg", "https://www.pexels.com/photo/faceless-lady-with-notebook-and-laptop-on-floor-at-home-4050302/"),
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
    idea = ideas[index]
    photo_pool = GENERAL_PHOTOS if account == "general" else HER_PHOTOS
    photo_start = (index * 2 + cycle) % len(photo_pool)
    photos = [photo_pool[(photo_start + offset) % len(photo_pool)] for offset in range(5)]
    if account == "general":
        slides = [
            {"text": line, "photo": photo, "source": source}
            for line, (photo, source) in zip(idea, photos)
        ]
        caption = f"{idea[0]} {TAGS[account]}"
    else:
        slides = [{"text": idea["hook"], "photo": photos[0][0], "source": photos[0][1]}]
        slides += [
            {**step, "photo": photo, "source": source}
            for step, (photo, source) in zip(idea["steps"], photos[1:])
        ]
        caption = f"{idea['hook']} #studyhabits #productivity #studytok"
    return {
        "account": account,
        "style": "plain" if account == "general" else "her_detail",
        "idea_number": index + 1,
        "cycle": cycle + 1,
        "caption": caption,
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
