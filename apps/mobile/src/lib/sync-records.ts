import type { Item, ScheduleVersion, SeriesRule } from '@dayli/schema';

import { personalSettings, snapshotOf, type Snapshot } from './cloud-snapshot';
import type { StoredCourse, useStore } from '../store';

/*
 * The plan as sync records, and back: one record per item, course, schedule, planned work date,
 * series rule (since Oct 27, 2026), plus the person's profile. Pure, so the sync rules can be tested without a server.
 */

type State = ReturnType<typeof useStore.getState>;
type Plan = Pick<State, 'items' | 'courses' | 'schedules' | 'taskWorkDates' | 'series' | 'settings'>;

export type RecordKind = 'item' | 'course' | 'schedule' | 'workdate' | 'series' | 'profile';

/** A record as the device holds it. A deletion has `deleted` set and no data. */
export interface PlanRecord {
  kind: RecordKind;
  id: string;
  data: unknown;
  deleted: boolean;
  /**
   * When this device made the change, by its own clock. Set only on edits made here and waiting to
   * be sent, to weigh against a deletion from another device (see `apply` in cloud.ts). Never sent.
   */
  at?: string;
}

/** A record as the server returns it: `seq` orders every write the account has made. */
export interface StoredRecord extends PlanRecord {
  seq: number;
  updated_at?: string;
}

type Profile = { settings: Snapshot['settings']; onboarded: boolean };

const PROFILE_ID = 'me';

export const keyOf = (r: { kind: RecordKind; id: string }) => `${r.kind}:${r.id}`;

/** Every record a plan holds, keyed `kind:id`. Samples never leave the device. */
export function recordsOf(plan: Plan): Map<string, PlanRecord> {
  const s = snapshotOf(plan);
  const out = new Map<string, PlanRecord>();
  const put = (kind: RecordKind, id: string, data: unknown) => out.set(`${kind}:${id}`, { kind, id, data, deleted: false });
  for (const item of s.items) put('item', item.id, item);
  for (const course of s.courses) put('course', course.id, course);
  for (const schedule of s.schedules) put('schedule', schedule.id, schedule);
  for (const [id, date] of Object.entries(s.taskWorkDates)) put('workdate', id, { date });
  for (const [id, rule] of Object.entries(s.series ?? {})) put('series', id, rule);
  put('profile', PROFILE_ID, { settings: s.settings, onboarded: s.onboarded ?? false } satisfies Profile);
  return out;
}

/** Whether two records say the same thing. Unchanged items keep their object, so most checks stop at `===`. */
export function sameRecord(a: PlanRecord | undefined, b: PlanRecord | undefined): boolean {
  if (!a || !b) return a === b;
  if (a.deleted !== b.deleted) return false;
  return a.data === b.data || JSON.stringify(a.data) === JSON.stringify(b.data);
}

/** What changed between two sets of records: new and edited ones, and a deletion for each one that's gone. */
export function diffRecords(before: Map<string, PlanRecord>, after: Map<string, PlanRecord>): PlanRecord[] {
  const changes: PlanRecord[] = [];
  for (const [key, record] of after) if (!sameRecord(before.get(key), record)) changes.push(record);
  for (const [key, record] of before) if (!after.has(key)) changes.push({ kind: record.kind, id: record.id, data: null, deleted: true });
  return changes;
}

/** The highest `seq` in a list of server rows, or `floor` when there are none. */
export function latestSeq(rows: StoredRecord[], floor = 0): number {
  return rows.reduce((max, r) => (r.seq > max ? r.seq : max), floor);
}

/** The account's plan from its live records, in the shape sign-in compares and adopts. */
export function snapshotFromRecords(rows: PlanRecord[]): Snapshot {
  const snapshot: Snapshot = { version: 1, items: [], courses: [], schedules: [], taskWorkDates: {}, series: {}, settings: {} };
  for (const r of rows) {
    if (r.deleted) continue;
    if (r.kind === 'item') snapshot.items.push(r.data as Item);
    else if (r.kind === 'course') snapshot.courses.push(r.data as StoredCourse);
    else if (r.kind === 'schedule') snapshot.schedules.push(r.data as ScheduleVersion);
    else if (r.kind === 'workdate') snapshot.taskWorkDates[r.id] = (r.data as { date: string }).date;
    else if (r.kind === 'series') snapshot.series![r.id] = r.data as SeriesRule;
    else if (r.kind === 'profile') {
      const profile = r.data as Profile;
      snapshot.settings = profile.settings;
      snapshot.onboarded = profile.onboarded;
    }
  }
  return snapshot;
}

/** Upsert by id, keeping the list's order (a course's place sets its fallback tint). */
function replaceIn<T extends { id: string }>(list: T[], id: string, next: T | null): T[] {
  const at = list.findIndex((x) => x.id === id);
  if (!next) return at < 0 ? list : list.filter((x) => x.id !== id);
  if (at < 0) return [...list, next];
  const copy = [...list];
  copy[at] = next;
  return copy;
}

/**
 * Records from another device, applied to this one. Returns only the fields that changed, or null.
 * A profile can finish onboarding here but never undo it.
 */
export function applyRecords(plan: Plan, rows: PlanRecord[]): Partial<Plan> | null {
  if (!rows.length) return null;
  const patch: Partial<Plan> = {};
  for (const r of rows) {
    if (r.kind === 'item') {
      const items = { ...(patch.items ?? plan.items) };
      if (r.deleted) delete items[r.id];
      else items[r.id] = r.data as Item;
      patch.items = items;
    } else if (r.kind === 'course') {
      patch.courses = replaceIn(patch.courses ?? plan.courses, r.id, r.deleted ? null : (r.data as StoredCourse));
    } else if (r.kind === 'schedule') {
      patch.schedules = replaceIn(patch.schedules ?? plan.schedules, r.id, r.deleted ? null : (r.data as Plan['schedules'][number]));
    } else if (r.kind === 'workdate') {
      const dates = { ...(patch.taskWorkDates ?? plan.taskWorkDates) };
      if (r.deleted) delete dates[r.id];
      else dates[r.id] = (r.data as { date: string }).date;
      patch.taskWorkDates = dates;
    } else if (r.kind === 'series') {
      const series = { ...(patch.series ?? plan.series) };
      if (r.deleted) delete series[r.id];
      else series[r.id] = r.data as SeriesRule;
      patch.series = series;
    } else if (r.kind === 'profile' && !r.deleted) {
      const profile = r.data as Profile;
      // Only the person's settings: a profile from an older version also carries its Canvas feed, which stays on that phone.
      patch.settings = { ...(patch.settings ?? plan.settings), ...personalSettings(profile.settings), ...(profile.onboarded ? { onboarded: true, seeded: true } : {}) };
    }
  }
  return patch;
}
