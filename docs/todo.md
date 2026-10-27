# Done and outstanding

October 19, 2026. The mobile UI pass against the design canvas (https://claude.ai/artifact/QgE4ddmEytZ2PyHMCT3QoV), what shipped and what is still open. Backend work is parked on purpose.

## Solo developer follow-up checklist

Keep this as the release scratchpad. Unchecked means work or device verification remains, even where the UI already exists. Backend work stays parked.

### First: subscriptions and the new welcome

- Built: onboarding, You → Semli Plus, and feature gates share the fireworks photo and purchase controls. A confirmed purchase with an active `semli_plus` entitlement shows a celebration, then a skippable two-step guide. Restore and normal app launches do not replay the celebration. The guide can be reopened from You → Semli Plus.
- [ ] Run real StoreKit sandbox / TestFlight purchases for each term, including eligible trial, ineligible trial, cancel, failed payment, pending approval and an inactive entitlement after a transaction. The welcome must appear only once for a successful new purchase. Development Test Store access is not this verification.
- [ ] Check the import-quota and schedule-update gates: cancel keeps the pending draft/review; purchase → tour → Continue resumes it; restore returns access without a new-purchase celebration. Test the glass X and Android Back too.
- [ ] Verify localized prices, total billed for semester/year, student vs regular offerings, introductory-offer eligibility, renewal disclosures and Terms/Privacy links against the actual store confirmation. Intro pricing on a product alone does not prove a returning user is eligible.
- [ ] In App Store Connect, rename the two six-month products' display names from "Plus Semester" to "Plus 6 months" (student and regular), so the purchase sheet matches the app's "6 months" label and "$14.99 / 6 months" price line (Oct 21). Update `revenuecat-offerings-brief.md` and the RevenueCat package display names to match. Product IDs stay `semli_plus_semester_*`; they are not shown to anyone.
- [ ] Account model (Oct 21, 2026), on device: sign out offline (must refuse and keep the plan), sign out online (welcome, then Continue as brings the plan back), sign in on a phone with its own plan (the keep-one choice, both answers), guest Erase plan, Delete account with Apple (Apple asks to confirm, then the account is gone).
- [ ] Set `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `APPLE_CLIENT_ID` on the web host so Delete account revokes Sign in with Apple (App Review 5.1.1(v)). Until then deletion works and logs `account.apple_revoke_unconfigured`.
- [ ] Account-deletion email: `supabase db push` (`20261023100000_email_outbox.sql`), then set `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` and `CRON_SECRET` on Vercel; delete a test email account and check the confirmation arrives. The cron runs daily (Hobby allows no more); the app also kicks the sender right after a deletion.
- [ ] Run `supabase db push` for the Oct 21 migrations (`20261021120000_import_allowance.sql`, `20261021130000_plan_size.sql`) before the next build ships; without the first one, free imports four and five are refused.
- [ ] Configure production RevenueCat public SDK keys, products and `semli_plus` entitlement for each store. Test expiration, refund, reinstall, Restore purchases and Manage subscription. Confirm Test Store keys are never used in a release build.
- [ ] Review the trial-reminder lifecycle: record an actual trial rather than assuming any product with an intro offer started one; remove obsolete reminders after cancellation, conversion, restore or a plan change. The paywall now says reminders require notifications to be enabled.
- [ ] Check the photo paywall and welcome on a small phone, large text, VoiceOver/TalkBack, Reduce Motion and both appearances. Verify image rights/attribution before shipping. Native launch splash remains ink wordmark on white.

### Notifications: enabling is only the start

- Existing: onboarding asks in context; You → Reminders can enable permission, open system Settings after denial, send a test reminder and set event lead time, deadline reminders, briefing and quiet hours. Notifications are local to this phone.
- [ ] On a physical device, test first allow, deny, Not now, then enabling/disabling in system Settings and returning to Semli. The switches should reflect actual permission. Avoid repeatedly sending someone to Settings after a fresh denial.
- [ ] Add notification-tap routing, including cold launch: event/deadline → the correct item; briefing → Today; trial reminder → Semli Plus. Deleted or missing items should land safely on Today. `notifications.ts` currently schedules payloads but has no response listener.
- [ ] Verify delivery while foregrounded, backgrounded and locked. Check 10/30/60 minute reminders, overnight shifts, all-day deadlines, morning briefing and empty-day suppression. Preview/sample events must never notify.
- [ ] Edit, complete and delete events; change reminder times; confirm old pending reminders are removed. Test timezone changes, daylight-saving transitions and quiet-hour boundaries. Quiet hours currently allow an exception when delaying would miss the event.
- [ ] Test the 60-notification cap and 14-day planning horizon. Define behavior when someone does not reopen the app for weeks: the current schedule refreshes on changes/foreground, so it is not an indefinite reminder service.
- [ ] Surface notification scheduling failures instead of silently implying everything is enabled. Reconcile a partial scheduling failure before the next retry.

### Reviews, support and learning what works

- Existing: You → Rate Semli opens the App Store review URL, and `lib/store-review.ts` asks with the system prompt after the second confirmed import on a second day, at most every 120 days, never right after a Plus gate.
- [ ] Verify the App Store ID, support inbox and legal URLs in a release build. Send a real support email to yourself and check the reply path.
- [ ] Review analytics for paywall shown → purchase/cancel → welcome/tour completion, import confirmed and reminder permission. Add missing events with coarse properties; never include schedule titles, file contents or student details.
- [ ] Configure release crash reporting and source maps; test one controlled error in a non-production build. Check offline, extraction timeout, malformed PDF, permission denied and store unavailable states.

### Before inviting more people

- [ ] Verify clean install → onboarding → real import → review → Today, and existing install → update with local data preserved. Test free users and Plus users, Undo, export and .ics import on a real device.
- [ ] New onboarding (Oct 21, 2026) on a device: plate multi-select and Next; job-only skips the deadlines question and opens on screenshots; each deadline source opens the matching import (syllabus → PDF picker, screenshots → photo picker and recent shots, nowhere → composer, Canvas → feed guide); "Try a sample" loads a labelled sample week and Today shows "This is a sample week · Remove"; a real import later removes the sample; "Your term, at a glance" numbers match the plan (deadlines, busiest week, exams, a shift clash); "Remind me" sets 8 pm the night before or 8 am the morning of and asks for permission once; the paywall headline names their classes and shifts (or Canvas); "Continue free" lands on Today; a guest with real items sees "Save your plan" once and "Not now" hides it for good; back on the first question returns to the welcome screen.
- [ ] Make local-only storage clear: no account, cloud backup or cross-device recovery exists. Test export before destructive actions and document what deleting the app loses.
- Accounts run on Supabase (`lib/auth-client.ts`, `supabase/migrations`): email, Google and Apple, emailed codes (6 to 8 digits) for confirm and reset, sign out, delete, and plan backup/restore. They switch on when the Supabase keys are set; until then the welcome is one "Get started". Schedule sharing stays hidden (`SHARING_ENABLED`). Do not list live sharing as a shipped benefit.
- Server-side import quota is built: `import_usage` and `claim_import` in `supabase/migrations/20261020000000_import_quota.sql`, Plus checked against RevenueCat in `apps/web/lib/import-access.ts`. Deploying it is in `launch-checklist.md`.
- [ ] Privacy page: say that voice capture uses Apple speech recognition, on the phone when its model is present and otherwise over Apple's network, and that Semli receives the transcript as text, never audio (`docs/voice-capture.md`).
- [ ] Review App Store screenshots/copy, accessibility, photo permissions, privacy disclosures for extraction/analytics/crash services, version/build numbers, release environment, production API URL and white native splash in an actual build.
- [ ] Keep a short support playbook: purchase not active → Restore; notifications missing → permission + test reminder; schedule wrong → review/edit/Undo; data recovery → available export. Write down the release rollback/update steps while they are fresh.

## Done

**System**
- Geist at the right weights: all display and title headings Regular (400), including onboarding; pills Medium.
- Category tints stay small in the planner; ordinary screens use plain rows. The photographic Plus showcase and welcome use accent icon badges.
- Five button roles, pills act and rectangles hold; the sliding segmented control; ink toggles.
- Glass chrome: the Today toggle, close and back, the onboarding chevron sit in Liquid Glass circles on iOS 26 (`components/Glass.tsx`).
- Add is the fifth tab with the iOS 26 `search` role (the detached circle). No add menu. Every entry point lands on the Add tab, with a source to open a picker.

**Charts, one timeline at three zooms**
- `DayBar` on Today, Moment, and the item screen ("around it").
- `HourView` behind the Today list/graph toggle.
- `WeekChart` as the Plan header, the employer screen, and both schedule reviews. The selected day pops on a spring.
- `TermLine` on School (four-week map), the course screen, and the syllabus review.

**Screens**
- Today: toggle, hour view, swipe actions, empty state as rows, "Mark all done", Moment header.
- Plan: week chart header, empty day, rest of the week, amber "Add a time" with Start and End pills.
- School: big number, deadline map, flat course rows, keep-it-up-to-date rows.
- Course detail: the term so far, meeting pattern with Change, coming up, "Remove STAT 200 · 31 things".
- Employer: next shift, this week's shifts, next week status, imports, remove in two scopes.
- Item: tappable time and date, plain rows, series row, the day around it, delete scope chooser (just this one, this week, from now on), notes.
- Import: what it added, undo this import.
- Add: composer, recent screenshots with skeletons, three start rows.
- Review: work schedule first import and update, syllabus, general; never blocks; "Until when?"; "Add 14 · skip 2".
- Create: pill field, hairline rows, segmented category, course chips with dots.
- You: no card style, Plus in accent, inline Clear confirm. Your data: export, Add to Calendar (.ics), recent changes with Undo, clear with "Export first".
- Onboarding: six steps (plate, deadlines, import, term at a glance, reminder, Plus), rebuilt Oct 21, 2026.

**Behavior**
- One tap deletes, Undo toast, undoable later from Your data. Swipe right completes, left deletes.
- Repeating classes share a `seriesId`; a class with no end date gets 15 weeks and asks.
- Course and employer removal restore fully on Undo (courses and schedules come back).
- Preview data is the board's week and shows in every list under the dev commands.

**Loading**
- Skeletons for the day bar, week chart, term line, hour view, the review shape, and the screenshot strip (`components/Skeleton.tsx`).
- Reading state is the review drawn as skeletons under the progress line.
- Plan pill on You and price rows on Plus are skeletons while the store answers. The Moment photo fades in on load.

**Site**
- The desktop board is row 13 on the canvas. Real iPhone frames, the try-it box second, the review look for results, survey proof, prices in the open.

## Outstanding

**After the web app is finished (deferred Oct 27, 2026)**
From the Oct 27 audit; the founder's call is to finish the web app first.
- [ ] Undoing a Canvas sync doesn't last: the next sync adds the items back. Remember undone UIDs as dismissed, or say so in the toast.
- [ ] A paid read is lost if review is closed or the app restarts mid-review: `pending` isn't persisted, and there's no cancel or timeout while reading.
- [ ] Undo history (`batches`) has no cap and is saved whole on every change. Pick a cap with the founder (e.g. last 100 or 60 days) and name it in the Recent changes footer.
- [ ] Recent changes shows 3 rows; imports sink under edits.
- [ ] CourseDetail's "Last one" can only shorten a class, not extend it.
- [ ] Nothing reads an exported plan file back in; the copy no longer promises it.

**Needs the backend**
- Schedule sharing direction: a named, private read-only link that friends or parents can open in a browser without installing Semli. Show a useful message preview (owner and date range); allow hiding titles or sharing school/work only, and let the owner revoke access. A live view should show when it last updated. Image/PDF export can be a fallback; links are not implemented yet.
- Streaming "Found so far" while reading (Capture board).
- Keeping the real screenshot for the import screen (it shows the sample image).
- The share extension. (Backup and restore shipped with accounts, `lib/cloud.ts`.)

**Auth frontend and sharing**
- `/auth` is the new-install welcome: wordmark, serif line, "Get started" (guest, into the role question) and "I have an account"; after a sign-out on this phone it leads with "Continue as <name> · <provider>". You → Back up your plan opens account settings.
- Built `/auth/login`, `/auth/signup` and `/auth/forgot-password`: email/password fields, optional signup name, password visibility, autofill hints, field validation, keyboard Next/Go/Send, legal links and navigation between flows. Each pushed screen uses a glass back chevron; the auth cover opened from the app has a glass X.
- Accounts are wired through `lib/auth-client.ts` on Supabase: email with emailed codes for confirm and reset (`/auth/verify`, `/auth/reset-password`), Google, Apple, sign out, authenticated deletion, `Purchases.logIn`/`logOut` for RevenueCat identity, and plan backup/restore (`lib/cloud.ts`). `lib/auth.ts` keeps the unavailable fallback for builds without Supabase keys. Signing out backs up and then removes the plan from the phone; signing in never merges two plans (Oct 21, 2026).
- [ ] On a device: each provider, cancellation, a reset code, deletion (including Apple token revocation), and a restore on a second phone.
- Built `/share-schedule`: day/week selection, category filters, title redaction, a message preview with Open preview, and a read-only schedule. Entry from the glass share button in Plan or You → Account → Share your schedule. Create share link remains unavailable until a backend exists; there are no public URLs yet.
- Sharing rendering uses an explicit field allowlist. Notes, source files, employer metadata, account data, private IDs and completed entries are excluded. The title switch substitutes Busy/To-do before the viewer receives data. Cloud backup, permanent links, recipient access/revocation and cross-device sync remain future work.

**UI still to do**
- Scrubbing the day bar to change the countdown.
- "Block time to study" on an empty Plan day (needs its own board).
- Course row tint dot in the native header (Sheet takes a string title).
- A compact 18/26 type token; the hero line is a body override in Review and the new screens.
- Shared format helpers: `longMonthDay`, `clock`, `period`, the source-name helper are duplicated across item, review, course, employer, import and data. Move to `lib/format.ts`.
- `FieldPill` is duplicated as `ReviewPill` and in Create; one component in Controls.
- The pill-to-native-picker swap needs a second tap on iOS (the compact SwiftUI picker can't open programmatically).
- Series end picker cannot be clamped (DateField has no min or max).
- Large text and VoiceOver pass over the new screens; swipe actions as accessibility actions.
- Sample week removal on the first real import, with a toast.
- "Still open" overdue pile: "Mark all done" is in; auto-collapse after 14 days is not.
- Semester-over prompt on School ("Fall 2026 is over · Remove 4 courses?").
- Resume a closed review ("Finish reviewing Campus Café · 7 shifts" on Add).
- "Already in your plan" close-only review is built; the duplicate-screenshot detection depends on matching quality.

**Motion review (this pass)**
- Removed: raw durations in onboarding (now tokens).
- Added: toggle glyph crossfade, week chart selection pop, photo fade-in.
- Kept and worth watching on device: layout animations on long lists (Today with 10+ rows), the Ticker on every minute, the Plan week swap (remounts the chart with a slide), the onboarding typing demo at 28ms per step.
- Still missing: a pull-to-refresh is not needed (local data); a haptic on the week chart day tap; the hour view blocks could fade in on first open.

**Verify on a device**
- The `search` role tab, swipe actions under the gesture root view, the glass circles, the share sheet for export and .ics, the 15-week series default in a real syllabus.

**Canvas sync (no backend)**
- Built Oct 19, 2026 on the Canvas calendar feed link (`lib/canvas.ts`, `lib/canvas-sync.ts`, You → Canvas, a row on Add). Matched by Canvas UID (`Item.externalId`); moved dates update, done stays done, upcoming items that leave the feed are removed, an empty or failed feed changes nothing. Each sync is one undoable batch.
- Onboarding asks where deadlines live (Canvas, a syllabus PDF, screenshots and texts, nowhere yet; `settings.deadlineSource`, with `lms: 'canvas'` kept for the Canvas tip). Canvas connects in place of the own-import step; the fallback is the screenshot/syllabus import.
- The first sync is free (the onboarding value moment); auto-sync and Sync now need `semli_plus`.
- [ ] Connect a real student's feed on a device: UTC vs TZID times, all-day assignments, course matching against an imported syllabus, a reset feed link.
- [ ] Update the pricing and SEO pages once verified ("coming soon" today).
- Brightspace (D2L) feeds connect through the same sync since Oct 27, 2026, for UGA's eLC (`uga.view.usg.edu`). York (`ycp.instructure.com`) and Pomona (`canvas.pomona.edu`) are Canvas. Onboarding and Settings ask Canvas or eLC/Brightspace and show that system's steps.
- [ ] Before the UGA handout: connect a real eLC feed on a device. The event names ("- Due", "- Availability Ends"), the course in LOCATION and the Subscribe menu path come from D2L's student guides, not a live feed; check UGA hasn't turned calendar feeds off.
- [ ] Blackboard and Moodle also publish iCal feeds; add them in the order the `lms` answers say.

**Urgent items and ringing alarms**
- Events and to-dos have an explicit Urgent switch in Create and item details, with an Urgent label in lists and the hour view. Imports never infer urgency. Existing saved items remain compatible.
- Urgent is part of Semli Plus (Oct 20, 2026): the switch asks for Plus before turning on, `lib/plus-status.ts` carries the entitlement to the alarm sync, and alarms are cancelled on a lapse and restored on a purchase or restore.
- Timed urgent items use the native iOS 26+ AlarmKit integration in `apps/mobile/src/native`. Enable ringing alarms from the item or Settings → Reminders; alarm authorization and the ringing preference are separate from ordinary notification permission. Untimed urgent items ask for a time. No backend is needed.
- Alarm synchronization keeps the nearest 32 future urgent items scheduled, preserves an unchanged alarm that is currently ringing, updates changed titles/times, and cancels alarms when items are completed, deleted, unmarked, or ringing alarms are disabled. It only changes Semli's recorded alarm IDs. Synchronization runs after hydration, item/preference changes, and foregrounding; open Semli periodically to replenish the 32-alarm window.
- Existing native binaries prompt the person to update Semli. Android and older iOS retain urgent labels and ordinary reminders; full ringing alarms are not implemented there. Do not describe a notification sound as a full ringing alarm.
- Native build configuration includes `NSAlarmKitUsageDescription` and Expo inline modules for `src/native`. From `apps/mobile`, regenerate with `npx expo prebuild --platform ios`, then build with `npx expo run:ios --device` or `npx eas-cli@latest build --platform ios --profile development`. This cannot ship through a JavaScript-only update or Expo Go. Expo SDK 58 lists Xcode 26.4+ for local builds; use a compatible local or EAS toolchain.
- Verified: full Debug iOS simulator build for arm64 and x86_64, Expo registration of `SemliAlarms`, weak linking of AlarmKit for older iOS, mobile lint/typecheck, and all 144 automated tests. Actual ringing has not yet been verified on a rebuilt physical device.
- [ ] On a physical iOS 26+ device: allow/deny/revoke alarm permission; schedule an urgent event and to-do a few minutes ahead; verify ringing while locked and with Semli closed; test system Stop, silent/Focus behavior, rescheduling, completion/deletion/unmarking and Undo, global disable, restart, timezone/DST changes, and the nearest-32 boundary. Confirm UI never reports an alarm set after native failure.
- [ ] Add Android's separate native ringing-alarm implementation before advertising full ringing alarms on Android.
