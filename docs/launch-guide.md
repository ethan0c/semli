# Launch guide: Apple, RevenueCat keys, screenshots, SEO, marketing

Status: Oct 19, 2026. Everything here is for the person running the launch; none of it is code. App record: **Semli: AI Student Planner**, Apple ID `6824600264`, bundle id `app.semli.mobile`, EAS project `629299e1-…`, RevenueCat project `a2c96d90`. Prices and plans: [pricing-and-positioning.md](pricing-and-positioning.md). Product config for Rico: [revenuecat-offerings-brief.md](revenuecat-offerings-brief.md).

---

## Part 1. Apple, end to end

### 1.1 Accounts and agreements (one-time, 1–3 days of waiting)
1. **Apple Developer Program**, $99/year, at developer.apple.com. Enroll as an individual unless you already have an LLC; you can transfer the app to a company later.
2. **App Store Connect → Business (Agreements, Tax, and Banking)**: accept the *Paid Apps* agreement, fill in tax forms (W-9 for US) and a bank account. Until this is done, subscription products stay "Missing Metadata" and sandbox purchases fail. This is the step people forget; do it first.
3. **App Store Connect → Users and Access**: add Rico as *App Manager* if he sets up products. Nobody else needs Admin.

### 1.2 The identifier
- developer.apple.com → Certificates, Identifiers & Profiles → **Identifiers** → `app.semli.mobile` must exist with capabilities **In-App Purchase** (on by default) and **Push Notifications** off (reminders are local; we don't need push). If the App Store Connect record was created with a different bundle id, change it there now (possible until the first build is uploaded) or tell me and I'll change `app.json`.

### 1.3 Build with EAS (no Xcode signing by hand)
From `apps/mobile`:
```sh
npx eas-cli login                                  # your Expo account (owner: ethanlma)
npx eas-cli build --profile development --platform ios
```
First run: say yes to letting EAS create the distribution certificate and provisioning profile; sign in with your Apple ID when asked (app-specific password if 2FA asks). Register your iPhone's UDID when prompted (EAS gives a link to open on the phone). Install the build from the QR/link, then run `npm run dev:mobile` here and open the app: this is the build that can run reminders, purchases, and the native pickers.

For TestFlight:
```sh
npx eas-cli build --profile production --platform ios
npx eas-cli submit --platform ios --latest        # uses ascAppId 6824600264 from eas.json
```
`eas submit` will ask for an **App Store Connect API key** the first time (see 1.7); it can also use your Apple ID password, but the key is less fragile.

### 1.4 App Store Connect record, field by field
The current, complete version is [app-store-connect.md](app-store-connect.md); this section is kept for history.
**App Information**
- Name: `Semli: AI Student Planner` (30 max; you have 25).
- Subtitle: `Syllabus, shifts & deadlines` (28). "AI" and "planner" are already in the name; the subtitle carries the other searchable words.
- Primary category **Productivity**, secondary **Education**.
- Content rights: no third-party content. Age rating: answer all "None" → 4+.
- Privacy Policy URL `https://semli.app/privacy`. Support URL `https://semli.app/contact`.

**Pricing and Availability**: Free app. All territories, or US only for the beta (simpler for tax).

**App Privacy** (the "nutrition label"). Declare, all as *Data Not Linked to You*:
- Purchases → Purchase History (RevenueCat) — App Functionality.
- Usage Data → Product Interaction (PostHog) — Analytics.
- Diagnostics → Crash Data, Performance Data (Sentry) — App Functionality.
- User Content → Photos or Videos, Other User Content (screenshots and PDFs sent for extraction; not stored) — App Functionality. Say they are not used for tracking.
- Identifiers → Device ID (RevenueCat anonymous id, PostHog) — Analytics, not tracking.
- Do **not** check "Tracking". We don't track across apps.

**Export compliance**: the app uses only HTTPS, which is exempt. I've added `ITSAppUsesNonExemptEncryption = false` to `app.json` so Apple stops asking on every build.

**In-App Purchases / Subscriptions**: the six subscriptions in one group "Semli Plus" per the brief, each with a Free 1-week introductory offer, localized name and description, and a review screenshot (any screenshot of the paywall works). Add the **App Store Promotion** image later if you want them featured.

**App Store Server Notifications** (App Information → App Store Server Notifications): paste the Production and Sandbox URLs that RevenueCat shows under the app's settings (version 2). This is how RevenueCat learns about renewals and cancellations.

### 1.5 TestFlight
- **Internal testers** (up to 100 App Store Connect users, no review): you, Rico, a couple of friends. Builds appear within minutes.
- **External testers:** two separate groups and invite links. "Survey" uses `https://testflight.apple.com/join/vG3RD6EJ`, capped at 60 for the 58 survey respondents; use it only in survey emails. "Beta" uses `https://testflight.apple.com/join/j15Rp5m4`, capped at 200 for public recruiting through `semli.app/beta`, posts, and QR codes. The first external build goes through *Beta App Review* and must be available to both groups before their invites can be used.
- What to Test notes (shown in TestFlight): "Add a syllabus or a screenshot of your work schedule, then check Today. Reminders and the 7-day trial are real; sandbox purchases don't charge you."
- TestFlight builds use the **sandbox** store: testers see a sandbox sign-in when buying. Tell them it is normal.

### 1.6 App Review (for the public release, later)
- Review notes: "No account needed. Tap 'Try a sample' on the import step in onboarding to see a populated app. To test import, send the text: 'I work Fri 4-10, exam Monday at 9.' Subscriptions use StoreKit via RevenueCat; the 7-day trial is configured on each product."
- Common rejections to pre-empt: subscription terms must be visible on the paywall before purchase (they are: price, period, auto-renew, cancel, Terms and Privacy links); "Restore purchases" must exist (it does); the privacy policy must mention the AI provider (make sure `/privacy` names Anthropic as a processor of uploaded content).

### 1.7 Keys: which .p8 is which
There are two different App Store Connect keys. Both download **once** as a `.p8` file; store them in a password manager.

| Key | Where to make it | Who uses it | Notes |
|---|---|---|---|
| **In-App Purchase key** | App Store Connect → Users and Access → **Integrations** → *In-App Purchase* → Generate | **RevenueCat** (StoreKit 2 verification) | Download `SubscriptionKey_XXXX.p8`. Note the **Key ID** and the **Issuer ID** shown on the page. In RevenueCat → Project → Apps → *Semli (App Store)* → "In-app purchase key configuration": upload the .p8, enter Issuer ID and Key ID. |
| **App Store Connect API key** (Team key) | App Store Connect → Users and Access → Integrations → *App Store Connect API* → Team Keys → Generate, role **App Manager** | **EAS Submit** (uploading builds) and optionally RevenueCat (to import products automatically) | Download `AuthKey_XXXX.p8`. `eas submit` asks for Key ID, Issuer ID, and the file path once and stores them in your EAS account. |
| **App-Specific Shared Secret** (not a .p8) | App Store Connect → the app → App Information → *App-Specific Shared Secret* → Generate | RevenueCat (legacy StoreKit 1 receipts; still recommended) | Paste into RevenueCat app settings. |

Then in RevenueCat → Project settings → **API keys**: copy the Apple **public** SDK key (`appl_…`) into `apps/mobile/.env` as `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`. Never commit `.env`; never use an `sk_` secret key in the app.

Sanity check: a sandbox purchase in the dev build shows up in RevenueCat → Customers within a minute, with the `semli_plus` entitlement active.

---

## Part 2. Screenshots

### 2.1 Apple's requirements (as of 2026)
- One set at **6.9-inch** (iPhone 16/17 Pro Max): **1320 × 2868 px** portrait. Apple scales it to every other iPhone size, so you only need this one set. (6.5-inch at 1284 × 2778 is optional.)
- No iPad set: the app is iPhone-only (`supportsTablet: false`).
- 3 to 10 images; the **first three** show in search results, so they carry the message.
- PNG or JPEG, no alpha, no status-bar fakery (Apple allows real status bars). Device frames and captions are allowed and expected.

### 2.2 The screenshots, in order
Raw capture name, caption on the image, and the subline. Since Oct 21, 2026 every shot shares one background, the morning sky from Today's header, and the caption is the site's h1 face (EB Garamond Regular, 156px, centered, ink) with one accent phrase in lavender EB Garamond Italic, under the wordmark and with no subline (after Origin's set); this replaces the Oct 20 Geist Bold set on mixed backgrounds. The sublines below stay in `SHOTS` for `--layout serif` and as alt copy, but are not drawn. Each capture is filled with the sample fortnight (You → Your data → Fill the next two weeks in a dev build, or the `spread` dev command). The first three carry the message in search results.

| # | Raw | Caption | Subline | How to capture |
|---|---|---|---|---|
| 1 | `today` | Classes, shifts, and deadlines | The next thing, the day as a bar, and your list under it. | `sample`, Today in list view |
| 2 | `review-syllabus` | Your syllabus, in your planner | Drop in a syllabus. Check the exams and due dates Semli finds. | `review-syllabus` |
| 3 | `review-update` | See what changed in your shifts | New, moved, and dropped shifts, before anything is saved. | `review-update` |
| 4 | `plan` | School and work, one calendar | Every class in its own color, overlaps in red, exams ringed. | `sample`, `semli://plan` (Oct 28, 2026: a capture by hand) |
| 5 | `share` | Share your week with a link | Anyone with the link sees your next two weeks in a browser. Stop it any time. | `share` (a signed-in person with two links, seeded; no account needed) |
| 6 | `spread` | Plan ahead for busy weeks | Semli finds the light days before each deadline. One tap to plan them. | `spread` on an empty plan (it loads its test fortnight only then), launched twice so the welcome cover is gone |
| 7 | `today-hours` | Catch overlaps in advance | A shift that lands on a class shows in red, days before it happens. | `hours` (Oct 28, 2026: by hand, scrolled to the shift over the study group) |
| 8 | `overlap-fix` | Then move it to a free time | The overlap is named, and Semli suggests a time that's clear on your calendar. | by hand: open the event that overlaps a shift (Oct 28, 2026) |
| 9 | `course` | Everything for one course | Lectures, office hours, the next exam, and the weeks left in the term. | `sample`, School → a course (Oct 28, 2026: by hand; `school` stays in `raw/` to swap back) |
| 10 | `canvas` | Bring in your class calendar | Import your class calendar. With Plus, Semli checks for updates when you open the app. | `sample`, `semli://settings/canvas` |

Render with `python3 design/render-screenshots.py` (all ten, sky and serif by default); a shot without its raw capture is skipped. No paywall shot: prices, trials and "free" are not allowed in store screenshots (guideline 2.3.7), and 1.0 was rejected for it on Oct 23, 2026. `raw/paywall.png` stays for the website only.

The captions live in `design/render-screenshots.py` (`SHOTS`). Listing text: [app-store-connect.md](app-store-connect.md). The earlier six-image set (`design/screenshots/out/`) and the foldable 2007 × 2853 set were removed Oct 21, 2026; Apple scales the 6.9-inch set.

### 2.3 How to produce them
`design/capture-screenshots.sh [names]` runs steps 1 to 3 for every shot (Oct 28, 2026); look at each capture afterwards, since the quirks below still apply. By hand:
1. On the booted **iPhone 17 Pro Max** simulator with the dev client and Metro running, write the dev files into the app's Documents folder (`C=$(xcrun simctl get_app_container booted app.semli.mobile data)`): `dev-clock.txt` holds `09:41`, or `2026-10-19 09:41` to also fix the day (Monday has the overlap, the due reading and the lecture); `dev-command.txt` holds `sample`, `hours`, `list`, `review`, `review-update`, `item`, `plus`, `moment` or `spread`. `list` and `hours` show Today's everyday header with the sky even when the sample week has a heavy-week moment; `spread` opens that moment with its list. Then relaunch: `xcrun simctl terminate booted app.semli.mobile; xcrun simctl openurl booted "semli://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"` and wait 16–20 s.
2. Light mode, 9:41 status bar: `xcrun simctl status_bar booted override --time 9:41 --batteryLevel 100 --cellularBars 4`.
3. Open a screen by deep link (`xcrun simctl openurl booted semli://plan`, `semli://school`, `semli://add`, `semli://paywall`) and capture with `xcrun simctl io booted screenshot design/screenshots/raw/<name>.png` (1320 × 2868). Look at every capture: the first launch after an install opens Expo's dev menu (launch once more), the dev build often restores the previous screen on relaunch, a deep link right after launch can leave a grey overlay on the status bar, and switching the Today view on launch leaves a ghost of the old view (relaunch once more).
4. Compose: `python3 design/render-screenshots.py` (needs Pillow) writes `design/screenshots/NN-<name>.png` at 1320 × 2868 with the `quiet` layout: the morning sky, the wordmark, an EB Garamond Regular caption centered in ink with one accent phrase in lavender EB Garamond Italic (`~words~` in `SHOTS`, wrapped as a unit so a line never breaks inside it), no subline, and the site's iPhone frame (`apps/web/public/phones/`) at 1090 wide, starting at 780 and bleeding off the bottom edge. A light guard washes the caption band toward paper until ink and lavender clear 4.5:1. `--layout serif` is the earlier version with Geist sublines; `--bg` keeps the Oct 20 backgrounds for experiments. The 6.1"/6.3" slot (1206 × 2622) takes a plain downscale, kept in `design/screenshots/6.3-inch/`. Rerendered Oct 21, 2026 from fresh captures with the new headers.
5. Upload in order to the 6.9-inch slot; Apple scales it to every other iPhone unless a size-specific set is uploaded. Localize nothing for now (US English only).

### 2.4 Creative assets (iOS 27 product page)
Two optional images, uploaded under App Store Connect → Header and Search Results. `python3 design/render-screenshots.py --header` writes both to `design/screenshots/header/`:
- **Header**, 3840 × 1646 (21:9): the screenshots' morning sky, evenly washed toward paper, with the ink wordmark and the tagline ("Your week, already organized.", EB Garamond, "organized" in lavender italic) centered. It sits above the icon on the product page and is cropped to a centered 1646 × 661 safe area on small devices, so nothing else goes in it. Apple's own examples are brand banners with the name centered and no UI.
- **Search results**, 3840 × 2560 (3:2): the same sky. the wordmark over "Your week, already organized." in EB Garamond (ink, "organized" in lavender italic, no subline) on the left, the Today phone (`raw/today.png`) on the right, inside the centered 2168 × 1030 safe area. It replaces the three screenshots in search results, so it carries the same promise as screenshot 1. Apple's rules: a short phrase, no prices, discounts, URLs, awards or other platforms.
Check both in App Store Connect's preview tool before saving; the crop differs per device.

Paywall fix (Oct 20, 2026): the cover and You → Semli Plus now explicitly use transparent native headers, a dark scene background and route-aware light status-bar icons. Verify both entry points on device in light and dark appearance, then capture fresh screenshots; a painted status-bar band should no longer be necessary.

---

## Part 3. SEO and Google

### 3.1 Technical (done or one-click)
- Done: canonicals, sitemap, robots, Organization/SoftwareApplication/FAQ/Breadcrumb structured data, per-page social previews, three intent pages, Urbanist via `next/font`.
- To do (you): **Google Search Console** → add `semli.app` (DNS verification at your registrar) → submit `https://semli.app/sitemap.xml`. **Bing Webmaster Tools**: import from Search Console, one click. Check Core Web Vitals after deploy; the site is static and should be green.
- Deploy the site (Vercel is the path of least resistance for Next.js; add `ANTHROPIC_API_KEY` as a server env var there). `SUPABASE_URL` and `SUPABASE_KEY` also feed the waitlist; add `TESTFLIGHT_URL` the day the public link exists and `semli.app/beta` switches from the waitlist to TestFlight.

### 3.2 Queries to own (validate volumes in Search Console and Keyword Planner before investing)
Tier 1, already have pages: *syllabus to calendar*, *assignment tracker app*, *work and school schedule planner*.
Tier 2, next pages (same template, `components/LandingPage.tsx`):
- `/student-planner-app` — the head term; compare honestly with MyStudyLife and Structured.
- `/class-schedule-maker` — registration screenshot → week view.
- `/nursing-student-planner` — clinicals, shifts, pharm exams; the beachhead.
- `/import/7shifts`, `/import/when-i-work`, `/import/hotschedules`, `/import/deputy` — "turn your 7shifts schedule into a calendar"; low volume each, high intent, cheap to make.
- `/canvas-syllabus-to-calendar` — captures Canvas intent before Canvas sync exists; be clear it's the PDF for now.
- `/semli-vs-mystudylife`, `/structured-alternative-for-students` — comparison pages win for people already shopping.
Tier 3, blog posts that earn links: "How to organize a rotating work schedule as a student", "What to do the week before a nursing exam", "The real cost of missing one assignment" (use the survey numbers).

### 3.3 Links and signals
- Campus newspapers and nursing program newsletters (a 200-word pitch + a screenshot).
- Product Hunt launch the week TestFlight goes public (links, not customers).
- Reddit threads (Part 4) that link to the intent pages, not the home page.
- YouTube "study with me" and nursing creators: a link in the description is a backlink.

### 3.4 App Store SEO (ASO)
- Name + subtitle as in 1.4. **Keyword field** (100 chars, commas, no spaces, no words already in name/subtitle): `college,schedule,assignment,tracker,class,work,semester,homework,calendar,nursing,organizer,todo`.
- Promotional text (170 chars, editable without a release): "Turn your syllabus and work schedules into one plan for classes, shifts, and deadlines. Review the dates, then see what’s next." No "free" here (the Oct 23, 2026 rejection); the source of truth is `apps/mobile/store.config.json`.
- Ratings: ask with the system prompt (`expo-store-review`) after the **second** confirmed import, never on first launch. Phase 2 if not before beta.
- Apple Search Ads (Part 4) also feeds the ranking through installs.

---

## Part 4. Marketing plan

### 4.1 Positioning, one line everywhere
"Semli is the daily planner for college students. Drop in a syllabus or a work schedule; it tells you what matters today." Student planner, not AI assistant. Nursing and working students first.

### 4.2 Timeline
| When | What |
|---|---|
| Weeks 1–3 (now) | Dev build, keys, TestFlight internal. Recruit 50 beta students by hand (nursing cohorts, your own campus). Site live with Search Console. |
| Week 4 | Beta runs. Weekly interviews. Watch the funnel: install → first import → paywall → trial → paid. |
| Week 5–6 | If ≥10 of 50 pay: App Review, public release, Product Hunt, Reddit founder posts, first creator videos, Apple Search Ads on. |
| Early January 2027 | Semester-start push: the natural moment to buy a semester plan. Content and ads peak the two weeks before classes. |

### 4.3 Channels, in order of expected return

**1. Campus, by hand (highest conversion, zero cost).** Nursing programs first (18% of the survey, highest hours). One ambassador per program gets Plus free for a year plus $50 per 25 installs. Kit: a one-page flyer with a QR to the TestFlight link, a 60-second phone video of a syllabus becoming a semester, and three sentences for a GroupMe/Discord post. Study-group and club presidents next.

**2. Reddit (credible, free, slow; the rules matter).**
- Subreddits: r/StudentNurse, r/nursing (flair rules; many ban self-promo, read first), r/college, r/CollegeRant, r/GetStudying, r/productivity, r/ADHD (only if a user raises it; never pitch), r/sideproject and r/iosapps (builder audience, good for feedback).
- Format that works: a founder post with the story and a screenshot, asking for beta testers, honest about what's not built. "I surveyed more than 50 students; 83% had missed an assignment because it got buried, so I built…" Reply to every comment. One post per subreddit, ever, unless mods invite more.
- What gets you banned and hurts the brand: multiple accounts, friends posting "has anyone tried Semli?", fake reviews. StudyStream's reviews call this out by name. Don't.
- Ongoing: answer "best planner for nursing school" style questions with a real answer and a one-line mention; the link goes to the intent page.

**3. Short video (TikTok, Reels, Shorts): the format fits the product.**
- The "transformation" clip: screenshot of a messy schedule → tap → the week appears. 15–30 seconds, no talking needed, caption "set up my whole semester in 2 min".
- Creator seeding: 10–20 nursing/study micro-creators (5k–50k followers): free Plus for a year plus $50–150 per video, no script, ask only that they show a real import. Track with a per-creator link (`semli.app/?r=name` → PostHog).
- Your own account: one clip per week; the sample week makes it easy to film.

**4. Apple Search Ads (paid, measurable, small).** Start at $15/day, exact-match campaigns: brand (`semli`), competitors (`mystudylife`, `my study life`, `structured planner`, `student planner`), category (`college planner app`, `assignment tracker`, `syllabus app`). Kill any keyword whose cost per trial start is above $8 after 50 installs; keep the rest. This also lifts organic ranking.

**5. Site + email.** A waitlist/"get the TestFlight link" form on the site now; one email when the public build lands; one before each semester.

**6. Later, not now:** Google Ads (low volume for these queries; revisit after Search Console shows which terms pull), Instagram ads, podcasts, PR beyond campus papers.

### 4.4 Budget for the first 8 weeks
Beta on $500 instead: [marketing-500.md](marketing-500.md).

Apple Developer $99; Apple Search Ads ~$600; creator seeding ~$1,000; ambassador rewards ~$300; Vercel/PostHog/Sentry/RevenueCat free tiers. Roughly **$2,000** to find out whether 50 students pay and what an install costs.

### 4.5 Numbers to watch every Monday
Installs by source → first import rate → paywall shown → trial started → trial converted → week-4 retention. Targets from the beta plan: ≥20% trial-to-paid in the beta, ≥40% W4 retention. If installs are fine but first imports are low, the problem is onboarding; if imports are high but trials are low, the paywall; if trials are high but conversion is low, the product's second week.
