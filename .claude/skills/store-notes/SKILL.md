---
name: store-notes
description: Draft the App Store text for the next store build (What's New in every English locale, and promotional text when there's a reason to change it), from what reached the app since the last release, then check it against the listing rules. Use before an EAS store build or submit, or when asked for release notes, What's New, promo text, or the weekly listing update. Also runs the keyword review every 3 to 4 weeks once rank data exists.
---

# Store notes

`apps/mobile/store.config.json` is the source of truth for the listing: four English storefronts (en-US, en-GB, en-AU, en-CA), pushed with `eas metadata:push`. The rules come from `docs/app-store-connect.md` and `docs/copy-audit-2026-10-23.md`; `npm run store:check` enforces the ones a script can check.

## Every store build: What's New

1. Run `npm run store:changes`. It lists commits since the last release tag (`v1.2.3`, skipping `-ota` tags) that touch the app, with their files.
2. Decide what a person would notice. Commit subjects here are often vague ("Refactor time pickers…"), so read the diff (`git show <hash> -- <file>`) whenever the subject doesn't say what changed on screen. Leave out anything dev-only (`lib/dev.ts`, check scripts), internal refactors, and tests.
3. Write en-US `releaseNotes`:
   - What changed for the person, in their words: "Tap a time once to change it" rather than "InlinePicker component".
   - Most noticeable change first. One to four short sentences, or short lines; well under 500 characters. Plain text only, since Apple shows no formatting.
   - Sentence case. No all caps, no exclamation marks, no emoji, no "we're excited".
   - No prices, "free" or trials (guideline 2.3.7, the Oct 23, 2026 rejection). No "#1" or "best".
   - Say "fixes" only for a fix someone could have hit, and name it: "The morning summary now leads with today, not a later deadline." Never "bug fixes and performance improvements" when there is something real to say.
   - Plus features get "With Plus" beside them, as in the description.
4. Adapt it to each other locale; don't just copy it. Use each storefront's words, as the existing descriptions do:
   - en-GB: lectures, timetable, module handbook, rota, honour.
   - en-AU: lectures, timetable, unit outline, roster, honour.
   - en-CA: classes, syllabus or course outline, honour.
5. If `store:check` warns that the version is already released, bump `expo.version` in `apps/mobile/app.json` and `apple.version` in `store.config.json` together. Patch for fixes, minor for new features. Ask the person which if it's unclear.
6. Run `npm run store:check` and fix every error. Warnings are judgment calls; mention any you leave.
7. Show the person the new notes for every locale. Don't commit, push metadata, or run `eas` without asking.

## Promotional text: only with a reason

It doesn't affect search, and it can change any time without a build. Leave it alone unless there's a timely reason: registration season, finals, the start of a term, a new feature worth the top line. Then propose one version, 170 characters at most, in each locale's words. Log any change you ship (see below).

## Every 3 to 4 weeks: keyword review

Only when the person brings data: ranks and popularity from their free ASO tool (APPlyzer or ASOMobile, signed up at public release), and search impressions from App Store Connect → Analytics. Without data, say so and don't change keywords. A guess costs a build cycle of ranking.

- Check `docs/aso-log.md` for when each keyword was last changed. Leave any change younger than three weeks to settle.
- Drop keywords that rank nowhere after a full cycle, or have tiny popularity. Prefer terms where Semli could reach the top 10.
- Keywords are single words, comma-separated, no spaces, no plurals or words already in the title or subtitle (Apple matches those), 100 characters at most per locale.
- The keyword field only changes with a new build, so a keyword change rides on the next store build's version.
- Never change the title or subtitle as part of this. Raise it as a separate suggestion.
- Log every keyword change, with the data that justified it.

## The log

`docs/aso-log.md` records every listing change that could move search or conversion: keywords, promotional text, title and subtitle. It doesn't record weekly release notes, which git history already holds. Without the log, nobody can tell three weeks later whether a change helped. Add a row with the date, version, locales, field, before and after, and why (the data, or the seasonal reason).
