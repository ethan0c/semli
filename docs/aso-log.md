# App Store listing log

Every change to keywords, promotional text, title or subtitle, so a change can be judged after it has had three to four weeks to settle. Weekly What's New text isn't logged here; git history has it. The process is in `.claude/skills/store-notes/SKILL.md`, and the listing itself is `apps/mobile/store.config.json`.

| Date | Version | Locales | Field | Before | After | Why |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-10-23 | 1.1.0 | all | promoText | ended "Free to start" | "Turn your syllabus and work schedules into one plan…" | Guideline 2.3.7 rejection; copy audit |
| 2026-10-27 | 1.1.3 | all | promoText | "Turn your syllabus and work schedules into one plan…" | en-US "Registered for spring? Add your classes now. Import a syllabus, a schedule screenshot, or your Canvas or Brightspace calendar…"; en-GB "New term coming up?…"; en-AU "Planning next semester?…"; en-CA "Registered for winter term?…" | Seasonal: spring registration is open at most US schools (Nov 2 to 23); Brightspace support is new in 1.1.3. Revert to an evergreen line after Jan 20, when add/drop closes |
