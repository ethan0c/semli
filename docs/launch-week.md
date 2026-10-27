# Launch, as it happened: live Oct 27, 2026

Status: Oct 27, 2026. The App Store listing went public today, ten weeks before the Jan 5 date in [launch-checklist.md](launch-checklist.md). This page re-dates that checklist to the real release and says what to do in the next two weeks, then until Jan 11. The checklist and [marketing-500.md](marketing-500.md) still explain how; this page says when, and in what order. Tick here.

## What changed, honestly

- **There is no beta any more; there is a public app.** The purchase test (50 engaged users, real price, 10 or more subscribe, [strategy.md](strategy.md) §2) now runs in production from today to Dec 15. The TestFlight groups are history. The one link is `semli.app/get?r=<tag>` (`/beta` still works for anything already posted or printed); it goes to the store and the `r` tag rides on it as `ct=`.
- **Late October is the worst buying window of the year.** Midterms are over, Thanksgiving and finals are ahead, and nobody buys six months of a planner six weeks before the semester ends. The monthly plan gets tested now. The six-month plan gets its test on Jan 5, same as before. Do not read November's numbers as the verdict on the price.
- **None of the supplies exist yet.** Every marketing row in the checklist's Oct 20 to 26 block is still open: brand accounts, Product Hunt page, creator list, Reddit account with history. That, not a missing plan, is the gap. The next two weeks are the four-hour setup from marketing-500 §3, spread out.
- **One thing only a live store can prove:** a real-money purchase on the production build unlocks Plus and shows in RevenueCat → Customers with `semli_plus` active. Buy the $4.99 month yourself today, check, then refund it through reportaproblem.apple.com. Sandbox and TestFlight never proved this.

## Days 1 to 14

### Tue Oct 27, today

- [x] Real purchase on the production build, RevenueCat shows the entitlement, refund (Oct 27).
- [x] Launch emails scheduled for Wed Oct 28, 10 am Eastern: `survey-invite` to Survey (their own email: they gave their address on the survey form) and `app-store-launch` to Waitlist. Cancel the two Oct 27 `app-store-launch` broadcasts in Resend first, then `npm run email send survey-invite -- --at "2026-10-28T14:00:00Z" --yes` and the same for `app-store-launch`. The template is written ([emails/emails.md](../emails/emails.md) `app-store-launch`); its link already goes to the store. These ~60 survey respondents and the waitlist are the warmest list there will ever be, and the email was always meant to go the day the listing was public.
- [x] Brand TikTok and Instagram created and finished (Oct 27). Was: with the names, bios and links in marketing-500 §3.4, with the bio's last line as `Free on iPhone ↓` from day one. Link: `semli.app/get?r=tiktok` and `?r=ig` (both redirect to the store, tagged).
- [x] Promotional text in `store.config.json` matches the 2.3.7 rewrite in aso-log.md, in all four locales (checked Oct 27). The live description is 1.1.2's, without Brightspace; that waits for the next store build.

### Wed Oct 28 to Fri Oct 30

- [ ] Schedule the eight clips (`design/clips/out/`), one a week on both accounts, syllabus clip first, with a licensed or in-app sound (marketing-500 §3.3). After this the video channel costs nothing until January.
- [x] Product Hunt: profile made (@semliapp, Oct 27); launch day **Tue Jan 5**; tagline, description and first comment in [beta-copy.md](beta-copy.md) §7. Schedule the launch itself in early December.
- [ ] Reddit: the founder's own seven-year-old account, not a new pseudonymous one (Oct 27: age and karma clear the filters a new account trips). Skim its history first; say "I built this" in every post. Still leave a few helpful comments in r/college and r/StudentNurse before posting, and read each subreddit's self-promotion rules. No second account, ever.
- [ ] Creator list: twenty names, 5k to 50k, their own screen in their last five videos. Send the first ten DMs Friday with the brief (beta-copy §4), the ask now "it's free on the App Store, link in bio".
- [ ] Fri: first build-in-public post on the brand account. The number is the store's first-week downloads, whatever it is.

### Mon Nov 2 to Sun Nov 8

- [ ] Mon: read the funnel in App Store Connect and PostHog: installs, onboarding done, first import within a day, paywall views, trials. Write the five numbers in [milestones.md](milestones.md). Under 40% first-import means onboarding, not acquisition; stop recruiting and fix it.
- [ ] Tue Nov 3, evening: founder post on **r/StudentNurse** (the rewritten version below), reply for 48 hours. One post per subreddit, ever.
- [ ] Send the other ten creator DMs. Aim for two videos live in the weeks of Nov 9 and Nov 16, two booked for the week of Jan 5.
- [ ] Reply to every store review (App Store Connect → Ratings and Reviews) and every support email within a day. In week one the replies are the marketing.
- [ ] Fri: build-in-public post.

### Mon Nov 9 to Sun Nov 15

- [ ] Tue Nov 10: founder post on **r/college**.
- [ ] Discord: one post each in the study servers' self-promo channel, clip attached, rules read.
- [ ] First two user interviews (coffee cards) with people who hit the paywall; PostHog says who reached it.
- [ ] Mid-November check (marketing-500 §7): under 25 installs means the message is wrong, not the channel. Rewrite around the missed-assignment line and rerun.

## Nov 16 to Dec 15: the purchase test, in production

- Tue posts, one a week: r/GetStudying, r/sideproject, r/iosapps. Then none.
- Weekly three hours per marketing-500 §5. Everything else waits.
- Dec 15: 10 or more of the first 50 engaged users subscribed, counting trials that converted. Yes: Jan 5 is a push with Search Ads at $10 a day on competitor terms. No: Jan 5 is still the push, with the paywall or onboarding fixed first and no ad spend.

## Dec 16 to Jan 11: the real launch

The semester plan sells in the two weeks before classes. This was always the moment, and the early release does not move it.

- Dec 20: flyers and stickers ordered, QR to `semli.app/get?r=campus`.
- Jan 5: Product Hunt launch, two creator videos live, `spring-schedule` email to everyone on the list ("Classes start next week; add your new syllabi").
- Jan 11: campus push, two ambassadors, `semester-reminder` email on day one of classes.

## The founder post, rewritten for a live store

Replaces beta-copy §2's TestFlight version. Adjust the first paragraph per subreddit; never the numbers.

> Earlier this year I surveyed more than 50 students about keeping track of classes and work. 83% said they'd missed or nearly missed an assignment because the date was buried somewhere: a syllabus PDF, a Canvas page, a group chat, a shift schedule taped to a wall.
>
> I've spent the year building a planner around that one problem. You drop in a syllabus, a screenshot of your work schedule, or a message from a classmate, and it pulls the dates into one week with reminders. It's called Semli and it went live on the App Store this week.
>
> The calendar, to-dos and reminders are free. There's a paid tier for unlimited imports; I'm saying that up front so nobody feels ambushed.
>
> Things it doesn't do yet: Android, Google Calendar sync, anything outside iPhone. If you try it, I'd genuinely like to hear where the schedule it built was wrong. I read every reply.
>
> [Today screenshot]

## Weekly installs: target and actual

First-time downloads from App Store Connect → Analytics → Units, Monday to Sunday, read every Monday and written in the Actual column the same day. The targets add up to the milestones below (50 by Nov 15, 150 by mid-December, 400 by Jan 17) and are shaped by the calendar: the Reddit posts and creator videos lift a week, Thanksgiving, finals and the break sink one, and the semester push is most of the total. A miss is a question to answer that Monday, not a failure: which channel was quiet (`select ref, count(*) from beta_clicks where at > now() - interval '7 days' group by ref`), and did people who installed import something (first-import rate, PostHog).

| Week (Mon) | What happens | Target | Running target | Actual | Running actual |
|---|---|---|---|---|---|
| Oct 26 | Launch Tue; launch emails Wed; first clips | 12 | 12 | | |
| Nov 2 | r/StudentNurse post Tue; ten creator DMs | 18 | 30 | | |
| Nov 9 | r/college post Tue; Discord; creator video 1 | 20 | 50 | | |
| Nov 16 | r/GetStudying; creator video 2; `spring-schedule` email Tue | 30 | 80 | | |
| Nov 23 | Thanksgiving: expect a dip | 15 | 95 | | |
| Nov 30 | r/sideproject; optional finals email Tue | 30 | 125 | | |
| Dec 7 | Finals: no posts | 25 | 150 | | |
| Dec 14 | Purchase test read Dec 15; r/iosapps | 15 | 165 | | |
| Dec 21 | Break: flyers ordered by Dec 20, nothing else | 10 | 175 | | |
| Dec 28 | Break | 15 | 190 | | |
| Jan 4 | Product Hunt + two creator videos Tue Jan 5; `semester-reminder` email | 120 | 310 | | |
| Jan 11 | Campus cards at York, Pomona and UGA; ambassadors | 90 | 400 | | |

If two weeks in a row land under half their target before Thanksgiving, run the mid-November check below early: the message, not the channel, is what to change.

## What good looks like now

| Number | By Nov 15 | By Dec 15 | By Jan 20 |
|---|---|---|---|
| Installs | 50 | 150 | 400 |
| First import within a day of install | 60% | 60% | 60% |
| Paying | first trial converts | 10 of the first 50 engaged | the six-month plan selling |
| Rating | first five reviews, replied to | 4.5 with 20 or more | 4.5 with 50 or more |

Tens of installs in the first two weeks is the expected shape of a quiet October launch with no list. It is not a verdict; the Jan 5 numbers are.
