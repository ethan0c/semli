import type { Item } from '@dayli/schema';
import { addDays, dayNumber, toMinutes } from './dates';
import { eventInterval, intervalOf, overlap, union, type Interval } from './intervals';

type Timed = Pick<Item, 'id' | 'kind' | 'date' | 'start' | 'end' | 'done'> & { sourceId?: string | null };

/**
 * Events read from the iPhone's own calendar, shown beside the plan but never saved in it. They
 * count for overlaps with the plan, never with each other: two meetings that overlap in Outlook
 * are Outlook's business.
 */
export const PHONE_CALENDAR_SOURCE = 'phone-calendar';

export interface Conflict {
  a: string;
  b: string;
  minutes: number;
}

/** Pairs of events whose times overlap. Tasks never conflict; an event with no end holds an hour. */
export function findConflicts(items: Timed[]): Conflict[] {
  const timed = items
    .filter((i) => i.kind === 'event' && !i.done)
    .map((i) => ({ id: i.id, iv: eventInterval(i), phone: i.sourceId === PHONE_CALENDAR_SOURCE }))
    .filter((x): x is { id: string; iv: Interval; phone: boolean } => x.iv !== null)
    .sort((x, y) => x.iv.start - y.iv.start);

  const out: Conflict[] = [];
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length && timed[j]!.iv.start < timed[i]!.iv.end; j++) {
      if (timed[i]!.phone && timed[j]!.phone) continue;
      const minutes = overlap(timed[i]!.iv, timed[j]!.iv);
      if (minutes > 0) out.push({ a: timed[i]!.id, b: timed[j]!.id, minutes });
    }
  }
  return out;
}

export function conflictIds(items: Timed[]): Set<string> {
  const ids = new Set<string>();
  for (const c of findConflicts(items)) {
    ids.add(c.a);
    ids.add(c.b);
  }
  return ids;
}

export interface OverloadOptions {
  windowHours: number;
  wakingStart: string;
  wakingEnd: string;
  minFreeHours: number;
}

export const defaultOverloadOptions: OverloadOptions = {
  windowHours: 72,
  wakingStart: '07:00',
  wakingEnd: '23:00',
  minFreeHours: 4,
};

export interface Overload {
  deadlineId: string;
  freeHours: number;
}

/**
 * For each upcoming deadline, count free waking hours in the window before it.
 * A deadline with fewer than `minFreeHours` free is overloaded.
 */
export function findOverloads(
  items: (Timed & Pick<Item, 'isDeadline'>)[],
  now: { date: string; time: string },
  opts: OverloadOptions = defaultOverloadOptions,
): Overload[] {
  const nowAbs = dayNumber(now.date) * 1440 + toMinutes(now.time);
  const busy = union(
    items
      .filter((i) => i.kind === 'event' && !i.done && !i.isDeadline)
      .map(intervalOf)
      .filter((x): x is Interval => x !== null),
  );

  const out: Overload[] = [];
  for (const d of items) {
    if (!d.isDeadline || d.done) continue;
    const due = dayNumber(d.date) * 1440 + toMinutes(d.start ?? '09:00');
    if (due <= nowAbs) continue;
    const windowStart = Math.max(nowAbs, due - opts.windowHours * 60);

    // Waking intervals inside [windowStart, due).
    const waking: Interval[] = [];
    const firstDay = Math.floor(windowStart / 1440);
    const lastDay = Math.floor((due - 1) / 1440);
    for (let day = firstDay; day <= lastDay; day++) {
      const s = Math.max(windowStart, day * 1440 + toMinutes(opts.wakingStart));
      const e = Math.min(due, day * 1440 + toMinutes(opts.wakingEnd));
      if (e > s) waking.push({ start: s, end: e });
    }

    let free = 0;
    for (const w of waking) {
      let wFree = w.end - w.start;
      for (const b of busy) wFree -= overlap(w, b);
      free += Math.max(0, wFree);
    }
    const freeHours = Math.round((free / 60) * 10) / 10;
    if (freeHours < opts.minFreeHours) out.push({ deadlineId: d.id, freeHours });
  }
  return out;
}

/** Dates between `from` and `to` (inclusive) that have no imported work schedule. */
export function pendingDates(coverage: { coversFrom: string; coversTo: string }[], from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; dayNumber(d) <= dayNumber(to); d = addDays(d, 1)) {
    if (!coverage.some((c) => d >= c.coversFrom && d <= c.coversTo)) out.push(d);
  }
  return out;
}
