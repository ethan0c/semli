# TikTok and Instagram plan: memes through the January push

Status: Nov 1, 2026. Replaces the weekly clip schedule in [marketing-500.md](marketing-500.md) §3.3 and §5, [launch-playbook.md](launch-playbook.md) §4 and [launch-week.md](launch-week.md). Those pages still cover creators, Reddit, email, campus and the install targets.

## 1. The decision

Memes are the main format on the brand accounts. Rendered slide decks stop. The eight simulator clips stay unscheduled for now. Post 4 times a week, drop to 2 over the break, and go to 5 in January, when students actually buy.

The goal is installs. Likes only tell us a post landed, so every check below uses saves, shares, watch time and link clicks.

## 2. What we know so far

Numbers from TikTok Studio, Nov 1, 2026.

| Post | Format | Views | Likes | Like rate |
|---|---|---|---|---|
| "sorry i have a lot going on" (Oct 31) | Meme | 524 | 38 | 7.3% |
| "sorry i have a lot going on" (Oct 30) | Meme | 317 | 15 | 4.7% |
| "explain my screen time" (Oct 29) | Meme | 897 | 41 | 4.6% |
| "classes and clinicals" (Oct 28) | Desk photo | 342 | 14 | 4.1% |
| "catch the clash" (Oct 28) | Deck, likely the $25 Promote | 19K | 197 | 1.0% |
| #syllabus (Nov 1, one hour old) | Deck | 136 | 1 | 0.7% |

- The three memes together: 94 likes on 1,738 views, 5.4%.
- The syllabus deck had 99.2% of its traffic from For You, a 2.36 second average watch, 1.5% full watches and no new followers. TikTok showed it to people, and they left.
- The memes have zero comments so far. Nothing yet shows that these viewers want the app.
- Paid viewers usually engage less, so the gap with the 19K post is exaggerated. Meme watch times still need pulling from View data.

## 3. Schedule

Posts go out around 11 am Eastern. That's close to when the memes have gone out so far, not a proven best time.

| Dates | Posts a week | Days | Weekly mix |
|---|---|---|---|
| Nov 2 to Nov 15 | 4 | Mon, Wed, Fri, Sun | 2 work and school jokes, 1 general joke, 1 aesthetic post |
| Nov 16 to Nov 22 | 4 | Mon, Wed, Fri, Sun | Set by the Nov 16 check; the weekly repeat of the best joke returns |
| Nov 23 to Dec 18 | 4 | Mon, Wed, Fri, Sun | Finals and "academic comeback" jokes in the best type, 1 repeat |
| Dec 19 to Jan 3 | 2 | Wed, Sun | Light break jokes, just to stay active |
| Jan 4 to Jan 24 | 5 | Mon to Fri | 3 syllabus-week jokes, 1 repeat, 1 real import framed as a joke |

Set the schedule after Jan 24 from January's numbers.

The "Finals: no posts" row in the launch-week table applies to Reddit and email. Memes keep going, because finals are the joke, and the Sunday batch means they take no time during finals.

Post the same memes to Instagram the same day, and skip Instagram rather than the batch if time runs short.

## 4. The first two weeks

| Date | Slot | Idea |
|---|---|---|
| Mon Nov 2 | Work and school | "closing shift until 11, exam at 8am" |
| Wed Nov 4 | Work and school | "told my manager I have finals, told my professor I have work" |
| Fri Nov 6 | General | "email professor back (day 6)" |
| Sun Nov 8 | Aesthetic | "locked in (for 20 minutes)" |
| Mon Nov 9 | Work and school | "clinicals at 6am, care plan due 11:59, eat (tbd)" |
| Wed Nov 11 | Work and school | "swapped my shift to study, studied for 20 minutes" |
| Fri Nov 13 | General | "the group chat said we'd split it evenly" |
| Sun Nov 15 | Aesthetic | "romanticizing my 8am so i don't drop the class" |

The work and school jokes need new presets in `apps/mobile/src/lib/meme-demo.ts`. Until those exist, type the fake schedule into a development build.

## 5. Each week

| When | Minutes | What |
|---|---|---|
| Sunday | 60 to 90 | Make the week's posts and schedule them on tiktok.com (desktop only, about 10 days ahead) |
| Monday | 10 | Add saves, shares, watch time and clicks to the Monday funnel read |

Making a meme: `zsh design/load-meme.sh <preset>`, take the screenshot, run `python3 design/slides/fit-tiktok.py <file>`, then `zsh design/load-meme.sh off` when you're done.

Drop the Friday build-in-public post while this runs, so it doesn't muddy the test. With that gone, the marketing week comes to about 3.5 to 4 hours. Once creators are booked, the 30-minute "DM one creator" slot in marketing-500 §5 goes too, which brings it to about 3 to 3.5 hours.

## 6. Rules for every post

- **Joke first, app as the prop.** No calls to action and no import limits in the caption. Those belong on the App Store listing and the site.
- **Keep it casual.** Real screenshots and photos, with TikTok's own text. No rendered slides, no "1/4" counters.
- **Fake schedules must read as jokes.** They're obvious fiction, so they make no claim about any real person or result.
- **No first-person claims that aren't true of whoever runs the account.** No "how I manage my clinicals" unless that's real.
- **No AI people and no AI testimonials.** That includes avatars posing as students or customers. AI can help draft joke schedules, and a person picks the funny ones.
- **Aesthetic posts use your own photos or Unsplash, with no pins from Pinterest.** No attractive person standing in for the account, and no faces unless they've agreed. Have Semli open on the phone or laptop when you can.
- **No more Promote.** The January rule in marketing-500 §2 stands: only boost a post that already did well, funded from revenue.

## 7. Checks

Compare the median post of each type, so one hit doesn't decide it. These samples are small, so treat each result as a reason to adjust, not as proof.

| Date | Question | Bar | If it passes | If it misses |
|---|---|---|---|---|
| Mon Nov 16 | Which joke type works best? | Saves plus shares per 100 views, one type at twice the other | That type takes 3 of the 4 weekly posts | Keep the mix for two more weeks |
| Mon Nov 16 | Are aesthetic posts worth keeping? | Any saves or link clicks from the two posts | Run two more | Drop them |
| Mon Nov 30 | Do the memes send people to the app? | 1 `tiktok` click per 200 views from Nov 2 to Nov 29 | Stay the course through finals | Show more of the app in the posts, starting with the held clips |

The 1-in-200 bar is a starting guess, not a benchmark. A miss means the posts need changing. It doesn't mean posting more.

Clicks by week:

```sql
select date_trunc('week', at) as week, count(*)
from beta_clicks
where ref = 'tiktok'
group by 1
order by 1;
```

The bio must stay `semli.app/get?r=tiktok`, or these counts go quiet. If `APP_STORE_PROVIDER_TOKEN` is set on Vercel, installs for the same tag are in App Store Connect under App Analytics → Campaigns.

The install targets and the mid-November check in [launch-week.md](launch-week.md) still apply.

## 8. Do first

- [ ] Open tonight's 6:50 pm scheduled post. If it's a deck, swap it for a meme.
- [ ] Pin "catch the clash", so anyone tapping through from a meme can see what Semli does.
- [ ] If nobody on the account is in clinicals, delete the Oct 28 "classes and clinicals" post. Photo text can't be edited after posting.
- [ ] Pull View data for "explain my screen time" and the 524-view "sorry i have a lot going on": average watch, full watches, saves, shares and traffic source.
- [ ] Confirm the 19K post is the Promote.
- [ ] Check the TikTok and Instagram bios still use `semli.app/get?r=tiktok` and `?r=ig`.
- [ ] Send the creator DMs in launch-week. Creators are the real version of UGC: videos live the weeks of Nov 9 and Nov 16, two more for Jan 5, no script.
