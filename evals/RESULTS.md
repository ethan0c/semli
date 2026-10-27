# Extraction benchmark results

Recorded 2026-10-19T17:23:59.881Z. Model `claude-opus-5-5`, prompt `2026-10-19.7`.

Full release gate: **PASS**.

| Input | Cases | Date/time accuracy | Item recall | Other labeled fields | Extra items |
| --- | ---: | ---: | ---: | ---: | ---: |
| Synthetic text | 30 | 100.0% | 100.0% | 100.0% | 0.0% |
| Public schedule images | 10 | 100.0% | 100.0% | 100.0% | 0.0% |
| Public syllabi PDFs | 5 | 99.2% | 100.0% | 98.9% | 1.2% |

Every input type is required to meet 95% temporal accuracy, recall, and other annotated fields, with no more than 2% extra items. Missing items lose all their date/time fields. Null values are graded. See [method and annotation rules](README.md), [machine-readable results](result.json), and [source manifest](sources.json).

The images were selected for multi-person grids, split shifts, dense spreadsheet exports, grouped work areas, breaks, and tiny mobile text. Sources include 7shifts, When I Work, and Deputy. PDFs include a 20-page nursing syllabus, cross-page tables, military times, conflicting years/AM–PM labels, and assessments given only by week number. The texts are synthetic.

This is a development benchmark used to tune the extractor, not an independent holdout or proof of accuracy on future customer uploads. Public vendor schedules are demonstrations. Class recurrence exceptions for holidays/online days and verbatim evidence accuracy are not scored.

## Model comparison, Oct 27, 2026

Prompt `2026-10-27.1` (adds the existing-plan rules), same cases, run with `--model` and `--fast`. Date/time accuracy and median latency:

| Model | Typed (32) | Screenshots (10) | Syllabi (5) |
| --- | --- | --- | --- |
| `claude-opus-5-5` | 99.1%, 2.5 s | 100.0%, 7.9 s | 96.9%, 21.6 s; extra 2.4% |
| `claude-opus-5-5` fast | 99.1%, 1.2 s | 100.0%, 3.4 s | 97.3%, 8.3 s; extra 3.5% |
| `claude-sonnet-5-5` | 99.1%, 1.8 s | 100.0%, 5.1 s | 91.4%, 16.6 s; extra 2.5% |
| `claude-haiku-5-5` | 99.1%, 2.2 s | 100.0%, 5.7 s | 91.8%, 25.1 s; extra 9.2% |

The app now reads in fast mode (`docs/import-speed.md`). The syllabus extra-item rate is over the 2% gate on every model at this prompt: `pdf-east-texas-nursing` adds two items on Opus (and `pdf-njit-biology` one more in fast mode). The one typed miss is shared by all four models. Opus syllabus results come from a `--kind pdf` rerun after the API spend limit cut the first run short.

## Changes verified

- User name reaches extraction context so multi-person schedules can be filtered.
- Every schedule date column and work area is checked; split shifts and repeated days stay separate.
- Small still images are enlarged within a fixed bound before model reading; original fixtures are unchanged.
- Syllabus policies are read across pages; unknown quiz dates stay unresolved and quiz series are consolidated.
- Optional material and holidays are excluded from obligations; source contradictions produce specific questions.
- Media uses high reasoning effort, and the API route allows 180 seconds for longer document reads.

## Remaining mismatches

- `pdf-njit-biology`: Extra: Read Gould 1994 (2025-01-28 null)
- `pdf-florida-economics`: class|lecture.repeat_until: expected "2024-12-04", got "2024-11-21"; class|lecture.repeat_until: expected "2024-12-04", got "2024-11-19"
- `pdf-east-texas-nursing`: dosage.*(?:make.up|retake)|make.up.*dosage.kind: expected "task", got "event"; simulation.start: expected "11:50", got null; simulation.end: expected "14:40", got null

## Validation

53 unit tests passed; workspace and eval type checks passed; mobile lint passed; Next.js production build passed. The downloader fetched and SHA-256 verified all 15 public assets. Raw model outputs and token usage remain in the ignored local report `evals/reports/full-v7.json`.

Earlier complete runs are retained locally: v4 passed text/images but failed PDF extra-item limits; v5 passed text/PDF but missed the image threshold (94.7%). Increasing image effort alone did not fix the tiny grid; bounded image enlargement passed that probe before this full rerun. Earlier partial PDF probes used incomplete annotations and are not directly comparable.
