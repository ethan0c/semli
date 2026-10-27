# Revenue milestones: dates, the creator engine, and what to watch

Status: Oct 20, 2026. Built on [marketing-500.md](marketing-500.md) (the channels and the $500), [strategy.md](strategy.md) §1 and §2 (the $20K MRR goal and the purchase test), [pricing-and-positioning.md](pricing-and-positioning.md) (prices and the survey) and outside benchmarks listed in §2. The model that produced the tables is 60 lines of Python; rerun it when a real number replaces an assumption.

Public copy never gives the survey's exact count. Say "more than 50 students" on the site, in the founder post and in creator briefs; the n=66 stays in the internal docs.

## 1. The milestones

Dates assume the beta opens the week of Nov 3, 2026 and the purchase test passes by Dec 15. "Base" is the $500 plan run as written, with revenue reinvested only into creator videos. "Push" is the same plan with performance-paid creators from February and twice the campus and creator volume at each semester start.

| Milestone | Base | Push | What has to be true | Paid for by |
|---|---|---|---|---|
| First paid subscription | Nov 20, 2026 | Nov 20, 2026 | Survey email sent Nov 3; paywall after the first confirmed import; 7-day trial converts | $0 |
| 10 paying testers, $100 collected | Dec 15, 2026 | Dec 10, 2026 | 50 engaged testers, 20% of those who see the paywall subscribe (the purchase test) | Survey email, 2 creator videos ($150) |
| $500 collected, $100 MRR | Jan 31, 2027 | Jan 20, 2027 | Public release Jan 5, 2 January creator videos, waitlist email, campus push Jan 11 | The remaining $350 |
| $1,000 collected, $150 MRR | Apr 30, 2027 | Mar 31, 2027 | One creator video a month from February, funded from January revenue | ~$75/month from revenue |
| $250 MRR, $2,000 collected | Aug 31, 2027 | Jul 31, 2027 | Fall push: 6 creator videos the two weeks before classes, 2 campuses, back-to-school search | ~$450 saved from spring |
| $500 MRR | Jan 31, 2028 | Aug 31, 2027 | Push case: 12 videos in August, 4 campuses in January 2028 | ~$900 from fall |
| $1,000 MRR | Fall 2028 (extrapolated) | Jan 31, 2028 | 260 active payers; the spring 2028 push at 2,000+ installs | Revenue only |
| $5,000 MRR | 2029 (extrapolated) | Jan 2029 | 1,300 active payers; a creator affiliate program and 6+ campuses | Revenue plus Apple Search Ads |
| $20,000 MRR (the strategy memo's goal) | 2030 (extrapolated) | 2029 to 2030 | 5,200 active payers at $3.83 blended; about 105,000 installs a year at 5% install-to-payer; 10 to 15 campuses at real penetration | A real marketing budget |

Two honest readings of that table:

- **The first year is small.** Base case ends 2027 at about $3,600 collected and $380 MRR. That is what $500 and three hours a week buy. The point of year one is not the money; it is proving the install-to-payer rate and the creator cost per install, because both decide whether year two can be bought.
- **Every milestone past $500 MRR is an extrapolation.** The model stops at Jan 2028. Beyond that, each semester push is assumed to double the previous one as campuses are added. Replace that with real numbers after the Aug 2027 push.

## 2. The assumptions, with sources

| Assumption | Value | Where it comes from |
|---|---|---|
| Blended revenue per active payer | $3.83/month | 40% monthly, 40% semester, 20% yearly ([strategy.md](strategy.md) §1), 85% at student prices |
| Install to payer, warm traffic (creator link, survey email, campus, waitlist, referral) | 8% (push: 10%) | Our purchase-test target is 20% of engaged testers paying ([strategy.md](strategy.md) §2); with 60% importing and about two-thirds of those reaching the paywall that is 8% of installs |
| Install to payer, cold traffic (search, Reddit, Product Hunt, ads) | 3% (push: 4%) | RevenueCat 2026: education apps' median download-to-trial at day 30 is 6.5%; roughly half of trials convert. [RevenueCat education](https://www.revenuecat.com/state-of-subscription-apps-2026-education) |
| Trial-to-paid | 45 to 55% | Adapty 2026 medians: productivity 58%, education 55%. RevenueCat's overall day-35 median for hard paywalls is 10.7%, so treat 45% as warm-traffic only. [Adapty via RocketShip HQ](https://www.rocketshiphq.com/?p=5390), [RevenueCat benchmarks](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026) |
| Monthly plan churn | 10% a month | RevenueCat: monthly plans lose most subscribers inside the first three months; 10% is the middle of the pack |
| Semester renewal at month 6 | 50% | Our guess; the semester plan is new to the market |
| Yearly renewal at month 12 | 30% | RevenueCat: about 28% of yearly subscribers in freemium apps are still active after one year |
| Installs per $75 creator video | 25 (range 10 to 50) | [marketing-500.md](marketing-500.md) §4 says 10 to 30; a 5k to 50k creator's video gets 2,000 to 8,000 views, 1 to 2% tap the bio link, 56% of taps install |
| Tap-to-install on the App Store | 56% | AppTweak 2025 Apple Ads benchmarks, education 56.4%, productivity 56.5%. [AppTweak](https://www.apptweak.com/en/aso-blog/apple-ads-benchmarks) |
| Apple Search Ads cost per install | $2.91 education, $3.58 productivity (US, 2025) | Same AppTweak report. This is the yardstick a creator video has to beat |
| First-year revenue per payer | about $25 | RevenueCat 2026 realized LTV per payer after one year: education $22.82, productivity $24.95; our semester plan twice a year is $30 gross |
| Buying moments | Jan 5 to 20 and Aug 15 to Sep 10 | Semester starts; SplitMetrics and AppTweak both report the education category's tap-to-install peaking in back-to-school |

Gross, not net. Apple keeps 15% of in-app revenue under the Small Business Program; web checkout for semester and yearly plans keeps about 97%.

## 3. The creator engine

Creators are the face of this campaign ([marketing-500.md](marketing-500.md) §1), so the milestones are a function of how many videos run and what each one returns.

**One video, $75, no script, one real import on screen, beta link in bio with `?r=name`.**

| Installs the video brings | Cost per install | Payers at 8% | First-year revenue | Verdict |
|---|---|---|---|---|
| 10 | $7.50 | 0.8 | $20 | Stop paying this creator; keep the free Plus year |
| 25 | $3.00 | 2 | $50 | Matches Apple Search Ads; pays back in year two if the semester plan renews |
| 50 | $1.50 | 4 | $100 | Book them again, every semester |

A flat $75 is only self-funding above about 40 installs. Three changes make the engine pay for itself sooner:

1. **Performance pay from February.** $40 on publish plus $1.50 per tracked install in the first 14 days, capped at $150. A 25-install video costs $78, a 10-install video $55, a 50-install video $115. Creators who can deliver earn more; the ones who cannot cost less. The `?r=` tag and PostHog already give the count.
2. **Reuse rights in the $75.** Every creator clip is reposted on the brand TikTok and Instagram with credit. That turns four paid videos into four more scheduled posts at zero cost, which is the only way the brand account grows without the founder's face.
3. **Free Plus instead of cash under 10k followers.** A year of Plus costs about $1.50 in AI spend. Offer it to ten small nursing and study creators for one honest video each; expect two to post.

**Cadence by phase**

| Phase | Videos | Why then |
|---|---|---|
| Nov 2026 | 2 | Beta recruiting; they go live the same week as the survey email |
| Jan 5, 2027 | 2 | Semester start, public release |
| Feb to Apr 2027 | 1 a month | Funded from January revenue, performance-paid |
| Jul 2027 | 1 | Summer session; build the fall list |
| Aug 15 to Sep 10, 2027 | 6 (push: 12) | The biggest buying window of the year |
| Jan 2028 | 8 (push: 16) | Spring push, two to four campuses |

Who to book: nursing and study creators with 5k to 50k followers whose last five videos show their own screen. Nursing is 18% of the survey and the heaviest study hours. Ask for one import of their real syllabus or work schedule, the review step on screen, nothing else.

## 4. Month by month, base case

Installs by source and what they turn into. Cash is gross, cumulative; MRR is active payers times $3.83.

| Month | Installs | Videos | New payers | Active payers | Cash collected | MRR | Where the installs come from |
|---|---|---|---|---|---|---|---|
| Nov 2026 | 100 | 2 | 7 | 6 | $100 | $25 | Survey email 20, creators 50, Reddit and Discord 30 |
| Dec 2026 | 50 | 0 | 3 | 9 | $150 | $33 | Referrals, "what should I switch to" threads; finals |
| Jan 2027 | 360 | 2 | 21 | 30 | $500 | $113 | Creators 50, campus 60, waitlist email 100, release and Product Hunt and Reddit 150 |
| Feb 2027 | 200 | 2 | 10 | 39 | $700 | $145 | Two videos from January revenue, campus 30, organic 120 |
| Mar 2027 | 145 | 1 | 7 | 44 | $880 | $162 | One video, referrals, organic |
| Apr 2027 | 145 | 1 | 7 | 49 | $1,050 | $179 | One video, referrals, organic |
| May 2027 | 60 | 0 | 2 | 48 | $1,190 | $175 | Summer |
| Jun 2027 | 50 | 0 | 2 | 48 | $1,310 | $173 | Summer |
| Jul 2027 | 85 | 1 | 4 | 46 | $1,510 | $167 | Summer-session creators, the fall list |
| Aug 2027 | 700 | 6 | 36 | 79 | $2,170 | $291 | Six videos 150, two campuses 150, back-to-school search 400 |
| Sep 2027 | 500 | 4 | 25 | 99 | $2,720 | $368 | Four videos 100, campus 100, organic 300 |
| Oct 2027 | 200 | 1 | 9 | 103 | $3,040 | $378 | Steady state |
| Nov 2027 | 200 | 1 | 9 | 106 | $3,370 | $386 | Steady state |
| Dec 2027 | 120 | 0 | 5 | 106 | $3,630 | $381 | Finals |
| Jan 2028 | 1,000 | 8 | 55 | 152 | $4,730 | $558 | Eight videos 200, four campuses 300, organic 500 |

Push case for the same months: $630 collected by Jan 2027, $1,340 by Apr, $3,420 and $533 MRR by Aug, $9,480 and $1,345 MRR by Jan 2028.

## 5. When to revise, and how

Check these on the Monday read ([marketing-500.md](marketing-500.md) §5). Each one moves a milestone more than any channel does.

- **Install-to-payer under 4% on warm traffic by Dec 15.** The paywall or the product's second week is the problem, not acquisition. Stop booking creators; fix onboarding and the trial reminder first. Every date in §1 slips a semester.
- **Install-to-payer at 10% or better.** Switch to the push column and move Apple Search Ads up to February at $10 a day on exact-match competitor terms, because at 10% a $2.91 install returns about $30 in a year.
- **A creator under 15 installs.** Do not rebook. Over 40, rebook for every semester start and ask for a second format (the "switching from MyStudyLife" clip).
- **Cost per install over $4 across all paid channels for a month.** Pause paid, keep Reddit and Discord, and spend the hours on the ten free-Plus creators instead.
- **Semester renewals under 35% in July 2027.** Email the lapsed semester payers two weeks before classes with an offer code for the first month of a new semester plan; the semester plan is the whole model.

## 6. The three tools, and nothing else

One person runs this, so the kit is three things. Everything else (rank trackers, custom product pages, A/B tests, in-app events) waits until there is revenue and a reason.

1. **The rating prompt in the app.** Built: `apps/mobile/src/lib/store-review.ts` asks with the system prompt after the second confirmed import on a second day, at most once every 120 days, never right after a Plus gate. "Rate Semli" in You stays as the manual path. Ratings are the biggest lever on the product page after screenshots, and this one runs itself.
2. **App Store Connect, App Analytics.** Free and already there. The Monday read adds one number: product page conversion (installs divided by page views). AppTweak's 2025 category median is 56%; under 40% means the first three screenshots or the subtitle are wrong. Reply to every review from the same console within a week; replies show on the listing.
3. **The `?r=` link.** Already built: `semli.app/get?r=name` logs to PostHog before the redirect. It is the only attribution needed to decide which creator to rebook.

Two notes that save time later: keep `canvas` as the last keyword (the two drafts in the repo disagree), and when a testimonial is wanted on the site, take it from a paying beta tester with permission, never from anywhere else.
