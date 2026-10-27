# Semli — Positioning, pricing, platforms

Status: decided Oct 19, 2026 · Sources: the Jan–Mar 2026 student survey (66 responses, `docs/Student Survey (Responses) - dayli.pdf`) and competitor pricing checked Oct 2026.

## 1. Positioning

**Semli is the daily planner for college students.** Drop in a syllabus, a work schedule, or a text, and Semli tells you what matters today.

Why "daily planner" and not "life organizer" or "AI assistant":
- Students already search for "planner". Nobody searches for "life organizer".
- The survey's top pain is not storage, it's focus: 68% said their problem is *seeing too many tasks at once* and/or *not knowing what actually matters today*. A daily view that ranks the day is the product. The capture magic (screenshots, syllabi) is how it gets filled without effort.
- "For college students" is a real niche with real channels (campus orgs, nursing cohorts, TikTok study content). We can widen later.

One-liner for the store: *The daily planner that reads your syllabus so you don't have to.*

## 2. What the survey says (n = 66)

| Question | Result | What it means for Semli |
|---|---|---|
| Missed or almost missed an assignment because it got buried | **83%** yes (42% multiple times) | The core promise, "never miss one", is a felt problem |
| What's harder | 42% both · 32% too many tasks at once · 26% not knowing what matters today | Today screen must rank, not list |
| Classes use Canvas | **71%** Canvas; 15% a mix; 14% other LMS | Canvas sync is the #1 integration after launch |
| Assignments posted outside Canvas | **73%** at least occasionally (syllabus PDFs, Google Docs, textbook sites, email) | Why one feed matters; syllabus + screenshot import covers the gaps Canvas can't |
| Device for schoolwork | **65% laptop** · 24% both · 11% phone | Web is not optional (see §4) |
| Want phone reminders | **65% "yes, definitely"** · 26% sometimes · 9% no | Reminders stay free; they're retention |
| Weekly study hours | 30% 0–5 · 33% 5–10 · 21% 10–20 · 15% 20+ | Heaviest users (nursing, engineering) are the beta targets |
| Would pay if it reduced stress and prevented misses | **26% yes · 53% maybe · 21% no** | 79% are open; "maybe" converts with a free trial, not a pitch |
| What feels reasonable | **47% $1–5/mo** · 27% $5–10/mo · 20% nothing · 5% yearly · 2% $10–15 | Price inside $1–5 per month *as perceived*; annual billing makes $29.99 feel like $2.50 |
| Who answered | 33% sophomores, 33% juniors, 21% freshmen, 12% seniors; 18% nursing | Go after sophomores/juniors; nursing is over-represented and high-hours |

Caveats: convenience sample from one campus network, self-reported willingness to pay (treat 26% "yes" as the ceiling, not a forecast).

## 3. Competitors and their prices (checked Oct 2026)

| App | Free tier | Paid | Notes |
|---|---|---|---|
| Structured | Yes | $6.99/mo · **$29.99/yr** · $99.99 lifetime | The closest look-alike; no AI import. [source](https://habitbox.app/blog/structured-app-review), [pricing post](https://structured.app/blog/new-pricing) |
| MyStudyLife+ | Yes (ads, task limits) | $6.99/mo · **$39.99/yr** | The incumbent student planner. [App Store](https://apps.apple.com/us/app/my-study-life-school-planner/id910639339), [media page](https://mystudylife.com/media/) |
| Shovel | 7-day trial only | ~$9.79/mo · ~$35/yr | Study-time planner; sources conflict. [comparison](https://www.coursicle.com/blog/shovel-vs-coursicle/), [guide](https://dormway.app/blog/best-ai-study-planner-apps-2026) |
| Todoist Pro | Yes | $7/mo · $60/yr | General to-do app. [overview](https://cal.com/blog/planner-apps-for-students) |
| Motion | No | $19/mo annual, $29 monthly, 25% student discount | AI scheduling for professionals; too expensive for this market. [overview](https://mystudylife.com/best-ai-school-planner-apps-for-students-in-2026-free-paid/) |
| Notion | Free Plus for students | — | The "I'll build my own planner" alternative |
| Saturn | Free | Premium exists, price not published | High-school/college social calendar. [App Store](https://apppricinglab.com/app/apple/1454483188) |

Takeaway: the student planner market has settled at **$30–40 per year**, with monthly at $5–7. Nobody in this tier does AI import from screenshots and syllabi. That is the thing to charge for.

## 4. Platforms: iOS + web, no Android

- **iOS**: the phone is where reminders land and where schedule screenshots already live. Primary app.
- **Web**: required by the survey (89% use a laptop at least equally). But not a second codebase. The Expo app already runs on the web (`npx expo start --web`), same screens, same code. The Next.js site stays small: landing page, try-it, API, checkout.
- **Android**: dropped. Not in the plan, not in `app.json`. Revisit only if campus demand is loud.

## 5. Pricing (recommended)

### Free
Calendar, tasks, Today, reminders, repeating classes, manual add, voice capture, the first Canvas pull, and **5 AI imports in the first 30 days, then 3 a month** (text, voice, screenshot, or PDF). Five loads a semester's syllabi so the first wall lands in week three or four, after a full week of the planner working, not on syllabus four in week one; three a month afterwards is what one weekly work schedule uses up. Decided Oct 21, 2026. Enough to feel it work; not enough to run a semester. Never meter the basics: Structured's single loudest complaint (Oct 2026 reviews) is recurring events locked behind Pro. Say "always free" in the listing.

### Semli Plus
| Plan | Student | Regular | Student effective | Why |
|---|---|---|---|---|
| Monthly | **$4.99** | $7.99 | $4.99/mo | Sits at the top of the "$1–5" band; under Structured and MyStudyLife monthly |
| Semester | **$14.99** / 6 months | $24.99 | $2.50/mo | A semester plus the break; the lower upfront price |
| **Yearly** | **$24.99** | $44.99 | $2.08/mo | The best per-month price and the preselected plan since Oct 21, 2026 (was $29.99 / $49.99, which tied with 6 months; see [conversion.md](conversion.md)) |

**Store note (Oct 19, 2026):** Apple has no 4-month auto-renewing term, so the Semester plan is sold as a 6-month subscription at the same price (a semester plus the break; a year is exactly two). **Oct 21:** "Semester" is the plan's name only; every price line in the app and on the site states the term as 6 months ("$14.99 / 6 months", "then $14.99 every 6 months"), because App Review 3.1.2 requires the length of the subscription to be stated plainly and "per semester" is not a length. Product setup: [revenuecat-offerings-brief.md](revenuecat-offerings-brief.md).

Student pricing is on the honor system. The toggle in onboarding says so plainly: we don't check IDs or .edu emails, we trust you, switch it off when you graduate. The regular price exists so the student price reads as a real discount (~40%) and so non-students (parents, grads, shift workers) have a way to pay.

Plus includes unlimited AI imports, work-schedule update comparisons, suggested times for overlapping plans, and urgent items with ringing alarms (decided Oct 20, 2026; standard reminders stay free). Voice capture on Add is free, like typing; adding by Siri will be Plus when it ships (decided Oct 21, 2026, `voice-capture.md`). Syllabi count toward the three free monthly imports; Plus removes that limit. Canvas sync is still planned.

### Access audit (Oct 19, 2026)

| Feature | Access and enforcement |
|---|---|
| Calendar, Today, Plan, courses, to-dos, repeating events, reminders, manual edits, export and Undo | Free; no subscription check |
| Text, voice, screenshot, camera and PDF imports, including syllabi | Five successful reads in the 30 days after the first one, then three per UTC month (`lib/plans.ts`). Add and onboarding share `usePlusAccess`; imports beyond the allowance require the active RevenueCat `semli_plus` entitlement. Failed/empty reads do not count. Cancelling review still counts a successful read. |
| Updating an existing work schedule | Review shows a preview; committing a comparison requires Plus. A first schedule or a new week without existing shifts uses the normal import allowance. Manual shift edits remain free. Cancelling the paywall preserves the pending review. |
| Overlap detection and named warnings | Free on both events, including the detail graph and agenda. |
| Suggested rescheduling | Plus; active entitlement checked again before applying. Fixed times stay fixed by default. A suggestion moves only the selected occurrence and is undoable. |
| Urgent items and ringing alarms | Plus. A free first urgent item was considered Oct 21, 2026 and deferred: the alarm sync refuses to schedule without an active entitlement (`alarms.ts`), so a freebie needs a per-item exception in code that has not yet run on a device. Revisit after the first device pass. | The Urgent switch in Create and item details asks for Plus before turning on; turning off is free. Alarm sync schedules nothing without an active entitlement and leaves existing alarms alone until the store has answered, so a lapse cancels alarms and a restore brings them back. Standard reminders are free. |
| Canvas sync | Connecting and the first pull are free (`settings/canvas.tsx`); Sync now and the automatic resync require Plus (`canvas-sync.ts`). The first pull is the onboarding import for the 71% on Canvas; staying in sync when a professor moves a date is the daily reason to pay. |

The subscription source of truth is RevenueCat's active entitlement, including an active store trial; saved trial dates and plan preferences grant no access. Store errors do not unlock paid actions. Existing entitlement tests cover inactive/wrong entitlements, cancellation, and restores.

**Server enforcement (corrected Oct 21, 2026):** the extract route authenticates every app request with its Supabase session (guests get a silent anonymous one), checks Plus against RevenueCat with the secret key on the server, and counts free imports in `import_usage` through `claim_import` (migration `20261021120000`: five in the thirty days after the account appeared, then three a month, the same numbers as `lib/plans.ts`). The website demo is limited per hashed IP. The phone's own counter is a courtesy. **What remains:** an anonymous identity is free to mint, so a reinstall (or anyone scripting `signInAnonymously`) starts a fresh allowance; Supabase's anonymous sign-in rate limit per IP is the only brake. App Attest or a device-bound id would close it; worth it only if the AI bill says so.

Rescheduling currently uses local scheduling rules, not an LLM: try the same day first, then the following six days, 8 am–10 pm, original duration, at least 15 minutes between bookings, no past/ongoing event moves. Study sessions stay before the next known deadline in the same course. Days with unknown event times are skipped. Study and workout plans default flexible; work, classes, exams, appointments and unknown event types default fixed. The person can change an event's flexibility, but deadlines/exams remain protected. A calendar slot does not establish other attendees' availability.

Rules:
- First import is free and *before* sign-up. The paywall appears after the first confirmed import, when the value is visible.
- 7-day free trial on every plan (converts the 53% "maybe").
- Sell yearly and semester plans through **web checkout** (allowed in the US since the 2025 Epic ruling) to avoid Apple's 15–30%. Keep monthly available in-app for impulse buys.
- Show "$2.50/month, billed yearly" style framing everywhere; the survey anchor is monthly.

### Unit economics
Claude Opus 5.5 in fast mode since Oct 27, 2026, at $8 / $40 per million tokens (twice standard; `docs/import-speed.md`):
- Text message import ≈ $0.02–0.04 (a 16-item request like "cardio before and after work" ≈ $0.10)
- Schedule screenshot ≈ $0.04–0.08
- 10-page syllabus PDF ≈ $0.16–0.30

A heavy Plus user (5 syllabi + 16 weekly schedule screenshots + 40 text adds per semester) costs roughly **$3 per semester** in AI. Against $14.99 per semester that is a ~80% gross margin; free users' 3–5 imports a month cost a few cents. The Oct 27 benchmark (`evals/RESULTS.md`) settles the cheaper routes: Sonnet 5.5 and Haiku 5.5 match Opus on typed messages and screenshots but miss items in syllabi (91–92% against 97%). If cost ever matters more than wait, `EXTRACT_FAST=0` halves it, or Sonnet 5.5 can take typed messages and screenshots while Opus keeps PDFs.

### What 1,000 paying students looks like
- All yearly on web: ~$29k/yr net of fees (~3%)
- All semester plans (2 per year): ~$28k/yr net on web, ~$21k if through Apple
- Realistic mix at 5% free-to-paid conversion needs ~20,000 free users. Campus-by-campus growth, nursing cohorts first.

## 6. Revenue checklist (in order)
1. Prove extraction on real screenshots and syllabi (the product promise).
2. Free-import-then-paywall flow in the app, with RevenueCat or StoreKit for in-app, Stripe on web.
3. Landing page: "the daily planner for college students" + try-it + student annual price.
4. Launch with 2–3 campus groups (nursing programs first), weekly interviews.
5. Canvas sync as the first paid-only feature after launch (71% of classes are on Canvas).
