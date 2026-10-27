import { describe, expect, it } from 'vitest';
import { contextBlock } from './index';

const ctx = { today: '2026-10-27', timezone: 'America/New_York', courses: [], employers: ['Campus Café'] };

describe('contextBlock', () => {
  it('lists the existing plan so "before work" has a time to end at', () => {
    const text = contextBlock({ ...ctx, schedule: [{ date: '2026-10-27', start: '09:00', end: '16:30', title: 'Work' }] });
    expect(text).toContain('Existing plan (upcoming timed events):');
    expect(text).toContain('- 2026-10-27 09:00–16:30 Work');
  });
  it('says nothing about a plan when none is sent', () => {
    expect(contextBlock(ctx)).not.toContain('Existing plan');
  });
});

describe('the schedule sent with a typed request', () => {
  it('drops bad entries and trims long ones instead of refusing the import', async () => {
    const { ExtractContext } = await import('@dayli/schema');
    const parsed = ExtractContext.parse({
      ...ctx,
      schedule: [
        { date: '2026-10-27', start: '09:00', end: '16:30', title: 'x'.repeat(300) },
        { date: 'tomorrow', start: '9am', end: null, title: 'Bad' },
        ...Array.from({ length: 250 }, () => ({ date: '2026-10-28', start: '07:00', end: null, title: 'Gym' })),
      ],
    });
    expect(parsed.schedule).toHaveLength(200);
    expect(parsed.schedule![0]!.title).toHaveLength(120);
    expect(parsed.schedule!.some((e) => e.title === 'Bad')).toBe(false);
  });
});
