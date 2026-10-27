# Launch playbook: every task, step by step

Status: Oct 27, 2026. The how-to for each line in [launch-week.md](launch-week.md). One person, a phone and a laptop. Copy is ready to paste; where a platform's limits may have moved since this was written, it says "confirm in the app". Links everywhere are `semli.app/beta?r=<tag>`: the route logs the tag to PostHog and sends the phone to the App Store, so every channel can be counted later (`beta_clicks`, grouped by `ref`).

Tags to use, always lowercase: `email-launch`, `tiktok`, `ig`, `reddit-studentnurse`, `reddit-college`, `reddit-getstudying`, `reddit-sideproject`, `reddit-iosapps`, `discord`, `creator-<handle>`, `campus`.

---

## 1. Prove a real purchase unlocks Plus (20 minutes)

Sandbox and TestFlight never test real money on the production build. Do this once, today.

1. On your iPhone, delete any TestFlight build of Semli and install the App Store version.
2. Open Semli, sign in with the account you use day to day (or stay a guest; both must work), go to the paywall (Settings → Semli Plus, or hit an import gate).
3. Buy **Plus monthly, $4.99**. If the trial is offered, take it; a trial is still a real transaction.
4. Confirm in the app: the welcome shows once, Settings → Plan status reads Plus, an import that was gated now runs.
5. RevenueCat dashboard → Customers → search your app user id (Plan status shows it) → the customer has `semli_pro` active, product `semli_plus_monthly_*`, store "App Store", environment **Production** (not Sandbox). If it says Sandbox, you installed the wrong build.
6. Kill the app, reopen: still Plus. Sign out and back in: still Plus. Tap Restore purchases: no "new purchase" celebration, access stays.
7. Refund: open reportaproblem.apple.com on the phone, sign in, find the Semli charge, "Request a refund", reason "Purchased by accident". Apple usually decides within 48 hours. After the refund, the entitlement drops in RevenueCat and the app returns to free; check that once it does.
8. Write the result (worked / what broke) in [todo.md](todo.md) line 12.

If step 5 shows nothing: the production RevenueCat public key or the App Store Connect In-App Purchase key is wrong ([launch-guide.md](launch-guide.md) §1.7). Stop marketing until it's fixed; every install until then is a lost sale.

## 2. Send the launch email (15 minutes, tonight)

The template `app-store-launch` is written and tested ([emails/emails.md](../emails/emails.md)). It goes to the Survey and Waitlist groups in Resend.

1. In the repo, `.env` has `RESEND_API_KEY` with full access (the send-only key Supabase uses cannot create broadcasts).
2. Preview once: `npm run email build` then open `docs/emails/app-store-launch.html` in a browser. Check the link is `https://www.semli.app/beta?r=email-launch`, the postal address is real, the unsubscribe placeholder is present.
3. Draft in Resend without sending: `npm run email send app-store-launch`. Open Resend → Broadcasts → the draft. Check the audience shows both groups and the recipient count is what you expect (around 60 survey plus the waitlist).
4. Send yourself a test from the Resend draft ("Send test"). Open it on the phone, tap the link, land on the App Store listing.
5. Send: `npm run email send app-store-launch --yes`. Evening Eastern is fine; students read email at night.
6. Tomorrow: Resend → Broadcasts → opens, clicks, bounces, unsubscribes. Write opens and clicks in [milestones.md](milestones.md). Over 40% open and 10% click is good for a warm list; under 20% open means the subject line or the sender name, not the product.
7. Anyone who replies gets a reply from you within a day. Those replies are the first interviews.

## 3. Create the brand accounts (45 minutes)

Use a fresh email (`hello@semli.app` or an alias) and a password manager. Never your personal accounts. The copy is from [marketing-500.md](marketing-500.md) §3.4; limits were checked Oct 22 against guides, confirm in the app.

### TikTok

1. Download TikTok, Sign up with email, username `semli.app` (fall back to `semliapp`). Age: your own. Birthdate matters; under-18 accounts lose features.
2. Profile → Edit profile:
   - Name: `Semli · college planner app`
   - Bio (80 max): `Syllabus + work schedule → one plan. Free on iPhone ↓`
   - Photo: the app icon (`design/png/app-icon-1024.png`; square, no rounded corners, TikTok rounds it).
3. Profile → menu (≡) → Settings and privacy → Account → Switch to Business Account → category **Education** (or Software & Apps). Business accounts get the website field and analytics without a follower minimum. The cost: no access to most trending commercial sounds; use the in-app "Commercial sounds" library or your own licensed track.
4. Edit profile → Website: `https://semli.app/beta?r=tiktok`.
5. Settings → Privacy: comments on, Duets and Stitch on (people remixing the clip is reach), downloads on.
6. Follow 20 to 30 accounts from the creator list (§6) so the For You page learns the niche. No mass following.

### Instagram

1. Install Instagram, Create new account with the same email, username `semli.app` (fall back to `semliapp`).
2. Edit profile:
   - Name: `Semli · college planner app`
   - Bio (150 max), three lines:
     `The daily planner for college students.`
     `Screenshot your shifts, drop in your syllabus.`
     `Free on iPhone ↓`
   - Link: `https://semli.app/beta?r=ig`
   - Photo: the app icon.
3. Edit profile → Switch to professional account → **Business** → category "App Page" (or Education). Business accounts can schedule posts in-app and see insights.
4. Settings → Privacy → Comments: on, with hidden-words filter on. Messages: allow requests from everyone (creators will DM back).
5. Follow 20 to 30 from the creator list.

Both: pin nothing until the first clip is up. Then pin, in order, the syllabus, shifts and switch clips. Never the free clip first.

## 4. Schedule the eight clips (2 hours once)

The clips are in `design/clips/out/`: `syllabus`, `shifts`, `switch`, `today`, `plan`, `ask`, `update`, `free`. 1080×1920, captions burned in, no voice, lo-fi placeholder music.

### Sound first

The placeholder bed is not licensed. Either:
- **Re-render silent** and add a sound inside each app when posting: `python3 design/clips/compose.py design/clips/raw/ design/clips/out/ --no-music` (the raw recordings come from `design/clips/record.sh`), then AirDrop the eight MP4s to the phone. In TikTok, "Add sound" from the Commercial sounds library (business accounts only see licensed ones). In Instagram, add audio from the Reels library, pick something from "Trending" that isn't a vocal; the feed rewards it and the business-account library is licensed.
- **Or** buy one track (Epidemic Sound, Artlist, around $15 to $20 a month, cancel after) and `compose.py --music track.mp3`. Simpler, but less reach than in-app sounds.

Pick the first; it's free and it's what the platforms reward.

### Order and dates (one a week, Tuesdays, 7 pm Eastern)

| Week of | Clip | Caption (first line matters; the rest is below the fold) |
|---|---|---|
| Oct 27 | syllabus | Drop in a syllabus. Every due date, on your calendar, before you've finished your coffee. |
| Nov 3 | shifts | Screenshot the schedule taped to the wall at work. Semli puts the shifts next to your classes. |
| Nov 10 | switch | Two minutes from install to a planned semester. If MyStudyLife took you an hour, this is for you. |
| Nov 17 | today | What today actually looks like when work and class are on the same screen. |
| Nov 24 | ask | It won't guess. When a shift has no time, it asks before saving. |
| Dec 1 | plan | The week, with the overlap between your Thursday shift and lab shown before it bites. |
| Dec 8 | update | New schedule next month? Add the new screenshot; it shows what changed before anything moves. |
| Dec 15 | free | Calendar, to-dos, reminders, overlap warnings: free. Imports beyond the first five are the paid part. |

Hashtags, same set under each: `#collegetips #studytok #nursingstudent #studentplanner #collegelife` (TikTok, 5 max useful) and on Instagram add `#studygram #productivityapp #iphoneapp`. No `#ai`.

### TikTok mechanics

- Scheduling exists only on **desktop web** (tiktok.com → Upload) and only up to about 10 days ahead (confirm in the app). So: upload and schedule the first two now, then set a weekly reminder to schedule the next one each Sunday. Or use a free scheduler (Buffer or Later, free tiers handle one account and ten posts) for all eight at once.
- Upload the MP4, paste the caption, add the sound, cover frame: pick the frame where the Today screen is fully visible. Allow comments, Duet, Stitch. "Schedule" → date/time → Schedule.

### Instagram mechanics

- In-app: create a Reel, pick the MP4, add audio, write the caption, "Share to Feed" on, Advanced settings → **Schedule** → date and time (business accounts can schedule up to 75 days ahead; confirm). All eight can go in one sitting.
- Cover: choose the Today frame. Turn off "Recommend on Facebook" unless you also want a Facebook page.
- Alternative: Meta Business Suite on the laptop does the same with a calendar view.

### After scheduling

Each Tuesday evening the clip posts itself. Wednesday: read and reply to every comment in both apps (30 minutes). That's the whole video channel until January.

## 5. Warm the Reddit account (20 minutes a day, two weeks)

Reddit kills new accounts that post links. The founder posts work only from an account with visible history.

1. Create a pseudonymous account on reddit.com (email alias, not the brand name, nothing linking to you). Pick a username that could be any student.
2. Join r/college, r/StudentNurse, r/GetStudying, r/nursing, r/CollegeRant, r/sideproject, r/iosapps. Read each subreddit's rules now, especially self-promotion rules; note them in a text file.
3. Every day, two or three comments that are **only useful**, no app mention, no links:
   - Sort each sub by New. Answer questions you can answer: time management, clinicals and work, how to read a syllabus, planners people use (name competitors honestly, including their weaknesses). Share what the survey taught you as a plain fact ("most people I asked said the dates got buried in a PDF").
   - Length: two to five sentences. Specific beats general.
   - Never argue. Never promote. Never mention being a developer until the founder post.
4. Target before the first post: ten or more comments, comment karma above 50, account older than seven days (r/college asks for it; others filter low-karma posts automatically).
5. Keep a list of threads where someone asks "which planner should I use". Those are for after the founder post, with one honest line about Semli and a link, no more than one a week.

## 6. Build the creator list (3 hours, Thursday)

Twenty creators, 5k to 50k followers, nursing or study niche, who show **their own screen or desk** in their last five videos (they'll show Semli the same way). Under 5k doesn't move installs; over 50k won't take $75.

1. A Google Sheet `Semli creators` with columns: handle, platform, followers, niche, last-5-screen (y/n), email or DM, date DMed, reply, booked week, link tag `creator-<handle>`, paid (date), video URL, installs at 14 days.
2. Finding them, on the phone, logged into the brand accounts:
   - TikTok search: `nursing student study`, `nursing school planner`, `college planner app`, `study with me nursing`, `clinicals and work`. Switch to Users. Open each, check follower count and the last five videos.
   - Instagram: the same searches, plus the Reels tab under `#nursingstudent`, `#studygram`, `#studentnurse`. Open the account, same check.
   - Also: the people who comment thoughtfully on the big study accounts (StudyQuill, UnJaded Jade, Mariana's Study Corner) are often small creators themselves.
3. Qualify in ten seconds: own screen or desk visible, posts at least weekly, comments that look like real students, no obvious engagement pods (hundreds of "🔥" comments, no questions).
4. Twenty names, half nursing, half general study. Follow all twenty from both brand accounts.

### The DM (Friday, first ten; the other ten Wed Nov 4)

Send from the brand account. Instagram DMs land better than TikTok ones; use email if the profile lists one.

> Hey! I built an iPhone planner called Semli. It takes the dates from a syllabus or a work schedule so you don't have to type them all in; it's free on the App Store this week.
>
> Would you be up for a paid video trying it with one of your own syllabi or schedules? No script. Show how it goes and say what you actually think, including what's off.
>
> $75 when the video goes live, plus a year of Semli Plus. I'd ask for the link in your bio for two weeks. Happy to send a code so you can try it first.

Follow-ups: one, five days later, two lines: "Floating this back up in case it got buried. No pressure either way." Then stop.

### When one says yes

1. Give them `https://semli.app/beta?r=creator-<handle>` for the bio and a Plus offer code (App Store Connect → the app → Subscriptions → Offer Codes → a one-time code for the yearly product; or set them up in RevenueCat with a granted entitlement).
2. Agree the week: two for Nov 9 and Nov 16, two for Jan 5. Ask for the video to go live Tuesday to Thursday.
3. One message of guidance only: "Use a real syllabus or schedule, show the review step where it asks before saving, and say what it got wrong." Nothing else; scripted videos die.
4. Pay the day it posts (Venmo, PayPal, Zelle). Write the video URL in the sheet. After 14 days, PostHog → `beta_clicks` where `ref = creator-<handle>` is the install proxy. Rebook the ones above 20 for January at the February terms in [milestones.md](milestones.md) §4.

## 7. The Friday build-in-public post (10 minutes)

Text only, brand account, both platforms (TikTok allows text posts; on Instagram, a plain post with the text on the app's white, Geist, no all-caps). Real numbers from Monday's read or App Store Connect, never invented. Templates in [beta-copy.md](beta-copy.md) §5 with "beta spots" replaced by:

> Semli has been on the App Store for [n] days. [installs] people have installed it; most started with [a syllabus / a shift screenshot]. This week I fixed [one real bug]. If you've tried it, what did it get wrong?

Reply to every comment the same day.

## 8. The Monday funnel read (20 minutes)

Five numbers, every Monday, into [milestones.md](milestones.md). Compare to the week before, not to a wish.

| Number | Where |
|---|---|
| Installs (first-time downloads) | App Store Connect → Analytics → Metrics → Total Downloads, filter First-Time Downloads, last 7 days |
| Onboarding completed | PostHog → Insights → Trends → `onboarding_completed`, unique users, 7 days |
| First import within a day of install | PostHog → Funnels: `onboarding_completed` → `review_committed`, conversion window 1 day. This is the number that decides things. |
| Paywall views | PostHog → `paywall_shown`, unique users |
| Trials and purchases | RevenueCat → Overview → Active trials and New paid; cross-check `purchase_completed` in PostHog |

Also glance at: App Store Connect → Ratings and Reviews (reply to each, §10); Sentry for new crash types; `beta_clicks` grouped by `ref` for which channel sent people.

Decisions that come from the read, already made, so you don't relitigate them on a Monday morning:
- First-import under 40% → stop recruiting, fix onboarding. The channel is not the problem.
- Installs under 25 by Nov 16 → the message is wrong; rewrite the posts around the missed-assignment line and run them again.
- Crash-free users under 99% → the week's engineering is the crash, nothing else.

## 9. Founder post day (Tue Nov 3, then one subreddit a week)

Order: r/StudentNurse (Nov 3), r/college (Nov 10), r/GetStudying (Nov 17), r/sideproject (Nov 24), r/iosapps (Dec 1). One post per subreddit, ever. Tuesday 6 to 8 pm Eastern.

1. Re-read the subreddit's self-promotion rule that morning. Some require flair ("App" or "Self-promo"); some require a mod message first. Follow it; a removed post burns the sub.
2. Post as a text post with the Today screenshot (`design/screenshots/03-today-mon.png`) attached, from the warmed account. Title and body from [launch-week.md](launch-week.md) "The founder post", with the first line swapped per subreddit (the five variants are in [beta-copy.md](beta-copy.md) §2). The link is `semli.app/beta?r=reddit-<sub>`; put it once, near the end, after the honest limitations paragraph.
3. For the first two hours, refresh every 15 minutes and answer every comment. Thank the critical ones and ask a follow-up question; never defend. "That's fair. What would it need to do for you to trust it?" is the whole playbook.
4. Reply for 48 hours. Someone asks for Android: "Not yet; iPhone first because that's what the people I surveyed carry. If it works, Android follows." Someone asks the price: say it plainly, including what's free.
5. Never upvote from another account, never ask friends to upvote, never post the same text twice. Reddit's filters catch all three and the sub's mods remember the app name.
6. Write the post URL and the 48-hour comment count in the sheet. The `reddit-<sub>` tag tells you installs.

## 10. Store reviews and support (15 minutes a day, week one)

- App Store Connect → the app → Ratings and Reviews → each review has a Reply. Reply to all of them, including five stars, within a day; replies are public and are read by the next person deciding. Three templates:
  - Good review: "Thank you. Which import did you start with? I'm trying to learn what people reach for first."
  - Something broken: "Sorry about that, and thank you for saying what happened. Can you email hello@semli.app with what you were adding? I'll fix it and reply when it ships." Then fix it.
  - Wrong expectation (Android, Google Calendar sync): "Not yet, and that's fair. iPhone first; the rest follows if this works. The free calendar and reminders are yours regardless."
- Support email: reply the same day. Keep the [todo.md](todo.md) playbook open: purchase not active → Restore; reminders missing → permission and a test reminder; schedule wrong → review, edit, Undo; lost data → the export.
- Every "it got this wrong" message goes into a `feedback` note with the date. By Nov 16 that note is the roadmap.

## 11. Discord (one evening, week of Nov 9)

1. Join Study Together and two nursing-student servers (search Disboard for "nursing student"). Read #rules; find the channel that allows self-promo or feedback. If none does, post nothing there; ask a mod instead.
2. One post per server, with the syllabus clip attached, text from [beta-copy.md](beta-copy.md) §3 with the beta line replaced: "It's free on the App Store: semli.app/beta?r=discord". Stay in the server afterwards and answer anything for a week.
3. Never post the same text in two channels of one server.

## 12. User interviews (two in the week of Nov 9, three more by Dec 15)

1. Who: PostHog → people with `paywall_shown` who did not purchase, and anyone who emailed. Ask by email: "Would you do a 20-minute call about how you plan your week? $10 coffee card as thanks."
2. Script, in order, and then shut up: How do you keep track of school and work right now? Walk me through the last time something slipped. Open Semli and add something real while I watch (don't help). What did it get wrong? What would make you pay for it, and what would make you delete it?
3. Write the five answers down the same day. Patterns across three interviews are real; one interview is an anecdote.

## 13. The engineering side, so it stops being a list

- `supabase db push` from the repo root with the production project linked: applies `20261021120000_import_allowance.sql`, `20261021130000_plan_size.sql`, `20261023100000_email_outbox.sql`. Without the first, free imports four and five are refused.
- Vercel → the web project → Settings → Environment Variables (Production): `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `CRON_SECRET`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`, `APPLE_CLIENT_ID`. Redeploy after.
- Supabase → Authentication → Providers → Anonymous sign-ins: on. Authentication → Rate limits: anonymous 300/hour, sign-ups 100 per 5 minutes, emails 150/hour, verifications 100 per 5 minutes. Never save a 0.
- App Store Connect → Subscriptions → the two six-month products → Display name "Plus 6 months" (student and regular). Mirror the names in RevenueCat → Offerings → package display names.
