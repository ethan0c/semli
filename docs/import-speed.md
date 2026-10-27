# Import speed

Decided Oct 27, 2026, after the founder's test: "add morning and evening cardio before and after work" took 15–18 s and the wait said nothing.

## How long people will wait

| Wait | What happens | Source |
|---|---|---|
| ≤0.1 s | Feels instant | [Nielsen](https://www.nngroup.com/articles/response-times-3-important-limits/) |
| ≤1 s | Flow of thought holds; show progress past it | [NN/g](https://www.nngroup.com/articles/progress-indicators/) |
| 3 s, mobile web | 53% of visits abandoned (2017, page loads) | [Google](https://thinkwithgoogle.com/consumer-insights/consumer-trends/mobile-site-load-time-statistics/) |
| ~10 s | Attention runs out; people want to do something else and need to know when it ends | [Nielsen](https://www.nngroup.com/articles/response-times-3-important-limits/) |

What makes a wait feel shorter, strongest evidence first: any progress at all ([Myers 1985](https://www.cs.cmu.edu/~bam/papers/percentdoneCHI85.pdf)); showing the work being done ([Buell & Norton 2011](https://ideas.repec.org/a/inm/ormnsc/v57y2011i9p1564-1579.html)); explaining the wait and giving it an end ([Maister](https://davidmaister.com/blog/201/The-Psychology-of-Waiting-Lines.html)); getting something on screen early. Skeleton screens set out the layout but did not shorten the felt wait in a mobile study ([Viget](https://viget.com/articles/a-bone-to-pick-with-skeleton-screens)). Past about 10 s, let people leave and tell them when it's done.

## Models, measured

The extraction benchmark (`evals/`: 32 typed messages, 10 schedule screenshots, 5 syllabi), prompt `2026-10-27.1`. Accuracy is date/time fields correct; times are medians.

| Model | Typed | Screenshots | Syllabi |
|---|---|---|---|
| Opus 5.5 standard | 99.1%, 2.5 s | 100%, 7.9 s | 96.9%, 21.6 s (slowest 64 s) |
| **Opus 5.5 fast** | 99.1%, **1.2 s** | 100%, **3.4 s** | 97.3%, **8.3 s** (slowest 25 s) |
| Sonnet 5.5 | 99.1%, 1.8 s | 100%, 5.1 s | 91.4%, 16.6 s |
| Haiku 5.5 | 99.1%, 2.2 s | 100%, 5.7 s | 91.8%, 25.1 s, 9% extra items |

The 16-item cardio request: 14.0 s on Opus, 5.5 s on Opus fast, about 7 s on Haiku with the same 16 items and times.

**Decision, revised the same day on cost** (fast mode for every import made free users' month-one syllabi the largest cost in the business): each input goes to the cheapest model that holds Opus's accuracy on it.

| Input | Reader | Accuracy | Median wait | Cost per import |
|---|---|---|---|---|
| Typed or spoken message | Haiku 5.5 | 99.1% | 2.0 s | $0.0002 |
| Screenshot | Haiku 5.5 | 100% | 6.2 s | $0.001 |
| Syllabus, free | Opus 5.5 | 96.9% | 21.6 s | $0.17 |
| Syllabus, Plus | Opus 5.5 fast | 97.3% | 8.3 s | $0.34 |

Haiku handing back nothing usable (a refusal, a cut-off answer) is read again by Opus. Fast mode has its own rate limit; a 429 there retries at standard speed. The readers are server settings (`EXTRACT_QUICK_MODEL`, `EXTRACT_DOCUMENT_MODEL`, `EXTRACT_FAST` in `docs/env.md`), never in the app, so a model changes with a Vercel redeploy and no release. Run the benchmark before changing one.

## The wait itself

`components/Reading.tsx`: the heading steps through what is happening for that kind of input and holds on its last step instead of looping; the line under it says how long it usually takes; after 10 s it says they can keep using Semli and the review opens when ready (the import keeps running while they move between tabs, and the ready sound plays when it lands).

## Not built yet

- Rows arriving as they are read (streaming the extraction), so the first row shows in about a second even on a long syllabus.
- A push notification when an import finishes while the app is in the background.
