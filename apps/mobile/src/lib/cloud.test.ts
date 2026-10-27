import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlanRecord, StoredRecord } from './sync-records';

/*
 * Sync between this device and the account's records, with an in-memory server standing in for
 * Supabase. Another device is played by writing rows to the server and delivering them live.
 */

type Listener = (state: Record<string, unknown>, prev: Record<string, unknown>) => void;

const mocks = vi.hoisted(() => {
  const server = { rows: new Map<string, StoredRecord>(), seq: 0 };
  const live = { onRow: null as null | ((payload: { new: unknown }) => void), onStatus: null as null | ((status: string) => void) };
  const channel = {
    on: (_event: string, _filter: unknown, cb: (payload: { new: unknown }) => void) => { live.onRow = cb; return channel; },
    subscribe: (cb: (status: string) => void) => { live.onStatus = cb; return channel; },
  };
  return {
    server, live,
    cloud: { pullRecords: vi.fn(), pushRecords: vi.fn(), readLegacyPlan: vi.fn() },
    supabase: { auth: { getSession: vi.fn() }, channel: vi.fn(() => channel), removeChannel: vi.fn() },
    storage: new Map<string, string>(),
    store: null as unknown as { getState: () => Record<string, unknown>; setState: (p: object) => void; subscribe: (l: Listener) => () => void; reset: () => void },
    session: null as unknown as { getState: () => Record<string, unknown>; setState: (p: object) => void; subscribe: (l: Listener) => () => void; reset: () => void },
  };
});

function fakeStore(initial: () => Record<string, unknown>) {
  let state = initial();
  const listeners = new Set<Listener>();
  return {
    getState: () => state,
    setState: (patch: object) => { const prev = state; state = { ...state, ...patch }; listeners.forEach((l) => l(state, prev)); },
    subscribe: (l: Listener) => { listeners.add(l); return () => { listeners.delete(l); }; },
    reset: () => { state = initial(); listeners.clear(); },
  };
}

const item = (id: string, over: object = {}) => ({ id, kind: 'task', title: id, category: 'school', icon: 'check', date: '2026-10-20', start: null, end: null, isDeadline: false, done: false, completedAt: null, courseId: null, employer: null, sourceId: null, batchId: null, notes: null, createdAt: '2026-10-01T00:00:00Z', ...over });
const SETTINGS = () => ({ name: 'Ama', onboarded: true, seeded: true, isStudent: true, cloud: { backedUpAt: null, error: null } });

mocks.store = fakeStore(() => ({
  hydrated: true, items: {} as Record<string, unknown>, courses: [], schedules: [], taskWorkDates: {}, series: {} as Record<string, unknown>, settings: SETTINGS(), planChoice: null, batches: [],
  setSettings: (patch: object) => mocks.store.setState({ settings: { ...(mocks.store.getState().settings as object), ...patch } }),
}));
mocks.session = fakeStore(() => ({ session: { user: { id: 'u1' } }, ready: true }));

vi.mock('react-native', () => ({ AppState: { addEventListener: () => ({ remove: () => undefined }) } }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async (k: string) => mocks.storage.get(k) ?? null,
  setItem: async (k: string, v: string) => { mocks.storage.set(k, v); },
  removeItem: async (k: string) => { mocks.storage.delete(k); },
} }));
vi.mock('./cloud-store', () => mocks.cloud);
vi.mock('./errors', () => ({ reportError: vi.fn() }));
vi.mock('./supabase', () => ({
  supabase: mocks.supabase,
  useSession: mocks.session,
  accountOf: (session: { user?: { is_anonymous?: boolean } } | null) => (session && !session.user?.is_anonymous ? session : null),
}));
vi.mock('../store', () => ({ useStore: mocks.store }));

let cloud: typeof import('./cloud');

/** Another device's write, as the server stores it. */
function elsewhere(record: PlanRecord): StoredRecord {
  const row = { ...record, seq: ++mocks.server.seq };
  mocks.server.rows.set(`${record.kind}:${record.id}`, row);
  return row;
}
const serverItems = () => [...mocks.server.rows.values()].filter((r) => r.kind === 'item' && !r.deleted).map((r) => r.id).sort();
const localItems = () => Object.keys(mocks.store.getState().items as object).sort();
const setItems = (items: Record<string, unknown>) => mocks.store.setState({ items });

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  mocks.store.reset();
  mocks.session.reset();
  mocks.server.rows.clear();
  mocks.server.seq = 0;
  mocks.storage.clear();
  mocks.live.onRow = null;
  mocks.live.onStatus = null;
  mocks.supabase.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
  mocks.cloud.pullRecords.mockImplementation(async (_user: string, after: number) => [...mocks.server.rows.values()].filter((r) => r.seq > after).sort((a, b) => a.seq - b.seq));
  mocks.cloud.pushRecords.mockImplementation(async (_user: string, records: PlanRecord[]) => { for (const r of records) elsewhere(r); });
  mocks.cloud.readLegacyPlan.mockResolvedValue(null);
  cloud = await import('./cloud');
});

describe('everyday sync', () => {
  it('sends only the record that changed', async () => {
    setItems({ a: item('a'), b: item('b') });
    await cloud.restoreFromCloud();
    mocks.cloud.pushRecords.mockClear();
    setItems({ ...(mocks.store.getState().items as object), b: item('b', { done: true }) });
    await cloud.saveToCloud();
    const sent = mocks.cloud.pushRecords.mock.calls.flatMap((c) => c[1] as PlanRecord[]);
    expect(sent.map((r) => `${r.kind}:${r.id}`)).toEqual(['item:b']);
  });

  it('sends a deletion so the account’s other devices drop the item too', async () => {
    setItems({ a: item('a'), b: item('b') });
    await cloud.restoreFromCloud();
    setItems({ a: item('a') });
    await cloud.saveToCloud();
    expect(serverItems()).toEqual(['a']);
    expect(mocks.server.rows.get('item:b')).toMatchObject({ deleted: true, data: null });
  });

  it('a phone and a laptop editing different items both keep their edits', async () => {
    setItems({ a: item('a') });
    await cloud.restoreFromCloud();
    // The laptop adds b while this device adds c.
    const fromLaptop = elsewhere({ kind: 'item', id: 'b', data: item('b'), deleted: false });
    setItems({ ...(mocks.store.getState().items as object), c: item('c') });
    mocks.live.onRow!({ new: fromLaptop });
    await cloud.saveToCloud();
    expect(localItems()).toEqual(['a', 'b', 'c']);
    expect(serverItems()).toEqual(['a', 'b', 'c']);
  });

  it('an edit not yet sent is never overwritten by an older one arriving', async () => {
    setItems({ a: item('a') });
    await cloud.restoreFromCloud();
    setItems({ a: item('a', { title: 'mine' }) });
    mocks.live.onRow!({ new: elsewhere({ kind: 'item', id: 'a', data: item('a', { title: 'theirs' }), deleted: false }) });
    expect((mocks.store.getState().items as Record<string, { title: string }>).a!.title).toBe('mine');
    await cloud.saveToCloud();
    expect((mocks.server.rows.get('item:a')!.data as { title: string }).title).toBe('mine');
  });

  it('applies another device’s deletion', async () => {
    setItems({ a: item('a'), b: item('b') });
    await cloud.restoreFromCloud();
    mocks.live.onRow!({ new: elsewhere({ kind: 'item', id: 'b', data: null, deleted: true }) });
    expect(localItems()).toEqual(['a']);
  });

  it('catches up on focus from where it left off', async () => {
    setItems({ a: item('a') });
    await cloud.restoreFromCloud();
    elsewhere({ kind: 'item', id: 'b', data: item('b'), deleted: false });
    mocks.live.onStatus!('SUBSCRIBED');
    await vi.waitFor(() => expect(localItems()).toEqual(['a', 'b']));
    // Its own writes don't move the cursor (another device's could sit between them); a pull does.
    mocks.live.onStatus!('SUBSCRIBED');
    await vi.waitFor(() => expect(mocks.cloud.pullRecords.mock.calls.at(-1)![1]).toBe(mocks.server.seq));
  });
});

describe('signing out', () => {
  it('after sync stops, clearing the device sends nothing', async () => {
    setItems({ a: item('a') });
    await cloud.restoreFromCloud();
    cloud.stopSync(true);
    mocks.cloud.pushRecords.mockClear();
    setItems({});
    await cloud.saveToCloud();
    expect(mocks.cloud.pushRecords).not.toHaveBeenCalled();
    expect(serverItems()).toEqual(['a']);
  });
});

describe('the first sync on an updated phone', () => {
  it('joins the account’s records: the account’s deletions win and this phone’s new items go up', async () => {
    // The laptop already synced a and deleted b; this phone still has b and has its own c.
    elsewhere({ kind: 'item', id: 'a', data: item('a'), deleted: false });
    elsewhere({ kind: 'item', id: 'b', data: null, deleted: true });
    setItems({ b: item('b'), c: item('c') });
    await cloud.resumeSync('u1');
    expect(localItems()).toEqual(['a', 'c']);
    expect(serverItems()).toEqual(['a', 'c']);
  });

  it('with no records yet, uploads the phone’s plan', async () => {
    setItems({ a: item('a') });
    await cloud.resumeSync('u1');
    expect(serverItems()).toEqual(['a']);
  });
});

describe('choosing between two plans', () => {
  it('keeping this device’s plan deletes the account’s other records', async () => {
    elsewhere({ kind: 'item', id: 'x', data: item('x'), deleted: false });
    setItems({ b: item('b') });
    await cloud.restoreFromCloud();
    expect(mocks.store.getState().planChoice).not.toBeNull();
    await cloud.keepPhonePlan();
    expect(serverItems()).toEqual(['b']);
  });

  it('keeping the account’s plan sends nothing back up', async () => {
    elsewhere({ kind: 'item', id: 'x', data: item('x'), deleted: false });
    setItems({ b: item('b') });
    await cloud.restoreFromCloud();
    mocks.cloud.pushRecords.mockClear();
    await cloud.keepAccountPlan();
    expect(localItems()).toEqual(['x']);
    expect(mocks.cloud.pushRecords).not.toHaveBeenCalled();
  });
});

/** A fresh launch: the module's memory goes, what AsyncStorage and the store hold stays. */
async function relaunch() {
  cloud.stopSync();
  vi.resetModules();
  mocks.store.setState({ planChoice: null });
  cloud = await import('./cloud');
}
const rule = (skipped: string[] = []) => ({ every: 1, days: ['mon'], until: '2026-12-15', skipped, start: '09:00', end: '10:15' });

describe('a sign-in that didn’t settle', () => {
  it('a launch before “You have two plans” was answered asks again instead of merging', async () => {
    elsewhere({ kind: 'item', id: 'x', data: item('x'), deleted: false });
    setItems({ b: item('b') });
    await cloud.restoreFromCloud();
    expect(mocks.store.getState().planChoice).not.toBeNull();
    await relaunch();
    await cloud.resumeSync('u1');
    expect(mocks.store.getState().planChoice).not.toBeNull();
    expect(localItems()).toEqual(['b']);
    expect(serverItems()).toEqual(['x']);
    expect(mocks.cloud.pushRecords).not.toHaveBeenCalled();
  });

  it('a launch after a restore that couldn’t reach the account decides again instead of merging', async () => {
    elsewhere({ kind: 'item', id: 'x', data: item('x'), deleted: false });
    setItems({ b: item('b') });
    mocks.cloud.pullRecords.mockRejectedValueOnce(new Error('offline'));
    await expect(cloud.restoreFromCloud()).rejects.toThrow('offline');
    await relaunch();
    await cloud.resumeSync('u1');
    expect(mocks.store.getState().planChoice).not.toBeNull();
    expect(serverItems()).toEqual(['x']);
  });

  it('once answered, a launch resumes sync', async () => {
    elsewhere({ kind: 'item', id: 'x', data: item('x'), deleted: false });
    setItems({ b: item('b') });
    await cloud.restoreFromCloud();
    await cloud.keepPhonePlan();
    await relaunch();
    await cloud.resumeSync('u1');
    expect(mocks.store.getState().planChoice).toBeNull();
    expect(serverItems()).toEqual(['b']);
  });

  it('keeping this device’s plan offline keeps the question up, sends nothing more, and can be tried again', async () => {
    elsewhere({ kind: 'item', id: 'x', data: item('x'), deleted: false });
    setItems({ b: item('b') });
    await cloud.restoreFromCloud();
    mocks.cloud.pushRecords.mockRejectedValueOnce(new Error('offline'));
    await expect(cloud.keepPhonePlan()).rejects.toThrow('offline');
    expect(mocks.store.getState().planChoice).not.toBeNull();
    expect(serverItems()).toEqual(['x']);
    // Nothing keeps going in the background: a change now sends nothing.
    setItems({ b: item('b'), c: item('c') });
    await cloud.saveToCloud();
    expect(mocks.cloud.pushRecords).toHaveBeenCalledTimes(1);
    await relaunch();
    await cloud.resumeSync('u1');
    expect(mocks.store.getState().planChoice).not.toBeNull();
    await cloud.keepPhonePlan();
    expect(serverItems()).toEqual(['b', 'c']);
    expect(mocks.store.getState().planChoice).toBeNull();
  });

  it('keeping an old backup offline leaves this phone’s plan and the question', async () => {
    mocks.cloud.readLegacyPlan.mockResolvedValue({ snapshot: { version: 1, items: [item('x')], courses: [], schedules: [], taskWorkDates: {}, settings: {} }, at: null });
    setItems({ b: item('b') });
    await cloud.restoreFromCloud();
    mocks.cloud.pushRecords.mockRejectedValueOnce(new Error('offline'));
    await expect(cloud.keepAccountPlan()).rejects.toThrow('offline');
    expect(localItems()).toEqual(['b']);
    expect(mocks.store.getState().planChoice).not.toBeNull();
    await cloud.keepAccountPlan();
    expect(localItems()).toEqual(['x']);
    expect(serverItems()).toEqual(['x']);
    expect(mocks.store.getState().planChoice).toBeNull();
  });
});

describe('the onboarding sample', () => {
  it('never goes up, and doesn’t make signing in ask', async () => {
    elsewhere({ kind: 'item', id: 'x', data: item('x'), deleted: false });
    mocks.store.setState({ items: { n1: item('n1', { batchId: 'b-sample', sourceId: 'Sample week' }) }, settings: { ...SETTINGS(), sampleBatchId: 'b-sample' } });
    expect(await cloud.restoreFromCloud()).toEqual({ restored: true, outcome: 'restored' });
    expect(mocks.store.getState().planChoice).toBeNull();
    expect(localItems()).toEqual(['x']);
  });

  it('stays on a phone signing in to an empty account, and stays off the account', async () => {
    mocks.store.setState({ items: { n1: item('n1', { batchId: 'b-sample' }) }, settings: { ...SETTINGS(), sampleBatchId: 'b-sample' } });
    await cloud.restoreFromCloud();
    expect(localItems()).toEqual(['n1']);
    expect(serverItems()).toEqual([]);
    setItems({ ...(mocks.store.getState().items as object), n1: item('n1', { batchId: 'b-sample', done: true }) });
    await cloud.saveToCloud();
    expect(serverItems()).toEqual([]);
  });
});

describe('series rules', () => {
  it('go up when changed and come down from another device', async () => {
    mocks.store.setState({ items: { a: item('a', { seriesId: 's1' }) }, series: { s1: rule() } });
    await cloud.restoreFromCloud();
    expect(mocks.server.rows.get('series:s1')).toMatchObject({ deleted: false, data: rule() });
    // A lecture deleted here: the rule skips that date, and the account learns it.
    mocks.store.setState({ series: { s1: rule(['2026-10-26']) } });
    await cloud.saveToCloud();
    expect(mocks.server.rows.get('series:s1')!.data).toEqual(rule(['2026-10-26']));
    mocks.live.onRow!({ new: elsewhere({ kind: 'series', id: 's1', data: rule(['2026-10-26', '2026-11-02']), deleted: false }) });
    expect((mocks.store.getState().series as Record<string, unknown>).s1).toEqual(rule(['2026-10-26', '2026-11-02']));
  });

  it('wait, without holding up the rest, while the server doesn’t take them yet', async () => {
    mocks.store.setState({ items: { a: item('a') }, series: { s1: rule() } });
    const refuse = async (_user: string, records: PlanRecord[]) => {
      if (records.some((r) => r.kind === 'series')) throw { code: '23514', message: 'violates check constraint "plan_records_kind_check"' };
      for (const r of records) elsewhere(r);
    };
    mocks.cloud.pushRecords.mockImplementation(refuse);
    await cloud.restoreFromCloud();
    expect(serverItems()).toEqual(['a']);
    expect(mocks.store.getState().settings).toMatchObject({ cloud: { error: null } });
    mocks.cloud.pushRecords.mockImplementation(async (_user: string, records: PlanRecord[]) => { for (const r of records) elsewhere(r); });
    setItems({ a: item('a'), b: item('b') });
    await cloud.saveToCloud();
    expect(mocks.server.rows.get('series:s1')).toMatchObject({ data: rule() });
  });
});

describe('a deletion from another device against an edit made here offline', () => {
  const at = (iso: string) => ({ updated_at: iso.replace('Z', '123+00:00') });

  it('the deletion wins when it came after the edit', async () => {
    setItems({ a: item('a'), b: item('b') });
    await cloud.restoreFromCloud();
    vi.useFakeTimers({ now: new Date('2026-10-27T09:00:00Z'), toFake: ['Date'] });
    try {
      mocks.cloud.pullRecords.mockRejectedValue(new Error('offline'));
      setItems({ a: item('a'), b: item('b', { title: 'edited offline' }) });
      await expect(cloud.saveToCloud()).rejects.toThrow('offline');
      // Meanwhile a laptop deleted b, later.
      const row = elsewhere({ kind: 'item', id: 'b', data: null, deleted: true });
      Object.assign(row, at('2026-10-27T09:05:00.456Z'));
      mocks.cloud.pullRecords.mockImplementation(async (_user: string, after: number) => [...mocks.server.rows.values()].filter((r) => r.seq > after).sort((a, b) => a.seq - b.seq));
      await cloud.saveToCloud();
    } finally { vi.useRealTimers(); }
    expect(localItems()).toEqual(['a']);
    expect(serverItems()).toEqual(['a']);
  });

  it('a deletion arriving live, in Postgres’s own time format, wins over an older unsent edit', async () => {
    setItems({ a: item('a'), b: item('b') });
    await cloud.restoreFromCloud();
    vi.useFakeTimers({ now: new Date('2026-10-27T09:00:00Z'), toFake: ['Date'] });
    try {
      setItems({ a: item('a'), b: item('b', { title: 'edited' }) });
    } finally { vi.useRealTimers(); }
    mocks.live.onRow!({ new: { ...elsewhere({ kind: 'item', id: 'b', data: null, deleted: true }), updated_at: '2026-10-27 09:00:01.5+00' } });
    expect(localItems()).toEqual(['a']);
    await cloud.saveToCloud();
    expect(serverItems()).toEqual(['a']);
  });

  it('the edit wins when it came after the deletion', async () => {
    setItems({ a: item('a'), b: item('b') });
    await cloud.restoreFromCloud();
    vi.useFakeTimers({ now: new Date('2026-10-27T09:10:00Z'), toFake: ['Date'] });
    try {
      mocks.cloud.pullRecords.mockRejectedValue(new Error('offline'));
      setItems({ a: item('a'), b: item('b', { title: 'edited offline' }) });
      await expect(cloud.saveToCloud()).rejects.toThrow('offline');
      const row = elsewhere({ kind: 'item', id: 'b', data: null, deleted: true });
      Object.assign(row, at('2026-10-27T09:05:00.456Z'));
      mocks.cloud.pullRecords.mockImplementation(async (_user: string, after: number) => [...mocks.server.rows.values()].filter((r) => r.seq > after).sort((a, b) => a.seq - b.seq));
      await cloud.saveToCloud();
    } finally { vi.useRealTimers(); }
    expect(localItems()).toEqual(['a', 'b']);
    expect(serverItems()).toEqual(['a', 'b']);
  });
});

describe('the backup status', () => {
  it('a launch that finds nothing left to send says backed up, for restores before Oct 27 that never did', async () => {
    mocks.storage.set('semli.sync', JSON.stringify({ userId: 'u1', cursor: 0, pending: [] }));
    await cloud.resumeSync('u1');
    expect((mocks.store.getState().settings as { cloud: { backedUpAt: string | null } }).cloud.backedUpAt).not.toBeNull();
  });

  it('a clean restore is backed up, though nothing was sent', async () => {
    elsewhere({ kind: 'item', id: 'x', data: item('x'), deleted: false });
    await cloud.restoreFromCloud();
    expect(mocks.cloud.pushRecords).not.toHaveBeenCalled();
    expect((mocks.store.getState().settings as { cloud: { backedUpAt: string | null } }).cloud.backedUpAt).not.toBeNull();
  });
});
