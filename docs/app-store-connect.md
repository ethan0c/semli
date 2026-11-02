# App Store Connect: every field, ready to paste

Updated November 1, 2026 for app version **1.2.0**. App record **Semli: AI Student Planner**, Apple ID `6824600264`, bundle id `app.semli.mobile`. Character counts are in brackets where Apple has a limit. Where a field needs something only you have (a phone number, a demo account), it says **you**. Finished screenshots: `design/screenshots/` (6.9-inch), `design/screenshots/6.3-inch/` and the header and search card in `design/screenshots/header/`, all made by `design/render-screenshots.py`. Sidebar order follows App Store Connect: General → App Store → Trust & Safety → Growth & Marketing → Monetization.

## 1. General → App Information

The page as App Store Connect shows it, top to bottom.

| Field | Value |
|---|---|
| Name [30] | `Semli: AI Student Planner` (25) |
| Subtitle [30] | `Syllabus, shifts & deadlines` (27) |
| Apple ID | `6824600264` (read-only) |
| Bundle ID | `app.semli.mobile` (read-only once a build is uploaded) |
| SKU | `semli-ios` (any unique string; never shown to customers) |
| Primary Language | English (U.S.) |
| Category → Primary | Productivity |
| Category → Secondary | Education |
| Content Rights | **Set Up** → "Does not contain, show, or access third-party content". The bundled showcase photos are licensed to us, not third-party content in Apple's sense. |
| License Agreement | Apple's Standard License Agreement. Do not upload a custom EULA; the subscription terms on the paywall and `semli.app/terms` are enough. |

**Age Ratings → Set Up.** Review the questionnaire for 1.2.0, including schedule sharing. Use the rating App Store Connect calculates; the old private-plans-only answers no longer describe the app. [Apple’s age-rating definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/) distinguish broadly distributed user content from social feeds and messaging; the schedule-link row below needs review against that definition.

| Section | Question | Answer |
|---|---|---|
| In-App Controls | Parental controls | No |
| In-App Controls | Age assurance | No |
| Capabilities | Unrestricted web access | **No** (no general-purpose browser; opens Semli links and the calendar feed the user supplies) |
| Capabilities | User-generated content | **Review for schedule links**: account holders can share school and work plans with anyone who has the link. There is no public directory, feed, comments or chat. Check this against Apple’s definition of broad distribution before submitting. |
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

**Additional Information.** View on App Store: check the current public listing; Edit User Access: add Rico as App Manager if he configures products; Remove App: no.

**Version submission.** Use the 1.2.0 version page and attach a matching build after checking sections 2 to 6 below. This guide describes repository metadata; check submission status in App Store Connect.

## 2. Pricing and Availability
- Price: **Free** (Plus is sold inside the app).
- Availability: confirm the enabled territories in App Store Connect. The repository includes en-US, en-GB, en-AU and en-CA listings.
- Pre-orders: off. App distribution: public.

## 3. Version information (1.2.0)

`apps/mobile/store.config.json` is the source of truth for all four English listings. The en-US fields below match it. Run `npm run store:check` before pushing metadata.

**Promotional text** [170], editable without a new build (162 characters):
```
Registered for spring? Add your classes now. Import a syllabus, a schedule screenshot, or your Canvas or Brightspace calendar, and see the whole term in one plan.
```

**Description** [4000] (2,614 characters):
```
Keep classes, work shifts, and assignment deadlines in one student planner.

Upload a syllabus PDF, a screenshot of your shifts, or a message from class. You can also type or speak your plans. Semli finds dates and times for you to review before adding them. Check uncertain details, leave items out, or return to an unfinished review later. You can correct the details or undo an import after saving.

See what’s next
Check today’s plans, view your week, and spot overlaps between work and school.

Bring your course dates together
Add exams and assignments from a syllabus, or import your Canvas or Brightspace calendar feed, including eLC. The first feed import is free; Plus keeps it in sync. Set repeating classes and edit one event or the upcoming series.

See your iPhone calendar alongside your plan
Choose which calendars to show, including iCloud, Google and Outlook calendars already on your iPhone. See where their events overlap with your plans. These events stay on your iPhone.

Choose your reminders
Set reminders for events and deadlines, with an optional daily summary. Choose reminder times and quiet hours.

Share your next two weeks
With an account, create a link to the school and work plans you choose. Anyone with the link can view them in a browser. Hide titles, choose when the link expires, or stop sharing at any time. Personal plans and iPhone calendar events aren’t included.

Start with the free plan
Use the calendar, to-dos, reminders, and five AI imports in your first 30 days, then three a month. No account is required on iPhone.

Add more with Semli Plus
Import as often as you need. Compare a new work schedule with your existing shifts and choose which changes to keep. Get suggested times for overlaps. Plus checks Canvas or Brightspace for updates when you open the app or tap Sync now.

With Plus, add a time to an urgent item to have it ring like an alarm. You’ll need iOS 26 or later and alarm permission.

Choose monthly, six-month, or yearly billing. Student pricing is on the honor system. Eligible new subscribers can try Plus for seven days.

Keep your plan on iPhone or use an account
An optional account backs up your plan and lets you use Semli in a browser at app.semli.app. Reminders and ringing alarms work on iPhone. Semli’s servers don’t save your original uploads; our privacy policy explains how speech recognition and AI requests are handled.

Subscriptions renew automatically unless cancelled at least 24 hours before the end of the period. Manage or cancel in your Apple ID settings. Terms: https://semli.app/terms. Privacy: https://semli.app/privacy.
```
Section headers are sentence case, like everything else we publish; Apple allows no other formatting in this field, so each header sits on its own line with a blank line above. Rewritten Oct 23, 2026 from `docs/copy-audit-2026-10-23.md`: no prices (Apple advises against them in descriptions, and the old text disagreed with the store products), "With Plus" beside every paid capability, the semester term called "six months", trial eligibility rather than a promised trial, ringing alarms with their requirements (a timed urgent item, iOS 26 or later, alarm permission), and no absolute claims about extraction, scrolling or file storage.

**Other English storefronts.** en-GB, en-AU and en-CA have their own title, subtitle, keywords, description and promotional text in `apps/mobile/store.config.json` (UK: module handbook, rota, honour; Australia: unit outline, roster, honour; Canada: syllabus or course outline, honour). Paste them from there, or push with `eas metadata:push`; the config is the source of truth and the text above matches its en-US entry exactly. Character counts, with commas between keywords:

| Locale | Title / 30 | Subtitle / 30 | Keywords / 100 | Description / 4,000 | Promo / 170 |
| --- | ---: | ---: | ---: | ---: | ---: |
| en-US | 25 | 28 | 98 | 1,844 | 162 |
| en-GB | 25 | 29 | 99 | 1,909 | 161 |
| en-AU | 25 | 29 | 94 | 1,910 | 162 |
| en-CA | 25 | 28 | 99 | 1,892 | 161 |

**Keywords** [100], no spaces, no words already in the name or subtitle:
```
college,schedule,assignment,tracker,class,work,semester,homework,calendar,nursing,organizer,canvas
```
(98 characters.)

**What’s New in This Version** [4000], for 1.2.0 (352 characters):
```
Show iPhone calendar events beside your plan and spot overlaps. Share a link to your next two weeks, with control over what it shows and when it stops. Edit one repeating class or the upcoming series. Connect Brightspace, including eLC, as well as Canvas, and review imports as dates appear, with uncertain details flagged and unfinished reviews saved.
```

| Field | Value |
|---|---|
| Support URL | `https://semli.app/contact` |
| Marketing URL | `https://semli.app` |
| Copyright | `2026 Chibudom Onyejesi` (**you**: or your company name once there is one) |
| Version | Must match `expo.version` in `apps/mobile/app.json` and `apple.version` in `apps/mobile/store.config.json` (both `1.2.0`). Attach a 1.2.0 build to the 1.2.0 version page. |
| Build | Uploaded by `eas submit`; pick the latest |
| App Clip, Game Center | none |

**Screenshots, 6.9-inch display** (1320 × 2868, `design/screenshots/`, upload in this order; the first three show in search):

| # | File | Caption on the image |
|---|---|---|
| 1 | `01-today.png` | Classes, shifts, and deadlines |
| 2 | `02-review-syllabus.png` | Your syllabus, in your planner |
| 3 | `03-review-update.png` | See what changed in your shifts |
| 4 | `04-plan.png` | School and work, one calendar |
| 5 | `05-share.png` | Share your week with a link |
| 6 | `06-spread.png` | Plan ahead for busy weeks |
| 7 | `07-today-hours.png` | Catch overlaps in advance |
| 8 | `08-overlap-fix.png` | Then move it to a free time |
| 9 | `09-course.png` | Everything for one course |
| 10 | `10-canvas.png` | Bring in your class calendar |

**No prices, trials or "free" in any screenshot, the name, subtitle, keywords or promotional text** (guideline 2.3.7; 1.0 was rejected for the paywall shot on Oct 23, 2026). Prices belong only on the paywall in the app, which shows the live store price; keep them out of the description too (Apple advises against specific prices there), and say "eligible new subscribers" rather than promising every reader a trial. Delete `10-paywall.png` from App Store Connect if it is still uploaded.

The current ten-shot set includes sharing, overlap suggestions and the course screen. Upload the numbered files above in order, replacing older screenshots in App Store Connect. `design/render-screenshots.py` defines the set and storefront captions. Extra screenshots in `design/screenshots/extra/` include the paywall and are for the website and social posts, not the store listing. Apple scales the 6.9-inch set to other iPhone sizes. The optional 6.1"/6.3" slot (1206 × 2622) has matching copies in `design/screenshots/6.3-inch/`. No iPad set (`supportsTablet: false`). No app preview video is supplied.

**Growth & Marketing → Custom Product Pages / Asset Library** (optional, iOS 27): Header `design/screenshots/header/header-3840x1646.png` (wordmark and tagline centered); Search Results `design/screenshots/header/search-3840x2560.png` (tagline and the Today phone). Check both in the Preview tool; the crop differs per device.

## 4. App Review Information

| Field | Value |
|---|---|
| Sign-in required | **Yes** (the app has optional accounts; reviewers need a way in). Reviewer account `review@semli.app` exists, email confirmed (created Oct 20, 2026 via the Supabase admin API). The password is `REVIEW_PASSWORD` in the repo-root `.env`; paste both into Sign-in Information. Notes: "Tap I have an account on the welcome screen and sign in with email and password. An account is optional for the iPhone planner; backup, the web planner and schedule sharing require an account." |
| Contact first/last name, phone, email | **you** |
| Notes | see below |
| Attachment | none |

Notes for the reviewer:
```
No account is needed to use the iPhone planner. Use the reviewer account to test login, backup, the web planner and schedule sharing.

To see a populated planner: in onboarding, pick Student, any major, then tap "Explore my preview first".

To test an import: on the Add tab, type "I work Fri 4-10 and Sat 11-5 at the campus café, exam Monday at 9" and send. The review screen shows what was found; tap Add to confirm.

To test a class calendar: You → Class calendar, paste a Canvas or Brightspace calendar feed link (including eLC). The first feed import is available without Plus; Plus checks for updates when the app opens or you tap Sync now. A test feed: [you: paste a feed URL from a test account, or remove this sentence].

To test iPhone calendar events: You → iPhone calendar, allow calendar access and choose calendars to show. Their events appear alongside the plan in Today and Plan, stay on the iPhone and are not included in backup or share links.

To test sharing: sign in, then You → Share your schedule. Choose School and/or Work, whether to show titles, and when sharing stops. Create a link and open it in a browser. Anyone with that link can view the next two weeks without an account. Stop the link from the same screen; personal plans and iPhone calendar events are excluded.

To test repeating events: open a repeating class and change its time for one occurrence or every upcoming occurrence. The Repeat screen edits the repeating days and end date.

Subscriptions use StoreKit through RevenueCat. Eligible new subscribers are offered a 7-day free trial; eligibility and localized prices come from the store. Price, period, renewal terms and Restore purchases are on the paywall (You → Your plan).

Photo access shows recent screenshots on Add; camera access lets the user photograph a printed schedule. Microphone and speech recognition access allow dictation; Apple transcribes on the device when available, otherwise on its servers. Semli receives only the transcript. Calendar access reads the selected iPhone calendars on the device. Notifications are local reminders. With Plus and alarm permission, AlarmKit (iOS 26 or later) rings for timed items marked urgent.
```

## 5. App Privacy (the nutrition label)

Data collected, with purpose. Account backups and share-link snapshots persist off the device and need to be covered by the label under [Apple’s data-collection definition](https://developer.apple.com/app-store/app-privacy-details/). Nothing is used for tracking; do not check "Tracking". Oct 27, 2026: Name and Email Address gained "Developer's Advertising or Marketing" when account holders joined the email list. Update the label in App Store Connect (no new build needed).

| Data type | Linked to you? | Purpose | Source |
|---|---|---|---|
| Contact Info → Name | Linked | App Functionality, Developer's Advertising or Marketing | Account metadata, only when they sign up with a name; greets them in the welcome and semester emails |
| Contact Info → Email Address | Linked | App Functionality (account), Developer's Advertising or Marketing | Supabase, only when they sign up; account holders get the welcome email and the semester broadcasts (Resend "App users" group) |
| Identifiers → User ID | Linked | App Functionality | Supabase user id, RevenueCat app user id |
| Purchases → Purchase History | Linked | App Functionality | RevenueCat |
| User Content → Other User Content | Linked for account-backed plans and share links; extraction inputs are not linked | App Functionality | Optional account backup stores plan content. Share links store selected school/work dates, times and optional titles, plus the first name if supplied; anyone with the link can view the next two weeks. Personal plans, notes, files and iPhone calendar events are excluded from links. Original extraction uploads are not stored by Semli |
| User Content → Photos or Videos | Not linked | App Functionality | Images selected for extraction; original uploads are not stored by Semli |
| Usage Data → Product Interaction | Not linked | Analytics | PostHog (no content, no titles) |
| Diagnostics → Crash Data, Performance Data | Not linked | App Functionality | Sentry |
| Identifiers → Device ID | Not linked | Analytics | PostHog anonymous id |

Not collected: location, contacts, health, payment card details, browsing history or search history. A name entered only on the phone stays there unless included in account metadata or a share-link title. iPhone calendar events stay on the device. Semli receives dictated text, never microphone audio; Apple may process speech on its servers when on-device recognition is unavailable. Review the complete label in App Store Connect before submission.

Privacy policy (`apps/web/app/privacy/page.tsx`, updated Oct 28, 2026) covers account backup, share links, iPhone calendar access and speech recognition, alongside imports, subscriptions, analytics and diagnostics. It names speech-recognition providers where needed to explain who processes audio. Phone Number is not collected. Turn on "Prevent storing of IP addresses" in the Sentry project so no location is collected.

## 5b. Trust & Safety → App Accessibility (Accessibility Nutrition Label)

Declare only what is true on a device; Apple can check. Current state of the code, with what still needs verifying marked **verify**:

| Feature | Declare? | Basis |
|---|---|---|
| VoiceOver | Yes, **verify** | Rows, pills, toggles and charts carry `accessibilityLabel`/`accessibilityRole`; the review chart has per-day labels. Walk Today, Plan, Review and the paywall with VoiceOver on before declaring. |
| Voice Control | Yes, **verify** | Follows from labelled controls; check that pill buttons are reachable by name. |
| Larger Text | **Verify** | Text follows the phone's text size. The 56 and 34 display type and chart labels stop at 1.35x (`MAX_TEXT_SCALE`), the largest standard size. Walk every tab at the largest accessibility size before declaring. |
| Dark Interface | Yes | Appearance: Match iPhone / Light / Dark, full dark palette. |
| Differentiate Without Color Alone | Yes | Status pills carry words ("Due today", "Moved", "Dropped"); overlaps say "Overlaps"; charts have legends. |
| Reduced Motion | Yes | Reduce Motion suppresses the purchase confetti and the motion tokens respect it. |
| Sufficient Contrast | Yes, **verify** | Ink on paper and the status colors were chosen for contrast; check the 12px captions and secondary text with Apple's checker. |
| Captions / Audio Descriptions | Not applicable | No video or audio content. |

## 5c. Everything else in the sidebar

| Page | Current guidance |
|---|---|
| Growth & Marketing → In-App Events | None. |
| Growth & Marketing → Custom Product Pages | None supplied in the repository; consider one per intent page (nursing, shifts, syllabus). |
| Growth & Marketing → Asset Library | Upload the header and search card from `design/screenshots/header/`. |
| Growth & Marketing → Product Page Optimization | Nothing until there is traffic; first test: screenshot 1 with and without the wordmark. |
| Growth & Marketing → Promo Codes | Generate 20 for beta students if needed; verify eligibility and redemption behavior in App Store Connect. |
| Game Center | Off. |
| Monetization → Featuring / Nominations | Nominate for the back-to-school window (early January 2027) when ready. |
| Ratings and Reviews | Nothing to set; respond to every review as reviews arrive. |

## 6. In-App Purchases

Subscription group **Semli Plus** (group display name shown to customers: `Semli Plus`). Six auto-renewable subscriptions, product ids exactly as in `docs/revenuecat-offerings-brief.md`:

| Product ID | Display name [30] | Description [45] | Duration | Price | Intro offer |
|---|---|---|---|---|---|
| `semli_plus_monthly_student` | Plus Monthly, student | Unlimited imports and class calendar sync | 1 month | $4.99 | Free, 1 week |
| `semli_plus_semester_student` | Plus Semester, student | Unlimited imports and class calendar sync | 6 months | $14.99 | Free, 1 week |
| `semli_plus_yearly_student` | Plus Yearly, student | Unlimited imports and class calendar sync | 1 year | $24.99 | Free, 1 week |
| `semli_plus_monthly_regular` | Plus Monthly | Unlimited imports and class calendar sync | 1 month | $7.99 | Free, 1 week |
| `semli_plus_semester_regular` | Plus Semester | Unlimited imports and class calendar sync | 6 months | $24.99 | Free, 1 week |
| `semli_plus_yearly_regular` | Plus Yearly | Unlimited imports and class calendar sync | 1 year | $44.99 | Free, 1 week |

Each product also needs: availability (all territories or US), a **review screenshot** (`design/screenshots/extra/05-paywall.png`, review only; never upload it as a public listing screenshot), and review notes ("Student pricing is on the honor system; nothing is verified."). Subscription levels in the group: yearly = level 1, semester = level 2, monthly = level 3, student and regular at the same level, so upgrades and downgrades behave.

Agreements: the **Paid Applications** agreement must be signed (Business → Agreements) with banking and tax forms done, or the products stay "Missing Metadata".

## 7. TestFlight

| Field | Value |
|---|---|
| Beta App Description | `Keep classes, shifts, and deadlines in one place. Add a syllabus or a screenshot of your work schedule, check the dates Semli finds, and save them to your calendar.` |
| Feedback email | `hello@semli.app` |
| Marketing URL / Privacy Policy URL | `https://semli.app`, `https://semli.app/privacy` |
| What to Test | `Try adding one of your own syllabi or work schedules. Check the dates Semli finds before saving, then open Today to see your plan. Try Canvas or Brightspace under You → Class calendar. You can also show your iPhone calendar, edit a repeating class and create a schedule link under You → Share your schedule (an account is required for sharing). Set a reminder and see whether it arrives when you expect. You can also try Plus and restore purchases; TestFlight purchases won't charge you. You don't need an account to get started, but signing up lets you back up your plan. If a date is wrong, something breaks, or you're unsure what to do next, please send feedback through TestFlight or email hello@semli.app.` |
| Beta App Review contact | **you** |
| Export compliance | "No" to non-exempt encryption; `ITSAppUsesNonExemptEncryption = false` is in `app.json` |
| Groups | Internal: "Team" (you and Rico). External: "Survey", [survey invite](https://testflight.apple.com/join/vG3RD6EJ), cap 60 for 58 survey respondents; "Beta", [public beta invite](https://testflight.apple.com/join/j15Rp5m4), cap 200. Separate links and caps; `semli.app/beta` routes public outreach to Beta. |

## 8. Before you press Submit

- [x] `expo.version` and store `apple.version` both set to `1.2.0`; build number set by EAS (`autoIncrement` in `eas.json`).
- [ ] Run `npm run store:check`, upload the current ten screenshots, and review age-rating and privacy answers for sharing and account backup.
- [x] Production keys in EAS env (pushed Oct 20, 2026 to `production` and `preview`): every `EXPO_PUBLIC_*` value from `apps/mobile/.env` with `EXPO_PUBLIC_API_URL=https://semli.app`, plus `SENTRY_AUTH_TOKEN` so EAS uploads source maps and dSYMs to the `semli-mobile` Sentry project. Re-push after a key changes: `npx eas-cli env:push --environment production --environment preview --path <file>`.
- [ ] Web host env: `SUPABASE_URL`, `SUPABASE_KEY`, `REVENUECAT_SECRET_KEY`, `ANTHROPIC_API_KEY`.
- [ ] Supabase: anonymous sign-ins on (off as of Oct 20), all current migrations applied, including import allowances, plan records and schedule sharing. Done Oct 20: Resend SMTP on (dashboard), code email templates pushed from `supabase/config.toml`, Site URL `https://semli.app`. See `supabase/templates/README.md`.
- [ ] One sandbox purchase per term works, Restore works, the trial shows as a trial in RevenueCat.
- [ ] A reminder fired on a real phone; Canvas and Brightspace feeds synced on a real phone.
- [ ] iPhone calendar events stay local; sharing includes only the selected school/work plans, hides titles when requested, expires as chosen and stops when revoked.
- [ ] Voice input keeps the transcript after stopping; repeat edits apply to the chosen occurrence or upcoming series.
- [ ] Check the live App Store listing and the site's "Get the app" destination before announcing this version. `WEB_APP_LIVE` is true and `APP_URL` is `https://app.semli.app`; test sign-in and plan sync in the browser.

**Sign in with Apple (Oct 20).** Native Apple sign-in is implemented alongside Google on welcome, login and signup. Before submission, enable the App ID capability and Supabase Apple provider (`app.semli.mobile`), build a new binary, and verify a real-device sign-in with Hide My Email. The remaining account-deletion revocation check is in [todo.md](todo.md) and the [launch checklist](launch-checklist.md).
