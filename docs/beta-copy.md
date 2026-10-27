# Beta copy, ready to paste

Oct 20, 2026. Copy for the steps in [marketing-500.md](marketing-500.md). Rules for all of it: no founder name or face, say "more than 50" survey respondents, never the exact count in public, never name a vendor. There are two separate TestFlight links: **Survey has a 60-person cap for the 58 survey respondents; public Beta has a 200-person cap.** Use "200 beta spots" only in public Beta outreach. Survey emails use their own invite and do not advertise the public group's spots. Replace `LINK` in public outreach with `https://semli.app/beta?r=<source>`, which logs the click and forwards to the Beta group's TestFlight link `https://testflight.apple.com/join/j15Rp5m4` (cap 200) once `TESTFLIGHT_URL` is set on Vercel so every channel shows up in the referral leaderboard (`select ref, count(*) from waitlist group by ref`).

| Where | `r=` tag |
| --- | --- |
| Survey email | none: use the Survey group's own TestFlight link, `https://testflight.apple.com/join/vG3RD6EJ` (capped at 60 for 58 addresses) |
| Reddit, one per subreddit | `reddit-<sub>`, e.g. `reddit-studentnurse` |
| Discord | `discord-<server>` |
| Creator | `<handle>` |
| Brand TikTok and Instagram bio | `tiktok`, `ig` |

## 1. Survey email (week 1, before anything else)

Send through a Resend Broadcast to the Survey segment, using the branded [survey-invite.html](emails/survey-invite.html). Send only once the Survey invite accepts testers and installs the build. The link was not accepting testers at the earlier Oct 20 check; confirm it works before sending. Keep the survey rows tagged `Survey` in the `waitlist` table's `ref` column (matched without regard to case) so they stay apart from people who sign up on the site.

These people did not sign up on the site; they were added from the survey. So don't count them in the public waitlist number in posts. Use `select count(*) from waitlist where lower(ref) is distinct from 'survey'` for that.

**Subject:** An update on that student planner survey

Use the current [HTML](emails/survey-invite.html) or [plain-text draft](emails/survey-invite.txt). Copy lives in `emails/emails.md` and the shared layout in `emails/layout.mjs`; run `npm run email build` after editing them so both versions stay aligned.

### Send it in Resend

Status, Oct 20, 2026: sender domain verified. Resend had no contacts at the Oct 20 check; `npm run email sync` creates them from the Supabase `waitlist` table. The email template is prepared locally; no broadcast or email has been sent from this repo.

1. Create a Broadcast in Resend. Select the **Survey** segment and confirm the recipient count matches the imported list, allowing for unsubscribed or suppressed contacts. Leave public Beta contacts out of this campaign.
2. Use **Semli** as the sender name and your already verified sending address. Set Reply-To to `hello@semli.app` after confirming replies reach an inbox you monitor. Subject: **An update on that student planner survey**.
3. Open the editor's HTML code view and paste the complete contents of [survey-invite.html](emails/survey-invite.html). Per your preference, it contains no pictures: `semli.` is a text wordmark, with a cream `#FAF9F6` background, ink `#222320` HTML button, and purple `#7057BD` wordmark dot and links. Fonts fall back to the email client's system fonts; there are no external font downloads. Keep `{{{FIRST_NAME|there}}}` for the greeting and `{{{RESEND_UNSUBSCRIBE_URL}}}` for each recipient's unsubscribe link. Replace `[SENDER_POSTAL_ADDRESS]` with the sender address, or set `EMAIL_POSTAL_ADDRESS` when building the templates.
4. Send previews to your own test inboxes. Check the text branding, narrow-screen layout, Survey invite, and Reply-To. The unsubscribe token resolves through Resend, not in a local browser preview. Keep open and click tracking off for this initial send; open tracking would insert a hidden image even though the template has none. Confirm the campaign's sending domain has tracking off without changing account-email settings.
5. Once the Survey invite installs the build and the previews look right, review the recipient segment and send or schedule the Broadcast. Review delivery failures afterward. Send the gift-card winner their claim code separately using [survey-follow-up.txt](emails/survey-follow-up.txt).

Resend supports [editing raw HTML in the dashboard](https://resend.com/changelog/introducing-the-new-email-editor) and [automatic Broadcast unsubscribe links](https://resend.com/blog/broadcast-api). A browser preview checks layout; inbox placement and email-client rendering still need the real preview sends.

Image research, Oct 20, 2026: [SendGrid's content-rejection guidance](https://www.twilio.com/docs/sendgrid/ui/analytics-and-reporting/bounce-and-block-classifications) warns about emails made mostly of images with little readable text; it does not say a small logo automatically causes spam placement. [Gmail's sender guidelines](https://support.google.com/mail/answer/81126?hl=en) emphasize authentication, sender identity, spam complaints, and unsubscribe handling. Removing images follows your preference and avoids reliance on image loading, but does not guarantee inbox placement. [Resend's tracking explanation](https://resend.com/blog/introducing-custom-tracking-domain) confirms that open tracking embeds a 1×1 image.

### Public icon URLs

The site already serves the brand icons. Both URLs were checked on Oct 20, 2026: HTTP 200, `image/png`, with downloaded files matching this repo. No sign-in or temporary URL is needed.

| Asset | Public URL | Source |
| --- | --- | --- |
| App icon | `https://www.semli.app/icon.png` | `apps/web/app/icon.png` |
| Apple touch icon | `https://www.semli.app/apple-icon.png` | `apps/web/app/apple-icon.png` |

Use these absolute HTTPS URLs if adding icons to a future email. The existing Supabase account-email templates already use the app icon URL. The current Survey invitation stays image-free; hosting an image on the site does not by itself prevent spam placement.

### Other email templates

Every email's words live in one file, `emails/emails.md`, with a short guide at the top: `## name` per email, `[words](url)` for a purple underlined link, `**words**` for medium weight, `Button:` for the one pill, `{name}` for the first name. `emails/templates.mjs` reads it and everything renders through the one layout in `emails/layout.mjs` (the app icon as the header mark, from `design/render-pngs.mjs` and served at `semli.app/email/icon.png`, with the typeset wordmark until the site serves it. Not the wordmark image: Gmail's dark mode darkens the page but never images, so a paper-backed wordmark showed as a light box, Oct 27, 2026; ink pill button; Geist if installed and system fonts otherwise; under 80 words for anything sent to a group). `npm run email build` writes the HTML and text versions locally without sending; `npm run email preview` opens all of them side by side. Edit `emails.md`, never the generated files. Broadcasts greet with [Resend's documented first-name fallback](https://resend.com/blog/broadcast-api), `{{{FIRST_NAME|there}}}`.

**Resend templates (Oct 27, 2026).** `npm run email publish` creates or updates a published Resend template for every email, named and aliased like its `## name`, with the sender, reply-to, subject, HTML and text. Templates can't use the broadcast fallback and Resend reserves `FIRST_NAME`, so they greet with the `NAME` variable (fallback "there"). The site sends `welcome` and `account-deleted` from their templates, so publishing is how those two change. An edit made in Resend's editor is overwritten by the next publish. Publish again after any site deploy that first serves the wordmark image.

| Email | To | Subject | When |
| --- | --- | --- | --- |
| `survey-invite` | Survey | An update on that student planner survey | Wed Oct 28, 2026, 10 am Eastern: the launch, in the survey respondents' own email |
| `public-beta-invite` | Waitlist | Your Semli beta invite is here | Retired Oct 27, 2026 (no beta); `app-store-launch` went to Waitlist instead |
| `app-store-launch` | Waitlist | Semli is on the App Store | Tue Oct 27, 2026, the day the listing went public (see [launch-week.md](launch-week.md)) |
| `spring-schedule` | Survey + Waitlist + App users | Registered for spring? Add your classes now | Tue Nov 17, 2026: spring registration is open at most schools |
| `semester-reminder` | Survey + Waitlist + App users | Got your new syllabus yet? | Tue Jan 5, 2027: the week before most spring terms start |

**When to send (decided Oct 26, 2026).** Tuesday or Wednesday at 10 am Eastern (7 am Pacific): student and general benchmarks put opens best at 9:30 to 11:30 am on those days and worst at 7 pm to 2 am. Compare your own open rates after two sends. Nothing the week of Thanksgiving (Nov 24 to 29), during finals (Dec 7 to 18) or over the break (Dec 19 to Jan 3); no broadcasts after add/drop closes (about Jan 20). A finals email ("finals, spread out") on Tue Dec 1 and a day-one syllabus email on Tue Jan 12 are the two optional sends. Every App Store button goes through `www.semli.app/get?r=email-<name>` (`email-launch`, `email-spring`, `email-semester`): the site counts the click in `beta_clicks` under that tag, then passes it to the App Store as the campaign `ct=email-<name>` once `APP_STORE_PROVIDER_TOKEN` is set on Vercel, so App Store Connect → App Analytics → Campaigns shows installs per email. Apple hides a campaign until 5 different Apple Accounts have installed through it. Clicks can run a little high: school mail filters open links to scan them.
| `feedback-thank-you` | one person | Thanks for the Semli feedback | `npm run email send feedback --to … --name … --about "…" --reply "…"` |

Groups are Resend segments, and the free plan allows three. Survey = waitlist rows tagged `Survey`, any case; Waitlist = every other row; App users = every account with a confirmed address (Testers until Oct 27, 2026, when it was empty and renamed). An address with an account is only in App users, so a broadcast to several groups reaches each person once. The App users copy of a broadcast says "You're getting this because you have a Semli account." in its footer. `npm run email sync` reads Supabase through the CLI (`npx supabase login` first): accounts into App users (contacts whose account is gone are deleted), then the `waitlist` table into Survey and Waitlist. Every `send` to App users runs the account half first. Sync looks up each contact before writing, because Resend's create call overwrites an existing contact and would re-subscribe someone who opted out.

**The welcome email** is not a broadcast. When an account first has a confirmed address (Apple or Google at sign-up, email after the code, a guest who adds one), a database trigger queues it in `email_outbox` (`supabase/migrations/20261027100000_welcome_email.sql`), and the site sends it 45 minutes later and adds the address to App users. Every 10 minutes a `pg_cron` job (`send-email-outbox`, migration `20261027120000_email_outbox_schedule.sql`) calls `/api/emails` through `pg_net`, only when a row is due, so welcomes land 45 to 55 minutes after sign-up; the daily Vercel cron at 15:00 UTC is the backup. `select * from cron.job_run_details order by start_time desc limit 5` shows the recent runs. Words: `emails/emails.md`, published as the `welcome` template. Subject "Welcome to Semli"; it asks for a reply. Accounts made before the migration don't get one. Apple's private relay addresses receive it because `semli.app` is registered under Sign in with Apple → Email Sources in the Apple Developer account (Oct 27, 2026). Relay mail has to pass SPF and DKIM: Resend signs as `semli.app` and sends from `send.semli.app`, both checked the same day. Moving the sender to another domain means registering that domain with Apple too.

Before sending launch or semester emails, check both recipient groups against the updates they actually requested. These emails go to Survey and Waitlist, which means every imported row, Survey respondents included. Sync does not check a separate ongoing-updates opt-in. The footer wording assumes that the recipients asked for those messages, so that audience still needs review before either campaign is sent.

Sending: `npm run email status` shows every group's count and every email's last broadcast. `npm run email send <name>` creates a draft broadcast in Resend to proof; `--yes` sends and `--yes --at 2027-01-05T13:00:00Z` schedules. `npm run email send all` drafts all five at once. Needs a full-access Resend key in the repo-root `.env` and `EMAIL_POSTAL_ADDRESS` set for the footer. Keep open and click tracking off on the sending domain.

## 2. Reddit founder post (one per subreddit, ever; Tuesday evening)

Post from the pseudonymous account. Attach the Today screenshot (`design/screenshots/03-today-mon.png`). Change only the first line per subreddit.

**Title:** I built an iPhone planner that reads syllabi and work schedules. Looking for students to try it.

> *(r/StudentNurse first line)* If you're keeping track of clinicals, classes and work shifts, I'd like to hear how you manage it.
> *(r/college first line)* I'm building a planner for students whose deadlines and work schedules are scattered across a bunch of places.
> *(r/GetStudying first line)* A planner only helps if you actually put your deadlines in it. I'm trying to make that part easier.
> *(r/sideproject and r/iosapps first line)* I've been building an iPhone planner on my own, and it's ready for some outside feedback.
>
> Earlier this year, I surveyed more than 50 college students about how they keep track of school and work. 83% said they'd missed or nearly missed an assignment because it got buried somewhere.
>
> That helped me decide what to build: Semli. You add a syllabus PDF, a screenshot of your shifts, or a message from class. It picks out the dates so you can check them before saving anything. Then you can see what's coming up and where work overlaps with class.
>
> The calendar, to-dos, reminders, overlap warnings and three imports a month are free. Plus adds unlimited imports and keeps Canvas in sync.
>
> It's still early. There's no Android app, web planner, or two-way sync with Google or Apple Calendar yet.
>
> If you'd like to try it on iPhone, there are 200 beta spots: LINK
>
> I'll be around in the comments over the next couple of days. What usually makes you stop using a planner?

Reply to every comment for 48 hours. Don't repost to the same subreddit.

## 3. Discord (study servers, self-promo or feedback channel only)

Attach one clip from `design/clips/out/` (the syllabus one).

> Hey, I've been building an iPhone planner called Semli for students who also work. You can add a syllabus or a screenshot of your shifts, check the dates it finds, and put them on one calendar. It also flags overlaps between work and class.
>
> I'm looking for people to try it with their actual schedules, especially if you're juggling clinicals or a job. It's free to test, with 200 beta spots: LINK
>
> If you try it, let me know what gets confusing or what you'd want it to do differently.

## 4. Creator DM (nursing and study creators, 5k to 50k followers)

> Hey! I built an iPhone planner called Semli. It takes dates from a syllabus or work schedule so you don't have to enter them all by hand.
>
> Would you be interested in making a paid video trying it with one of your own syllabi or schedules? No script. I'd just want you to show how it goes and say what you think.
>
> The offer is $75 when the video goes live, plus a year of Semli Plus. I'd also ask you to put the beta link in your bio. Happy to send you an invite so you can try it before deciding.

Pay on publish. Two in November, two the week of Jan 5.

## 5. Friday build-in-public post (brand account, text only)

Pick one each week:

> [installs] people have tried Semli so far. This week I fixed [one real bug and what it was doing]. Most people are starting with [kind of import]. If you've tried it, how did yours go?

> Someone tried adding [a real, unexpected type of schedule] to Semli this week. It picked up [x] of the [y] items. It missed [what it missed], so I'm working on [the actual next fix].

> There are [verified remaining spots] of the 200 beta spots left. If you've been meaning to try Semli with your class or work schedule, here's the invite: LINK

Use real numbers from the Monday funnel. Check remaining spots in the public Beta TestFlight group; total installs include the separate Survey group. Only mention a fix you're actually working on, and leave out anything that could identify a tester. Never invent a number.

## 6. TestFlight fields (already in App Store Connect doc)

Beta App Description and What to Test are in [app-store-connect.md](app-store-connect.md#L245). Use the review account `review@semli.app` for Beta App Review sign-in.
