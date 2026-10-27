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
