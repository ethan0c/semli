import type { Item } from '@dayli/schema';
import { describe, expect, it } from 'vitest';
import type { Batch } from './index';
import { planUndo, undoQuestion } from './undo';

const item = (id: string, over: Partial<Item> = {}): Item => ({
  id, kind: 'task', title: id, category: 'school', icon: 'book', date: '2026-10-20', start: null, end: null, isDeadline: false,
  done: false, completedAt: null, courseId: null, employer: null, sourceId: null, batchId: 'b', notes: null, createdAt: '', ...over,
} as Item);
const byId = (...list: Item[]) => Object.fromEntries(list.map((it) => [it.id, it]));

describe('planUndo', () => {
  it('takes back an import but keeps what was changed or deleted since', () => {
    const a = item('a'); const b = item('b'); const c = item('c');
    const batch: Batch = { id: 'b', createdAt: '', label: 'Added 3 items', undone: false, changes: [a, b, c].map((after) => ({ op: 'create', before: null, after })) };
    const now = byId(a, { ...b, done: true });
    const r = planUndo(batch, now, {}, []);
    expect(Object.keys(r.items)).toEqual(['b']);
    expect(r).toMatchObject({ reverted: 1, kept: 1 });
    expect(undoQuestion(batch, now, {}, [])).toBe('Undo “Added 3 items”? 1 item change back. 1 item you’ve changed since stays as it is.');
    expect(Object.keys(planUndo(batch, now, {}, [], { force: true }).items)).toEqual([]);
  });

  it('leaves a newer edit alone and does not bring back a later delete', () => {
    const before = item('a', { date: '2026-10-20' });
    const after = { ...before, date: '2026-10-22' };
    const batch: Batch = { id: 'e', createdAt: '', label: 'Edited a', undone: false, changes: [{ op: 'update', before, after }] };
    expect(planUndo(batch, byId({ ...after, title: 'Renamed' }), {}, []).items.a!.title).toBe('Renamed');
    expect(planUndo(batch, {}, {}, []).items).toEqual({});
    expect(planUndo(batch, byId(after), {}, []).items.a!.date).toBe('2026-10-20');
  });

  it('puts the repeat rule back and keeps courses other items still use', () => {
    const rule = { weekdays: ['mon'], start: '09:00', end: '10:00', until: '2026-12-11', skipped: [] } as never;
    const a = item('a', { courseId: 'k' });
    const batch: Batch = { id: 'b', createdAt: '', label: 'Added', undone: false, changes: [{ op: 'create', before: null, after: a }], seriesBefore: { s1: rule, s2: null } };
    const later = item('later', { courseId: 'k', batchId: 'other' });
    const r = planUndo(batch, byId(a, later), { s1: { ...(rule as object), skipped: ['2026-10-26'] } as never, s2: rule }, [{ id: 'k', code: 'BIO', title: 'Bio', instructor: null, sourceId: null, batchId: 'b' }]);
    expect(r.series).toEqual({ s1: rule });
    expect(r.courses.map((k) => k.id)).toEqual(['k']);
    expect(planUndo(batch, byId(a), {}, [{ id: 'k', code: 'BIO', title: 'Bio', instructor: null, sourceId: null, batchId: 'b' }]).courses).toEqual([]);
  });
});
