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
| Syllabus, free | Opus 5.5, read as text | 96.9% | 19.8 s | $0.11 |
| Syllabus, Plus | Opus 5.5 fast, read as text | about the same | about 8 s | about $0.21 |

Haiku handing back nothing usable (a refusal, a cut-off answer) is read again by Opus. Fast mode has its own rate limit; a 429 there retries at standard speed. The readers are server settings (`EXTRACT_QUICK_MODEL`, `EXTRACT_DOCUMENT_MODEL`, `EXTRACT_FAST` in `docs/env.md`), never in the app, so a model changes with a Vercel redeploy and no release. Run the benchmark before changing one.

## Reading PDFs as text first (tested Oct 27, 2026)

The API reads a PDF page as both an image and its text, about 7,000 tokens for three pages against about 1,000 for text alone ([PDF support](https://platform.claude.com/docs/en/build-with-claude/pdf-support)). Pulling the text out first with a PDF library takes 30 to 60 ms per syllabus (poppler's `pdftotext -layout` on the five benchmark syllabi, 4 to 20 pages). Read as text by each model, graded by the benchmark's scorer:

| Syllabi read by | Dates and times | Extra items | Median wait | Cost per syllabus |
|---|---|---|---|---|
| Opus 5.5, whole PDF (live) | 96.9% | 2.4% | 21.6 s | $0.17 |
| Opus 5.5, extracted text | 98.0% | 1.2% | 22.4 s | $0.11 |
| Sonnet 5.5, extracted text | 93.3% | 2.4% | 18.2 s | $0.065 |
| Haiku 5.5, extracted text | 76.5% | 16.3% | 32.3 s | $0.005 |

Opus on the text is more accurate, back under the 2% extra-item gate, and a third cheaper; the wait doesn't change, because writing the answer, not reading, is now most of both the time and the cost. Lower effort and shorter evidence quotes were also tried on whole PDFs and saved nothing (medium effort: same cost, 96.5%; low: 12% cheaper, 85%).

**Built the same day** (`packages/extract/src/pdf-text.ts`, unpdf 1.8.1): the server rebuilds each page's layout from PDF.js text positions (rows by baseline, columns by position, a blank line wherever the page leaves vertical space between table rows) and sends that to Opus. Any page with under 80 visible characters, under 300 in all, a failed parse or a parse over 4 s sends the whole PDF instead. On the benchmark through the live path: 96.9% of dates and times (the same as whole PDFs), 97.8% of other fields (from 96.8%), $0.107 a syllabus (from $0.166), 19.8 s median. The row breaks mattered: without them a dense 20-page nursing schedule dropped to 95.7%. `EXTRACT_PDF_TEXT=0` turns it off; the route logs `[extract.pdf]` with which way each PDF was read.

**Also built Oct 27, 2026.** A cache of finished syllabus reads (`apps/web/lib/syllabus-cache.ts`, table `syllabus_cache`): keyed by a SHA-256 of the PDF plus term, reader, prompt version and date locale; only syllabi and course schedules, never work schedules; the read, not the file; 150 days; a 1.5 s lookup budget, after which it reads normally; logged as `[extract.pdf] { via: 'cache' }`. And rows streamed as they're written: the app asks with `Accept: application/x-ndjson`, the server sends one line per item as the model finishes it, a `reset` if another reader starts over, then the same response a single request returns (`ExtractStreamLine` in `@dayli/schema`); older apps and the site get one response as before. Measured on the built server: a syllabus's first row at 11.7 s instead of the whole answer at 22.4 s, then one row about every 0.8 s; on the phone the reading screen fills in row by row ("Found 5 so far…") before review opens. Haiku with thinking switched off was tried for speed and rejected: no faster on messages, more questions, and 9.5% extra items on screenshots.

## The wait itself

`components/Reading.tsx`: the heading steps through what is happening for that kind of input and holds on its last step instead of looping; the line under it says how long it usually takes; after 10 s it says they can keep using Semli and the review opens when ready (the import keeps running while they move between tabs, and the ready sound plays when it lands).

## Not built yet

- A push notification when an import finishes while the app is in the background.
- A faster first row on syllabi: Opus thinks for about 11 s before writing; Plus's fast mode cuts that to about 4 to 5 s.
