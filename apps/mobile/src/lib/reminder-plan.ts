import { addDays, assessment, dayNumber, diffDays, formatTime, monthDay, toMinutes, weekdayLong, andList } from '@dayli/core';
import type { Item } from '@dayli/schema';

export interface ReminderPrefs {
  enabled: boolean;
  /** Native AlarmKit permission is separate from notification permission. */
  urgentAlarmsEnabled?: boolean;
  /** Minutes before a timed event. */
  eventLead: 10 | 30 | 60;
  /** Also remind before each repeating class. Off unless chosen: a class you attend three times a week needs no nudge. */
  classReminders?: boolean;
  /** HH:mm the day before a deadline. */
  dayBeforeAt: string;
  /** HH:mm on the morning of a deadline. */
  morningAt: string;
  quietStart: string;
  quietEnd: string;
  briefing: boolean;
  briefingAt: string;
}

export const DEFAULT_REMINDERS: ReminderPrefs = {
  enabled: true,
  eventLead: 30,
  dayBeforeAt: '18:00',
  morningAt: '08:00',
  quietStart: '22:00',
  quietEnd: '07:00',
  briefing: true,
  briefingAt: '08:00',
};

export interface PlannedNotification {
  /** Stable per item and reason, so re-planning produces the same ids. */
  id: string;
  title: string;
  body: string;
  /** Local date + time of delivery. */
  date: string;
  time: string;
  itemId: string | null;
  kind: 'event' | 'deadline' | 'briefing';
  /** Where a tap opens: the item, or Today for a summary of several, or the plan for the trial. */
  url: string;
}

/** iOS keeps at most 64 pending local notifications; leave headroom. */
export const MAX_PENDING = 60;
export const BRIEFING_DAYS = 7;
export const HORIZON_DAYS = 14;
/** No day gets more than this many; the latest ordinary event reminders give way first. */
export const DAILY_MAX = 5;

const toAbs = (date: string, time: string) => dayNumber(date) * 1440 + toMinutes(time);
const fromAbs = (abs: number): { date: string; time: string } => {
  const day = Math.floor(abs / 1440);
  const m = abs - day * 1440;
  const pad = (n: number) => String(n).padStart(2, '0');
  return { date: addDays('1970-01-01', day), time: `${pad(Math.floor(m / 60))}:${pad(m % 60)}` };
};

/** True when a minute-of-day falls inside the quiet window, which may wrap midnight. */
export function inQuietHours(time: string, prefs: ReminderPrefs): boolean {
  const t = toMinutes(time);
  const s = toMinutes(prefs.quietStart);
  const e = toMinutes(prefs.quietEnd);
  if (s === e) return false;
  return s < e ? t >= s && t < e : t >= s || t < e;
}

/** Push a delivery inside quiet hours to the end of the window, unless that would be after the thing itself. */
function respectQuiet(abs: number, itemAbs: number | null, prefs: ReminderPrefs): number {
  const { time } = fromAbs(abs);
  if (!inQuietHours(time, prefs)) return abs;
  const day = Math.floor(abs / 1440);
  const endToday = day * 1440 + toMinutes(prefs.quietEnd);
  const moved = endToday > abs ? endToday : endToday + 1440;
  if (itemAbs !== null && moved >= itemAbs) return abs;
  return moved;
}

/** "A", "A and B", "A, B and C", "A, B and 2 more". */
function titleList(items: Item[]): string {
  const names = items.map((i) => i.title);
  if (names.length <= 3) return names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}

/** "2 classes", "1 shift": the count with its noun. */
const count = (n: number, one: string, many: string) => (n > 0 ? `${n} ${n === 1 ? one : many}` : '');
/** Exams and quizzes are on a day; everything else is due on it. */
const isTest = (it: Item) => assessment(it.title) !== null;

/**
 * The summary's day: what kinds of things are on it and the first one still ahead, then what is
 * due by name, since it stands in for the morning deadline reminders.
 * "2 classes and 1 shift, starting with Psych lecture at 9 am. Due today: Lab report.", or
 * "Café shift at 4 pm." when that is all there is.
 */
function dayLine(items: Item[], date: string, from: string): string {
  const todays = items.filter((i) => i.date === date && !i.done);
  if (todays.length === 0) return '';
  const due = todays.filter((i) => i.isDeadline && !isTest(i));
  const tests = todays.filter((i) => i.isDeadline && isTest(i));
  const rest = todays.filter((i) => !i.isDeadline);
  const events = rest.filter((i) => i.kind === 'event');
  const classes = events.filter((i) => i.category === 'school').length;
  const shifts = events.filter((i) => i.category === 'work').length;
  const kinds = andList([
    count(classes, 'class', 'classes'),
    count(shifts, 'shift', 'shifts'),
    count(events.length - classes - shifts, 'event', 'events'),
    count(rest.length - events.length, 'to-do', 'to-dos'),
  ].filter(Boolean));
  const first = events.filter((i) => i.start && i.start >= from).sort((a, b) => a.start!.localeCompare(b.start!))[0];
  const at = first ? `${first.title} at ${formatTime(first.start!)}` : '';
  const lead = !first ? kinds : rest.length === 1 ? at : `${kinds}, starting with ${at}`;
  return [
    lead ? `${lead[0]!.toUpperCase()}${lead.slice(1)}.` : '',
    tests.length ? `Today: ${titleList(tests)}.` : '',
    due.length ? `Due today: ${titleList(due)}.` : '',
  ].filter(Boolean).join(' ');
}

/** A repeating class: reminded only when the person turns class reminders on, or marks it urgent. */
export const isClass = (it: Pick<Item, 'seriesId' | 'category' | 'isDeadline' | 'urgent'>) => !!it.seriesId && it.category === 'school' && !it.isDeadline && !it.urgent;

/**
 * Everything that should be scheduled right now, in delivery order, capped for iOS.
 * Pure: the same items and prefs always produce the same plan.
 */
export interface PlanExtras {
  /** Free trial in progress: remind two days before it converts (the Blinkist pattern). */
  trial?: { endsAt: string; label: string } | null;
}

export function planReminders(items: Item[], prefs: ReminderPrefs, now: { date: string; time: string }, extras: PlanExtras = {}): PlannedNotification[] {
  // Old installations may still contain a seeded week. Examples never notify.
  items = items.filter((item) => item.sourceId !== 'sample');
  if (!prefs.enabled && !prefs.briefing && !extras.trial) return [];
  const nowAbs = toAbs(now.date, now.time);
  // rank 0 always stays; rank 1 (ordinary event reminders) gives way when a day is full.
  const out: (PlannedNotification & { abs: number; rank: 0 | 1 })[] = [];
  const push = (p: Omit<PlannedNotification, 'date' | 'time'>, abs: number, rank: 0 | 1 = 0) => {
    if (abs <= nowAbs) return;
    const { date, time } = fromAbs(abs);
    if (diffDays(now.date, date) > HORIZON_DAYS) return;
    out.push({ ...p, date, time, abs, rank });
  };
  const live = items.filter((it) => !it.done && it.date >= now.date);

  if (prefs.enabled) {
    for (const it of live) {
      if (it.kind === 'event' && it.start && (prefs.classReminders || !isClass(it))) {
        const itemAbs = toAbs(it.date, it.start);
        push(
          { id: `ev-${it.id}`, title: it.title, body: `Starts at ${formatTime(it.start)}.${it.end ? ` Ends at ${formatTime(it.end)}.` : ''}`, itemId: it.id, kind: 'event', url: `/item/${it.id}` },
          respectQuiet(itemAbs - prefs.eventLead, itemAbs, prefs),
          it.urgent ? 0 : 1,
        );
      }
    }

    // Deadlines on the same day share one reminder the evening before, and one that morning.
    const byDate = new Map<string, Item[]>();
    for (const it of live.filter((i) => i.isDeadline)) byDate.set(it.date, [...(byDate.get(it.date) ?? []), it]);
    for (const [date, due] of byDate) {
      due.sort((a, b) => (a.start ?? '99').localeCompare(b.start ?? '99'));
      const first = due[0]!;
      const one = due.length === 1;
      const firstAbs = first.start ? toAbs(date, first.start) : null;
      const target = one ? { itemId: first.id, url: `/item/${first.id}` } : { itemId: null, url: '/' };
      const dueLabel = first.start ? `${weekdayLong(date)} at ${formatTime(first.start)}` : weekdayLong(date);
      push(
        one
          ? { id: `dl1-${first.id}`, title: first.title, body: isTest(first) ? `${dueLabel}.` : `Due ${dueLabel}.`, kind: 'deadline', ...target }
          : { id: `dl1-${date}`, title: `${due.length} due ${weekdayLong(date)}`, body: `${titleList(due)}.`, kind: 'deadline', ...target },
        respectQuiet(toAbs(addDays(date, -1), prefs.dayBeforeAt), firstAbs, prefs),
      );
      // The daily summary names what is due today, so it replaces the morning reminder when it comes first.
      const morning = toAbs(date, prefs.morningAt);
      const summaryAbs = toAbs(date, prefs.briefingAt);
      const summaryFirst = prefs.briefing && diffDays(now.date, date) < BRIEFING_DAYS && summaryAbs > nowAbs && (firstAbs === null || summaryAbs < firstAbs);
      if (!summaryFirst && (firstAbs === null || morning < firstAbs)) {
        push(
          one
            ? { id: `dl2-${first.id}`, title: first.title, body: `${isTest(first) ? 'Today' : 'Due today'}${first.start ? ` at ${formatTime(first.start)}` : ''}.`, kind: 'deadline', ...target }
            : { id: `dl2-${date}`, title: `${due.length} due today`, body: `${titleList(due)}.`, kind: 'deadline', ...target },
          morning,
        );
      }
    }
  }

  if (prefs.briefing) {
    for (let d = 0; d < BRIEFING_DAYS; d++) {
      const date = addDays(now.date, d);
      const line = dayLine(items, date, prefs.briefingAt);
      const nextDeadline = items
        .filter((i) => i.isDeadline && !i.done && i.date > date && diffDays(date, i.date) <= 3)
        .sort((a, b) => a.date.localeCompare(b.date))[0];
      if (!line && !nextDeadline) continue;
      // A later day's deadline, said as one so it never reads as today's next event.
      const ahead = nextDeadline ? `${isTest(nextDeadline) ? '' : 'Due '}${weekdayLong(nextDeadline.date)}: ${nextDeadline.title}.` : '';
      const body = [line, ahead].filter(Boolean).join(' ');
      push({ id: `brief-${date}`, title: 'Today’s schedule', body, itemId: null, kind: 'briefing', url: '/' }, toAbs(date, prefs.briefingAt));
    }
  }

  if (extras.trial) {
    const ends = new Date(extras.trial.endsAt);
    if (!Number.isNaN(ends.getTime())) {
      const pad = (n: number) => String(n).padStart(2, '0');
      const endDate = `${ends.getFullYear()}-${pad(ends.getMonth() + 1)}-${pad(ends.getDate())}`;
      push(
        { id: 'trial-reminder', title: `Your Plus trial ends on ${monthDay(endDate)}`, body: `Then ${extras.trial.label}. Manage or cancel in You → Your plan.`, itemId: null, kind: 'briefing', url: '/settings/plan' },
        toAbs(addDays(endDate, -2), prefs.dayBeforeAt),
      );
    }
  }

  out.sort((a, b) => a.abs - b.abs);
  // At most DAILY_MAX a day: everything of rank 0, then the soonest event reminders.
  const perDay = new Map<string, number>();
  for (const p of out) if (p.rank === 0) perDay.set(p.date, (perDay.get(p.date) ?? 0) + 1);
  const kept = out.filter((p) => {
    if (p.rank === 0) return true;
    const used = perDay.get(p.date) ?? 0;
    if (used >= DAILY_MAX) return false;
    perDay.set(p.date, used + 1);
    return true;
  });
  // Keep every briefing (they are few) and the soonest reminders up to the iOS cap.
  const briefings = kept.filter((p) => p.kind === 'briefing');
  const rest = kept.filter((p) => p.kind !== 'briefing').slice(0, Math.max(0, MAX_PENDING - briefings.length));
  return [...briefings, ...rest]
    .sort((a, b) => a.abs - b.abs)
    .map(({ abs: _abs, rank: _rank, ...p }) => p);
}
