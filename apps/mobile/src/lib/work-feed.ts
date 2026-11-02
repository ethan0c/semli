import { feedSystem, icsDateTime, parseIcs, type CanvasEntry, type FeedMessages, type FeedTarget } from './canvas';

/*
 * A job's schedule through its calendar link: When I Work, 7shifts, When to Work, Deputy and
 * others give each employee a private iCal link to their own shifts (Nov 2, 2026). Same reading
 * and diff as Canvas (`canvas.ts`); the items are work shifts under the job's name, with ids
 * starting `work:`. Jobs with no link (Olive Garden's Krowd, Starbucks, Walmart) keep the
 * screenshot import and its schedule comparison.
 *
 * iPhone only for now: the phone fetches the link itself, while the web would need Semli's server
 * to fetch any address a person pastes, and `api/canvas-feed` only allows Canvas and Brightspace.
 */

export type WorkSystem = 'wheniwork' | '7shifts' | 'whentowork' | 'other';

export const WORK_SYSTEMS: { id: WorkSystem; label: string }[] = [
  { id: 'wheniwork', label: 'When I Work' },
  { id: '7shifts', label: '7shifts' },
  { id: 'whentowork', label: 'When to Work' },
  { id: 'other', label: 'Something else' },
];

/**
 * Where each app keeps the link. 7shifts' path is from its help center (kb.7shifts.com, Nov 2,
 * 2026); When I Work says to set calendar sync up on a computer; When to Work's menu names are
 * not checked against a live account yet, so its steps stay general.
 */
export const WORK_STEPS: Record<WorkSystem, string[]> = {
  wheniwork: ['Sign in to When I Work in your browser.', 'Open Calendar Sync and choose My Schedule.', 'Copy the link and paste it here.'],
  '7shifts': ['Sign in to 7shifts in your browser.', 'Open Schedules, then Tools, and choose the calendar sync link.', 'Copy the link and paste it here.'],
  whentowork: ['Sign in to When to Work in your browser.', 'Open your schedule and look for the option to sync or export to a calendar (iCal, Google or Outlook).', 'Copy the link and paste it here.'],
  other: ['In your work schedule app or website, look for calendar sync, iCal, or “add to Google or Outlook”.', 'Choose your own shifts, not the whole team’s.', 'Copy the link and paste it here.'],
};

export const WORK_MESSAGES: FeedMessages = {
  link: 'We couldn’t use that link. Copy your schedule’s calendar link using the steps above, then paste it here.',
  connection: 'We couldn’t reach your work schedule. Your saved shifts are still here. Check your internet connection and try again.',
  timeout: 'Your work schedule took too long to respond. Your saved shifts are still here. Try again in a moment.',
  rejected: 'Your schedule app didn’t accept that link. Copy a new calendar link from it and try again.',
  format: 'That link isn’t a calendar. Copy the calendar sync or iCal link from your schedule app, not the page you see it on.',
  session: 'Sign in to Semli again to sync your work schedule.',
  reviewing: 'Finish or close your import review before syncing your work schedule.',
  disconnected: 'Your work schedule connection changed during the sync. No updates were saved. Try syncing again.',
};

/** A Canvas or Brightspace link pasted here belongs on the class calendar screen. */
export const CLASS_FEED_HERE = 'That’s a class calendar link. Connect it under You → Class calendar instead.';

/** webcal:// or https:// on a named host; anything else is not a link Semli can subscribe to. */
export function normalizeWorkFeedUrl(input: string): { ok: true; url: string } | { ok: false; error: string } {
  const raw = input.trim().replace(/^webcals?:\/\//i, 'https://');
  if (feedSystem(raw)) return { ok: false, error: CLASS_FEED_HERE };
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return { ok: false, error: WORK_MESSAGES.link };
  }
  if (parsed.protocol !== 'https:' || !/^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(parsed.hostname)) return { ok: false, error: WORK_MESSAGES.link };
  return { ok: true, url: raw };
}

/**
 * Feed events → shifts. Only timed events: an all-day entry in a work feed is time off or a note,
 * not a shift. An end on the next day is kept as the end time; an end before the start is how the
 * planner already marks an overnight shift.
 */
export function workEntries(events: ReturnType<typeof parseIcs>): CanvasEntry[] {
  const entries: CanvasEntry[] = [];
  for (const ev of events) {
    const uid = ev.UID?.value;
    const title = ev.SUMMARY?.value.trim() || 'Shift';
    const start = icsDateTime(ev.DTSTART);
    if (!uid || !start?.time) continue;
    const end = icsDateTime(ev.DTEND);
    entries.push({
      externalId: `work:${uid}`,
      kind: 'event',
      title,
      courseLabel: null,
      date: start.date,
      start: start.time,
      end: end?.time && end.time !== start.time ? end.time : null,
      isDeadline: false,
      url: null,
    });
  }
  return entries;
}

export const workTarget = (employer: string): FeedTarget => ({ prefix: 'work:', category: 'work', employer });
