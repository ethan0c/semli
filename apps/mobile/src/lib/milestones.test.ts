import { describe, expect, it } from 'vitest';
import { allDoneLine, firstOf, importLine, readyLine } from './milestones';

describe('voice', () => {
  it('names what went in, and the person when their name is known', () => {
    expect(importLine(['5 added', '1 updated'], 'work_schedule', 'Ethan')).toBe('Your shifts are in, Ethan. 5 added · 1 updated.');
    expect(importLine(['3 added'], 'general', null)).toBe('Added to your plan. 3 added.');
  });
  it('uses only the first word of a saved name', () => {
    expect(firstOf('  Chibudom Ethan ')).toBe('Chibudom');
    expect(firstOf('')).toBeNull();
  });
  it('says the plan is ready and the day is done', () => {
    expect(readyLine(false, 'Ana')).toBe('Your plan is ready, Ana.');
    expect(allDoneLine(null)).toBe('That’s everything due today. Nice work.');
  });
});
