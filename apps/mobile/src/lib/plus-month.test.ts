import { describe, expect, it } from 'vitest';
import { plusMonthLine } from './plus-month';

const at = new Date('2026-10-27T12:00:00Z');
const item = (over: object) => ({ urgent: false, done: false, date: '2026-10-28', ...over });

describe('plusMonthLine', () => {
  it('counts imports past the free limit and alarms ready', () => {
    const usage = { month: '2026-10', imports: 6, firstImportAt: '2026-08-01T00:00:00Z' };
    expect(plusMonthLine(usage, [item({ urgent: true }), item({ urgent: true, done: true })], '2026-10-27', at))
      .toBe('6 imports this month, 3 past the free limit · 1 urgent alarm ready.');
  });
  it('says nothing before Plus has done anything', () => {
    expect(plusMonthLine({ month: '2026-09', imports: 2 }, [], '2026-10-27', at)).toBeNull();
  });
});
