import type { Item, ScheduleVersion, SeriesRule } from '@dayli/schema';

import type { StoredCourse, useStore } from '../store';
import { SAMPLE_SOURCE } from '../store/sample';

/* The backup's shape and the sign-in merge, kept free of native imports so they can be tested. */

type State = ReturnType<typeof useStore.getState>;
type Settings = State['settings'];

/**
 * Settings that describe the person, not this phone. Canvas stays out (Oct 27, 2026): its feed
 * link is the only credential and stays on this phone, and the rest is that feed's sync status here.
 */
const PERSONAL = ['name', 'isStudent', 'major', 'weekKinds', 'plate', 'deadlineSource', 'lms', 'reminders', 'breaks', 'planIntent', 'region', 'termSystem'] as const;

export interface Snapshot {
  version: 1;
  items: Item[];
  courses: StoredCourse[];
  schedules: (ScheduleVersion & { batchId?: string })[];
  taskWorkDates: Record<string, string>;
  /** How each repeating series repeats, by seriesId. Missing in plans saved before Oct 27, 2026. */
  series?: Record<string, SeriesRule>;
  settings: Partial<Pick<Settings, (typeof PERSONAL)[number]>>;
  /** Whether the account ever finished onboarding. Missing in rows saved before Oct 20, 2026. */
  onboarded?: boolean;
}

type Plan = Pick<State, 'items' | 'courses' | 'schedules' | 'taskWorkDates' | 'series' | 'settings'>;
type Row = { id: string; sourceId?: string | null; batchId?: string | null };

/** `sampleWeek` (store/sample.ts) gives the sample's courses and series these ids, and its rows in previews too. */
const SAMPLE_ID = 'sample-';
/** The source onboarding's "Try a sample" gives every sample item (onboarding.tsx). */
const SAMPLE_LABEL = 'Sample week';

/**
 * Whether a row is the onboarding sample rather than something the person made (Oct 27, 2026).
 * The sample is made as a real import (`preview`), so its source alone doesn't say so: its rows
 * carry the sample's batch, the "Sample week" label or a `sample-` id. Another device's batch
 * isn't known here, so rows from the account are judged by the label and ids.
 */
function isSample(row: Row, sampleBatchId: string | null | undefined): boolean {
  return row.sourceId === SAMPLE_SOURCE || row.sourceId === SAMPLE_LABEL || row.id.startsWith(SAMPLE_ID) || (!!sampleBatchId && row.batchId === sampleBatchId);
}

const own = <T extends Row>(rows: T[], sampleBatchId?: string | null): T[] => rows.filter((r) => !isSample(r, sampleBatchId));

/** The person's own items, for "a plan from Oct 12". */
export function ownItems(items: Record<string, Item>, sampleBatchId: string | null): Item[] {
  return own(Object.values(items), sampleBatchId);
}

/** The person's settings out of a stored profile; anything else it carries (Canvas, from older versions) stays where it was. */
export function personalSettings(settings: Partial<Settings> | undefined): Snapshot['settings'] {
  if (!settings) return {};
  return Object.fromEntries(PERSONAL.filter((k) => k in settings).map((k) => [k, settings[k]]));
}

/** The person's plan as the account holds it. Samples never leave the device. */
export function snapshotOf(s: Plan): Snapshot {
  const batch = s.settings.sampleBatchId;
  const all = Object.values(s.items);
  const samples = new Set(all.filter((i) => isSample(i, batch)).map((i) => i.id));
  return {
    version: 1,
    items: all.filter((i) => !samples.has(i.id)),
    courses: own(s.courses, batch),
    schedules: own(s.schedules, batch),
    taskWorkDates: Object.fromEntries(Object.entries(s.taskWorkDates).filter(([id]) => !samples.has(id) && !id.startsWith(SAMPLE_ID))),
    series: Object.fromEntries(Object.entries(s.series).filter(([id]) => !id.startsWith(SAMPLE_ID))),
    settings: Object.fromEntries(PERSONAL.map((k) => [k, s.settings[k]])),
    onboarded: s.settings.onboarded,
  };
}

/**
 * Every sign-in saves a row, so a row alone doesn't mean the account was set up: someone who
 * signed up and stopped at the code has an empty one. Older rows carry no flag; a plan stands in.
 */
export function finishedOnboarding(remote: Snapshot): boolean {
  if (typeof remote.onboarded === 'boolean') return remote.onboarded;
  return remote.items.length > 0 || remote.courses.length > 0 || remote.schedules.length > 0;
}

/** Whether a side holds anything the person made (samples don't count). */
function hasPlan(p: Pick<Snapshot, 'items' | 'courses' | 'schedules'>): boolean {
  return own(p.items).length > 0 || own(p.courses).length > 0 || own(p.schedules).length > 0;
}

/**
 * What signing in does with the two plans. Never merge: merging two people's plans on a shared
 * phone was how one account's classes ended up in another's backup.
 * - `remote`: only the account has a plan, so this phone takes it.
 * - `local`: only this phone has one (a guest backing up), so the account takes it.
 * - `ask`: both do; the person keeps one and the other is replaced.
 * - `none`: neither does.
 */
export function choosePlan(local: Plan, remote: Snapshot | null | undefined): 'remote' | 'local' | 'ask' | 'none' {
  const mine = hasPlan(snapshotOf(local));
  const theirs = !!remote && hasPlan(remote);
  if (mine && theirs) return 'ask';
  if (theirs) return 'remote';
  return mine ? 'local' : 'none';
}

/** The newest thing on a plan, for "a plan from Oct 12": the latest item created. */
export function planDate(items: Item[]): string | null {
  return items.reduce<string | null>((latest, i) => (!latest || i.createdAt > latest ? i.createdAt : latest), null);
}

/**
 * The account's profile on this phone: the person's settings come from the account, and this
 * phone's own preferences (appearance, sounds, its Canvas feed) stay. A phone that never finished
 * onboarding (a new install) skips it only when the account finished it somewhere else.
 */
export function adoptProfile(local: Pick<Plan, 'settings'>, remote: Snapshot): Settings {
  const done = finishedOnboarding(remote);
  return { ...local.settings, ...personalSettings(remote.settings), ...(done ? { onboarded: true, seeded: true } : {}) };
}

/**
 * This phone takes the account's plan in place of its own, the sample included (so Today stops
 * offering to remove it). Sample rows another device uploaded before Oct 27, 2026 stay behind.
 */
export function adoptSnapshot(local: Plan, remote: Snapshot) {
  return {
    items: Object.fromEntries(own(remote.items).map((i) => [i.id, i])),
    courses: own(remote.courses),
    schedules: own(remote.schedules),
    taskWorkDates: remote.taskWorkDates,
    // Plans saved before series synced carry no rules; each series reads its rule off its occurrences again.
    series: remote.series ?? {},
    settings: { ...adoptProfile(local, remote), sampleBatchId: null },
  };
}
