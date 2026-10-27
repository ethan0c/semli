# Editing: dates, times and repeats

Status: decided and built Oct 27, 2026, in three steps (core and data, #37; the item screen, #38; the Repeat screen and Create). Replaces the compact pickers and the shorten-only "until" on the item screen.

## 1. What was wrong

- Date and time opened Apple's compact picker, which needs a second tap before anything happens, so the first tap felt dead.
- Every scroll of a wheel saved and made an undo step and a reminder update.
- A repeating class could only be cut short: not extended, not moved to other days, not stopped; a one-off could not be made to repeat.
- Any edit on a repeating class changed one occurrence; moving a lecture from 9 to 10 meant fourteen edits.
- A Canvas sync put an edited date back.

## 2. The rules

**Every fact is a row; tapping it edits it in place.** The picker opens already showing the calendar (date) or the wheels (time): one tap. Changes are kept in a draft and saved once, on Done or when leaving, as one undo step.

**Times.** Changing the start moves the end with it, keeping the length; changing the end alone changes the length. An end before the start is "ends next day" for shifts and amber for anything else. "No time" removes the time. Moving into the past is allowed; the item becomes overdue, which is the truth. A move that creates an overlap shows the overlap at once.

**Repeats.** A series is its occurrences (ordinary items sharing a `seriesId`) plus one stored rule (`SeriesRule`: weekdays, every N weeks or every day, until, skipped dates, start, end). Series made before rules existed get one read off their occurrences the first time it is needed. The Repeat screen (`/repeat/[id]`, pushed from the repeat row, which reads "Doesn't repeat" on a one-off) edits the rule with a live preview (count and four weeks of dots) and says what the change comes to before it is saved (adds, removes and how many of those have notes, how many hand-moved stay); the end date defaults to the end of term and is capped at a year. The day of the occurrence being edited always stays in the rule, so the thing on screen is never one the rule removes. Create has the same editor under a Repeats row; the rest of the series is a second batch after the first item. Tasks can repeat too.

**Scope on a repeating item**, asked inline, never as a pop-up: "This one" or "Every one from now". Time and repeat default to every one from now; date defaults to this one. "From now" means from the occurrence being edited; earlier ones keep what they had. `rebuildSeries` in core applies a rule from a date onward and never touches the past, done occurrences, or occurrences the person moved by hand (`editedAt`); those still hold their date, so nothing lands on top of them, and the result says how many were left alone. Deleting one occurrence adds its date to the rule's skips. Breaks in the term calendar (`settings.breaks`) are skipped. Turning repeat off keeps this one and asks before removing the rest. Every change is one undoable batch.

**Sources.** A hand-edited item (`editedAt`) is never moved by a Canvas sync; the sync stores what Canvas says in `feed`, and the item offers "Use Canvas's date". A new work-schedule screenshot still goes through the review, which shows changes before anything is saved.

**Clock times are local strings** ("09:00"), so a class stays at 9 across daylight-saving changes; a test locks this in.

## 3. Edge cases, decided

| Case | Decision |
|---|---|
| Changing the days drops dates with notes | Warn with the count before applying; undo remains |
| Editing from the middle of a series | From this occurrence onward; the repeat row shows the current time |
| Every 2 weeks | Counted from the week of the occurrence being edited |
| End before start, or a year away | Blocked; capped at a year; the default stays the end of term |
| Repeating tasks ("discussion post every Friday") | Allowed, same rule |
| A hand-moved occurrence, then "every one from now" | Left alone, counted in the result ("1 you moved stays") |
| Reminders and alarms | Rebuilt from the items, so they follow every edit; checked on a device |
| Web | The browser's own date and time inputs stand in for the wheels |
| Accidental wheel scroll | One row open at a time, only when tapped |

## 4. Data

`Item.editedAt`, `Item.feed`, `SeriesRule` in `packages/schema`; `series` in the store, persisted on the phone. Rules are not yet in the account backup: a second device reads them off the occurrences, which loses only skipped dates and the every-N-weeks choice until the rule is edited there. Adding `series` to the live sync is a follow-up.
