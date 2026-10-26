import type { Item } from '@dayli/schema';
import { describe, expect, it } from 'vitest';

import { DEFAULT_REMINDERS, inQuietHours, planReminders } from './reminder-plan';

function item(p: Partial<Item> & Pick<Item, 'id' | 'date'>): Item {
  return {
    kind: 'event', title: 'x', category: 'school', icon: 'calendar', start: null, end: null, isDeadline: false, done: false,
    completedAt: null, courseId: null, employer: null, sourceId: null, batchId: null, notes: null, createdAt: '2026-10-19T00:00:00Z', ...p,
  };
}
const now = { date: '2026-10-19', time: '12:00' };

describe('planReminders', () => {
  it('never turns legacy examples into reminders or briefing counts', () => {
    const example = item({ id: 'demo', title: 'Example shift', date: '2026-10-20', start: '16:00', end: '22:00', sourceId: 'sample' });
    expect(planReminders([example], DEFAULT_REMINDERS, now)).toEqual([]);
    const real = item({ id: 'real', title: 'Real shift', category: 'work', date: '2026-10-20', start: '16:00', end: '22:00', sourceId: 'schedule.jpg' });
    const plan = planReminders([example, real], DEFAULT_REMINDERS, now);
    expect(plan.some((notification) => notification.itemId === 'demo')).toBe(false);
    expect(plan.find((notification) => notification.kind === 'briefing')?.body).toBe('Real shift at 4:00 pm.');
    expect(plan.some((notification) => notification.itemId === 'real')).toBe(true);
  });

  it('reminds before timed events and twice before deadlines', () => {
    const plan = planReminders(
      [
        item({ id: 'shift', title: 'Café shift', date: '2026-10-20', start: '16:00', end: '22:00' }),
        item({ id: 'exam', title: 'Stats exam', date: '2026-10-23', start: '09:00', end: '10:30', isDeadline: true }),
      ],
      { ...DEFAULT_REMINDERS, briefing: false },
      now,
    );
    expect(plan.map((p) => [p.id, p.date, p.time])).toEqual([
      ['ev-shift', '2026-10-20', '15:30'],
      ['dl1-exam', '2026-10-22', '18:00'],
      ['dl2-exam', '2026-10-23', '08:00'],
      ['ev-exam', '2026-10-23', '08:30'],
    ]);
  });

  it('moves a quiet-hours reminder to the end of the window, unless the event is sooner', () => {
    const plan = planReminders(
      [
        item({ id: 'late', title: 'Late task review', date: '2026-10-20', start: '23:00', end: '23:30' }),
        item({ id: 'early', title: 'Clinical', date: '2026-10-21', start: '06:30', end: '14:00' }),
      ],
      { ...DEFAULT_REMINDERS, briefing: false },
      now,
    );
    const byId = Object.fromEntries(plan.map((p) => [p.id, p]));
    // 22:30 is inside quiet hours; the next quiet end (07:00 next day) is after the event, so it stays.
    expect(byId['ev-late']).toMatchObject({ date: '2026-10-20', time: '22:30' });
    // 06:00 is inside quiet hours and 07:00 is after the 06:30 start, so it stays too.
    expect(byId['ev-early']).toMatchObject({ date: '2026-10-21', time: '06:00' });
  });

  it('skips the past, caps the count, and keeps briefings', () => {
    const many = Array.from({ length: 80 }, (_, i) => item({ id: `e${i}`, title: 'Lecture', date: '2026-10-21', start: `${String(8 + (i % 12)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`, end: '20:00' }));
    const plan = planReminders([...many, item({ id: 'past', date: '2026-10-19', start: '09:00', end: '10:00' })], DEFAULT_REMINDERS, now);
    expect(plan.length).toBeLessThanOrEqual(60);
    expect(plan.some((p) => p.id === 'ev-past')).toBe(false);
    expect(plan.filter((p) => p.kind === 'briefing').length).toBeGreaterThan(0);
  });

  it('leads with today and says a later deadline is due then, not next', () => {
    const plan = planReminders(
      [
        item({ id: 'gym', title: 'Morning cardio', category: 'personal', date: '2026-10-20', start: '07:00', end: '07:45' }),
        item({ id: 'work', title: 'Work', category: 'work', date: '2026-10-20', start: '09:00', end: '16:30' }),
        item({ id: 'run', title: 'Afternoon cardio', category: 'personal', date: '2026-10-20', start: '16:30', end: '17:30' }),
        item({ id: 'reg', kind: 'task', title: 'Class registration', date: '2026-10-21', isDeadline: true }),
      ],
      { ...DEFAULT_REMINDERS, enabled: false },
      now,
    );
    expect(plan.find((p) => p.id === 'brief-2026-10-20')!.body).toBe('1 shift and 2 events, starting with Work at 9:00 am. Due Wednesday: Class registration.');
  });

  it('writes a briefing from the day and the next deadline', () => {
    const plan = planReminders(
      [
        item({ id: 'lec', title: 'Psych lecture', date: '2026-10-20', start: '09:00', end: '10:15' }),
        item({ id: 'todo', kind: 'task', title: 'Buy notebook', date: '2026-10-20' }),
        item({ id: 'exam', title: 'Stats exam', date: '2026-10-22', isDeadline: true }),
      ],
      { ...DEFAULT_REMINDERS, enabled: false },
      now,
    );
    const b = plan.find((p) => p.id === 'brief-2026-10-20')!;
    expect(b.time).toBe('08:00');
    expect(b.body).toBe('1 class and 1 to-do, starting with Psych lecture at 9:00 am. Thursday: Stats exam.');
    expect(plan.some((p) => p.id === 'brief-2026-10-25')).toBe(false);
  });

  it('skips repeating classes unless class reminders are on, but keeps shifts and urgent classes', () => {
    const items = [
      item({ id: 'lec', title: 'Stats lecture', date: '2026-10-20', start: '09:00', end: '10:15', seriesId: 'stats' }),
      item({ id: 'lab', title: 'Bio lab', date: '2026-10-20', start: '13:00', end: '15:00', seriesId: 'bio', urgent: true }),
      item({ id: 'shift', title: 'Café shift', category: 'work', date: '2026-10-20', start: '16:00', end: '22:00', seriesId: 'cafe' }),
    ];
    const prefs = { ...DEFAULT_REMINDERS, briefing: false };
    expect(planReminders(items, prefs, now).map((p) => p.id)).toEqual(['ev-lab', 'ev-shift']);
    expect(planReminders(items, { ...prefs, classReminders: true }, now).map((p) => p.id)).toEqual(['ev-lec', 'ev-lab', 'ev-shift']);
  });

  it('groups deadlines on the same day into one reminder that opens Today', () => {
    const plan = planReminders(
      [
        item({ id: 'a', kind: 'task', title: 'Lab report', date: '2026-10-21', isDeadline: true }),
        item({ id: 'b', kind: 'task', title: 'Problem set', date: '2026-10-21', isDeadline: true }),
        item({ id: 'c', kind: 'task', title: 'Reading quiz', date: '2026-10-21', start: '09:00', isDeadline: true }),
      ],
      { ...DEFAULT_REMINDERS, briefing: false },
      now,
    );
    expect(plan.map((p) => [p.id, p.title, p.body, p.url])).toEqual([
      ['dl1-2026-10-21', '3 due Wednesday', 'Reading quiz, Lab report and Problem set.', '/'],
      ['dl2-2026-10-21', '3 due today', 'Reading quiz, Lab report and Problem set.', '/'],
    ]);
  });

  it('lets the daily summary stand in for the morning deadline reminder, and names it', () => {
    const plan = planReminders([item({ id: 'essay', kind: 'task', title: 'Essay', date: '2026-10-20', isDeadline: true })], DEFAULT_REMINDERS, now);
    expect(plan.map((p) => p.id)).toEqual(['dl1-essay', 'brief-2026-10-20']);
    expect(plan.find((p) => p.id === 'dl1-essay')?.url).toBe('/item/essay');
    expect(plan.find((p) => p.id === 'brief-2026-10-20')?.body).toBe('Due today: Essay.');
  });

  it('sends at most five a day, dropping the latest ordinary event reminders first', () => {
    const events = Array.from({ length: 8 }, (_, i) => item({ id: `e${i}`, title: `Event ${i}`, category: 'work', date: '2026-10-20', start: `${String(9 + i).padStart(2, '0')}:00`, end: '23:00' }));
    const urgent = item({ id: 'u', title: 'Clinical', date: '2026-10-20', start: '20:00', end: '21:00', urgent: true });
    const plan = planReminders([...events, urgent], DEFAULT_REMINDERS, now).filter((p) => p.date === '2026-10-20');
    expect(plan).toHaveLength(5);
    expect(plan.map((p) => p.id)).toEqual(['brief-2026-10-20', 'ev-e0', 'ev-e1', 'ev-e2', 'ev-u']);
  });

  it('says an exam is on a day, not due, and counts the day by kind', () => {
    const plan = planReminders(
      [
        item({ id: 'exam', title: 'Stats exam', date: '2026-10-21', start: '09:00', end: '10:30', isDeadline: true }),
        item({ id: 'lab', kind: 'task', title: 'Lab report', date: '2026-10-21', isDeadline: true }),
        item({ id: 'shift', title: 'Café shift', category: 'work', date: '2026-10-21', start: '16:00', end: '22:00' }),
      ],
      DEFAULT_REMINDERS,
      now,
    );
    const byId = Object.fromEntries(plan.map((p) => [p.id, p]));
    expect(byId['ev-shift']?.body).toBe('Starts at 4:00 pm. Ends at 10:00 pm.');
    expect(byId['brief-2026-10-21']?.body).toBe('Café shift at 4:00 pm. Today: Stats exam. Due today: Lab report.');
    const alone = planReminders([item({ id: 'quiz', title: 'Bio quiz', date: '2026-10-21', start: '09:00', isDeadline: true })], { ...DEFAULT_REMINDERS, briefing: false }, now);
    expect(alone.filter((p) => p.kind === 'deadline').map((p) => p.body)).toEqual(['Wednesday at 9:00 am.', 'Today at 9:00 am.']);
  });

  it('knows quiet hours across midnight', () => {
    expect(inQuietHours('23:30', DEFAULT_REMINDERS)).toBe(true);
    expect(inQuietHours('06:59', DEFAULT_REMINDERS)).toBe(true);
    expect(inQuietHours('07:00', DEFAULT_REMINDERS)).toBe(false);
    expect(inQuietHours('12:00', DEFAULT_REMINDERS)).toBe(false);
  });

  it('reminds two days before a free trial converts, even with reminders off', () => {
    const plan = planReminders([], { ...DEFAULT_REMINDERS, enabled: false, briefing: false }, now, {
      trial: { endsAt: '2026-10-26T14:03:00Z', label: '$14.99 per 6 months' },
    });
    expect(plan.map((p) => [p.id, p.date, p.time])).toEqual([['trial-reminder', '2026-10-24', '18:00']]);
    expect(plan[0]!.title).toBe('Your Plus trial ends on Oct 26');
    expect(plan[0]!.body).toBe('Then $14.99 per 6 months. Manage or cancel in You → Your plan.');
  });

  it('drops the trial reminder once it is in the past', () => {
    const plan = planReminders([], DEFAULT_REMINDERS, now, { trial: { endsAt: '2026-10-20T14:03:00Z', label: 'x' } });
    expect(plan).toEqual([]);
  });
});
