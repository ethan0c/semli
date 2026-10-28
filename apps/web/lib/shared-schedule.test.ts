import type { SharedEntry } from '@dayli/core';
import { describe, expect, it } from 'vitest';

import { hourLabel, nowIn, sharedDays, todayIn, updatedLine, weekGrid } from './shared-schedule';

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

  it('lays two weeks out Monday to Sunday, fitting the hours to the plans', () => {
    // Wednesday Oct 28 to Tuesday Nov 10: three calendar weeks, the days around them empty.
    const { range, weeks } = weekGrid([
      entry({ date: '2026-10-28', start: '08:30', end: '09:30' }),
      entry({ date: '2026-10-29', start: '18:00', end: '23:30', category: 'work' }),
      entry({ date: '2026-10-30', kind: 'task', isDeadline: true, start: '17:00', end: null }),
      entry({ date: '2026-11-11', start: '06:00', end: '07:00' }),
    ], '2026-10-28', '2026-11-10', { date: '2026-10-28', time: '12:00' });
    expect(range).toEqual([480, 1440]);
    expect(weeks.map((w) => [w[0]!.date, w.filter((d) => d.inRange).length])).toEqual([['2026-10-26', 5], ['2026-11-02', 7], ['2026-11-09', 2]]);
    const [mon, , wed, thu, fri] = weeks[0]!;
    expect(mon!.inRange).toBe(false);
    expect(wed).toMatchObject({ today: true, blocks: [{ top: 3.125, height: 6.25, kind: 'school' }], now: 25 });
    expect(thu!.blocks).toEqual([{ top: 62.5, height: 34.375, kind: 'work' }]);
    expect(fri).toMatchObject({ blocks: [], dues: [56.25], now: null });
  });

  it('draws an overnight shift as the evening and the next morning', () => {
    const { range, weeks } = weekGrid([entry({ date: '2026-10-29', start: '22:00', end: '06:00', category: 'work' })],
      '2026-10-28', '2026-11-10', { date: '2026-10-28', time: '12:00' });
    expect(range).toEqual([0, 1440]);
    expect(weeks[0]![3]!.blocks).toEqual([{ top: 91.66666666666666, height: 8.333333333333343, kind: 'work' }]);
    expect(weeks[0]![4]!.blocks).toEqual([{ top: 0, height: 25, kind: 'work' }]);
  });

  it('names the grid’s ends and reads the owner’s clock', () => {
    expect([hourLabel(480), hourLabel(720), hourLabel(1440)]).toEqual(['8 am', 'Noon', 'Midnight']);
    expect(nowIn('America/Los_Angeles', new Date('2026-10-29T03:05:00Z'))).toEqual({ date: '2026-10-28', time: '20:05' });
  });
});
