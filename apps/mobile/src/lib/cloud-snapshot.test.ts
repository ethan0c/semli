import { describe, expect, it } from 'vitest';
import type { Item } from '@dayli/schema';
import { adoptProfile, adoptSnapshot, choosePlan, personalSettings, planDate, snapshotOf } from './cloud-snapshot';

const item = (id: string, over: Partial<Item> = {}): Item => ({
  id, kind: 'task', title: id, category: 'school', icon: 'check', date: '2026-10-20', start: null, end: null, isDeadline: false,
  done: false, completedAt: null, courseId: null, employer: null, sourceId: null, batchId: null, notes: null, createdAt: '2026-10-01T00:00:00Z', ...over,
});

const settings = { name: '', onboarded: true, seeded: true, isStudent: true, major: null, weekKinds: [], lms: null, canvas: { feedUrl: null, lastSyncedAt: null, lastError: null }, reminders: {}, breaks: [], planIntent: null, appearance: 'dark', sampleBatchId: null } as never;
const state = (items: Item[], over: object = {}, plan: object = {}) => ({ items: Object.fromEntries(items.map((i) => [i.id, i])), courses: [], schedules: [], taskWorkDates: {}, series: {}, settings: { ...(settings as object), ...over } as never, ...plan });
const rule = { every: 1, days: ['mon' as const], until: '2026-12-15', skipped: [], start: '09:00', end: '10:15' };

describe('cloud backup', () => {
  it('leaves sample records and phone-only settings out of the backup', () => {
    const snap = snapshotOf(state([item('a'), item('s', { sourceId: 'sample' })]));
    expect(snap.items.map((i) => i.id)).toEqual(['a']);
    expect(snap.settings).not.toHaveProperty('appearance');
    expect(snap.settings).not.toHaveProperty('onboarded');
  });

  it('never merges two plans: both sides with a plan means the person chooses', () => {
    const remote = snapshotOf(state([item('a'), item('b')]));
    expect(choosePlan(state([item('c')]), remote)).toBe('ask');
  });

  it('a guest backing up gives the account its plan, a new phone takes the account plan', () => {
    const empty = snapshotOf(state([]));
    expect(choosePlan(state([item('c')]), empty)).toBe('local');
    expect(choosePlan(state([item('c')]), null)).toBe('local');
    expect(choosePlan(state([]), snapshotOf(state([item('a')])))).toBe('remote');
    expect(choosePlan(state([]), empty)).toBe('none');
  });

  it('sample records on the phone do not count as a plan', () => {
    expect(choosePlan(state([item('s', { sourceId: 'sample' })]), snapshotOf(state([item('a')])))).toBe('remote');
  });

  it('adopting the account plan replaces the phone plan instead of adding to it', () => {
    const remote = snapshotOf(state([item('a', { title: 'cloud' })]));
    const adopted = adoptSnapshot(state([item('a', { title: 'phone' }), item('c')]), remote);
    expect(Object.keys(adopted.items)).toEqual(['a']);
    expect(adopted.items.a!.title).toBe('cloud');
  });

  it('dates a plan by its newest item', () => {
    expect(planDate([item('a', { createdAt: '2026-10-01T00:00:00Z' }), item('b', { createdAt: '2026-10-12T00:00:00Z' })])).toBe('2026-10-12T00:00:00Z');
    expect(planDate([])).toBeNull();
  });

  it('a new phone takes the stored profile and skips onboarding the account finished', () => {
    const remote = snapshotOf(state([item('a')], { name: 'Ama', major: 'nursing' }));
    expect(remote.onboarded).toBe(true);
    const adopted = adoptSnapshot(state([], { onboarded: false, name: '' }), remote);
    expect(adopted.settings).toMatchObject({ onboarded: true, seeded: true, name: 'Ama', major: 'nursing', appearance: 'dark' });
  });

  it('a new phone still runs onboarding for an account that stopped at the code', () => {
    // Every sign-in saves a row, so the row of someone who never finished onboarding is empty.
    const remote = snapshotOf(state([], { onboarded: false, name: 'Ama' }));
    expect(remote.onboarded).toBe(false);
    const adopted = adoptSnapshot(state([], { onboarded: false, seeded: false, name: '' }), remote);
    expect(adopted.settings).toMatchObject({ onboarded: false, seeded: false, name: 'Ama' });
  });

  it('reads rows saved before the flag by whether they hold a plan', () => {
    const { onboarded: _legacy, ...empty } = snapshotOf(state([], { onboarded: true }));
    expect(adoptSnapshot(state([], { onboarded: false }), empty).settings.onboarded).toBe(false);
    const { onboarded: _legacyPlan, ...plan } = snapshotOf(state([item('a')], { onboarded: true }));
    expect(adoptSnapshot(state([], { onboarded: false }), plan).settings.onboarded).toBe(true);
  });

  it('leaves the onboarding sample out, though it is made as a real import, and it is no plan', () => {
    // onboarding.tsx: the sample's items carry its batch and the "Sample week" label; its courses and series have sample- ids.
    const sample = [item('n1', { batchId: 'b-sample', sourceId: 'Sample week' }), item('n2', { batchId: 'b-sample' }), item('sample-3', { sourceId: 'Screenshot' })];
    const local = state([item('a'), ...sample], { sampleBatchId: 'b-sample' }, {
      courses: [{ id: 'sample-course-0', code: 'STAT 200', title: 'Statistics', instructor: null, sourceId: 'syllabus.pdf', batchId: 'b-sample' }, { id: 'k1', code: null, title: 'Mine', instructor: null, sourceId: null }],
      series: { 'sample-series-0': rule, s1: rule },
      taskWorkDates: { n1: '2026-10-21', a: '2026-10-22' },
    });
    const snap = snapshotOf(local);
    expect(snap.items.map((i) => i.id)).toEqual(['a']);
    expect(snap.courses.map((c) => c.id)).toEqual(['k1']);
    expect(Object.keys(snap.series!)).toEqual(['s1']);
    expect(snap.taskWorkDates).toEqual({ a: '2026-10-22' });
    // A phone with only the sample signing in to an account with a plan takes it without asking.
    const onlySample = state(sample, { sampleBatchId: 'b-sample' });
    expect(choosePlan(onlySample, snapshotOf(state([item('x')])))).toBe('remote');
    expect(choosePlan(onlySample, null)).toBe('none');
    // Sample rows another device uploaded before Oct 27 aren't a plan either, and don't come down.
    const leftover = { ...snapshotOf(state([])), items: [item('n9', { sourceId: 'Sample week' })] };
    expect(choosePlan(state([item('c')]), leftover)).toBe('local');
    expect(adoptSnapshot(state([]), { ...leftover, items: [...leftover.items, item('x')] }).items).toHaveProperty('x');
    expect(Object.keys(adoptSnapshot(state([]), leftover).items)).toEqual([]);
  });

  it('adopting the account plan replaces the sample too, so Today stops offering to remove it', () => {
    const adopted = adoptSnapshot(state([item('n1', { batchId: 'b-sample' })], { sampleBatchId: 'b-sample' }), snapshotOf(state([item('x')])));
    expect(adopted.settings.sampleBatchId).toBeNull();
    // Taking only the profile (neither side has a plan) leaves the sample where it is.
    expect(adoptProfile(state([], { sampleBatchId: 'b-sample' }), snapshotOf(state([]))).sampleBatchId).toBe('b-sample');
  });

  it('carries series rules, and an account saved before them leaves each series to read its rule again', () => {
    const remote = snapshotOf(state([item('a')], {}, { series: { s1: rule } }));
    expect(adoptSnapshot(state([], {}, { series: { old: rule } }), remote).series).toEqual({ s1: rule });
    const { series: _none, ...legacy } = remote;
    expect(adoptSnapshot(state([], {}, { series: { old: rule } }), legacy).series).toEqual({});
  });

  it('keeps the Canvas feed link, the only credential, on this phone', () => {
    const canvas = { feedUrl: 'https://school.instructure.com/feeds/calendars/user_secret.ics', lastSyncedAt: '2026-10-26T00:00:00Z', lastError: null };
    const snap = snapshotOf(state([item('a')], { canvas, lms: 'canvas' }));
    expect(snap.settings).not.toHaveProperty('canvas');
    expect(snap.settings).toMatchObject({ lms: 'canvas' });
    // A profile an older version saved still carries it; it never lands on another phone.
    const older = { ...snap, settings: { ...snap.settings, canvas } } as never;
    const mine = { feedUrl: null, lastSyncedAt: null, lastError: null };
    expect(adoptSnapshot(state([], { canvas: mine }), older).settings.canvas).toEqual(mine);
    expect(personalSettings({ name: 'Ama', canvas } as never)).toEqual({ name: 'Ama' });
  });
});
