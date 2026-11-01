import { conflictIds, todayItems } from '@dayli/core';
import { Item } from '@dayli/schema';
import { describe, expect, it } from 'vitest';

import { planRingingAlarms } from './alarm-plan';
import { MEME_VERSIONS, memeDemo, memeVersion } from './meme-demo';
import { realRecords } from './planner-preview';
import { DEFAULT_REMINDERS, planReminders } from './reminder-plan';

describe('meme screenshot schedules', () => {
  it('keeps every preview item out of live records, notifications and alarms', () => {
    for (const version of MEME_VERSIONS) {
      const { items } = memeDemo(version, '2026-10-29');
      items.forEach((item) => Item.parse(item));
      expect(realRecords(items)).toEqual([]);
      expect(planReminders(items, DEFAULT_REMINDERS, { date: '2026-10-29', time: '07:00' })).toEqual([]);
      expect(planRingingAlarms(items)).toEqual([]);
    }
  });

  it('gives the cooked schedule actual overlapping meetings', () => {
    const { items } = memeDemo('cooked', '2026-10-29');
    const conflicts = conflictIds(items);
    expect(conflicts.has(items[0]!.id)).toBe(true);
    expect(conflicts.has(items[1]!.id)).toBe(true);
    expect(todayItems(items, '2026-10-29')).toHaveLength(items.length);
  });

  it('leaves today empty and puts all 23 deadlines tomorrow, including across a month boundary', () => {
    const { items } = memeDemo('comeback', '2026-10-31');
    expect(todayItems(items, '2026-10-31')).toEqual([]);
    expect(todayItems(items, '2026-11-01')).toHaveLength(23);
    expect(items.every((item) => item.isDeadline && item.kind === 'task' && !item.done)).toBe(true);
  });

  it('blocks the busy day continuously from morning until midnight', () => {
    const { items } = memeDemo('busy', '2026-10-29');
    expect(items[0]!.start).toBe('08:00');
    expect(items.at(-1)!.end).toBe('23:59');
    expect(items.every((item, i) => i === 0 || item.start === items[i - 1]!.end)).toBe(true);
  });

  it('recognizes only the three explicit screenshot commands', () => {
    expect(MEME_VERSIONS.map((version) => memeVersion(`meme-${version}`))).toEqual(MEME_VERSIONS);
    expect(memeVersion('sample')).toBeNull();
    expect(memeVersion('meme-unknown')).toBeNull();
  });
});
