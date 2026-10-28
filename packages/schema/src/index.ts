import { z } from 'zod';

/** YYYY-MM-DD in the user's local calendar. */
export const LocalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
/** HH:mm, 24-hour, in the user's local time. */
export const LocalTime = z.string().regex(/^\d{2}:\d{2}$/);

export const Category = z.enum(['school', 'work', 'personal']);
export type Category = z.infer<typeof Category>;

export const Weekday = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);
export type Weekday = z.infer<typeof Weekday>;

export const IconName = z.enum([
  'calendar',
  'book',
  'check',
  'work',
  'bag',
  'pen',
  'school',
  'exam',
  'heart',
]);
export type IconName = z.infer<typeof IconName>;

// ---------------------------------------------------------------------------
// What the model returns. Kept flat and nullable (no optional keys, no numeric
// bounds) so it maps cleanly onto structured outputs.
// ---------------------------------------------------------------------------

export const ExtractedItem = z.object({
  kind: z.enum(['event', 'task']),
  title: z.string(),
  category: Category,
  date: z.string().nullable().describe('YYYY-MM-DD; null if no date could be determined'),
  start: z.string().nullable().describe('HH:mm 24h start time for events; due time for tasks; null if none'),
  end: z.string().nullable().describe('HH:mm 24h end time; null if none'),
  is_deadline: z.boolean().describe('true for exams, due dates, and submissions'),
  repeat_weekdays: z.array(Weekday).describe('weekdays a class or recurring event meets; empty if it does not repeat'),
  repeat_until: z.string().nullable().describe('YYYY-MM-DD last date of a repeating item; null if unknown'),
  course_code: z.string().nullable(),
  evidence: z.string().describe('the exact text this item was read from'),
  // Optional so a cached or older answer without it still reads (added Oct 28, 2026).
  notes: z.string().nullable().optional().describe('practical details for the day the title cannot hold, from the input only; null if none'),
  confidence: z.number().describe('0 to 1'),
  question: z.string().nullable().describe('a short question for the user when something is ambiguous; otherwise null'),
});
export type ExtractedItem = z.infer<typeof ExtractedItem>;

export const Extraction = z.object({
  detected_type: z.enum(['general', 'work_schedule', 'syllabus', 'course_schedule']),
  employer: z.string().nullable(),
  course: z
    .object({ code: z.string().nullable(), title: z.string(), instructor: z.string().nullable() })
    .nullable(),
  covers_from: z.string().nullable().describe('YYYY-MM-DD first day a work schedule covers'),
  covers_to: z.string().nullable().describe('YYYY-MM-DD last day a work schedule covers'),
  items: z.array(ExtractedItem),
});
export type Extraction = z.infer<typeof Extraction>;

// ---------------------------------------------------------------------------
// Stored records
// ---------------------------------------------------------------------------

export const Item = z.object({
  id: z.string(),
  kind: z.enum(['event', 'task']),
  title: z.string(),
  category: Category,
  icon: IconName,
  date: LocalDate,
  start: LocalTime.nullable(),
  end: LocalTime.nullable(),
  isDeadline: z.boolean(),
  done: z.boolean(),
  completedAt: z.string().nullable(),
  courseId: z.string().nullable(),
  employer: z.string().nullable(),
  sourceId: z.string().nullable(),
  batchId: z.string().nullable(),
  /** Shared by every occurrence expanded from one repeating item (a class that meets Mon/Wed). */
  seriesId: z.string().nullable().optional(),
  /** An explicit choice overrides the conservative scheduling default. */
  timeFlexibility: z.enum(['fixed', 'flexible']).optional(),
  /** Chosen by the user, never inferred from an imported title. */
  urgent: z.boolean().optional(),
  /** A synced source's own id ("canvas:event-assignment-123"), so a resync updates instead of duplicating. */
  externalId: z.string().nullable().optional(),
  /** When the person last changed the date or time by hand. A sync never moves an edited item; a series rebuild leaves it be. */
  editedAt: z.string().nullable().optional(),
  /** What the synced source last said, kept while the person's own edit stands, so the item can offer to follow the source again. */
  feed: z.object({ date: LocalDate, start: LocalTime.nullable(), end: LocalTime.nullable() }).nullable().optional(),
  notes: z.string().nullable(),
  createdAt: z.string(),
});
export type Item = z.infer<typeof Item>;

/**
 * How a repeating item repeats: which weekdays, every N weeks (0 means every day), until when,
 * and the dates skipped by hand. The occurrences are still ordinary items sharing a seriesId;
 * the rule is what lets the days or the end change without guessing from the occurrences.
 */
export const SeriesRule = z.object({
  every: z.number().int().min(0).max(4),
  days: z.array(Weekday),
  until: LocalDate,
  skipped: z.array(LocalDate),
  start: LocalTime.nullable(),
  end: LocalTime.nullable(),
});
export type SeriesRule = z.infer<typeof SeriesRule>;

export const Course = z.object({
  id: z.string(),
  code: z.string().nullable(),
  title: z.string(),
  instructor: z.string().nullable(),
  sourceId: z.string().nullable(),
});
export type Course = z.infer<typeof Course>;

export const ScheduleVersion = z.object({
  id: z.string(),
  employer: z.string(),
  coversFrom: LocalDate,
  coversTo: LocalDate,
  sourceId: z.string().nullable(),
  createdAt: z.string(),
});
export type ScheduleVersion = z.infer<typeof ScheduleVersion>;

// ---------------------------------------------------------------------------
// API contract between the app and /api/extract
// ---------------------------------------------------------------------------

/** At most this many upcoming events go with a typed request; more are cut, never refused. */
export const MAX_SCHEDULE = 200;
const ScheduleEntry = z.object({ date: LocalDate, start: LocalTime, end: LocalTime.nullable(), title: z.string().transform((t) => t.slice(0, 120)) });

/**
 * Context is trimmed, never refused (Oct 27, 2026): a request could carry megabytes of course names
 * and pay for a hundred imports' worth of reading as one. These are far above any real plan.
 */
export const MAX_CONTEXT_COURSES = 100;
export const MAX_CONTEXT_EMPLOYERS = 50;
const clip = (n: number) => z.string().transform((s) => s.slice(0, n));

export const ExtractContext = z.object({
  name: clip(80).optional(),
  today: LocalDate,
  timezone: clip(64),
  /** BCP 47 tag of the device, e.g. "en-GB". Older builds and the web demo may omit it. */
  locale: z.string().max(35).optional(),
  /** ISO 3166 region the person studies or works in, e.g. "GB". */
  region: z.string().regex(/^[A-Z]{2}$/).optional(),
  courses: z.array(z.object({ code: clip(30).nullable(), title: clip(120) })).transform((a) => a.slice(0, MAX_CONTEXT_COURSES)),
  employers: z.array(clip(80)).transform((a) => a.slice(0, MAX_CONTEXT_EMPLOYERS)),
  /**
   * The person's upcoming timed events, so a typed request can be placed around them ("cardio before
   * work"). Sent with typed and dictated messages only; older builds and the web demo omit it.
   */
  // Lenient on purpose: this is context, never the import itself, so a bad or long entry is dropped
  // or trimmed rather than failing the request (a future app version must not break typed imports).
  schedule: z.array(z.unknown()).transform((entries) => entries
    .map((e) => ScheduleEntry.safeParse(e))
    .flatMap((r) => (r.success ? [r.data] : []))
    .slice(0, MAX_SCHEDULE)).optional(),
});
export type ExtractContext = z.infer<typeof ExtractContext>;

/** 20 MB of file as base64, matching the pickers; a bigger body is a mistake or an attack. */
export const MAX_UPLOAD_BASE64 = 28_000_000;

export const ExtractRequest = z.object({
  input: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('text'), text: z.string().min(1).max(20_000) }),
    z.object({
      kind: z.literal('image'),
      mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
      data: z.string().min(1).max(MAX_UPLOAD_BASE64),
    }),
    z.object({ kind: z.literal('pdf'), data: z.string().min(1).max(MAX_UPLOAD_BASE64) }),
  ]),
  context: ExtractContext,
});
export type ExtractRequest = z.infer<typeof ExtractRequest>;

export const ExtractResponse = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true), extraction: Extraction }),
  z.object({ ok: z.literal(false), error: z.string() }),
]);
export type ExtractResponse = z.infer<typeof ExtractResponse>;

/** Ask for this to get the answer as it's written: one JSON line per item, then the full response. */
export const EXTRACT_STREAM_TYPE = 'application/x-ndjson';
/**
 * One line of a streamed import. `item`: a row as soon as it's written (validated, but only a
 * preview). `reset`: the rows so far no longer stand (another reader is starting again). `done`: the
 * same response a single request returns, with its HTTP status; review uses only this.
 */
export const ExtractStreamLine = z.discriminatedUnion('type', [
  z.object({ type: z.literal('item'), item: Extraction.shape.items.element }),
  z.object({ type: z.literal('reset') }),
  z.object({ type: z.literal('done'), status: z.number(), response: ExtractResponse }),
]);
export type ExtractStreamLine = z.infer<typeof ExtractStreamLine>;
export { IMPORT_MESSAGES, importErrorForStatus, friendlyImportError } from './messages';
