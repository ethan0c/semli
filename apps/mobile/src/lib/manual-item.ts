import { isLocalDate, isLocalTime } from '@dayli/core';
import type { Category, Item, SeriesRule } from '@dayli/schema';

export interface ManualDraft {
  kind: 'task' | 'event';
  title: string;
  category: Category;
  date: string;
  start: string;
  end: string;
  allDay: boolean;
  hasDueTime: boolean;
  isDeadline: boolean;
  urgent?: boolean;
  courseId: string | null;
  employer: string;
  notes: string;
  /** How it repeats, from this date; null for a one-off. */
  repeat: SeriesRule | null;
}

export type ManualItem = Omit<Item, 'id' | 'createdAt' | 'batchId'>;
export type ManualResult = { ok: true; item: ManualItem; repeat: SeriesRule | null } | { ok: false; error: string };

/** Validate before touching the store; dates are local calendar dates, never UTC. */
export function buildManualItem(draft: ManualDraft): ManualResult {
  if (!draft.title.trim()) return { ok: false, error: `Add a title for this ${draft.kind === 'event' ? 'event' : 'to-do'}.` };
  if (!isLocalDate(draft.date)) return { ok: false, error: 'Choose a valid date.' };
  const timedEvent = draft.kind === 'event' && !draft.allDay;
  const hasStart = timedEvent || (draft.kind === 'task' && draft.hasDueTime);
  if (hasStart && !isLocalTime(draft.start)) return { ok: false, error: 'Choose a valid time.' };
  if (timedEvent && !isLocalTime(draft.end)) return { ok: false, error: 'Choose a valid end time.' };
  if (timedEvent && draft.start === draft.end) return { ok: false, error: 'Choose a different end time. The start and end times are the same.' };
  if (draft.repeat && draft.repeat.every > 0 && !draft.repeat.days.length) return { ok: false, error: 'Choose at least one day to repeat.' };
  if (draft.repeat && (!isLocalDate(draft.repeat.until) || draft.repeat.until < draft.date)) return { ok: false, error: 'Choose a last date on or after the first date.' };
  const start = hasStart ? draft.start : null;
  const end = timedEvent ? draft.end : null;
  return { ok: true, repeat: draft.repeat ? { ...draft.repeat, start, end } : null, item: {
    kind: draft.kind, title: draft.title.trim(), category: draft.category,
    icon: draft.kind === 'event' ? 'calendar' : 'check',
    date: draft.date, start, end,
    isDeadline: draft.kind === 'task' && draft.isDeadline,
    ...(draft.urgent ? { urgent: true } : {}),
    done: false, completedAt: null, sourceId: null,
    courseId: draft.category === 'school' ? draft.courseId : null,
    employer: draft.category === 'work' ? draft.employer.trim() || null : null,
    notes: draft.notes.trim() || null,
  } };
}

/** Round forward to the next half hour; retain local time even across midnight. */
export function defaultManualTimes(now: Date): { start: string; end: string } {
  const minutes = (Math.floor((now.getHours() * 60 + now.getMinutes()) / 30) + 1) * 30;
  const clock = (value: number) => `${String(Math.floor(value / 60) % 24).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
  return { start: clock(minutes), end: clock(minutes + 60) };
}
