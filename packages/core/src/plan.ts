import type { Course, Extraction, ExtractedItem, IconName, Item } from '@dayli/schema';
import { assessment } from './assessment';
import { WEEKDAYS, addDays, dayNumber, isLocalDate, isLocalTime, typicalTermEnd, weekdayOf } from './dates';
import { diffSchedule, type ScheduleDiff } from './diff';

type Break = { start: string; end: string };

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
  /** What to bring, what it covers, where: from the document, never made up. Lands in the item's notes. */
  notes: string | null;
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
/** How far past a guessed term end a class is expanded, so review can extend it by up to ten weeks. */
const EXTRA_DAYS = 70;
/**
 * Occurrences one repeating item can expand to: a year of weekday classes (52 × 5). It was 120,
 * which cut a Mon–Fri full-year course off in February. Past it the series stops early; review
 * still shows its last date, so the student can see it.
 */
const MAX_OCCURRENCES = 260;

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
export function toDrafts(extraction: Extraction, today: string, opts: { breaks?: Break[] } = {}): Draft[] {
  const drafts: Draft[] = [];
  const breaks = opts.breaks ?? [];
  extraction.items.forEach((raw, idx) => {
    const base = normalize(raw, today);
    if (raw.repeat_weekdays.length > 0 && base.date) {
      // A repeating class with no end date runs to the typical end of its term; the review asks "Until when?".
      const endUnknown = !isLocalDate(raw.repeat_until);
      const until = endUnknown ? typicalTermEnd(base.date).date : raw.repeat_until!;
      // A guessed end is expanded past the guess, so picking a later date in review has classes to
      // keep; review leaves out the ones after the chosen end (Oct 27, 2026: it could only shorten).
      const reach = endUnknown ? addDays(until, EXTRA_DAYS) : until;
      const days = new Set(raw.repeat_weekdays);
      const seriesId = `series-${idx}-${base.date}`;
      let n = 0;
      for (let d = base.date; d <= reach && n < MAX_OCCURRENCES; d = addDays(d, 1)) {
        // Classes don't meet over the breaks the student set, as a series edit already knew.
        if (!days.has(weekdayOf(d)) || breaks.some((b) => d >= b.start && d <= b.end)) continue;
        // Lectures already held aren't plans: a syllabus read mid-term (or a classmate's cached
        // read) starts its class on the first meeting from today.
        if (d < today) continue;
        // The first one carries the item's own question (no time, a year that looks wrong) before "Until when?".
        const ask = n === 0 ? base.question ?? (endUnknown ? 'Until when does this repeat?' : null) : null;
        drafts.push({ ...base, key: `${idx}-${n++}`, date: d, seriesId, seriesUntil: until, seriesEndUnknown: endUnknown, question: ask, needsInput: n === 1 && (base.needsInput || endUnknown) });
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
    notes: raw.notes?.trim() || null,
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
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // "Café" is "cafe", not "caf"
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

/**
 * The stored item a draft is, or is a newer version of. The closest title wins, not the first one
 * over the bar ("Chapter 5 reading quiz" must not update "Chapter 6 reading quiz"), and two
 * courses' items never match each other (ENGL's and HIST's "Reading response" on one Friday).
 */
export function matchExisting(
  draft: Pick<Draft, 'kind' | 'title' | 'date' | 'start' | 'end'> & { courseId?: string | null },
  existing: (Pick<Item, 'id' | 'kind' | 'title' | 'date' | 'start' | 'end'> & { courseId?: string | null })[],
): Match {
  if (!draft.date) return null;
  let best: { id: string; sim: number } | null = null;
  for (const e of existing) {
    if (e.kind !== draft.kind || e.date !== draft.date) continue;
    if (draft.courseId && e.courseId && draft.courseId !== e.courseId) continue;
    const sim = titleSimilarity(e.title, draft.title);
    if (sim >= 0.999 && e.start === draft.start && e.end === draft.end) return { type: 'duplicate', existingId: e.id };
    if (sim >= 0.6 && (!best || sim > best.sim)) best = { id: e.id, sim };
  }
  return best ? { type: 'update', existingId: best.id } : null;
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
  // A job already on file keeps its own spelling, so "Campus Cafe" lands on the "Campus Café" page.
  const read = extraction.employer;
  const known = read ? existing.find((i) => i.category === 'work' && i.employer && normalizeTitle(i.employer) === normalizeTitle(read))?.employer : null;
  const employerName = known ?? read;

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
    employer: d.category === 'work' ? employerName : null,
    seriesId: d.seriesId,
    notes: d.notes,
  });

  if (extraction.detected_type === 'work_schedule' && extraction.employer) {
    const shifts = chosen.filter((d) => d.category === 'work');
    const dates = shifts.map((s) => s.date).sort();
    const coversFrom = isLocalDate(extraction.covers_from) ? extraction.covers_from : dates[0];
    const coversTo = isLocalDate(extraction.covers_to) ? extraction.covers_to : dates[dates.length - 1];
    if (coversFrom && coversTo) {
      const employer = employerName!;
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
    const courseId = courseIdByCode(d.courseCode);
    const m = matchExisting({ ...d, courseId }, existing);
    if (m?.type === 'duplicate') plan.skipped++;
    else if (m?.type === 'update') {
      // A newer version of something already planned changes only what the document says: its
      // title and times. Done, notes, its course and its series are the student's (Oct 27, 2026: a
      // re-import reopened finished work and wiped its notes). Notes from the document fill only an empty field.
      const was = existing.find((e) => e.id === m.existingId);
      plan.update.push({ id: m.existingId, patch: { title: d.title, start: d.start, end: d.end, isDeadline: d.isDeadline, ...(!was?.courseId && courseId ? { courseId } : {}), ...(!was?.notes?.trim() && d.notes ? { notes: d.notes } : {}) } });
    } else plan.create.push(toItem(d));
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
  const sameCode = (a: string | null, b: string | null) => !!courseKey(a) && courseKey(a) === courseKey(b);
  const known = (code: string | null, title: string) =>
    [...stored, ...out].some((k) => sameCode(k.code, code) || same(k.title, title));
  const course = extraction.course;
  if (course && !known(course.code, course.title)) out.push({ code: course.code, title: course.title, instructor: course.instructor });
  if (extraction.detected_type !== 'course_schedule') return out;
  for (const d of drafts) {
    // By code alone: two classes can share a title ("Lab") but not a code.
    if (!d.include || d.kind !== 'event' || !d.courseCode?.trim() || [...stored, ...out].some((k) => sameCode(k.code, d.courseCode))) continue;
    out.push({ code: d.courseCode.trim(), title: d.title, instructor: null });
  }
  return out;
}

/** A course code as a key: "BIOL 201", "BIOL201" and "biol-201" are one course. Null when empty. */
export function courseKey(code: string | null | undefined): string | null {
  const key = (code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return key || null;
}

/**
 * The stored course an import's code or title belongs to: by code first, then by title, the same
 * rule `newCourses` uses to decide a course is already known, so a course matched by title gets
 * its items instead of none.
 */
export function findCourse<K extends Pick<Course, 'id' | 'code' | 'title'>>(courses: K[], code: string | null, title?: string | null): K | null {
  const key = courseKey(code);
  const byCode = key ? courses.find((k) => courseKey(k.code) === key) : undefined;
  if (byCode) return byCode;
  const t = title?.trim().toLowerCase();
  return (t ? courses.find((k) => k.title.trim().toLowerCase() === t) : undefined) ?? null;
}

export { WEEKDAYS };
