import { addDays, diffDays, localParts, normalizeTitle, PHONE_CALENDAR_SOURCE } from '@dayli/core';
import type { Item } from '@dayli/schema';

/** What Semli needs from an iPhone calendar event; expo-calendar's event carries more. */
export type PhoneEvent = {
  id: string;
  calendarId: string;
  title: string;
  startDate: string | Date;
  endDate: string | Date;
  allDay: boolean;
  canceled: boolean;
};

/** Read from two weeks back, so last week's Plan isn't empty, to about a term ahead. Nothing past it shows. */
export const PHONE_DAYS_BACK = 14;
export const PHONE_DAYS_AHEAD = 120;
/** A trip or a holiday spanning weeks would fill every day in Plan; past this it shows on its first days only. */
const MAX_ALL_DAY_SPAN = 14;
/** A timed event that runs past the next morning holds the rest of its first day, not the days after. */
const END_OF_DAY = '23:59';

export const isPhoneEvent = (item: Pick<Item, 'sourceId'>) => item.sourceId === PHONE_CALENDAR_SOURCE;
export const isPhoneItemId = (id: string) => id.startsWith('phone:');

/** An occurrence's id: the event and its own start, since a repeating event shares one id across occurrences. */
export function phoneItemId(eventId: string, start: Date): string {
  return `phone:${eventId}@${start.toISOString()}`;
}

/** The event id and occurrence start from `phoneItemId`, to open it in the system's event view. */
export function parsePhoneItemId(id: string): { eventId: string; start: Date } | null {
  const match = /^phone:(.+)@([^@]+)$/.exec(id);
  if (!match) return null;
  const start = new Date(match[2]!);
  return Number.isNaN(start.getTime()) ? null : { eventId: match[1]!, start };
}

function base(id: string, title: string, date: string): Item {
  return {
    id, kind: 'event', title: title.trim() || 'Busy', category: 'personal', icon: 'calendar', date,
    start: null, end: null, isDeadline: false, done: false, completedAt: null, courseId: null, employer: null,
    sourceId: PHONE_CALENDAR_SOURCE, batchId: null, seriesId: null, externalId: null,
    // The calendar owns the time; Semli never suggests moving it.
    timeFlexibility: 'fixed', notes: null, createdAt: '',
  };
}

/** One event as the day items Today and Plan draw: one per day for an all-day event, one for a timed one. */
export function phoneEventItems(event: PhoneEvent): Item[] {
  if (event.canceled) return [];
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const id = phoneItemId(event.id, start);
  const from = localParts(start);
  if (event.allDay) {
    // An all-day event ends at the next midnight, or a second before it; either way its last day is the one before.
    const last = localParts(new Date(Math.max(start.getTime(), end.getTime() - 1))).date;
    const days = Math.min(diffDays(from.date, last) + 1, MAX_ALL_DAY_SPAN);
    return Array.from({ length: days }, (_, i) => base(i ? `${id}+${i}` : id, event.title, addDays(from.date, i)));
  }
  const to = localParts(end);
  const span = diffDays(from.date, to.date);
  // Same day, or overnight into the next morning (the plan's own overnight shifts work the same way).
  const endTime = span === 0 || (span === 1 && to.time <= from.time) ? to.time : END_OF_DAY;
  return [{ ...base(id, event.title, from.date), start: from.time, end: endTime === from.time ? null : endTime }];
}

/**
 * The plan's items with the phone's events beside them, in the plan's order. An event that is already
 * in the plan (Semli's own calendar export added back to the iPhone, or a class typed twice) shows once.
 */
export function mergePhoneItems(items: Item[], phone: Item[]): Item[] {
  if (!phone.length) return items;
  const key = (i: Pick<Item, 'title' | 'date' | 'start'>) => `${i.date}|${i.start ?? ''}|${normalizeTitle(i.title)}`;
  const planned = new Set(items.map(key));
  return [...items, ...phone.filter((i) => !planned.has(key(i)))]
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? ''));
}
