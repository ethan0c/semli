#!/usr/bin/env python3
"""Photo-post slideshows for TikTok and Instagram: 1080x1920 slides, Geist on paper, one idea a
slide, the app's screen inside the site's iPhone frame where a slide shows it. Post them as a
photo post (swipeable), never as a video slideshow; one sound across the set; the caption and
first comment for each set land in out/<set>/caption.txt.

    python3 design/slides/slides.py            # every set, into design/slides/out/<set>/NN.png
    python3 design/slides/slides.py overlap    # one set

Text stays out of the bottom 250 px (TikTok's caption bar) and the right 130 px (its buttons).
`~words~` in a title is the one lavender phrase, the way render-screenshots.py marks it. The
screens are design/screenshots/raw/<name>.png; the syllabus page is drawn here as a prop.
Needs Pillow.
"""
from __future__ import annotations

import sys
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent.parent
FONTS = ROOT / 'apps/mobile/assets/fonts'
RAW = ROOT / 'design/screenshots/raw'
FRAME = ROOT / 'apps/web/public/phones/iphone-frame.png'      # 944 x 1902
MASK = ROOT / 'apps/web/public/phones/iphone-screen-mask.png'  # 850 x 1814 at (47, 44)
OUT = Path(__file__).resolve().parent / 'out'

W, H = 1080, 1920
PAPER, INK, INK2, ACCENT = (250, 249, 246), (34, 35, 32), (104, 105, 99), (112, 87, 189)
MARGIN, RIGHT_GUARD, BOTTOM_GUARD = 72, 130, 250
TEXT_W = W - MARGIN - RIGHT_GUARD


@dataclass(frozen=True)
class Slide:
    title: str
    body: str = ''
    screen: str | None = None   # a raw capture name, shown in the phone under the words
    prop: str | None = None     # 'syllabus': the drawn PDF page
    end: bool = False           # the closing card


@dataclass(frozen=True)
class Deck:
    name: str
    caption: str
    first_comment: str
    slides: list[Slide] = field(default_factory=list)


END = Slide('semli.app', 'Free on iPhone. Link in bio.', end=True)

DECKS = [
    Deck('overlap',
         'The shift that lands on your lab. Semli flags it before you save anything. #nursingstudent #collegestudent #workingstudent #studytok',
         'Semli reads your syllabus and your shift screenshot onto one calendar and marks overlaps in red. The calendar, to-dos and reminders are free; Plus adds unlimited imports. Link in bio.',
         [
             Slide('A shift that lands on your lab. You find out ~the day of~, unless something checks first.'),
             Slide('Work is in one app. Classes are in another.', 'Nothing compares them, so you do, from memory.'),
             Slide('Put both on one week. An overlap turns red before you save anything.', screen='today'),
             Slide('Then you can swap the shift a week early, while a swap is still possible.', screen='plan'),
             END,
         ]),
    Deck('syllabus',
         'Nine dates in one PDF, and where they end up. #syllabus #collegestudent #nursingschool #studytok',
         'Semli reads the syllabus, lists every date it found so you can check them, and adds them in one tap. The calendar, to-dos and reminders are free; Plus adds unlimited imports. Link in bio.',
         [
             Slide('A syllabus has ~nine dates~ in it. Here’s where they end up.', prop='syllabus'),
             Slide('Drop the PDF in. Every exam, quiz and due date is listed, so you can check them before adding.', screen='review-syllabus'),
             Slide('One tap, and the whole term is on your calendar next to your shifts.', screen='plan'),
             END,
         ]),
    Deck('five-things',
         'Five things to know before your first semester working and in school. #workingstudent #collegetips #nursingstudent #studytok',
         'Number 1 is what we built Semli for: shifts and classes on one calendar, with overlaps marked. The calendar, to-dos and reminders are free; Plus adds unlimited imports. Link in bio.',
         [
             Slide('5 things to know before your first semester ~working and in school~.'),
             Slide('1. Put your shifts and your classes on the same calendar.', 'The overlap you can’t see is the one that gets you.', screen='plan'),
             Slide('2. Read the syllabus properly in week one.', 'Every exam date for the term is already in it. Get them out of the PDF and onto your calendar.'),
             Slide('3. Your manager’s schedule screenshot is a calendar.', 'Add it the day it arrives, not the night before the shift.'),
             Slide('4. Set reminders for the evening before.', 'That leaves time to actually do the thing.'),
             Slide('5. Pick one place and check it every morning.', 'Before Canvas, before the group chat.', screen='today'),
             END,
         ]),
    Deck('four-apps',
         'Four apps for students who also work. One of them is ours. #studentapps #workingstudent #collegestudent #studytok',
         'Semli is the second one. It reads syllabi and shift screenshots onto one calendar and marks overlaps. The calendar, to-dos and reminders are free; Plus adds unlimited imports. Link in bio.',
         [
             Slide('4 apps for students who ~also work~. One of them is ours.'),
             Slide('Quizlet', 'Flashcards on the bus and between shifts.'),
             Slide('Semli', 'Your syllabus and your shift screenshot, read onto one calendar. Overlaps turn red.', screen='plan'),
             Slide('GoodNotes', 'Lecture notes on the iPad that you can search in finals week.'),
             Slide('Forest', 'A timer that keeps you off your phone while you study.'),
             END,
         ]),
]


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONTS / f'Geist-{name}.ttf'), size)


def tokens(text: str) -> list[tuple[str, bool]]:
    """Words with whether each sits inside the ~accent~ phrase."""
    out: list[tuple[str, bool]] = []
    for i, part in enumerate(text.split('~')):
        accent = i % 2 == 1
        for w in part.split():
            # Punctuation right after the phrase stays on its last word: "~the day of~," → "of,"
            if out and not any(ch.isalnum() for ch in w) and not part.startswith(' '):
                out[-1] = (out[-1][0] + w, out[-1][1])
            else:
                out.append((w, accent))
    return out


def draw_words(d: ImageDraw.ImageDraw, x: int, y: int, text: str, f: ImageFont.FreeTypeFont, width: int, lead: int, color=INK) -> int:
    """Wraps and draws, the accent words in lavender. Returns the y after the last line."""
    space = d.textlength(' ', font=f)
    line: list[tuple[str, bool]] = []
    lines: list[list[tuple[str, bool]]] = []
    used = 0.0
    for word, accent in tokens(text):
        w = d.textlength(word, font=f)
        if line and used + space + w > width:
            lines.append(line)
            line, used = [], 0.0
        used += (space if line else 0) + w
        line.append((word, accent))
    if line:
        lines.append(line)
    for words in lines:
        cx = float(x)
        for word, accent in words:
            d.text((cx, y), word, font=f, fill=ACCENT if accent else color)
            cx += d.textlength(word, font=f) + space
        y += lead
    return y


def phone(screen: Image.Image, width: int) -> Image.Image:
    """The capture inside the site's iPhone frame, at `width`, with a soft shadow."""
    frame = Image.open(FRAME).convert('RGBA')
    scale = width / frame.width
    frame = frame.resize((width, round(frame.height * scale)), Image.LANCZOS)
    sw, sh = round(850 * scale), round(1814 * scale)
    mask = Image.open(MASK).getchannel('A').resize((sw, sh), Image.LANCZOS)
    shot = screen.convert('RGB').resize((sw, sh), Image.LANCZOS)
    out = Image.new('RGBA', frame.size, (0, 0, 0, 0))
    out.paste(shot, (round(47 * scale), round(44 * scale)), mask)
    out.alpha_composite(frame)
    pad = 60
    shadow = Image.new('RGBA', (out.width + 2 * pad, out.height + 2 * pad), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((pad, pad + 24, pad + out.width, pad + out.height), radius=round(140 * scale), fill=(34, 35, 32, 70))
    shadow = shadow.filter(ImageFilter.GaussianBlur(28))
    shadow.alpha_composite(out, (pad, pad))
    return shadow


def syllabus_page() -> Image.Image:
    """A page of a course syllabus, the schedule table, as a PDF would print it."""
    pw, ph = 900, 1160
    page = Image.new('RGB', (pw, ph), (255, 255, 255))
    d = ImageDraw.Draw(page)
    serif = lambda s, w='Regular': ImageFont.truetype(str(FONTS / f'Newsreader-{w}.ttf'), s)  # noqa: E731
    d.text((70, 60), 'NURS 210 · Pharmacology I', font=serif(34), fill=(20, 20, 20))
    d.text((70, 104), 'Fall 2026 · Dr. Okafor · Nursing 204 · Tue/Thu 10:30–11:45', font=serif(22), fill=(90, 90, 90))
    d.text((70, 170), 'Course schedule', font=serif(28), fill=(20, 20, 20))
    d.line((70, 212, pw - 70, 212), fill=(40, 40, 40), width=2)
    rows = [
        ('Week 1', 'Oct 20', 'Introduction; pharmacokinetics'),
        ('Week 2', 'Oct 27', 'Drug card set 1 due, 11:59 pm'),
        ('Week 3', 'Nov 3', 'Exam 1 (Units 1–3), in class'),
        ('', 'Nov 5', 'Dosage calculation quiz'),
        ('Week 4', 'Nov 10', 'Drug card set 2 due, 11:59 pm'),
        ('Week 5', 'Nov 17', 'Care plan 1: cardiac medications, due Sunday'),
        ('Week 6', 'Nov 24', 'Exam 2 (Units 4–6), in class'),
        ('Week 7', 'Dec 1', 'Drug card set 3 due, 11:59 pm'),
        ('Week 8', 'Dec 8', 'Care plan 2: antibiotics, due Sunday'),
        ('Finals', 'Dec 17', 'Cumulative final, 8:00–10:00 am'),
    ]
    y = 232
    for week, date, what in rows:
        d.text((70, y), week, font=serif(22), fill=(90, 90, 90))
        d.text((200, y), date, font=serif(22, 'Regular'), fill=(20, 20, 20))
        d.text((320, y), what, font=serif(22), fill=(20, 20, 20))
        y += 44
        d.line((70, y - 8, pw - 70, y - 8), fill=(225, 225, 225), width=1)
    d.text((70, y + 30), 'Late work loses 10% per day. Exams are in class unless announced otherwise.', font=serif(20), fill=(90, 90, 90))
    d.text((70, ph - 60), '3', font=serif(20), fill=(140, 140, 140))
    return page


def prop_card(prop: str) -> Image.Image:
    page = syllabus_page() if prop == 'syllabus' else None
    assert page is not None, prop
    page = page.rotate(-2.5, resample=Image.BICUBIC, expand=True, fillcolor=PAPER)
    pad = 60
    card = Image.new('RGBA', (page.width + 2 * pad, page.height + 2 * pad), (0, 0, 0, 0))
    sd = ImageDraw.Draw(card)
    sd.rectangle((pad + 6, pad + 22, pad + page.width - 6, pad + page.height), fill=(34, 35, 32, 60))
    card = card.filter(ImageFilter.GaussianBlur(22))
    card.paste(page, (pad, pad))
    return card


def render(slide: Slide, n: int, total: int) -> Image.Image:
    img = Image.new('RGBA', (W, H), PAPER + (255,))
    d = ImageDraw.Draw(img)
    if slide.end:
        tf, sf = font('Light', 104), font('Regular', 40)
        tw = d.textlength(slide.title, font=tf)
        d.text(((W - tw) / 2, H / 2 - 110), slide.title, font=tf, fill=INK)
        sw = d.textlength(slide.body, font=sf)
        d.text(((W - sw) / 2, H / 2 + 20), slide.body, font=sf, fill=INK2)
        return img
    d.text((MARGIN, 96), f'{n}/{total}', font=font('Regular', 34), fill=INK2)
    visual = bool(slide.screen or slide.prop)
    size, lead = (76, 88) if visual else (92, 106)
    top = 180
    if not visual:
        # Words alone sit a little above the middle of the frame, clear of the caption bar.
        probe = ImageDraw.Draw(Image.new('RGB', (W, H)))
        h = draw_words(probe, 0, 0, slide.title, font('Medium', size), TEXT_W, lead)
        if slide.body:
            h = draw_words(probe, 0, h + 28, slide.body, font('Regular', 44), TEXT_W, 56)
        top = max(180, ((H - BOTTOM_GUARD) - h) // 2 - 60)
    y = draw_words(d, MARGIN, top, slide.title, font('Medium', size), TEXT_W, lead)
    if slide.body:
        y = draw_words(d, MARGIN, y + 28, slide.body, font('Regular', 44), TEXT_W, 56, INK2)
    if slide.screen:
        ph = phone(Image.open(RAW / f'{slide.screen}.png'), 760)
        img.alpha_composite(ph, ((W - ph.width) // 2, max(y + 40, 640)))
    elif slide.prop:
        card = prop_card(slide.prop)
        img.alpha_composite(card, ((W - card.width) // 2, max(y + 40, 620)))
    return img


def main() -> None:
    only = set(sys.argv[1:])
    for deck in DECKS:
        if only and deck.name not in only:
            continue
        folder = OUT / deck.name
        folder.mkdir(parents=True, exist_ok=True)
        for old in folder.glob('*.png'):
            old.unlink()
        for i, slide in enumerate(deck.slides, 1):
            render(slide, i, len(deck.slides)).convert('RGB').save(folder / f'{i:02d}.png')
        (folder / 'caption.txt').write_text(f'Caption:\n{deck.caption}\n\nFirst comment:\n{deck.first_comment}\n')
        print(f'wrote {folder} ({len(deck.slides)} slides)')


if __name__ == '__main__':
    main()
