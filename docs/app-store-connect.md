# App Store Connect: every field, ready to paste

October 20, 2026. App record **Semli: AI Student Planner**, Apple ID `6824600264`, bundle id `app.semli.mobile`. Character counts are in brackets where Apple has a limit. Where a field needs something only you have (a phone number, a demo account), it says **you**. Finished screenshots: `design/screenshots/` (6.9-inch), `design/screenshots/6.3-inch/` and the header and search card in `design/screenshots/header/`, all made by `design/render-screenshots.py`. Sidebar order follows App Store Connect: General → App Store → Trust & Safety → Growth & Marketing → Monetization.

## 1. General → App Information

The page as App Store Connect shows it, top to bottom.

| Field | Value |
|---|---|
| Name [30] | `Semli: AI Student Planner` (25) |
| Subtitle [30] | `Syllabus, shifts & deadlines` (28) |
| Apple ID | `6824600264` (read-only) |
| Bundle ID | `app.semli.mobile` (read-only once a build is uploaded) |
| SKU | `semli-ios` (any unique string; never shown to customers) |
| Primary Language | English (U.S.) |
| Category → Primary | Productivity |
| Category → Secondary | Education |
| Content Rights | **Set Up** → "Does not contain, show, or access third-party content". The bundled showcase photos are licensed to us, not third-party content in Apple's sense. |
| License Agreement | Apple's Standard License Agreement. Do not upload a custom EULA; the subscription terms on the paywall and `semli.app/terms` are enough. |

**Age Ratings → Set Up.** Answer the questionnaire like this; the result is 4+ everywhere.

| Section | Question | Answer |
|---|---|---|
| In-App Controls | Parental controls | No |
| In-App Controls | Age assurance | No |
| Capabilities | Unrestricted web access | **No** (the app opens only our own links and the Canvas feed the user pastes; no browser) |
| Capabilities | User-generated content | **No** (plans are private to the device or the account; nothing is shared with other users; `SHARING_ENABLED` is off) |
| Capabilities | Social media | No |
| Capabilities | Messaging and chat | No |
| Capabilities | Advertising | No |
| Mature Themes | Profanity or crude humor; horror; alcohol, tobacco, drugs | None |
| Medical or Wellness | Medical or treatment information | None |
| Medical or Wellness | Health or wellness topics | None (nursing *students* plan their classes; the app gives no health content) |
| Sexuality or Nudity | All three | None |
| Violence | All four | None |
| Chance-Based Activities | Gambling, simulated gambling, contests, loot boxes | None |

If the questionnaire asks about "frequent or intense" anything, every answer is None. If it asks about Made for Kids: No.

**App Encryption Documentation.** Nothing to upload. `ITSAppUsesNonExemptEncryption = false` is already in `app.json` (`ios.infoPlist`), so each build answers the export-compliance question itself. The app uses only HTTPS through the operating system, which is exempt.

**App Store Regulations & Permits**

| Item | Value |
|---|---|
| Digital Services Act → trader status | Keep **trader** (already set). Apple shows the trader's name, address, email and phone on the EU product page, so under **Edit** confirm the address and a phone number you are willing to publish. A PO box or registered-agent address is fine. If you will not sell in the EU for the beta, leave the EU out of availability instead. |
| Add Labels and Markings | None. Nothing in the app is a regulated product. |
| Vietnam Game License | Not applicable; not a game. |
| Regulated Medical Devices | **Declare** → "Not a regulated medical device". Required only if the category were Medical or Health & Fitness, or "Medical or Treatment Information" were frequent; it is neither, but declaring costs nothing and stops the reminder. |

**App Store Server Notifications**

| Field | Value |
|---|---|
| Production Server URL | From RevenueCat → Project → Apps → Semli (App Store) → "Apple Server Notifications": the production URL (`https://api.revenuecat.com/v1/subscribers/…/apple_server_notifications…`). Version 2. |
| Sandbox Server URL | Same page, the sandbox URL. Version 2. |

**App-Specific Shared Secret.** Manage → Generate. Copy it once into RevenueCat → Semli (App Store) → App-Specific Shared Secret. It is not needed in the app or the repo.

**Additional Information.** View on App Store (inactive until live); Edit User Access: add Rico as App Manager if he configures products; Remove App: no.

**Draft Submissions (1).** The 1.0 version page. It submits when sections 2 to 6 below are complete and a build is attached.

## 2. Pricing and Availability
- Price: **Free** (Plus is sold inside the app).
- Availability: United States only for the beta; all territories at public launch.
- Pre-orders: off. App distribution: public.

## 3. Version information (the 1.0 page)

**Promotional text** [170], editable without a new build (127 characters):
```
Turn your syllabus and work schedules into one plan for classes, shifts, and deadlines. Review the dates, then see what’s next.
```

**Description** [4000] (1,818 characters):
```
Keep classes, work shifts, and assignment deadlines in one student planner.

Upload a syllabus PDF, a screenshot of your shifts, or a message from class. Semli finds dates and times for you to review before adding them to your plan. You can correct the details or undo an import later.

See what’s next
Check today’s plans, view your week, and spot overlaps between work and school.

Bring your course dates together
Add exams and assignments from a syllabus, or import assignments from your Canvas calendar feed.

Choose your reminders
Set reminders for events and deadlines, with an optional daily summary. Choose reminder times and quiet hours.

Start with the free plan
Use the calendar, to-dos, reminders, and five AI imports to start, then three a month. No account is required.

Add more with Semli Plus
With Plus, get unlimited AI imports, apply a new work schedule as changes to the shifts you already have, see suggested times for overlaps, and have Semli check Canvas for updates when you open the app or tap Sync now. Also with Plus, urgent items can ring like an alarm; ringing alarms need a timed urgent item, iOS 26 or later, and alarm permission. Plus is billed monthly, every six months, or yearly, and student pricing is on the honor system. Eligible new subscribers can try Plus for seven days.

Private by default
Your plan stays on your phone, with optional account backup. Semli’s servers don’t save your original uploads; our privacy policy explains how the AI provider handles requests.

Built for students who mix lectures, labs, clinicals, and part-time work. iPhone only for now.

Subscriptions renew automatically unless cancelled at least 24 hours before the end of the period. Manage or cancel in your Apple ID settings. Terms: https://semli.app/terms. Privacy: https://semli.app/privacy.
```
Section headers are sentence case, like everything else we publish; Apple allows no other formatting in this field, so each header sits on its own line with a blank line above. Rewritten Oct 23, 2026 from `docs/copy-audit-2026-10-23.md`: no prices (Apple advises against them in descriptions, and the old text disagreed with the store products), "With Plus" beside every paid capability, the semester term called "six months", trial eligibility rather than a promised trial, ringing alarms with their requirements (a timed urgent item, iOS 26 or later, alarm permission), and no absolute claims about extraction, scrolling or file storage.

**Other English storefronts.** en-GB, en-AU and en-CA have their own title, subtitle, keywords, description and promotional text in `apps/mobile/store.config.json` (UK: module handbook, rota, honour; Australia: unit outline, roster, honour; Canada: syllabus or course outline, honour). Paste them from there, or push with `eas metadata:push`; the config is the source of truth and the text above matches its en-US entry exactly. Character counts, with commas between keywords:

| Locale | Title / 30 | Subtitle / 30 | Keywords / 100 | Description / 4,000 | Promo / 170 |
| --- | ---: | ---: | ---: | ---: | ---: |
| en-US | 25 | 28 | 98 | 1,818 | 127 |
| en-GB | 25 | 29 | 99 | 1,882 | 126 |
| en-AU | 25 | 29 | 94 | 1,883 | 125 |
| en-CA | 25 | 28 | 99 | 1,865 | 126 |

**Keywords** [100], no spaces, no words already in the name or subtitle:
```
college,schedule,assignment,tracker,class,work,semester,homework,calendar,nursing,organizer,canvas
```
(98 characters.)

**What’s New in This Version** [4000], for 1.0:
```
First release. Syllabus and work-schedule import, Canvas import, reminders, and the week as a chart.
```

| Field | Value |
|---|---|
| Support URL | `https://semli.app/contact` |
| Marketing URL | `https://semli.app` |
| Copyright | `2026 Chibudom Onyejesi` (**you**: or your company name once there is one) |
| Version | Must match `expo.version` in `apps/mobile/app.json` (`1.1.2` since Oct 23, 2026). If the App Store Connect version page says anything else, rename it to 1.1.2 before attaching the build; an unreleased version can be renamed. |
| Build | Uploaded by `eas submit`; pick the latest |
| App Clip, Game Center | none |

**Screenshots, 6.9-inch display** (1320 × 2868, `design/screenshots/`, upload in this order; the first three show in search):

| # | File | Caption on the image |
|---|---|---|
| 1 | `01-today.png` | Classes, shifts, and deadlines |
| 2 | `02-review-syllabus.png` | Your syllabus, in your planner |
| 3 | `03-review-update.png` | See what changed in your shifts |
| 4 | `04-plan.png` | School and work, one calendar |
| 5 | `05-spread.png` | Plan ahead for busy weeks |
| 6 | `06-today-hours.png` | Your day, hour by hour |
| 7 | `07-school.png` | Keep your course dates together |
| 8 | `08-item.png` | Choose your reminders |
| 9 | `09-canvas.png` | Bring Canvas into your plan |

**No prices, trials or "free" in any screenshot, the name, subtitle, keywords or promotional text** (guideline 2.3.7; 1.0 was rejected for the paywall shot on Oct 23, 2026). Prices belong only on the paywall in the app, which shows the live store price; keep them out of the description too (Apple advises against specific prices there), and say "eligible new subscribers" rather than promising every reader a trial. Delete `10-paywall.png` from App Store Connect if it is still uploaded.

The set was rerendered Oct 21, 2026: shots on the morning sky with the wordmark and an EB Garamond caption each, no sublines, one accent phrase in lavender italic, captured with the new main-tab headers; the header and search card moved to the same sky and faces. Recaptured Oct 23, 2026 with the course dot in place of the gutter bar, nine shots, no paywall; later that day the captions were rewritten after the copy audit (`docs/copy-audit-2026-10-23.md`) so each one matches its screen, and shot 2 became a real syllabus review (`02-review-syllabus.png`, which replaces `02-review.png`: delete the old one in App Store Connect). Re-upload all nine, the 6.3-inch copies and the search card (the header has no phone and did not change). Apple scales the 6.9-inch set to every other iPhone size. The 6.1"/6.3" slot (1206 × 2622) is optional; downscaled copies are in `design/screenshots/6.3-inch/`. The foldable set was dropped. No iPad set (`supportsTablet: false`). App previews (video): none for 1.0.

**Growth & Marketing → Custom Product Pages / Asset Library** (optional, iOS 27): Header `design/screenshots/header/header-3840x1646.png` (wordmark and tagline centered); Search Results `design/screenshots/header/search-3840x2560.png` (tagline and the Today phone). Check both in the Preview tool; the crop differs per device.

## 4. App Review Information

| Field | Value |
|---|---|
| Sign-in required | **Yes** (the app has optional accounts; reviewers need a way in). Reviewer account `review@semli.app` exists, email confirmed (created Oct 20, 2026 via the Supabase admin API). The password is `REVIEW_PASSWORD` in the repo-root `.env`; paste both into Sign-in Information. Notes: "Tap I have an account on the welcome screen and sign in with email and password. An account is optional; every feature also works signed out." |
| Contact first/last name, phone, email | **you** |
| Notes | see below |
| Attachment | none |

Notes for the reviewer:
```
No account is needed to use the app; the reviewer account is only for testing login and backup.

To see a populated planner: in onboarding, pick Student, any major, then tap "Explore my preview first".

To test an import: on the Add tab, type "I work Fri 4-10 and Sat 11-5 at the campus café, exam Monday at 9" and send. The review screen shows what was found; tap Add to confirm.

To test Canvas sync: You → Canvas, paste any Canvas calendar feed link (webcal://…/feeds/calendars/….ics). A test feed: [you: paste a feed URL from a Canvas test account, or remove this line].

Subscriptions use StoreKit through RevenueCat. Each product has a 7-day free trial. Price, period, renewal terms and Restore purchases are on the paywall (You → Your plan).

Photos permission is used only to show recent screenshots on the Add tab. Notifications are local reminders. AlarmKit (iOS 26) is used for items the user marks urgent.
```

## 5. App Privacy (the nutrition label)

Data collected, with purpose. Nothing is used for tracking; do not check "Tracking". Oct 27, 2026: Name and Email Address gained "Developer's Advertising or Marketing" when account holders joined the email list. Update the label in App Store Connect (no new build needed).

| Data type | Linked to you? | Purpose | Source |
|---|---|---|---|
| Contact Info → Name | Linked | App Functionality, Developer's Advertising or Marketing | Account metadata, only when they sign up with a name; greets them in the welcome and semester emails |
| Contact Info → Email Address | Linked | App Functionality (account), Developer's Advertising or Marketing | Supabase, only when they sign up; account holders get the welcome email and the semester broadcasts (Resend "App users" group) |
| Identifiers → User ID | Linked | App Functionality | Supabase user id, RevenueCat app user id |
| Purchases → Purchase History | Linked | App Functionality | RevenueCat |
| User Content → Other User Content | Not linked | App Functionality | Messages, screenshots and PDFs sent for extraction; not stored |
| User Content → Photos or Videos | Not linked | App Functionality | Same, when the import is an image |
| Usage Data → Product Interaction | Not linked | Analytics | PostHog (no content, no titles) |
| Diagnostics → Crash Data, Performance Data | Not linked | App Functionality | Sentry |
| Identifiers → Device ID | Not linked | Analytics | PostHog anonymous id |

Not collected: name (optional, stays on the phone unless they sign up with it; if you keep it in the Supabase user metadata, add Contact Info → Name, linked), location, contacts, health, financial info, browsing history, search history.

Privacy policy (`apps/web/app/privacy/page.tsx`, rewritten Oct 20, 2026) covers all ten declared types and names providers only by role (AI model, hosting, database and authentication, subscriptions, product analytics, error monitoring), never by company. Keep it that way. Phone Number is not collected. Turn on "Prevent storing of IP addresses" in the Sentry project so no location is collected.

## 5b. Trust & Safety → App Accessibility (Accessibility Nutrition Label)

Declare only what is true on a device; Apple can check. Current state of the code, with what still needs verifying marked **verify**:

| Feature | Declare? | Basis |
|---|---|---|
| VoiceOver | Yes, **verify** | Rows, pills, toggles and charts carry `accessibilityLabel`/`accessibilityRole`; the review chart has per-day labels. Walk Today, Plan, Review and the paywall with VoiceOver on before declaring. |
| Voice Control | Yes, **verify** | Follows from labelled controls; check that pill buttons are reachable by name. |
| Larger Text | **Verify** | Text tokens are fixed sizes (Geist 12–56). If Dynamic Type is not honored, do not declare it. |
| Dark Interface | Yes | Appearance: Match iPhone / Light / Dark, full dark palette. |
| Differentiate Without Color Alone | Yes | Status pills carry words ("Due today", "Moved", "Dropped"); overlaps say "Overlaps"; charts have legends. |
| Reduced Motion | Yes | Reduce Motion suppresses the purchase confetti and the motion tokens respect it. |
| Sufficient Contrast | Yes, **verify** | Ink on paper and the status colors were chosen for contrast; check the 12px captions and secondary text with Apple's checker. |
| Captions / Audio Descriptions | Not applicable | No video or audio content. |

## 5c. Everything else in the sidebar

| Page | 1.0 answer |
|---|---|
| Growth & Marketing → In-App Events | None. |
| Growth & Marketing → Custom Product Pages | None for 1.0; later one per intent page (nursing, shifts, syllabus). |
| Growth & Marketing → Asset Library | Upload the header and search card from `design/screenshots/header/`. |
| Growth & Marketing → Product Page Optimization | Nothing until there is traffic; first test: screenshot 1 with and without the wordmark. |
| Growth & Marketing → Promo Codes | Generate 20 for beta students once approved; they unlock a subscription for free. |
| Game Center | Off. |
| Monetization → Featuring / Nominations | Nominate for the back-to-school window (early January 2027) after launch. |
| Ratings and Reviews | Nothing to set; respond to every review once live. |

## 6. In-App Purchases

Subscription group **Semli Plus** (group display name shown to customers: `Semli Plus`). Six auto-renewable subscriptions, product ids exactly as in `docs/revenuecat-offerings-brief.md`:

| Product ID | Display name [30] | Description [45] | Duration | Price | Intro offer |
|---|---|---|---|---|---|
| `semli_plus_monthly_student` | Plus Monthly, student | Unlimited imports and Canvas sync | 1 month | $4.99 | Free, 1 week |
| `semli_plus_semester_student` | Plus Semester, student | Unlimited imports and Canvas sync | 6 months | $14.99 | Free, 1 week |
| `semli_plus_yearly_student` | Plus Yearly, student | Unlimited imports and Canvas sync | 1 year | $24.99 | Free, 1 week |
| `semli_plus_monthly_regular` | Plus Monthly | Unlimited imports and Canvas sync | 1 month | $7.99 | Free, 1 week |
| `semli_plus_semester_regular` | Plus Semester | Unlimited imports and Canvas sync | 6 months | $24.99 | Free, 1 week |
| `semli_plus_yearly_regular` | Plus Yearly | Unlimited imports and Canvas sync | 1 year | $44.99 | Free, 1 week |

Each product also needs: availability (all territories or US), a **review screenshot** (use `6-paywall.png`), and review notes ("Student pricing is on the honor system; nothing is verified."). Subscription levels in the group: yearly = level 1, semester = level 2, monthly = level 3, student and regular at the same level, so upgrades and downgrades behave.

Agreements: the **Paid Applications** agreement must be signed (Business → Agreements) with banking and tax forms done, or the products stay "Missing Metadata".

## 7. TestFlight

| Field | Value |
|---|---|
| Beta App Description | `Keep classes, shifts, and deadlines in one place. Add a syllabus or a screenshot of your work schedule, check the dates Semli finds, and save them to your calendar.` |
| Feedback email | `hello@semli.app` |
| Marketing URL / Privacy Policy URL | `https://semli.app`, `https://semli.app/privacy` |
| What to Test | `Try adding one of your own syllabi or work schedules. Check the dates Semli finds before saving, then open Today to see your plan. If your school uses Canvas, try connecting it under You → Canvas. Set a reminder and see whether it arrives when you expect. You can also try Plus and restore purchases; TestFlight purchases won't charge you. You don't need an account to get started, but signing up lets you back up your plan. If a date is wrong, something breaks, or you're unsure what to do next, please send feedback through TestFlight or email hello@semli.app.` |
| Beta App Review contact | **you** |
| Export compliance | "No" to non-exempt encryption; `ITSAppUsesNonExemptEncryption = false` is in `app.json` |
| Groups | Internal: "Team" (you and Rico). External: "Survey", [survey invite](https://testflight.apple.com/join/vG3RD6EJ), cap 60 for 58 survey respondents; "Beta", [public beta invite](https://testflight.apple.com/join/j15Rp5m4), cap 200. Separate links and caps; `semli.app/beta` routes public outreach to Beta. |

## 8. Before you press Submit

- [ ] `expo.version` bumped to `1.0.0`; build number set by EAS (`autoIncrement` in `eas.json`).
- [x] Production keys in EAS env (pushed Oct 20, 2026 to `production` and `preview`): every `EXPO_PUBLIC_*` value from `apps/mobile/.env` with `EXPO_PUBLIC_API_URL=https://semli.app`, plus `SENTRY_AUTH_TOKEN` so EAS uploads source maps and dSYMs to the `semli-mobile` Sentry project. Re-push after a key changes: `npx eas-cli env:push --environment production --environment preview --path <file>`.
- [ ] Web host env: `SUPABASE_URL`, `SUPABASE_KEY`, `REVENUECAT_SECRET_KEY`, `ANTHROPIC_API_KEY`.
- [ ] Supabase: anonymous sign-ins on (off as of Oct 20), all three migrations run. Done Oct 20: Resend SMTP on (dashboard), code email templates pushed from `supabase/config.toml`, Site URL `https://semli.app`. See `supabase/templates/README.md`.
- [ ] One sandbox purchase per term works, Restore works, the trial shows as a trial in RevenueCat.
- [ ] A reminder fired on a real phone; a Canvas feed synced on a real phone.
- [ ] `APP_STORE_LIVE = true` in `apps/web/lib/site.ts` once approved, so the site's "Get the app" links to the store.

**Sign in with Apple (Oct 20).** Native Apple sign-in is implemented alongside Google on welcome, login and signup. Before submission, enable the App ID capability and Supabase Apple provider (`app.semli.mobile`), build a new binary, and verify a real-device sign-in with Hide My Email. The remaining account-deletion revocation check is in [todo.md](todo.md) and the [launch checklist](launch-checklist.md).
