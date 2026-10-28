import { SHARE_DAYS, addDays, isLocalDate, type SharedEntry } from '@dayli/core';
import { rpc, supabaseEnv } from './supabase';

/** One live share link, as `shared_schedule` returns it: the projection the owner's phone sent, nothing else. */
export type SharedSchedule = {
  title: string;
  options: { categories?: string[]; showTitles?: boolean; timezone?: string };
  entries: SharedEntry[];
  updatedAt: Date;
};

const TOKEN = /^[0-9a-f]{32}$/;

/** The link's schedule, or null for an unknown or stopped link. Throws only when Supabase is unreachable. */
export async function loadSharedSchedule(token: string): Promise<SharedSchedule | null> {
  const base = supabaseEnv();
  if (!base || !TOKEN.test(token)) return null;
  const row = (await rpc(base, 'shared_schedule', { p_token: token })) as
    | { title: string; options: SharedSchedule['options']; entries: SharedEntry[]; updated_at: string }
    | null;
  if (!row || typeof row.title !== 'string' || !Array.isArray(row.entries)) return null;
  const entries = row.entries.filter((e) => e && isLocalDate(e.date) && typeof e.title === 'string');
  return { title: row.title, options: row.options ?? {}, entries, updatedAt: new Date(row.updated_at) };
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
