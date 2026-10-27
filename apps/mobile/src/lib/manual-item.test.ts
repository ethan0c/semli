import { describe, expect, it } from 'vitest';
import { buildManualItem, defaultManualTimes, type ManualDraft } from './manual-item';

const draft: ManualDraft = {
  kind: 'task', title: ' Read chapter 4 ', category: 'personal', date: '2026-10-21',
  start: '09:00', end: '10:00', allDay: false, hasDueTime: false, isDeadline: false,
  courseId: 'course-1', employer: 'Cafe', notes: ' Bring notes ', repeat: null,
};

describe('manual planner items', () => {
  it.each([
    [{ title: '   ' }, 'title'], [{ date: '2026-02-30' }, 'date'],
    [{ hasDueTime: true, start: '24:00' }, 'time'],
    [{ kind: 'event', end: 'noon' }, 'end time'],
    [{ kind: 'event', end: '09:00' }, 'different'],
    [{ repeat: { every: 1, days: [], until: '2026-12-11', skipped: [], start: null, end: null } }, 'day'],
    [{ repeat: { every: 1, days: ['wed'], until: '2026-10-20', skipped: [], start: null, end: null } }, 'last date'],
  ])('rejects invalid input before a write: %j', (patch, message) => {
    const result = buildManualItem({ ...draft, ...patch } as ManualDraft);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(message);
  });

  it('keeps the chosen calendar date, trims text, and clears irrelevant fields', () => {
    const result = buildManualItem(draft);
    expect(result).toEqual({ ok: true, repeat: null, item: {
      kind: 'task', title: 'Read chapter 4', category: 'personal', icon: 'check', date: '2026-10-21',
      start: null, end: null, isDeadline: false, done: false, completedAt: null,
      courseId: null, employer: null, notes: 'Bring notes', sourceId: null,
    } });
  });

  it('keeps a school deadline and due time without creating an event range', () => {
    const result = buildManualItem({ ...draft, category: 'school', isDeadline: true, hasDueTime: true });
    expect(result.ok && result.item).toMatchObject({ courseId: 'course-1', isDeadline: true, start: '09:00', end: null });
  });

  it('keeps urgency on timed and untimed events and to-dos', () => {
    for (const kind of ['event', 'task'] as const) {
      const result = buildManualItem({ ...draft, kind, urgent: true });
      expect(result.ok && result.item.urgent).toBe(true);
    }
    const ordinary = buildManualItem(draft);
    expect(ordinary.ok && ordinary.item.urgent).toBeUndefined();
  });

  it('accepts overnight events with their original start date', () => {
    const result = buildManualItem({ ...draft, kind: 'event', category: 'work', start: '22:00', end: '02:00', isDeadline: true });
    expect(result.ok && result.item).toMatchObject({ date: '2026-10-21', start: '22:00', end: '02:00', employer: 'Cafe', courseId: null, isDeadline: false });
  });

  it('clears hidden times for all-day events, even when an old time is invalid', () => {
    const result = buildManualItem({ ...draft, kind: 'event', allDay: true, start: 'bad', end: 'bad' });
    expect(result.ok && result.item).toMatchObject({ start: null, end: null });
  });

  it('rounds local default times across midnight', () => {
    expect(defaultManualTimes(new Date(2026, 9, 19, 23, 45))).toEqual({ start: '00:00', end: '01:00' });
    expect(defaultManualTimes(new Date(2026, 9, 19, 9, 1))).toEqual({ start: '09:30', end: '10:30' });
  });
});
