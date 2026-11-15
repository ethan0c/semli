# Strategy: goal, competition, and what we do about it

Status: Nov 9, 2026. The founder raised the long-term goal to $200K MRR; pricing arithmetic and the purchase-test status below are updated. The competitor review data and other strategic observations remain historical findings from Oct 19, 2026.

## 1. The goal, in our numbers

The founder's long-term goal is **$200,000 MRR**, updated Nov 9, 2026. That is **$2.4 million in annualized recurring revenue**, before store fees, taxes and operating costs. $20K MRR is now an intermediate milestone. The goal has no committed completion date.

Using the student prices in [pricing-and-positioning.md](pricing-and-positioning.md) and [the product setup brief](revenuecat-offerings-brief.md), the subscriber requirements are:

| Pricing scenario | Monthly revenue per active payer | Payers for $20K MRR | Payers for $200K MRR |
|---|---:|---:|---:|
| All student monthly ($4.99) | $4.99 | 4,009 | 40,081 |
| All student semester ($14.99 / 6 months) | $2.4983 | 8,006 | 80,054 |
| All student yearly ($24.99 / year) | $2.0825 | 9,604 | 96,039 |
| Illustrative student mix: 40% monthly, 40% semester, 20% yearly | $3.4118 | 5,862 | 58,620 |

These are arithmetic scenarios, not forecasts of plan mix or demand. Counts use unrounded monthly values and round up to whole subscribers. Regular-price subscriptions would change the average. The previous table used an obsolete four-month semester term and yearly price; this table uses six months and $24.99 yearly. Two current paid subscriptions are too few to establish the eventual mix.

The revised goal needs tens of thousands of simultaneously active paying subscribers. Plan growth around measured acquisition, first-import completion, retention, renewals and contribution after fees and service costs. Campus cohorts are an initial audience to learn from; the current $500 launch plan does not yet establish a distribution path to that scale. An install-to-paid assumption alone cannot determine the required active user base or annual downloads without retention and churn.

Use $1K, $10K, $20K, $50K and $100K MRR as intermediate checkpoints on the way to $200K. Set later budgets and dates from observed conversion, renewals and acquisition costs. Keep the current November targets and Dec 15 purchase test as the next evidence to collect.

The memo's reading of the survey ("45 of 66 willing to pay") is off. The tallies from the CSV: **17 yes, 35 maybe, 14 no**. 17 firm yeses is the honest base; the 35 maybes are the trial's job.

## 2. The test that matters next

The goal memo is right that stated willingness is not purchasing. The test: **50 engaged testers, a short free trial, then the real $4.99 / $14.99 offer. 10–15 subscribers (20–30%) is a strong signal; 5 is still informative.**

The app launched Oct 27, and the test now runs in production through Dec 15 under [launch-week.md](launch-week.md). By Nov 9, the user reported 31 lifetime App Store app units and two production trial conversions totaling $39.98; see [the actuals](milestones.md#actuals--nov-9-2026). First-import completion and the matched engaged-user cohort remain unverified. Keep the goal of at least 10 paid conversions among the first 50 engaged users; two purchases do not establish repeatable acquisition or renewal behavior.

## 3. What the competitors' own users say (last 250 reviews each, Oct 2026)

| App | Recent avg | 1–3 star share | Top complaints |
|---|---|---|---|
| Structured | 4.08 | 25% | **Paywall** (recurring events locked behind Pro, "useless free version"), recurring/repeat handling, calendar sync |
| MyStudyLife | **1.62** | **92%** | Bugs (can't edit class times, changes don't save), **setup time** ("over 2 hours"), subscription, sync |
| Tiimo | 3.56 | 38% | Paywall, "the AI sucks", charged during free trial, notifications |

Three openings:
1. **The incumbent student planner is failing its users right now.** MyStudyLife's rating has cratered on bugs and setup friction. "Set up your semester in two minutes" is a direct answer to its most common complaint.
2. **Don't paywall the basics.** Structured's loudest complaint is that recurring events need Pro. Our free tier keeps calendar, to-dos, reminders, and repeating classes free; only AI imports are metered. Say that out loud in the listing.
3. **Make the AI accountable.** Tiimo's AI reviews are brutal because it acts without showing its work. Our review step with the evidence line ("read from: Fri 10/30 4:00p–10:00p") and nothing-saved-until-you-confirm is the differentiator. Also: never charge inside a trial without a reminder the day before.

## 4. Structured memo, point by point

| Memo says | Our position |
|---|---|
| Structured already has AI planning and scanning; don't just copy it | Agreed. Our wedge is the *semester* (syllabus → every deadline) and the *shift schedule diff*, which Structured doesn't do. |
| Ideal first-run: syllabus or Canvas → classes/deadlines → work screenshot → one calendar → conflicts and study suggestions | This is our onboarding and capture flow, minus Canvas (post-launch) and automated study suggestions (V1.1). Conflicts and overload warnings are built. |
| Win a specific student audience first (nursing, working students) | Agreed; it is the survey's heaviest-hours group and 18% of respondents. |
| Make importing the signature feature | Agreed; it is what the paywall meters, so it has to be the thing people feel. |
| Build an ASO/SEO engine on "student planner", "syllabus to calendar", "assignment tracker", "work school schedule planner" | Agreed. Website pages per query are cheap; the other session has the site. Name choice is tracked in [README.md](README.md). |
| Nav: Home, Calendar, School, You, one Add action | Built: Today, Plan, School, You, glass "+". |
| Student planner that expands, or life assistant with great student features? Memo leans life-assistant | We market as **the daily planner for college students** and keep the engine general (work shifts, personal items, any screenshot). Same thing in practice; the label is the only difference, and "student planner" is the searchable one. Revisit the label after the first 1,000 payers. |

## 5. What changes in the plan because of this
- Milestone 9 gains **purchases** (RevenueCat + StoreKit), trial with a day-before reminder, and the paywall after the first confirmed import.
- Beta exit criterion adds: **≥10 of 50 engaged testers subscribe** within two weeks of the trial ending.
- Store listing copy leads with the two findings: "Set up your semester in two minutes" and "Calendar, to-dos, reminders and repeating classes: always free."
- Keep a quarterly review-mining pass (the script lives in this session's notes; it is 40 lines against the App Store RSS feed) so we hear competitors' users before they do.
