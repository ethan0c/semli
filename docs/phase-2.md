# Phase 2: what comes after the first release

Status: Oct 20, 2026, audited against `main` through PR #12. Phase 1 is the app as it stands: the launch hand-off, the clear flows, the firsts, What Semli can do, voice capture, the free-tier allowance, term-end estimates, markdown notes, the role-seeded Today view, and the pieces that were on this list and are now built: Supabase accounts (email, Google, Apple, emailed codes, deletion, backup and restore, RevenueCat identity), the server-side import quota (`supabase/migrations/20261020000000_import_quota.sql`, `apps/web/lib/import-access.ts`), the trial timeline and its reminder (`components/PlanPicker.tsx`, `lib/reminder-plan.ts`) and the ratings prompt (`lib/store-review.ts`). Most of it has not run on a device yet.

This doc is the list to pick from once the beta is in hands. Each item says what it is, why it earns a place (the survey, the benchmarks, or a gap the code already has), how big it is, what it waits on, and what number tells you it worked. Items are grouped by what they do for the business, and ordered inside each group by evidence, not by how fun they are to build.

## Dates

Decided Oct 21, 2026. Phase 2 starts **Monday, Nov 16, 2026**: the beta opens the week of Nov 3 (`milestones.md`), the device pass (§0) takes that first week, and two weeks of beta data are what several items below wait on. It ships in two releases, each tied to a date the business already has.

| Release | Build window | Ships | What goes in |
|---|---|---|---|
| **2a** | Nov 16 to **Dec 18, 2026** (code freeze; App Review over the holidays, finals keep testers quiet) | With the public release, **Jan 5, 2027** | Only the hours-to-days items that wait on nothing: quarter vs semester (the review-sheet prompt), semester-over prompt, overdue auto-collapse, sample week removal, resume a closed review, extraction fills notes (with an eval run). Store work, not code: the en-GB, en-AU and en-CA listings and screenshots (`localization.md` step 2), since public launch opens every territory. |
| **2b** | Jan 18 to **Jul 31, 2027** | By **Aug 9, 2027**, ahead of the Aug 15 to Sep 10 fall push | The big items: other LMS feeds (Moodle and Blackboard first, ordered by the `lms` answers per country), widgets, share sheet, share links and referral, web checkout, Siri, first urgent free. Whether a Tier B translation (Germany or the Netherlands) joins 2b depends on how the English listings convert in the UK and Australia (`localization.md` step 3). |

**Releases 1.2 and 1.3 (founder, Oct 27, 2026).** Split by who each one is for.
- **1.2, the launch build** (code freeze Dec 18, release Jan 5, before the Jan 11 campus cards): the web planner shipped alongside; reading the iPhone's calendar (about a week; a native module, so it makes this build or waits for the next store build; students with jobs keep shifts in Google or Outlook); a real eLC feed checked on a device before the UGA handout; device-pass fixes; the store description naming Brightspace (already in `store.config.json`).
- **1.3, for people leaving school** (by mid-April, ahead of May graduation): the Work tab, onboarding that fits working adults (one flow that branches on the plate answer), and "done with school". Sized by February's numbers: installs that chose a job and no classes, still active on day 30. JavaScript only, so it can ship as an update once 1.2 is live.
- **Out:** Apple Watch. Widgets and a Live Activity, which watchOS shows in the Smart Stack, cover the glance.
- Positioning stays "for college students"; graduates and working adults are kept, not courted. If working adults show up in numbers, an App Store custom product page gives them their own screenshots and text under the same app.

If the Nov 3 beta slips, the Jan 5 release date holds and 2a shrinks; dates do not move to fit features. Re-plan 2b in late January with the first month of public numbers.

Sources: `pricing-and-positioning.md` (the survey, n = 66), `onboarding-research.md` (the benchmarks), `strategy.md` (competitor reviews), `todo.md` (the code's own gaps), `voice-capture.md`.

## 0. Before any of this: one gate

| Gate | Why it comes first |
|---|---|
| **A device pass of Phase 1.** Cold launch in both appearances and with Reduce Motion; Erase plan as a guest, and Sign out and Delete account signed in; the four firsts; What Semli can do; voice (needs a development build, not an OTA update); the allowance copy in You; a syllabus with no end date; sign-in with each provider and a restore on a second phone; a free import over the allowance refused by the server, not the phone. | Twelve merged changes and the account and quota backend with no device run. Every Phase 2 item below builds on them. Deploying the quota (migrations, `REVENUECAT_SECRET_KEY`) is in `launch-checklist.md`. |

## 1. Revenue

| Item | What | Why | Size | Waits on | Metric |
|---|---|---|---|---|---|
| **Web checkout for semester and yearly** | Stripe on the site for the two plans people should buy; monthly stays in-app. | Avoids 15–30% on the plans that carry the revenue; allowed in the US since the Epic ruling. | A week | Accounts in production (the code is built) | Share of paid revenue net of store fees. |
| **First urgent item free** | One urgent item rings without Plus; the second asks. | 83% have missed an assignment; the alarm is the emotional hook. Considered Oct 21 and deferred: `alarms.ts` refuses to schedule without an entitlement, so it needs a per-item exception in AlarmKit code that has not run on a device. | Days | The device pass confirms alarms ring for Plus | Paywall shown with reason `urgent` → trial start. |
| **Siri: "Hey Siri, add to Semli…"** (Plus) | An App Intent that takes a sentence, runs the same text extraction, opens the review sheet. | Hands-free is the version of voice people use when walking out of a lecture. Decided Plus-only Oct 21 (`voice-capture.md` §8). | Two weeks (native: an App Intent through a config plugin or a small Expo module) | Voice capture used on a device; `voice_started` is healthy | Imports with kind `siri` per Plus user. |
| **Hard-paywall test on a slice** | A true paywall after the first import for 10–20% of new installs, retention as the tie-breaker. | RevenueCat: 10.7% vs 2.1% paid by day 35. Freemium was chosen for ASO and reputation; the cost is real and should be measured, not assumed. | Days to build, a semester to read | ~1,000 installs | Paid by day 35 and day-30 retention, slice vs control. |

## 2. Retention

| Item | What | Why | Size | Waits on | Metric |
|---|---|---|---|---|---|
| **Extraction fills notes** | Add `notes` to the extraction schema and prompt; a syllabus's "bring a lab coat", "chapters 4–6" land in the item's notes. | Notes render like a markdown file now (PR #9), but imports never fill them. A server change that affects every import, so it ships with the eval set green. | Days + an eval run | Nothing | Share of imported items with notes; review commit rate unchanged. |
| **Course notes** | A notes page per course, same renderer, stored on the course. | "Like an md file" (founder, Oct 21). Mostly a storage question once item notes exist. | Days | Nothing | Courses with notes after week 2. |
| **Other LMS feeds** (2b) | Blackboard, Brightspace and Moodle also publish iCal feeds; Moodle and Blackboard are also the UK and Ireland's LMS (`localization.md`). Same sync, a different link page. | 71% Canvas; the rest is 29% of students with nothing to connect. The onboarding `lms` answer says which to build first. | Days each | A real Canvas feed verified on a device | `lms` answer → connected rate, per platform. |
| **Quarter vs semester** (2a) | The setting and the quarter calendar exist (You → Region, `typicalTermEnd(start, region, system)`, Oct 21). What is left: an "On quarters?" link on the review sheet's term-end row for US and Canadian students, which switches the setting and redoes the guess in place. No onboarding step. | A quarter school gets the wrong default, visibly, and nobody opens You to fix it. | Hours | Seeing a quarter-school tester | "Until when?" pill accepted vs picked. |
| **Semester-over prompt, and "done with school"** | When a term ends and no syllabus arrives within a few weeks of the next one, Today asks once: "New term, or done with school?" New term opens the syllabus import and offers to remove the old courses ("Fall 2026 is over · Remove 4 courses?"). Done switches the role to Working, swaps School for the Work tab, and says once that the regular price applies at the next renewal (honest, not policed: Apple cannot move a subscriber between products, and student pricing is the honor system). Never a yearly "are you still a student?" check. | In `todo.md`. Dead courses otherwise carry into spring, and a graduate who keeps a student planner deletes it. Retention past graduation, not acquisition. Decided Oct 22. | Hours | The Work tab, for the switch | Courses removed in a term's first week; "done" answers that are still active 60 days later. |
| **Overdue auto-collapse** | The "Still open" pile folds after 14 days. | In `todo.md`. A long pile is the thing that makes a planner feel like a debt. | Hours | Nothing | Day-14 retention of people with ≥5 overdue. |
| **Firsts, reviewed** | Read `first_note {kind, action}` and `can_do {item}`: which notes get "See it" vs "Got it", which rows get tapped. Rewrite or remove the ones nobody opens; add the toast line ("Added 4 things. One overlaps your shift.") if the overlap note is scrolled past. | The firsts replaced a tour on the bet that in-place beats a walkthrough. Data decides. | Hours | Two weeks of beta data | Opened / shown per kind. |

## 3. Capture (the product promise)

| Item | What | Why | Size | Waits on | Metric |
|---|---|---|---|---|---|
| **Share sheet into Add** | A share extension: a screenshot, a PDF, a message or a note shared from any app opens Semli's Add with it attached. | Removes the copy-paste step for the 73% whose assignments arrive outside Canvas. Listed in `todo.md`. | A week (native extension) | Nothing | Imports from the share sheet per user. |
| **Undated schedule screenshots** | When a shift screenshot has weekday names but no dates, the model should anchor to the coming week and the review should say "Assumed next week · change" with a one-tap week picker. | Raised Oct 21. Today undated shifts land in Plan's needs-a-date state one at a time. A prompt change plus a review affordance. | Days + an eval run | Nothing | Undated items per schedule import; review commit rate. |
| **Streaming "Found so far"** | Rows appear in the Reading state as the model streams, instead of all at once at the end. | In `todo.md`. The Heard rows already set the rhythm; this is the real version of it. | Days (server streaming + the skeleton) | Nothing | Time-to-first-row; cancel rate during reading. |
| **Heard rows, tuned** | Expand the cue table from real transcripts: phrases that were missed, am/pm guesses that were wrong. | The parser is rules; rules improve from examples. | Hours per pass | Voice on a device | Heard rows per voice import; corrections in review. |
| **Resume a closed review** | "Finish reviewing Campus Café · 7 shifts" on Add. | In `todo.md`. A closed review is a lost import today. | Hours | Nothing | Resumed reviews. |
| **Sample week removal** | On the first real import, remove the sample with a toast. | In `todo.md`. | Hours | Nothing | Sample rows alive after first import → 0. |

## 4. Sharing and growth

| Item | What | Why | Size | Waits on | Metric |
|---|---|---|---|---|---|
| **Schedule share links** (built Oct 28, 2026 for 1.2: table `schedule_shares`, `lib/shares.ts`, `semli.app/s/<token>`; the next two weeks, rolling, school and work only, the phone sends the projection on every change; ends when stopped, in a week or at the end of the term; the page switches between a list and the two weeks by the hour, list first; needs `supabase db push` for both migrations) | A named, private, read-only link a parent or friend opens in a browser: owner and date range in the message preview, titles hideable, school/work only, revocable, "updated 2 h ago". | `share-schedule.tsx` is built behind `SHARING_ENABLED = false`; the screen says links are coming. Every shared link is marketing; this stays free (`pricing-and-positioning.md`). | A week (a public route on the site, a token table, the allowlisted payload that already exists) | Accounts in production | Links created per user; installs from link views. |
| **Referral on the share link** | The viewer's page ends with "Plan your week like this" → the store. | Free distribution on a surface that already exists. | Hours | Share links | Installs attributed to links. |

## 5. Widgets

The widget is the planner on the home screen: the one big number without opening the app. All of it runs on local data, so none of it waits on the backend. One piece of plumbing serves every row: a WidgetKit extension target added through a config plugin (the way `src/native` already carries AlarmKit), the app writing a small snapshot of the next 48 hours to an App Group container on every store change, and `WidgetCenter.reloadAllTimelines()` after each write. Timeline entries are precomputed for each commitment boundary so the widget stays right without the app running. Same design rules as the app: Geist (bundled into the extension), Light for the number, sentence case, color only as meaning, no logo, no tinted tiles.

| Item | What | Why | Size | Waits on | Metric |
|---|---|---|---|---|---|
| **Today widget, small and medium** (free) | Small: the next commitment and its countdown ("Shift in 2 h 10 m"). Medium: the same, plus the next three rows of Today. Tapping opens the item; tapping empty space opens Today. | The one big number per screen, on the home screen. A daily glance is a daily return without a notification. Every serious planner ships one; its absence is visible in the first week. | A week (the target, the App Group snapshot, two layouts) | Nothing | Day-7 and day-30 retention of widget users vs not; share of installs with a widget placed. |
| **Lock Screen widgets** (free) | Circular: the countdown ring to the next thing. Rectangular: next item and time. Inline: "STAT 200 in 40 m" above the clock. | Seen on every phone pickup; costs almost nothing once the home-screen timeline exists. | Days, after the Today widget | Today widget | Placements per kind. |
| **Check off from the widget** (free) | A done button on to-do and deadline rows in the medium and large widgets, through an App Intent that writes the change to the shared container; the app merges it on next open, with the usual Undo in Your data. | Interactive widgets (iOS 17+) turn a glance into the action. Swipe-to-complete is already the main gesture in the app. | Days to a week (the intent, merging writes made while the app was closed) | Today widget | Completions from the widget per active user. |
| **Large widget: the day by the hour** (Plus) | The `HourView` as a widget: today's blocks, the now line, overlaps outlined. | The hour view is what working students set as their Today (PR #12); a widget makes it permanent. A visible Plus perk that costs no AI spend. | Days, after the Today widget | Today widget | Plus conversions with reason `widget`; placements among Plus users. |
| **Live Activity for what's happening now** (free) | On the Lock Screen and in the Dynamic Island: a class or shift in progress with time left, or an urgent deadline in its last hour. Started by the app from local data, ended by the activity's own end date; no push server. | The countdown where people already look during a shift. Pairs with ringing alarms for urgent items. | A week (ActivityKit, Dynamic Island layouts, start/end rules so it never nags) | Today widget; the device pass of alarms | Activities started vs dismissed early. |
| **Control Center and Action button** (free) | An iOS 18 control that opens Add with the mic on, also assignable to the Action button. | Capture in one press from anywhere, before Siri ships. Reuses the voice path that exists. | Days | Voice verified on a device | Imports started from the control. |
| **StandBy** | The small widget in StandBy's night-mode-aware layout. | Free once the small widget exists; dorm desks charge phones on their side. | Hours | Today widget | — |

Not planned: a widget per course or per employer (a list of widgets is a settings screen), and Android widgets (no Android release).

## 6. Platform

| Item | What | Why | Size | Waits on | Metric |
|---|---|---|---|---|---|
| **Web planner** (built Oct 22, 2026; [web.md](web.md)) | The Expo app on the web with the same screens, behind an account. | 65% do schoolwork on a laptop. The site has try-it and pricing only. Not a second codebase. | Two weeks (web layout, keyboard, no native modules) | Accounts in production; backup becomes sync; a web build of the router | Weekly active on web among account holders. |
| **Read the iPhone's calendar** (built Oct 28, 2026 for 1.2: `lib/phone-calendar.ts`, You → iPhone calendar, a link on onboarding's own-import step; phone only, never saved or synced, founder's call; device test pending) | One permission through Expo's calendar module (`expo-calendar`, not installed yet) reads every account the person added to the iPhone: Outlook, Exchange, Google, iCloud. Chosen calendars show in Today and Plan, read-only, and count for overlaps. Offered in onboarding (for Working, it replaces the own-import step: "Bring your schedule · a screenshot, a PDF, or your calendar"; for students, a row beside Canvas) and in You. For everyone, not only non-students: students with jobs keep shifts and meetings there too. | No separate Outlook or Google integration is needed; iOS already aggregates them. The overlap warnings get much better when they can see the rest of someone's week. Decided Oct 22. | A week, plus a new build (native module) | The device pass | Calendars connected per install; overlap notes involving a calendar event. |
| **A Work tab for Working** | Not a new tab: the same tab slot and route as School, relabelled and with a work icon for the "Working" role, showing employers in place of courses, hours this week and next (the existing week chart) in place of the term map, and schedules still to add. The tab bar stays the same size for everyone. Students and students with a job keep School; their job shows through Plan and the employer pages. | Today a working person sees empty courses and a term map. Employer pages already exist; this gathers them. Keeps graduates, rather than courting a second market: positioning stays "for college students" (decided Oct 22). | Days | Nothing | Working-role users active on day 30, before and after. |
| **Two-way calendar sync** | Semli items written out to the iPhone calendar, on top of the read above. | The beta copy already apologises for its absence. Big: conflicts, duplicates, which side wins. | Weeks | Reading the calendar, shipped and used; a clear rule for ownership | Users with sync on; overlap notes that involve a calendar event. |
| **Android** | Not planned. Revisit only if campus demand is loud (`pricing-and-positioning.md` §4). Ringing alarms would need their own native implementation. | — | — | — | — |
| **iPad** | Not planned for 1.x (`supportsTablet: false`). | — | — | — | — |

## 7. Polish carried from Phase 1

From `todo.md` and `design-system.md`, still true:

- Moments need a calendar of breaks and finals, and licensed photos.
- Scrubbing the day bar to change the countdown; a haptic on the week-chart day tap; the hour view fading in on first open.
- "Block time to study" on an empty Plan day.
- Shared format helpers into `lib/format.ts`; one `FieldPill`; the compact 18/26 type token.
- The pill-to-native-picker second tap; the series end picker's missing min/max.
- Large text and VoiceOver pass over every screen added since Oct 19, swipe actions as accessibility actions.
- The design-system page's "what Semli would add" line and the beta copy's "no two-way sync yet" updated as the items above land.

## 8. Suggested order

Within the releases in **Dates** above: 2a is the device pass plus the small items it lists; the order below is for 2b.

1. The device pass (§0).
2. Today widget and Lock Screen widgets. No backend, daily return, and the first thing a new user looks for after setup.
3. Web checkout and share links, now that accounts are built.
4. Extraction notes and undated screenshots, with an eval run each.
5. Share sheet; check off from the widget; the Live Activity.
5a. Read the iPhone's calendar; then the Work tab and "done with school", if `onboarding_completed.role` shows enough Working users still active on day 30.
6. First urgent free; Siri; the Control Center control.
7. The hard-paywall slice, once there are a thousand installs to split.

Re-read §2 "Firsts, reviewed" two weeks into the beta and prune this list with the numbers, not the ideas.
