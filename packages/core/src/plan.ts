import type { Course, Extraction, ExtractedItem, IconName, Item } from '@dayli/schema';
import { assessment } from './assessment';
import { WEEKDAYS, addDays, dayNumber, isLocalDate, isLocalTime, typicalTermEnd, weekdayOf } from './dates';
import { diffSchedule, type ScheduleDiff } from './diff';

/** An extracted item after validation, ready for the review screen. */
export interface Draft {
  key: string;
  include: boolean;
  kind: Item['kind'];
  title: string;
  category: Item['category'];
  icon: IconName;
  date: string | null;
  start: string | null;
  end: string | null;
  isDeadline: boolean;
  courseCode: string | null;
  evidence: string;
  question: string | null;
  needsInput: boolean;
  /** Set on every occurrence expanded from one repeating item; null for one-offs. */
  seriesId: string | null;
  /** Last date of the series, and whether that end was a guess because the source did not say. */
  seriesUntil: string | null;
  seriesEndUnknown: boolean;
}

export type DatedDraft = Draft & { date: string };

export const CONFIDENCE_THRESHOLD = 0.85;
/** Fifteen weeks: a semester, used when a repeating class has no end date. */
export const DEFAULT_TERM_DAYS = 105;

export function iconFor(i: Pick<ExtractedItem, 'kind' | 'category' | 'title' | 'is_deadline'>): IconName {
  const t = i.title.toLowerCase();
  if (assessment(i.title)) return 'exam';
  if (/buy|pick up|shop|store|groceries/.test(t)) return 'bag';
  if (/read|chapter|ch\.|study|review/.test(t)) return 'book';
  if (/write|draft|essay|paper|post|care plan/.test(t)) return 'pen';
  if (i.category === 'work') return 'work';
  if (i.category === 'school' && i.kind === 'event') return 'school';
  if (i.kind === 'task') return 'check';
  return 'calendar';
}

/**
 * Validate model output, expand repeating classes into dated items, and mark
 * anything that needs the user's attention. Never trusts the model's dates
 * blindly: invalid or out-of-range values become questions.
 */
export function toDrafts(extraction: Extraction, today: string): Draft[] {
  const drafts: Draft[] = [];
  extraction.items.forEach((raw, idx) => {
    const base = normalize(raw, today);
    if (raw.repeat_weekdays.length > 0 && base.date) {
      // A repeating class with no end date runs to the typical end of its term; the review asks "Until when?".
      const endUnknown = !isLocalDate(raw.repeat_until);
      const until = endUnknown ? typicalTermEnd(base.date).date : raw.repeat_until!;
      const days = new Set(raw.repeat_weekdays);
      const seriesId = `series-${idx}-${base.date}`;
      let n = 0;
      for (let d = base.date; d <= until && n < 120; d = addDays(d, 1)) {
        if (days.has(weekdayOf(d))) {
          drafts.push({ ...base, key: `${idx}-${n++}`, date: d, seriesId, seriesUntil: until, seriesEndUnknown: endUnknown, question: n === 1 && endUnknown ? 'Until when does this repeat?' : null, needsInput: n === 1 && endUnknown });
        }
      }
      if (n > 0) return;
    }
    drafts.push({ ...base, key: `${idx}` });
  });
  return drafts.sort(
    (a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || (a.start ?? '').localeCompare(b.start ?? ''),
  );
}

function normalize(raw: ExtractedItem, today: string): Omit<Draft, 'key'> {
  const date = isLocalDate(raw.date) ? raw.date : null;
  const start = isLocalTime(raw.start) ? raw.start : null;
  const end = raw.kind === 'event' && isLocalTime(raw.end) ? raw.end : null;
  let question = raw.question;
  if (!date) question ??= 'When does this happen?';
  else if (dayNumber(date) < dayNumber(today) - 1) question ??= 'This date has already passed. Does it look right?';
  else if (dayNumber(date) > dayNumber(today) + 400) question ??= 'This date is more than a year away. Does the year look right?';
  if (raw.kind === 'event' && !start && !raw.is_deadline) question ??= 'What time does this start?';
  const needsInput = question !== null || raw.confidence < CONFIDENCE_THRESHOLD;
  return {
    include: true,
    kind: raw.kind,
    title: raw.title.trim(),
    category: raw.category,
    icon: iconFor(raw),
    date,
    start,
    end,
    isDeadline: raw.is_deadline,
    courseCode: raw.course_code,
    evidence: raw.evidence,
    question,
    needsInput,
    seriesId: null,
    seriesUntil: null,
    seriesEndUnknown: false,
  };
}

// ---------------------------------------------------------------------------
// Matching against what's already stored
// ---------------------------------------------------------------------------

export function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function titleSimilarity(a: string, b: string): number {
  const ta = new Set(normalizeTitle(a).split(' ').filter(Boolean));
  const tb = new Set(normalizeTitle(b).split(' ').filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

export type Match = { type: 'duplicate'; existingId: string } | { type: 'update'; existingId: string } | null;

export function matchExisting(
  draft: Pick<Draft, 'kind' | 'title' | 'date' | 'start' | 'end'>,
  existing: Pick<Item, 'id' | 'kind' | 'title' | 'date' | 'start' | 'end'>[],
): Match {
  if (!draft.date) return null;
  for (const e of existing) {
    if (e.kind !== draft.kind || e.date !== draft.date) continue;
    const sim = titleSimilarity(e.title, draft.title);
    if (sim >= 0.999 && e.start === draft.start && e.end === draft.end) return { type: 'duplicate', existingId: e.id };
    if (sim >= 0.6) return { type: 'update', existingId: e.id };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Building the commit
// ---------------------------------------------------------------------------

export interface CommitPlan {
  create: Omit<Item, 'id' | 'createdAt' | 'batchId' | 'sourceId'>[];
  update: { id: string; patch: Partial<Item> }[];
  remove: string[];
  skipped: number;
  schedule?: { employer: string; coversFrom: string; coversTo: string; diff: ScheduleDiff<Item, DatedDraft> };
}

export function planCommit(
  extraction: Pick<Extraction, 'detected_type' | 'employer' | 'covers_from' | 'covers_to'>,
  drafts: Draft[],
  existing: Item[],
  courseIdByCode: (code: string | null) => string | null,
): CommitPlan {
  const chosen = drafts.filter((d): d is DatedDraft => d.include && d.date !== null);
  const plan: CommitPlan = { create: [], update: [], remove: [], skipped: 0 };

  const toItem = (d: DatedDraft): CommitPlan['create'][number] => ({
    kind: d.kind,
    title: d.title,
    category: d.category,
    icon: d.icon,
    date: d.date,
    start: d.start,
    end: d.end,
    isDeadline: d.isDeadline,
    done: false,
    completedAt: null,
    courseId: courseIdByCode(d.courseCode),
    employer: d.category === 'work' ? extraction.employer : null,
    seriesId: d.seriesId,
    notes: null,
  });

  if (extraction.detected_type === 'work_schedule' && extraction.employer) {
    const shifts = chosen.filter((d) => d.category === 'work');
    const dates = shifts.map((s) => s.date).sort();
    const coversFrom = isLocalDate(extraction.covers_from) ? extraction.covers_from : dates[0];
    const coversTo = isLocalDate(extraction.covers_to) ? extraction.covers_to : dates[dates.length - 1];
    if (coversFrom && coversTo) {
      const employer = extraction.employer;
      const stored = existing.filter(
        (i) =>
          i.category === 'work' &&
          normalizeTitle(i.employer ?? '') === normalizeTitle(employer) &&
          i.date >= coversFrom &&
          i.date <= coversTo,
      );
      const diff = diffSchedule(stored, shifts);
      plan.schedule = { employer, coversFrom, coversTo, diff };
      plan.create.push(...diff.added.map(toItem));
      plan.update.push(...diff.changed.map((c) => ({ id: c.before.id, patch: { start: c.after.start, end: c.after.end } })));
      plan.remove.push(...diff.removed.map((r) => r.id));
      plan.skipped += diff.unchanged.length;
      // Non-shift items in a schedule import fall through to normal handling.
      chosen.splice(0, chosen.length, ...chosen.filter((d) => d.category !== 'work'));
    }
  }

  for (const d of chosen) {
    const m = matchExisting(d, existing);
    if (m?.type === 'duplicate') plan.skipped++;
    else if (m?.type === 'update') plan.update.push({ id: m.existingId, patch: toItem(d) });
    else plan.create.push(toItem(d));
  }
  return plan;
}

/**
 * The courses an import brings that aren't stored yet. A syllabus names its one course; a class
 * schedule (a registration screenshot) lists several classes, each carrying its code, so each code
 * becomes a course named after its class. Before Oct 27, 2026 only the syllabus course was added,
 * and a whole semester's schedule landed with no courses on School.
 */
export function newCourses(
  extraction: Pick<Extraction, 'detected_type' | 'course'>,
  drafts: Pick<Draft, 'include' | 'kind' | 'title' | 'courseCode'>[],
  stored: Pick<Course, 'code' | 'title'>[],
): Omit<Course, 'id' | 'sourceId'>[] {
  const out: Omit<Course, 'id' | 'sourceId'>[] = [];
  const same = (a: string | null, b: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
  const known = (code: string | null, title: string) =>
    [...stored, ...out].some((k) => same(k.code, code) || same(k.title, title));
  const course = extraction.course;
  if (course && !known(course.code, course.title)) out.push({ code: course.code, title: course.title, instructor: course.instructor });
  if (extraction.detected_type !== 'course_schedule') return out;
  for (const d of drafts) {
    // By code alone: two classes can share a title ("Lab") but not a code.
    if (!d.include || d.kind !== 'event' || !d.courseCode?.trim() || [...stored, ...out].some((k) => same(k.code, d.courseCode))) continue;
    out.push({ code: d.courseCode.trim(), title: d.title, instructor: null });
  }
  return out;
}

export { WEEKDAYS };
