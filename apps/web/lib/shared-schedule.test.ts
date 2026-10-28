import type { SharedEntry } from '@dayli/core';
import { describe, expect, it } from 'vitest';

import { sharedDays, todayIn, updatedLine } from './shared-schedule';

const entry = (patch: Partial<SharedEntry>): SharedEntry => ({
  date: '2026-10-28', start: '09:00', end: '10:00', kind: 'event', category: 'school', isDeadline: false, title: 'Bio', ...patch,
});

describe('shared schedule page', () => {
  it('shows two weeks from today, in order, with last night’s shift carried onto today', () => {
    const { from, to, days } = sharedDays([
      entry({ date: '2026-10-27', start: '22:00', end: '06:00', title: 'Night shift', category: 'work' }),
      entry({ date: '2026-10-27', title: 'Yesterday' }),
      entry({ date: '2026-10-28', start: '13:00', end: '14:00', title: 'Lab' }),
      entry({ date: '2026-10-28', title: 'Bio' }),
      entry({ date: '2026-11-10', title: 'Last day' }),
      entry({ date: '2026-11-11', title: 'Too far' }),
    ], '2026-10-28');
    expect([from, to]).toEqual(['2026-10-28', '2026-11-10']);
    expect(days.map((d) => [d.date, d.entries.map((e) => e.title)])).toEqual([
      ['2026-10-28', ['Night shift', 'Bio', 'Lab']],
      ['2026-11-10', ['Last day']],
    ]);
    expect(days[0]!.entries[0]!.carried).toBe(true);
  });

  it('reads today in the owner’s time zone', () => {
    const lateNightUtc = new Date('2026-10-29T03:00:00Z');
    expect(todayIn('America/Los_Angeles', lateNightUtc)).toBe('2026-10-28');
    expect(todayIn('Europe/London', lateNightUtc)).toBe('2026-10-29');
    expect(todayIn('Not/AZone', lateNightUtc)).toBe('2026-10-29');
  });

  it('says how fresh the schedule is', () => {
    const now = new Date('2026-10-28T12:00:00Z');
    expect(updatedLine(new Date('2026-10-28T11:59:30Z'), now)).toBe('Updated just now');
    expect(updatedLine(new Date('2026-10-28T11:20:00Z'), now)).toBe('Updated 40 minutes ago');
    expect(updatedLine(new Date('2026-10-28T10:00:00Z'), now)).toBe('Updated 2 hours ago');
    expect(updatedLine(new Date('2026-10-25T12:00:00Z'), now)).toBe('Updated 3 days ago');
  });
});
