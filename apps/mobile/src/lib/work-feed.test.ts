import { describe, expect, it } from 'vitest';
import type { Item } from '@dayli/schema';
import { parseIcs, planCanvasSync } from './canvas';
import { CLASS_FEED_HERE, normalizeWorkFeedUrl, workEntries, workTarget } from './work-feed';

const FEED = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'UID:shift-1',
  'DTSTART:20261104T090000',
  'DTEND:20261104T130000',
  'SUMMARY:Front desk',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:shift-2',
  'DTSTART:20261106T220000',
  'DTEND:20261107T060000',
  'SUMMARY:Night shift',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:timeoff-1',
  'DTSTART;VALUE=DATE:20261108',
  'SUMMARY:Time off',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const shift = (over: Partial<Item>): Item => ({
  id: 's1', kind: 'event', title: 'Front desk', category: 'work', icon: 'work', date: '2026-11-04', start: '09:00', end: '13:00',
  isDeadline: false, done: false, completedAt: null, courseId: null, employer: 'Campus Rec', sourceId: 'Campus Rec', batchId: null,
  externalId: 'work:shift-1', notes: null, createdAt: '2026-11-01T00:00:00Z', ...over,
});

describe('work schedule link', () => {
  it('accepts webcal and https links on a named host', () => {
    expect(normalizeWorkFeedUrl(' webcal://app.wheniwork.com/ical/abc ')).toEqual({ ok: true, url: 'https://app.wheniwork.com/ical/abc' });
    expect(normalizeWorkFeedUrl('https://www.whentowork.com/cal/xyz.ics')).toEqual({ ok: true, url: 'https://www.whentowork.com/cal/xyz.ics' });
  });
  it('rejects plain http, addresses without a domain and non-links', () => {
    expect(normalizeWorkFeedUrl('http://app.wheniwork.com/ical/abc').ok).toBe(false);
    expect(normalizeWorkFeedUrl('https://192.168.1.4/feed.ics').ok).toBe(false);
    expect(normalizeWorkFeedUrl('my schedule').ok).toBe(false);
  });
  it('sends a Canvas link to the class calendar', () => {
    expect(normalizeWorkFeedUrl('https://school.instructure.com/feeds/calendars/user_abc.ics')).toEqual({ ok: false, error: CLASS_FEED_HERE });
  });
});

describe('shifts from a feed', () => {
  const entries = workEntries(parseIcs(FEED));

  it('reads timed events as shifts and skips all-day entries', () => {
    expect(entries.map((e) => e.externalId)).toEqual(['work:shift-1', 'work:shift-2']);
    expect(entries[0]).toMatchObject({ kind: 'event', title: 'Front desk', date: '2026-11-04', start: '09:00', end: '13:00', isDeadline: false });
  });
  it('keeps an overnight shift on its start day, ending before it starts', () => {
    expect(entries[1]).toMatchObject({ date: '2026-11-06', start: '22:00', end: '06:00' });
  });
});

describe('syncing shifts', () => {
  const entries = workEntries(parseIcs(FEED));
  const plan = (existing: Item[]) => planCanvasSync(entries, existing, '2026-11-02', () => null, workTarget('Campus Rec'));

  it('creates work items under the job’s name', () => {
    const p = plan([]);
    expect(p.added).toBe(2);
    expect(p.create[0]).toMatchObject({ category: 'work', employer: 'Campus Rec', externalId: 'work:shift-1', courseId: null });
  });
  it('moves a changed shift and removes one that left the schedule', () => {
    const p = plan([shift({ start: '08:00' }), shift({ id: 's9', externalId: 'work:shift-9', date: '2026-11-05' })]);
    expect(p.update).toEqual([{ id: 's1', patch: { start: '09:00' } }]);
    expect(p.remove).toEqual(['s9']);
  });
  it('leaves Canvas items alone', () => {
    const canvas = shift({ id: 'c1', category: 'school', employer: null, externalId: 'canvas:event-assignment-1', date: '2026-11-05' });
    expect(plan([canvas]).remove).toEqual([]);
  });
});
