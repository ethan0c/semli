import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Item } from '@dayli/schema';
import { CANVAS_MESSAGES, canvasEntries, courseCodeOf, fetchCanvasFeed, normalizeFeedUrl, parseIcs, planCanvasSync, syncSummary } from './canvas';

const FEED = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:event-assignment-101',
  'DTSTART;VALUE=DATE:20261023',
  'DTEND;VALUE=DATE:20261023',
  'SUMMARY:Essay 2: Argument\\, draft [ENG 101-01 Fall 2026]',
  'URL;VALUE=URI:https://school.instructure.com/courses/1/assignments/101',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:event-calendar-event-55',
  'DTSTART:20261024T140000',
  'DTEND:20261024T153000',
  'SUMMARY:Review session for the midterm with Dr. Alvarez in Hall',
  '  B [PSYC 101]',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:event-calendar-event-56',
  'SUMMARY:No date',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const item = (over: Partial<Item>): Item => ({
  id: 'a', kind: 'task', title: 'Essay 2: Argument, draft', category: 'school', icon: 'pen', date: '2026-10-23', start: null, end: null,
  isDeadline: true, done: false, completedAt: null, courseId: 'eng', employer: null, sourceId: 'Canvas', batchId: null,
  externalId: 'canvas:event-assignment-101', notes: null, createdAt: '2026-10-01T00:00:00Z', ...over,
});

describe('feed link', () => {
  it('accepts webcal and https feed links', () => {
    expect(normalizeFeedUrl(' webcal://school.instructure.com/feeds/calendars/user_abc.ics ')).toBe('https://school.instructure.com/feeds/calendars/user_abc.ics');
    expect(normalizeFeedUrl('https://canvas.uni.edu/feeds/calendars/user_abc.ics')).toBe('https://canvas.uni.edu/feeds/calendars/user_abc.ics');
  });
  it('rejects anything that is not a Canvas feed', () => {
    expect(normalizeFeedUrl('https://school.instructure.com/calendar')).toBeNull();
    expect(normalizeFeedUrl('http://school.instructure.com/feeds/calendars/user_abc.ics')).toBeNull();
  });
});

describe('parsing', () => {
  const entries = canvasEntries(parseIcs(FEED));

  it('reads assignments as deadlines and strips the course from the title', () => {
    expect(entries[0]).toMatchObject({ externalId: 'canvas:event-assignment-101', kind: 'task', title: 'Essay 2: Argument, draft', courseLabel: 'ENG 101-01 Fall 2026', date: '2026-10-23', start: null, isDeadline: true, url: 'https://school.instructure.com/courses/1/assignments/101' });
  });
  it('unfolds long lines and keeps event times', () => {
    expect(entries[1]).toMatchObject({ kind: 'event', title: 'Review session for the midterm with Dr. Alvarez in Hall B', courseLabel: 'PSYC 101', start: '14:00', end: '15:30' });
  });
  it('skips events with no date', () => expect(entries).toHaveLength(2));
  it('turns UTC times into local ones', () => {
    const [e] = canvasEntries(parseIcs('BEGIN:VEVENT\nUID:event-assignment-9\nDTSTART:20261021T035900Z\nSUMMARY:Quiz\nEND:VEVENT'));
    const local = new Date(Date.UTC(2026, 9, 21, 3, 59));
    expect(e!.start).toBe(`${String(local.getHours()).padStart(2, '0')}:${String(local.getMinutes()).padStart(2, '0')}`);
  });
  it('finds the course code in a Canvas course label', () => {
    expect(courseCodeOf('ENG 101-01 Fall 2026')).toBe('ENG 101');
    expect(courseCodeOf('Intro to Psychology')).toBeNull();
  });
});

describe('sync', () => {
  const entries = canvasEntries(parseIcs(FEED));
  const course = (label: string | null) => (label?.startsWith('ENG') ? 'eng' : null);

  it('creates new entries and names missing courses', () => {
    const plan = planCanvasSync(entries, [], '2026-10-19', course);
    expect(plan.create).toHaveLength(2);
    expect(plan.create[0]).toMatchObject({ courseId: 'eng', externalId: 'canvas:event-assignment-101', notes: 'https://school.instructure.com/courses/1/assignments/101' });
    expect(plan.newCourses).toEqual(['PSYC 101']);
    expect(syncSummary(plan)).toBe('2 new');
  });

  it('moves a changed due date and keeps done', () => {
    const plan = planCanvasSync(entries.slice(0, 1), [item({ date: '2026-10-21', done: true })], '2026-10-19', course);
    expect(plan.update).toEqual([{ id: 'a', patch: { date: '2026-10-23' } }]);
    expect(syncSummary(plan)).toBe('1 date moved');
  });

  it('leaves a date the person moved by hand, and keeps what Canvas says', () => {
    const plan = planCanvasSync(entries.slice(0, 1), [item({ date: '2026-10-21', editedAt: '2026-10-20T00:00:00Z' })], '2026-10-19', course);
    expect(plan.update).toEqual([{ id: 'a', patch: { feed: { date: '2026-10-23', start: null, end: null } } }]);
    expect(plan.moved).toBe(0);
    const again = planCanvasSync(entries.slice(0, 1), [item({ date: '2026-10-21', editedAt: '2026-10-20T00:00:00Z', feed: { date: '2026-10-23', start: null, end: null } })], '2026-10-19', course);
    expect(again.skipped).toBe(1);
  });

  it('skips unchanged items', () => {
    const plan = planCanvasSync(entries.slice(0, 1), [item({})], '2026-10-19', course);
    expect(plan.skipped).toBe(1);
    expect(syncSummary(plan)).toBeNull();
  });

  it('removes upcoming unfinished items that left the feed, never past or done ones', () => {
    const gone = [item({ id: 'up', externalId: 'canvas:x1', date: '2026-10-30' }), item({ id: 'past', externalId: 'canvas:x2', date: '2026-09-01' }), item({ id: 'done', externalId: 'canvas:x3', date: '2026-10-30', done: true }), item({ id: 'mine', externalId: null, date: '2026-10-30' })];
    expect(planCanvasSync(entries, gone, '2026-10-19', course).remove).toEqual(['up']);
  });

  it('an empty feed removes nothing', () => {
    expect(planCanvasSync([], [item({ date: '2026-10-30' })], '2026-10-19', course).remove).toEqual([]);
  });
});

describe('fetching', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('a reset link says so', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })));
    expect(await fetchCanvasFeed('https://x/feeds/calendars/u.ics')).toEqual({ ok: false, error: CANVAS_MESSAGES.rejected });
  });
  it('an offline phone keeps what it has', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    expect(await fetchCanvasFeed('https://x/feeds/calendars/u.ics')).toEqual({ ok: false, error: CANVAS_MESSAGES.connection });
  });
  it('a login page is not a feed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Log in</html>', { status: 200 })));
    expect(await fetchCanvasFeed('https://x/feeds/calendars/u.ics')).toEqual({ ok: false, error: CANVAS_MESSAGES.format });
  });
  it('parses a good feed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(FEED, { status: 200 })));
    const res = await fetchCanvasFeed('https://x/feeds/calendars/u.ics');
    expect(res.ok && res.entries.length).toBe(2);
  });
});
