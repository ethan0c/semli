import { SHARE_DAYS, addDays, chartRange, formatHour, isLocalDate, toMinutes, weekOf, type SharedEntry } from '@dayli/core';
import { rpc, supabaseEnv } from './supabase';

/** One live share link, as `shared_schedule` returns it: the projection the owner's phone sent, nothing else. */
export type SharedSchedule = {
  title: string;
  options: { categories?: string[]; showTitles?: boolean; timezone?: string };
  entries: SharedEntry[];
  updatedAt: Date;
  /** When the link stops on its own; null runs until the owner stops it. */
  expiresAt: Date | null;
};

const TOKEN = /^[0-9a-f]{32}$/;

/** The link's schedule, or null for an unknown or stopped link. Throws only when Supabase is unreachable. */
export async function loadSharedSchedule(token: string): Promise<SharedSchedule | null> {
  const base = supabaseEnv();
  if (!base || !TOKEN.test(token)) return null;
  const row = (await rpc(base, 'shared_schedule', { p_token: token })) as
    | { title: string; options: SharedSchedule['options']; entries: SharedEntry[]; updated_at: string; expires_at?: string | null }
    | null;
  if (!row || typeof row.title !== 'string' || !Array.isArray(row.entries)) return null;
  const entries = row.entries.filter((e) => e && isLocalDate(e.date) && typeof e.title === 'string');
  return { title: row.title, options: row.options ?? {}, entries, updatedAt: new Date(row.updated_at), expiresAt: row.expires_at ? new Date(row.expires_at) : null };
}

/** Today where the owner lives, so a reader in another time zone sees the owner's days. */
export function todayIn(timezone: string | undefined, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone || 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export type SharedDay = { date: string; entries: (SharedEntry & { carried: boolean })[] };

/**
 * The days a reader sees: two weeks from today, each day's plans in order. An overnight shift that
 * started yesterday shows on today as "until 6 am" so the morning isn't drawn as free.
 */
export function sharedDays(entries: SharedEntry[], today: string): { from: string; to: string; days: SharedDay[] } {
  const from = today;
  const to = addDays(today, SHARE_DAYS - 1);
  const yesterday = addDays(today, -1);
  const byDate = new Map<string, SharedDay['entries']>();
  for (const e of entries) {
    const carried = e.date === yesterday && !!e.start && !!e.end && e.end <= e.start;
    if (!carried && (e.date < from || e.date > to)) continue;
    const date = carried ? from : e.date;
    byDate.set(date, [...(byDate.get(date) ?? []), { ...e, carried }]);
  }
  const days = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => ({ date, entries: list.sort((a, b) => Number(b.carried) - Number(a.carried) || (a.start ?? '').localeCompare(b.start ?? '')) }));
  return { from, to, days };
}

/** "Updated just now", "Updated 2 hours ago", "Updated 3 days ago". */
export function updatedLine(updatedAt: Date, now = new Date()): string {
  const minutes = Math.max(0, Math.round((now.getTime() - updatedAt.getTime()) / 60_000));
  if (minutes < 2) return 'Updated just now';
  if (minutes < 60) return `Updated ${minutes} minutes ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Updated ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.round(hours / 24);
  return `Updated ${days} ${days === 1 ? 'day' : 'days'} ago`;
}

/** Now where the owner lives, as a date and an HH:mm time, for the grid's now line. */
export function nowIn(timezone: string | undefined, now = new Date()): { date: string; time: string } {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone || 'America/New_York', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
    return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
  } catch {
    return { date: now.toISOString().slice(0, 10), time: now.toISOString().slice(11, 16) };
  }
}

export type GridBlock = { top: number; height: number; kind: 'work' | 'school' };
export type GridDay = {
  date: string;
  /** Outside the two weeks the link shows: drawn empty, so the weeks still line up Monday to Sunday. */
  inRange: boolean;
  today: boolean;
  /** Positions are percentages of the day's track, top to bottom. */
  blocks: GridBlock[];
  dues: number[];
  now: number | null;
};

/** The hours the grid's ends name: "8 am" at the top, "Midnight" at the bottom. */
export const hourLabel = (minutes: number) => (minutes % 1440 === 0 ? 'Midnight' : minutes === 720 ? 'Noon' : formatHour(minutes / 60));

/**
 * The two weeks as Monday-to-Sunday weeks of day columns, the way Plan's week chart stands the day
 * up: timed plans as blocks (work plum, school slate), timed deadlines as dots, and the now line on
 * today. The hours fit the plans, at least eight of them; untimed plans are in the list only.
 */
export function weekGrid(entries: SharedEntry[], from: string, to: string, now: { date: string; time: string }): { range: [number, number]; weeks: GridDay[][] } {
  type Span = { date: string; start: number; end: number; kind: GridBlock['kind'] };
  const spans: Span[] = [];
  const dues: { date: string; at: number }[] = [];
  for (const e of entries) {
    if (!e.start) continue;
    const start = toMinutes(e.start);
    if (e.kind === 'task') {
      if (e.isDeadline) dues.push({ date: e.date, at: start });
      continue;
    }
    const kind = e.category === 'work' ? 'work' : 'school';
    const end = e.end ? toMinutes(e.end) : start + 60;
    if (end > start) spans.push({ date: e.date, start, end, kind });
    else {
      // Overnight: the evening on its own day, the morning on the next.
      spans.push({ date: e.date, start, end: 1440, kind });
      if (end > 0) spans.push({ date: addDays(e.date, 1), start: 0, end, kind });
    }
  }
  const shown = (date: string) => date >= from && date <= to;
  const range = chartRange([...spans.filter((s) => shown(s.date)), ...dues.filter((d) => shown(d.date)).map((d) => ({ start: d.at, end: d.at }))], 8);
  const [lo, hi] = range;
  const pct = (m: number) => ((Math.min(hi, Math.max(lo, m)) - lo) / (hi - lo)) * 100;
  const weeks: GridDay[][] = [];
  for (let monday = weekOf(from)[0]!; monday <= to; monday = addDays(monday, 7)) {
    weeks.push(weekOf(monday).map((date) => {
      const inRange = shown(date);
      const nowAt = toMinutes(now.time);
      return {
        date, inRange, today: date === now.date,
        blocks: inRange ? spans.filter((s) => s.date === date && s.end > lo && s.start < hi)
          .map((s) => ({ top: pct(s.start), height: pct(s.end) - pct(s.start), kind: s.kind })) : [],
        dues: inRange ? dues.filter((d) => d.date === date && d.at >= lo && d.at <= hi).map((d) => pct(d.at)) : [],
        now: date === now.date && nowAt >= lo && nowAt <= hi ? pct(nowAt) : null,
      };
    }));
  }
  return { range, weeks };
}
