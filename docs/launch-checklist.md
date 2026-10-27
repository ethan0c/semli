# Launch checklist: Oct 20, 2026 to Jan 11, 2027

Status: Oct 20, 2026; superseded Oct 27 by [launch-week.md](launch-week.md), since the app released that day instead of Jan 5. The supplies table still applies. One list, in date order, of everything that has to exist before the beta opens the week of Nov 3 and before classes start Jan 11. Sources: [app-store-connect.md](app-store-connect.md) §8, [todo.md](todo.md), [marketing-500.md](marketing-500.md), [milestones.md](milestones.md). Tick things here; the other docs explain how.

## The supplies, all of them

Everything the campaign needs to have ready, with where it lives. Make these once; the weekly three hours only reuse them.

| Supply | Where | Done when |
|---|---|---|
| App Store record, every field | App Store Connect, from [app-store-connect.md](app-store-connect.md) | Pasted and saved, screenshots uploaded for 6.9 and 6.3 inch |
| Store screenshots, header, search card | `design/screenshots`, `6.3-inch`, `header` (rerendered Oct 21, 2026) | Uploaded |
| TestFlight Survey link, cap 60 for 58 respondents | [Survey invite](https://testflight.apple.com/join/vG3RD6EJ), survey emails only | The invite accepts testers and installs the build from an iPhone |
| Separate TestFlight Beta link, cap 200, behind `semli.app/get?r=name` | [Public Beta invite](https://testflight.apple.com/join/j15Rp5m4), `apps/web/app/beta/route.ts` | A tap on the link from a phone installs the build and PostHog logs the `r` tag |
| Waitlist on semli.app | Live | A signup lands in the Supabase `waitlist` table with its `r` tag |
| Eight faceless clips from the simulator | `design/clips/` | Eight MP4s, captions burned in, scheduled on the brand accounts |
| Brand TikTok and Instagram accounts | Not personal; bio link `semli.app/get` | Clips scheduled one a week through December |
| Founder post, written once | [marketing-500.md](marketing-500.md) §3.6, "more than 50 students" | Saved as a text file with the Today screenshot |
| Survey email | One paragraph, from you, to the survey respondents | Drafted, sent Nov 3 |
| Creator brief and DM | One page: $75 on publish, free Plus for a year, one real import on screen, link in bio, we may repost with credit | Sent to 20 nursing and study creators; 4 booked |
| Creator list | 20 names, 5k to 50k followers, last five videos show their own screen | Spreadsheet with handle, size, niche, status |
| Product Hunt coming-soon page | producthunt.com | Live, collecting followers |
| Reddit account with history | Pseudonymous, helpful answers for two weeks before any post | 10 comments in, no links |
| Discord servers joined | Study Together, nursing student servers; rules read | List with the channel that allows self-promo |
| Waitlist email 1 and 2 | "Semester starts next week, set it up in two minutes" (Jan 5) and day-one email (Jan 11) | Drafted in December |
| Flyer and sticker | One page, QR to `semli.app/get`, the Today screenshot, "Set up your semester in two minutes" | Ordered by Dec 20, delivered by Jan 8 |
| Ambassador agreement | Two people, $50 after 25 installs each, free Plus | Two names by Dec 15 |
| Support playbook | [todo.md](todo.md): Restore, reminders, wrong schedule, export | One page |
| Beta tester quotes | With permission, after Dec 15 | Three lines for the site |

## Keep it small

One person runs this. The toolkit is the rating prompt in the app, App Store Connect's own analytics, and the `?r=` link ([milestones.md](milestones.md) §6). Anything else is a January-or-later question, and only if a number asks for it.

## What we can claim

- **"The daily planner for college students."** Keep it. The definite article is a positioning claim, not a measurable one, and it is on every page already.
- **"Best" and "#1".** Do not use "#1" until there is a number to cite: a chart position, a Product Hunt rank, a rating with its count. MyFitnessPal's "#1 nutrition tracker" sits on top of a download count. An unsupported "#1" is an FTC substantiation problem and gives a competitor a one-line reply. "Best" is puffery and survives review, but it reads like every other listing. Spend the words on the thing nobody else does: "the planner that reads your syllabus".
- **Competitor lines on the site.** Say only what the reviews show ([strategy.md](strategy.md) §3): Structured locks repeating events behind Pro, MyStudyLife's users report hours of setup. Never say what a competitor cannot do unless it was checked that month.
- **Survey numbers.** 83%, 73%, 65% with their questions, "more than 50 students, spring 2026". Never the exact count in public.

## Week by week

### Oct 20 to 26: the product is submittable

- [ ] App Store Connect: every field in [app-store-connect.md](app-store-connect.md) §1 to §6 pasted; the keyword field ends in `canvas`.
- [ ] Screenshots, header and search card uploaded.
- [ ] Production keys in EAS env; web host env; Supabase anonymous sign-ins, migrations, Resend SMTP, email templates (`supabase/templates/README.md`), Site URL.
- [ ] Sign in with Apple: App ID capability, Supabase provider, new binary, real-device check with Hide My Email.
- [ ] Internal TestFlight build to you and Rico. One sandbox purchase per term, Restore, the trial shows as a trial in RevenueCat.
- [ ] A reminder fired on a real phone. A Canvas feed synced on a real phone.
- [x] Rating prompt: the system prompt after the second confirmed import on a second day, 120-day cooldown, quiet after a Plus gate (`apps/mobile/src/lib/store-review.ts`). Verify once on a TestFlight build; Apple only shows the sheet in production builds.
- [ ] Site: waitlist live and tested end to end with an `r` tag; Search Console verified; `APP_STORE_LIVE` stays false.
- [ ] Brand TikTok and Instagram created. Product Hunt coming-soon page up.
- [ ] Creator list of 20 written; brief written.

### Oct 27 to Nov 2: the beta is reachable

- [ ] External TestFlight group "Survey", separate invite link, cap 60 for 58 respondents, reviewed build available.
- [ ] External TestFlight group "Beta", public link, cap 200, Beta App Review passed.
- [ ] `semli.app/get` redirects to the public link and logs `r` to PostHog.
- [ ] Eight clips rendered from the simulator, captioned, scheduled weekly on both brand accounts.
- [ ] Founder post written and saved. Survey email drafted.
- [ ] Twenty creator DMs sent. Two booked for the weeks of Nov 3 and Nov 17.
- [ ] Reddit account commenting helpfully; Discord servers joined.
- [ ] Notification tap routing verified on a device, cold launch included.
- [ ] Clean install → onboarding → real import → review → Today checked on a device; update with local data preserved.

### Nov 3 to 9: week one

- [ ] Tue Nov 3: survey email sent. Creator video 1 live.
- [ ] Mon: funnel read (waitlist, installs, first imports, paywall views, trials).
- [ ] Wed to Thu: reply to every tester message.
- [ ] Fri: build-in-public post on the brand account.

### Nov 10 to 16

- [ ] Tue: founder post on r/StudentNurse. Reply for 48 hours.
- [ ] First two tester interviews (coffee cards).
- [ ] Check first-import rate within a day of install; under 40% means onboarding, not acquisition.

### Nov 17 to 23

- [ ] Creator video 2 live.
- [ ] Tue: founder post on r/college.
- [ ] Mid-November check: under 25 installs means the message is wrong; rewrite around the missed-assignment line and rerun.

### Nov 24 to 30

- [ ] Discord posts (one per server, clip attached).
- [ ] Recruit the two January ambassadors from the most engaged testers.
- [x] Draft waitlist emails 1 and 2: `app-store-launch` and `semester-reminder` in `emails/emails.md`, with [groups and sending notes](beta-copy.md#other-email-templates). `npm run email send app-store-launch --yes --at …` after the listing is live.

### Dec 1 to 14: the purchase test window

- [ ] Tue posts: r/GetStudying, then r/sideproject and r/iosapps.
- [ ] Remaining interviews. Ask the three paying testers for a quote.
- [ ] Book the two January creators for the week of Jan 5.
- [ ] Flyer and sticker designed; order placed by Dec 20.
- [ ] Product Hunt launch assets: tagline, first comment, five images from the store set.

### Dec 15: decision day

- [ ] 10 or more of the first 50 engaged testers subscribed: submit 1.0 for App Review with Jan 5 as the release date.
- [ ] Fewer: do not submit. Fix the paywall or onboarding, rerun the test in January with the semester plan.

### Dec 16 to Jan 3: review and the break

- [ ] App Review passed; release set to manual for Jan 5.
- [ ] Testimonial lines on the site, with permission.
- [ ] Flyers and stickers in hand by Jan 8.

### Jan 4 to 10: public release

- [ ] Tue Jan 5: release live, `APP_STORE_LIVE = true`, Product Hunt launch, both creator videos live, waitlist email 1.
- [ ] Apple Search Ads at $10 a day on exact-match competitor terms, only if the purchase test passed.
- [ ] Campus paper and the nursing program's newsletter emailed once.

### Jan 11: classes start

- [ ] Flyers and stickers up in the nursing building and library.
- [ ] Ambassadors start; the semester plan is the ask.
- [ ] Waitlist email 2 on day one.
- [ ] Monday read, then the weekly three hours as in [marketing-500.md](marketing-500.md) §5.
