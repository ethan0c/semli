import { iconFor, localParts, normalizeTitle, type CommitPlan , count } from '@dayli/core';
import type { Item } from '@dayli/schema';
import { reportError } from './errors';

/*
 * Canvas sync through the calendar feed: the .ics link every student can copy from
 * Canvas → Calendar → Calendar feed. No token, no OAuth, no developer key, no server.
 * Read-only; each event keeps its Canvas UID so a resync moves dates instead of duplicating.
 *
 * Brightspace (D2L) feeds go the same way since Oct 27, 2026: UGA, one of the three January
 * schools, runs it as eLC. Its link comes from Calendar → Subscribe. The store still calls the
 * connection `canvas` and its items `canvas:` ids; that's the name of the slot, not the system.
 */

export type FeedSystem = 'canvas' | 'brightspace';

/**
 * Where each system keeps its link, as the numbered steps on the connect screens. Brightspace's
 * menu names are from D2L's student guides (Oct 27, 2026), not yet checked against a live eLC
 * account; schools that turn feeds off have no Subscribe at all.
 */
export const FEED_STEPS: Record<FeedSystem, string[]> = {
  canvas: ['Open Canvas in your browser.', 'Open Calendar, then choose Calendar feed in the sidebar.', 'Copy the link and paste it here.'],
  brightspace: [
    'Open eLC or Brightspace in your browser and go to Calendar.',
    'Open Calendar Settings, select Enable Calendar Feeds, then Save.',
    'Choose Subscribe, then All Calendars and Tasks. Copy the link and paste it here.',
  ],
};
export const FEED_PLACEHOLDER: Record<FeedSystem, string> = {
  canvas: 'https://…/feeds/calendars/…',
  brightspace: 'https://…/d2l/le/calendar/feed/…',
};

const FEED_PATHS: Record<FeedSystem, RegExp> = {
  canvas: /^https:\/\/[^\s/]+\/feeds\/calendars\/[^\s/]+\.ics(\?\S*)?$/i,
  brightspace: /^https:\/\/[^\s/]+\/d2l\/le\/calendar\/feed\/[^\s?]+\.ics\?\S*token=\S+$/i,
};

/** Which system a feed link is from, or null when it is neither. */
export function feedSystem(url: string): FeedSystem | null {
  return (Object.keys(FEED_PATHS) as FeedSystem[]).find((k) => FEED_PATHS[k].test(url)) ?? null;
}

/** What the student calls it: UGA's Brightspace is eLC. */
export function feedName(url: string | null | undefined): string {
  if (!url || feedSystem(url) !== 'brightspace') return 'Canvas';
  return /\.view\.usg\.edu\//i.test(url) && /uga\./i.test(url) ? 'eLC' : 'Brightspace';
}

export const CANVAS_SOURCE = 'Canvas';

/** One assignment or calendar event from the feed. */
export interface CanvasEntry {
  externalId: string;
  kind: Item['kind'];
  title: string;
  /** The bracketed course from the title: "ENG 101-01 Fall 2026". */
  courseLabel: string | null;
  date: string;
  start: string | null;
  end: string | null;
  isDeadline: boolean;
  url: string | null;
}

/** Accepts webcal:// and https:// Canvas or Brightspace feed links; anything else is not a feed. */
export function normalizeFeedUrl(input: string): string | null {
  const raw = input.trim().replace(/^webcals?:\/\//i, 'https://');
  return feedSystem(raw) ? raw : null;
}

interface IcsEvent {
  [key: string]: { value: string; params: Record<string, string> } | undefined;
}

/** Just enough RFC 5545 for Canvas: unfold lines, read VEVENT properties, unescape text. */
export function parseIcs(text: string): IcsEvent[] {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const events: IcsEvent[] = [];
  let current: IcsEvent | null = null;
  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') current = {};
    else if (line === 'END:VEVENT') {
      if (current) events.push(current);
      current = null;
    } else if (current) {
      const colon = line.indexOf(':');
      if (colon < 0) continue;
      const [name, ...rawParams] = line.slice(0, colon).split(';');
      const params: Record<string, string> = {};
      for (const p of rawParams) {
        const [k, v] = p.split('=');
        if (k && v) params[k.toUpperCase()] = v.replace(/^"|"$/g, '');
      }
      current[name!.toUpperCase()] = { value: unescape(line.slice(colon + 1)), params };
    }
  }
  return events;
}

function unescape(s: string): string {
  return s.replace(/\\([\\;,nN])/g, (_, ch: string) => (ch === 'n' || ch === 'N' ? '\n' : ch));
}

/** 20261020 → date only; 20261021T035900Z → local date and time; TZID or floating → wall clock as written. */
export function icsDateTime(prop: { value: string; params: Record<string, string> } | undefined): { date: string; time: string | null } | null {
  const m = prop?.value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;
  if (!h) return { date: `${y}-${mo}-${d}`, time: null };
  if (z) return localParts(new Date(Date.UTC(+y!, +mo! - 1, +d!, +h, +mi!)));
  return { date: `${y}-${mo}-${d}`, time: `${h}:${mi}` };
}

/**
 * Brightspace names a date by what happens on it: "Lab report 2 - Due", "Quiz 3 - Availability
 * Ends". The end of a window is the deadline; its start isn't an obligation, so it is left out.
 */
const D2L_START = /\s+-\s+(availability\s+starts|start\s+date|starts)$/i;
const D2L_END = /\s+-\s+(due|due\s+date|availability\s+ends|end\s+date|ends)$/i;

/** Feed events → entries. Canvas UIDs say which: event-assignment-123 vs event-calendar-event-456. */
export function canvasEntries(events: IcsEvent[], system: FeedSystem = 'canvas'): CanvasEntry[] {
  const entries: CanvasEntry[] = [];
  for (const ev of events) {
    const uid = ev.UID?.value;
    let summary = ev.SUMMARY?.value.trim();
    const start = icsDateTime(ev.DTSTART);
    if (!uid || !summary || !start) continue;
    const end = icsDateTime(ev.DTEND);
    let due = false;
    if (system === 'brightspace') {
      if (D2L_START.test(summary)) continue;
      due = D2L_END.test(summary);
      summary = summary.replace(D2L_END, '').trim();
    }
    const bracket = summary.match(/^(.*?)\s*\[([^\]]+)\]$/);
    const title = (bracket?.[1] || summary).trim();
    const assignment = due || /assignment/i.test(uid);
    // Brightspace has no [course] suffix; its course, when it says, is in LOCATION.
    const location = ev.LOCATION?.value.trim();
    const courseLabel = bracket?.[2]?.trim() ?? (system === 'brightspace' && location && courseCodeOf(location) ? location : null);
    entries.push({
      externalId: `canvas:${uid}`,
      kind: assignment ? 'task' : 'event',
      title,
      courseLabel,
      date: start.date,
      start: start.time,
      end: !assignment && end?.date === start.date && end.time !== start.time ? end.time : null,
      isDeadline: assignment || /exam|quiz|midterm|final/i.test(title),
      url: ev.URL?.value ?? null,
    });
  }
  return entries;
}

/** "ENG 101-01 Fall 2026" → "ENG 101", so a syllabus import and the feed land on the same course. */
export function courseCodeOf(label: string): string | null {
  const m = label.match(/\b([A-Z]{2,5})[\s-]?(\d{3,4}[A-Z]?)\b/);
  return m ? `${m[1]} ${m[2]}` : null;
}

export interface CanvasPlan extends CommitPlan {
  /** Course labels with no stored course yet; the caller creates them before resolving ids. */
  newCourses: string[];
  added: number;
  moved: number;
  dropped: number;
}

/**
 * Diff the feed against what an earlier sync stored. New UIDs are created, changed dates and
 * times are updated (done stays done), and an upcoming, unfinished item that left the feed is
 * removed. Past items outside the feed's window are left alone. An empty feed removes nothing.
 */
export function planCanvasSync(
  entries: CanvasEntry[],
  existing: Item[],
  today: string,
  courseIdByLabel: (label: string | null) => string | null,
): CanvasPlan {
  const plan: CanvasPlan = { create: [], update: [], remove: [], skipped: 0, newCourses: [], added: 0, moved: 0, dropped: 0 };
  const stored = new Map(existing.filter((i) => i.externalId?.startsWith('canvas:')).map((i) => [i.externalId!, i]));
  const seen = new Set<string>();

  for (const e of entries) {
    if (seen.has(e.externalId)) continue;
    seen.add(e.externalId);
    if (e.courseLabel && !courseIdByLabel(e.courseLabel) && !plan.newCourses.includes(e.courseLabel)) plan.newCourses.push(e.courseLabel);
    const before = stored.get(e.externalId);
    if (!before) {
      plan.create.push({
        kind: e.kind,
        title: e.title,
        category: 'school',
        icon: iconFor({ kind: e.kind, category: 'school', title: e.title, is_deadline: e.isDeadline }),
        date: e.date,
        start: e.start,
        end: e.end,
        isDeadline: e.isDeadline,
        done: false,
        completedAt: null,
        courseId: courseIdByLabel(e.courseLabel),
        employer: null,
        seriesId: null,
        externalId: e.externalId,
        notes: e.url,
      });
      plan.added++;
      continue;
    }
    const patch: Partial<Item> = {};
    if (before.editedAt) {
      // The person moved it by hand: their date stands. Remember what Canvas says, so the item can offer it.
      const feed = { date: e.date, start: e.start, end: e.end };
      if (before.feed?.date !== feed.date || before.feed?.start !== feed.start || before.feed?.end !== feed.end) patch.feed = feed;
    } else {
      if (before.date !== e.date) patch.date = e.date;
      if (before.start !== e.start) patch.start = e.start;
      if (before.end !== e.end) patch.end = e.end;
    }
    if (normalizeTitle(before.title) !== normalizeTitle(e.title)) patch.title = e.title;
    if (Object.keys(patch).length === 0) plan.skipped++;
    else {
      plan.update.push({ id: before.id, patch });
      if (patch.date || patch.start !== undefined || patch.end !== undefined) plan.moved++;
    }
  }

  if (entries.length > 0) {
    for (const [uid, item] of stored) {
      if (seen.has(uid) || item.done || item.date < today) continue;
      plan.remove.push(item.id);
      plan.dropped++;
    }
  }
  return plan;
}

/** "3 new · 1 date moved · 1 removed", or null when nothing changed. */
export function syncSummary(p: Pick<CanvasPlan, 'added' | 'moved' | 'dropped' | 'update'>): string | null {
  const renamed = p.update.length - p.moved;
  const parts = [
    p.added ? `${p.added} new` : null,
    p.moved ? `${count(p.moved, 'date')} moved` : null,
    renamed > 0 ? `${renamed} renamed` : null,
    p.dropped ? `${p.dropped} removed` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : null;
}

// Retry copy names no Plus-only step (Oct 27, 2026): a free person has no "Sync now" and no
// sync on open, so "try again" means Connect for them and Sync now for a subscriber.
export const CANVAS_MESSAGES = {
  link: 'We couldn’t use that link. Copy the calendar feed link using the steps above, then paste it here.',
  connection: 'We couldn’t reach your class calendar. Your saved items are still here. Check your internet connection and try again.',
  timeout: 'Your class calendar took too long to respond. Your saved items are still here. Try again in a moment.',
  rejected: 'Your school didn’t accept that calendar link. Copy a new link from Calendar feed in Canvas, or Subscribe in Brightspace or eLC.',
  format: 'We couldn’t read that calendar. Your saved items are still here. Copy a new calendar feed link and try again.',
  /** The web's feed goes through Semli's server, which needs a current sign-in; the link itself is fine. */
  session: 'Sign in to Semli again to sync your class calendar. You can use the same calendar feed link.',
  /** An import under review is replaced by any plan saved under it, so Canvas waits for it. */
  reviewing: 'Finish or close your import review before syncing your class calendar.',
  /** Disconnected (or relinked) while the feed was loading; nothing from it was saved. */
  disconnected: 'Your calendar connection changed during the sync. No updates were saved. Try syncing again.',
} as const;

/** How the feed is fetched: straight from Canvas on the phone, through Semli's server on the web. */
export type FeedLoader = (url: string, signal: AbortSignal) => Promise<Response>;
const direct: FeedLoader = (url, signal) => fetch(url, { signal, headers: { accept: 'text/calendar' } });

/** `{ "reason": "session" }` is the web canvas-feed route's answer for a missing or expired Semli session. */
async function sessionExpired(res: Response): Promise<boolean> {
  const body = (await res.json().catch(() => null)) as { reason?: unknown } | null;
  return body?.reason === 'session';
}

/** Fetch and parse the feed. Never throws; failures come back as a message to show. */
export async function fetchCanvasFeed(url: string, timeoutMs = 20_000, load: FeedLoader = direct): Promise<{ ok: true; entries: CanvasEntry[] } | { ok: false; error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await load(url, controller.signal);
    if (!res.ok) {
      reportError('canvas.fetch', { code: 'http_error', status: res.status });
      // Semli's own server marks an expired sign-in, so it isn't read as Canvas refusing the link.
      if (res.status === 401 && (await sessionExpired(res))) return { ok: false, error: CANVAS_MESSAGES.session };
      return { ok: false, error: [401, 403, 404].includes(res.status) ? CANVAS_MESSAGES.rejected : CANVAS_MESSAGES.connection };
    }
    const text = await res.text();
    if (!text.includes('BEGIN:VCALENDAR')) {
      reportError('canvas.parse', { code: 'invalid_calendar', message: 'Feed response did not contain VCALENDAR' });
      return { ok: false, error: CANVAS_MESSAGES.format };
    }
    return { ok: true, entries: canvasEntries(parseIcs(text), feedSystem(url) ?? 'canvas') };
  } catch (error) {
    reportError('canvas.fetch_or_parse', error);
    return { ok: false, error: controller.signal.aborted ? CANVAS_MESSAGES.timeout : CANVAS_MESSAGES.connection };
  } finally {
    clearTimeout(timer);
  }
}
