import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { adoptProfile, adoptSnapshot, choosePlan, type Snapshot } from './cloud-snapshot';
import { pullRecords, pushRecords, readLegacyPlan } from './cloud-store';
import { reportError } from './errors';
import { accountOf, supabase, useSession } from './supabase';
import { applyRecords, diffRecords, keyOf, latestSeq, recordsOf, sameRecord, snapshotFromRecords, type PlanRecord, type StoredRecord } from './sync-records';
import { useStore } from '../store';

/*
 * Sync, one record at a time: an item, a course, a schedule, a planned work date, a series rule,
 * the profile. Each device pushes what changed a moment after the change, pulls everything newer
 * than the last `seq` it saw, and listens live while open, so a phone and a laptop can both edit.
 * Signing in still never merges two plans (see choosePlan): one side wins, and when both have a
 * plan the person picks which to keep. Undo history stays on the device that made the change.
 */

type Sync = {
  userId: string;
  /** The last server `seq` this device has applied. */
  cursor: number;
  /** Changes made here that the server hasn't confirmed, by `kind:id`. */
  pending: Map<string, PlanRecord>;
  /** The records as of the last change seen, to tell what the next change touched. */
  baseline: Map<string, PlanRecord>;
};

let sync: Sync | null = null;
let stopLive: (() => void) | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let flushing: Promise<void> | null = null;
/** Set while another device's records are written into the store, so they aren't sent back. */
let applying = false;
/** While the person picks between two plans: where the account's records stand. */
let choiceCursor: { cursor: number; fromRecords: boolean } | null = null;

const STORAGE_KEY = 'semli.sync';
/**
 * Set while a sign-in hasn't settled which plan the account keeps: the restore couldn't reach the
 * account, or the person hasn't answered "You have two plans" yet. A launch then decides again
 * (asking, if both still have a plan) instead of joining the two plans (Oct 27, 2026).
 */
const UNSETTLED_KEY = 'semli.sync.unsettled';
const PUSH_DELAY_MS = 1000;
const SYNC_FAILED = 'Couldn’t sync. We’ll try again after your next change.';
/** Postgres `check_violation`: what a server not yet migrated for `series` records answers them with. */
const CHECK_VIOLATION = '23514';

/** What signing in did with the plan, for the line that confirms it. */
export type RestoreOutcome =
  /** This phone took the account's plan. */
  | 'restored'
  /** The account took this phone's plan, or neither had one; the account has it now. */
  | 'backed-up'
  /** Both had a plan; the person is asked which to keep. */
  | 'choose'
  /** The account took this phone's plan, but sending it failed; it goes up on the next try. */
  | 'unsent'
  /** The account couldn't be read, so nothing changed. */
  | 'unreached';

/** The account's plan: its records, or the old whole-plan backup when it has none yet. */
async function readAccountPlan(userId: string): Promise<{ snapshot: Snapshot; at: string | null; cursor: number; fromRecords: boolean } | null> {
  const rows = await pullRecords(userId, 0);
  const cursor = latestSeq(rows);
  const live = rows.filter((r) => !r.deleted);
  if (live.length) {
    const at = rows.reduce<string | null>((latest, r) => (r.updated_at && (!latest || r.updated_at > latest) ? r.updated_at : latest), null);
    return { snapshot: snapshotFromRecords(live), at, cursor, fromRecords: true };
  }
  const legacy = await readLegacyPlan(userId);
  return legacy ? { ...legacy, cursor, fromRecords: false } : null;
}

/** After sign-in: take the account's plan, upload this device's, or ask which to keep. */
export async function restoreFromCloud(): Promise<{ restored: boolean; outcome: RestoreOutcome }> {
  if (!supabase) return { restored: false, outcome: 'unreached' };
  // Read the session directly: right after sign-in the listener may not have run yet.
  const { data: auth } = await supabase.auth.getSession();
  useSession.setState({ session: auth.session, ready: true });
  const userId = accountOf(auth.session)?.user.id;
  if (!userId) return { restored: false, outcome: 'unreached' };
  stopSync();
  const outcome = await settleSignIn(userId);
  return { restored: outcome === 'restored', outcome };
}

/**
 * Decides which plan an account keeps, on sign-in or on a launch after one that didn't settle.
 * Marked unsettled first, so being killed or offline before the end means deciding again, never merging.
 */
async function settleSignIn(userId: string): Promise<RestoreOutcome> {
  await remember(UNSETTLED_KEY, { userId });
  const remote = await readAccountPlan(userId);
  const choice = choosePlan(useStore.getState(), remote?.snapshot);
  if (choice === 'ask' && remote) {
    // Nothing is saved until the person keeps one, so neither plan can overwrite the other.
    choiceCursor = { cursor: remote.cursor, fromRecords: remote.fromRecords };
    useStore.setState({ planChoice: { remote: remote.snapshot, remoteAt: remote.at } });
    return 'choose';
  }
  if (remote && choice === 'remote') useStore.setState(adoptSnapshot(useStore.getState(), remote.snapshot));
  // Neither side has a plan: the account's profile (name, studies, setup state) still comes along,
  // and the phone keeps its sample, if it has one.
  if (remote && choice === 'none') useStore.setState({ settings: adoptProfile(useStore.getState(), remote.snapshot) });
  try {
    // Records the account already holds needn't go back up; anything else (an old backup, this device's plan) does.
    await begin(userId, remote?.cursor ?? 0, choice === 'remote' && remote?.fromRecords ? [] : null);
  } catch (error) {
    // The decision is made and remembered; what didn't go up waits for the next change or launch.
    noteSyncFailure(error);
    return choice === 'remote' ? 'restored' : 'unsent';
  }
  return choice === 'remote' ? 'restored' : 'backed-up';
}

/**
 * "Keep account plan": this device's plan is replaced by the account's. The question stays up
 * until that's done, so a failure shows and leaves both plans as they were.
 */
export async function keepAccountPlan(): Promise<void> {
  const pending = useStore.getState().planChoice;
  const userId = accountOf(useSession.getState().session)?.user.id;
  if (!pending || !userId) return;
  const at = choiceCursor ?? { cursor: 0, fromRecords: false };
  const next = { ...adoptSnapshot(useStore.getState(), pending.remote), batches: [] };
  // An old whole-plan backup goes up as records before this phone's plan is replaced.
  if (!at.fromRecords) await pushRecords(userId, [...recordsOf({ ...useStore.getState(), ...next }).values()]);
  useStore.setState(next);
  await begin(userId, at.cursor, []);
  choiceCursor = null;
  useStore.setState({ planChoice: null });
}

/**
 * "Keep this device's plan": the account's records are replaced with this device's plan. The
 * question stays up until the account has it, so a failure shows and can be tried again.
 */
export async function keepPhonePlan(): Promise<void> {
  const userId = accountOf(useSession.getState().session)?.user.id;
  if (!useStore.getState().planChoice || !userId) return;
  const at = choiceCursor;
  // Read again: the account's other devices may have written since the question was asked.
  const rows = await pullRecords(userId, 0);
  const local = recordsOf(useStore.getState());
  const gone = rows.filter((r) => !r.deleted && !local.has(keyOf(r))).map((r): PlanRecord => ({ kind: r.kind, id: r.id, data: null, deleted: true }));
  try {
    await begin(userId, latestSeq(rows), null, gone, false);
  } catch (error) {
    // Not settled: stop, so nothing more goes up behind the question, and keep asking.
    stopSync();
    choiceCursor = at;
    throw error;
  }
  choiceCursor = null;
  useStore.setState({ planChoice: null });
}

/**
 * Start syncing this account from the current plan. `upload` null sends every local record (a
 * first upload); a list sends just those. `extra` adds records to send, such as deletions.
 * `settleFirst` remembers the sync before sending; false waits until the account has it.
 */
async function begin(userId: string, cursor: number, upload: PlanRecord[] | null, extra: PlanRecord[] = [], settleFirst = true): Promise<void> {
  const baseline = recordsOf(useStore.getState());
  const pending = new Map<string, PlanRecord>();
  for (const r of upload ?? baseline.values()) pending.set(keyOf(r), r);
  for (const r of extra) pending.set(keyOf(r), r);
  const s: Sync = { userId, cursor, pending, baseline };
  sync = s;
  startLive();
  if (settleFirst) await settle(s);
  // Nothing to send (a clean restore): the account already holds every record.
  if (!pending.size) noteBackedUp();
  await flush();
  if (!settleFirst) await settle(s);
}

/** Saves where sync stands now and drops the unsettled mark, so from here a launch resumes this sync. */
async function settle(s: Sync): Promise<void> {
  if (sync !== s) return;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(savedOf(s)));
    await AsyncStorage.removeItem(UNSETTLED_KEY);
  } catch (error) {
    // The mark stays, so the next launch decides again rather than joining.
    reportError('cloud.remember', error);
  }
}

/** Resume on launch for an account that was already signed in. */
export async function resumeSync(userId: string): Promise<void> {
  if (await unsettled(userId)) {
    await settleSignIn(userId);
    return;
  }
  const saved = await loadSaved();
  if (saved?.userId === userId) {
    sync = { userId, cursor: saved.cursor, pending: new Map(saved.pending.map((r) => [keyOf(r), r])), baseline: recordsOf(useStore.getState()) };
    startLive();
    await flush();
    await pull();
    return;
  }
  // The first sync on this device (an update from the backup-only version): join the account's
  // records, sending only what the account doesn't have. A record the account has wins.
  const rows = await pullRecords(userId, 0);
  const known = new Set(rows.map(keyOf));
  apply(rows);
  const local = recordsOf(useStore.getState());
  await begin(userId, latestSeq(rows), [...local.values()].filter((r) => !known.has(keyOf(r))));
}

/** A time from this device or the server, to compare: Postgres sends microseconds, which not every engine parses. */
const timeOf = (iso: string | undefined) => (iso ? Date.parse(iso.replace(/(\.\d{3})\d+/, '$1')) : NaN);

/**
 * Writes another device's records into the store, skipping any this device has changed since.
 * A deletion made elsewhere after this device's unsent edit wins, so an edit made offline doesn't
 * bring back what another device deleted (Oct 27, 2026). The two clocks are the device's and the
 * server's, so a phone set minutes wrong can tip a near tie.
 */
function apply(rows: StoredRecord[]): void {
  const s = sync;
  const base = s?.baseline ?? recordsOf(useStore.getState());
  let dropped = false;
  const fresh = rows.filter((r) => {
    const key = keyOf(r);
    const waiting = s?.pending.get(key);
    if (waiting) {
      if (!r.deleted || waiting.deleted || !(timeOf(r.updated_at) > timeOf(waiting.at))) return false;
      s!.pending.delete(key);
      dropped = true;
    }
    const mine = base.get(key);
    return r.deleted ? !!mine : !sameRecord(mine, r);
  });
  if (dropped) persist();
  const patch = applyRecords(useStore.getState(), fresh);
  if (!patch) return;
  applying = true;
  try { useStore.setState(patch); } finally { applying = false; }
  if (s) s.baseline = recordsOf(useStore.getState());
}

/** Everything newer than the cursor. */
async function pull(): Promise<void> {
  const s = sync;
  if (!s) return;
  const rows = await pullRecords(s.userId, s.cursor);
  if (sync !== s) return;
  apply(rows);
  s.cursor = latestSeq(rows, s.cursor);
  persist();
}

/** Logged once a session: the server refuses `series` records until its migration runs. */
let seriesRefused = false;

/**
 * Sends series rules apart from the rest, so a server that doesn't take them yet can't hold up
 * everything else. Refused, they stay waiting and go up once it does. Returns whether they went.
 */
async function pushSeries(userId: string, rules: PlanRecord[]): Promise<boolean> {
  if (!rules.length) return true;
  try {
    await pushRecords(userId, rules);
    return true;
  } catch (error) {
    if ((error as { code?: unknown } | null)?.code !== CHECK_VIOLATION) throw error;
    if (!seriesRefused) reportError('cloud.series_unsupported', error);
    seriesRefused = true;
    return false;
  }
}

/**
 * Sends this device's unconfirmed changes. One send at a time; a change made during one waits for
 * the next. It catches up first: a deletion another device made while this one was offline has to
 * be seen before this device's edit is sent over it (Oct 27, 2026).
 */
async function flush(): Promise<void> {
  if (flushing) await flushing.catch(() => undefined);
  const s = sync;
  if (!s || !s.pending.size) return;
  flushing = (async () => {
    await pull();
    if (sync !== s || !s.pending.size) return;
    const batch = [...s.pending.values()];
    const rules = batch.filter((r) => r.kind === 'series');
    const rest = batch.filter((r) => r.kind !== 'series');
    if (rest.length) await pushRecords(s.userId, rest);
    const sent = (await pushSeries(s.userId, rules)) ? batch : rest;
    for (const r of sent) if (s.pending.get(keyOf(r)) === r) s.pending.delete(keyOf(r));
    persist();
    noteBackedUp();
  })();
  try { await flushing; } finally { flushing = null; }
}

function noteBackedUp() {
  const { settings, setSettings } = useStore.getState();
  setSettings({ cloud: { ...settings.cloud, backedUpAt: new Date().toISOString(), error: null } });
}

/**
 * Sign-out sends what's left first; a failure keeps the person signed in. `force` (sign-out) also
 * checks the account answers when nothing is left to send: sign-out refuses while offline
 * (Oct 21, 2026 account model, docs/design-system.md), and offline Supabase would end the session
 * on this phone and then fail.
 */
export async function saveToCloud(force = false): Promise<void> {
  const userId = accountOf(useSession.getState().session)?.user.id;
  if (!supabase || !userId) return;
  // Sync never started here (the sign-in couldn't reach the account): settle it as a launch would.
  if (force && sync?.userId !== userId && !useStore.getState().planChoice) await resumeSync(userId);
  // While the person is choosing between two plans, saving would decide for them, and signing out
  // would clear a plan the account doesn't have.
  if (useStore.getState().planChoice) {
    if (force) throw new Error('A plan choice is waiting');
    return;
  }
  if (sync?.userId !== userId) return;
  await flush();
  if (force) await pull();
}

function noteSyncFailure(error: unknown) {
  reportError('cloud.sync', error);
  const { settings, setSettings } = useStore.getState();
  // Setting the same message twice would schedule another save; set it once.
  if (settings.cloud.error !== SYNC_FAILED) setSettings({ cloud: { ...settings.cloud, error: SYNC_FAILED } });
}

function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    void flush().catch(noteSyncFailure);
  }, PUSH_DELAY_MS);
}

/** Watch the store for local changes, the server for other devices' changes, and the app for focus. */
function startLive(): void {
  stopLive?.();
  const s = sync;
  if (!s || !supabase) return;
  const unsubscribe = useStore.subscribe((st, prev) => {
    if (applying || sync !== s || !st.hydrated || st.planChoice) return;
    if (st.items === prev.items && st.courses === prev.courses && st.schedules === prev.schedules && st.taskWorkDates === prev.taskWorkDates && st.series === prev.series && st.settings === prev.settings) return;
    const next = recordsOf(st);
    const changes = diffRecords(s.baseline, next);
    s.baseline = next;
    if (!changes.length) return;
    const at = new Date().toISOString();
    for (const r of changes) s.pending.set(keyOf(r), { ...r, at });
    persist();
    schedulePush();
  });
  const channel = supabase
    .channel(`plan-records:${s.userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'plan_records', filter: `user_id=eq.${s.userId}` }, (payload) => {
      // Live rows are applied but don't move the cursor: the next pull fetches anything committed out of order.
      const row = payload.new as StoredRecord | undefined;
      if (row?.kind && sync === s) apply([row]);
    })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') void pull().catch(noteSyncFailure);
    });
  const focus = AppState.addEventListener('change', (state) => {
    if (state === 'active') void flush().then(pull).catch(noteSyncFailure);
  });
  stopLive = () => {
    unsubscribe();
    focus.remove();
    void supabase?.removeChannel(channel);
    if (pushTimer) clearTimeout(pushTimer);
    pushTimer = null;
    stopLive = null;
  };
}

/** Stops syncing (sign-out, or a different account signing in). `forget` drops what this device remembered. */
export function stopSync(forget = false): void {
  stopLive?.();
  sync = null;
  choiceCursor = null;
  if (forget) void Promise.all([STORAGE_KEY, UNSETTLED_KEY].map((k) => AsyncStorage.removeItem(k))).catch((error: unknown) => reportError('cloud.forget', error));
}

function persist() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const s = sync;
    if (!s) return;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(savedOf(s))).catch((error: unknown) => reportError('cloud.remember', error));
  }, 300);
}

const savedOf = (s: Sync) => ({ userId: s.userId, cursor: s.cursor, pending: [...s.pending.values()] });

async function remember(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    reportError('cloud.remember', error);
  }
}

/** Whether this account's last sign-in hasn't settled which plan to keep (see UNSETTLED_KEY). */
async function unsettled(userId: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(UNSETTLED_KEY);
    return !!raw && (JSON.parse(raw) as { userId?: string }).userId === userId;
  } catch (error) {
    reportError('cloud.recall', error);
    return false;
  }
}

async function loadSaved(): Promise<{ userId: string; cursor: number; pending: PlanRecord[] } | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    reportError('cloud.recall', error);
    return null;
  }
}

/**
 * Resumes sync for an account that was signed in when the app opened. A sign-in later in the
 * session starts sync from `restoreFromCloud` instead, once the person's plan is settled.
 */
export function CloudBackup() {
  const ready = useSession((s) => s.ready);
  const userId = useSession((s) => accountOf(s.session)?.user.id);
  const launched = useRef(false);
  useEffect(() => {
    if (!ready) return;
    if (!launched.current) {
      launched.current = true;
      if (userId) void resumeSync(userId).catch(noteSyncFailure);
      return;
    }
    if (!userId) stopSync();
  }, [ready, userId]);
  useEffect(() => () => stopSync(), []);
  return null;
}
