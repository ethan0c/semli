import { afterEach, describe, expect, it } from 'vitest';
import type { Extraction, Item } from '@dayli/schema';
import {
  addDays,
  diffSchedule,
  findConflicts,
  PHONE_CALENDAR_SOURCE,
  findOverloads,
  dateLocaleFrom,
  formatHour,
  formatRange,
  formatTime,
  fullDate,
  isLocalDate,
  monthDay,
  pendingDates,
  courseKey,
  findCourse,
  matchExisting,
  newCourses,
  planCommit,
  relativeDay,
  toDrafts,
  weekOf,
  resetDateLocale,
  setDateLocale,
  typicalTermEnd,
  weekdayOf,
} from '../src';

afterEach(() => resetDateLocale());

function item(p: Partial<Item> & Pick<Item, 'id' | 'date'>): Item {
  return {
    kind: 'event',
    title: 'x',
    category: 'personal',
    icon: 'calendar',
    start: null,
    end: null,
    isDeadline: false,
    done: false,
    completedAt: null,
    courseId: null,
    employer: null,
    sourceId: null,
    batchId: null,
    notes: null,
    createdAt: '2026-10-19T00:00:00Z',
    ...p,
  };
}

describe('dates', () => {
  it('knows weekdays and weeks', () => {
    expect(weekdayOf('2026-10-19')).toBe('mon');
    expect(weekdayOf('2026-10-25')).toBe('sun');
    expect(weekOf('2026-10-22')).toEqual([
      '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25',
    ]);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
  it('validates dates', () => {
    expect(isLocalDate('2026-02-29')).toBe(false);
    expect(isLocalDate('2028-02-29')).toBe(true);
    expect(isLocalDate('10/20/2026')).toBe(false);
  });
  it('formats times', () => {
    expect(formatTime('16:00')).toBe('4:00 pm');
    expect(formatTime('00:30')).toBe('12:30 am');
    expect(formatRange('16:00', '22:00')).toBe('4–10 pm');
    expect(formatRange('11:00', '17:00')).toBe('11 am–5 pm');
    expect(relativeDay('2026-10-20', '2026-10-20')).toBe('Today');
    expect(relativeDay('2026-10-20', '2026-10-21')).toBe('Tomorrow');
    expect(relativeDay('2026-10-20', '2026-10-19')).toBe('Yesterday');
    expect(relativeDay('2026-10-20', '2026-10-23')).toBe('In 3 days');
  });
});

describe('diffSchedule', () => {
  const old = [
    item({ id: 'a', date: '2026-10-27', start: '16:00', end: '22:00' }),
    item({ id: 'b', date: '2026-10-30', start: '16:00', end: '22:00' }),
    item({ id: 'c', date: '2026-10-31', start: '11:00', end: '17:00' }),
  ];
  it('classifies new, changed, removed, unchanged', () => {
    const d = diffSchedule(old, [
      { date: '2026-10-27', start: '16:00', end: '22:00' },
      { date: '2026-10-29', start: '11:00', end: '17:00' },
      { date: '2026-10-30', start: '17:00', end: '23:00' },
    ]);
    expect(d.unchanged.map((u) => u.before.id)).toEqual(['a']);
    expect(d.changed.map((c) => [c.before.id, c.after.start])).toEqual([['b', '17:00']]);
    expect(d.added.map((a) => a.date)).toEqual(['2026-10-29']);
    expect(d.removed.map((r) => r.id)).toEqual(['c']);
  });
  it('pairs double shifts by overlap', () => {
    const d = diffSchedule(
      [item({ id: 'am', date: '2026-11-01', start: '09:00', end: '13:00' }), item({ id: 'pm', date: '2026-11-01', start: '17:00', end: '22:00' })],
      [{ date: '2026-11-01', start: '17:30', end: '22:00' }, { date: '2026-11-01', start: '09:00', end: '13:00' }],
    );
    expect(d.unchanged.map((u) => u.before.id)).toEqual(['am']);
    expect(d.changed.map((c) => c.before.id)).toEqual(['pm']);
  });
});

describe('conflicts and overload', () => {
  it('finds overlapping events, including overnight shifts', () => {
    const c = findConflicts([
      item({ id: 'shift', date: '2026-10-29', start: '22:00', end: '06:00' }),
      item({ id: 'clinical', date: '2026-10-30', start: '05:30', end: '14:00' }),
      item({ id: 'task', kind: 'task', date: '2026-10-30', start: '06:00', end: null }),
    ]);
    expect(c).toEqual([{ a: 'shift', b: 'clinical', minutes: 30 }]);
  });
  it('flags a deadline with too little free time before it', () => {
    const items = [
      item({ id: 'exam', date: '2026-10-26', start: '09:00', end: '11:00', isDeadline: true }),
      item({ id: 's1', date: '2026-10-24', start: '07:00', end: '23:00' }),
      item({ id: 's2', date: '2026-10-25', start: '07:00', end: '21:00' }),
    ];
    const o = findOverloads(items, { date: '2026-10-23', time: '23:30' });
    // From Fri night: Sun 21–23 (2h) + Mon 07–09 (2h) free = 4h, which is not under the 4h threshold.
    expect(o).toEqual([]);
    const o2 = findOverloads(items, { date: '2026-10-24', time: '06:00' });
    expect(o2).toEqual([]);
    const o3 = findOverloads([...items, item({ id: 's3', date: '2026-10-26', start: '07:00', end: '08:30' })], { date: '2026-10-24', time: '06:00' });
    expect(o3).toEqual([{ deadlineId: 'exam', freeHours: 2.5 }]);
  });
  it('counts iPhone calendar events against the plan, never against each other', () => {
    const phone = { sourceId: PHONE_CALENDAR_SOURCE };
    const c = findConflicts([
      item({ id: 'standup', date: '2026-10-26', start: '09:00', end: '10:00', ...phone }),
      item({ id: 'one-on-one', date: '2026-10-26', start: '09:30', end: '10:30', ...phone }),
      item({ id: 'lecture', date: '2026-10-26', start: '10:00', end: '11:00' }),
    ]);
    expect(c).toEqual([{ a: 'one-on-one', b: 'lecture', minutes: 30 }]);
  });
  it('gives an event with no end the hour the charts draw', () => {
    const c = findConflicts([
      item({ id: 'shift', date: '2026-10-26', start: '09:00', end: '17:00' }),
      item({ id: 'lunch', date: '2026-10-26', start: '12:00', end: null }),
      item({ id: 'evening', date: '2026-10-26', start: '17:00', end: null }),
    ]);
    expect(c).toEqual([{ a: 'shift', b: 'lunch', minutes: 60 }]);
  });
  it('reads an end equal to the start as no end, never 24 hours', () => {
    const c = findConflicts([
      item({ id: 'zero', date: '2026-10-26', start: '09:00', end: '09:00' }),
      item({ id: 'next-day', date: '2026-10-27', start: '08:00', end: '09:00' }),
      item({ id: 'same-hour', date: '2026-10-26', start: '09:30', end: '10:30' }),
    ]);
    expect(c).toEqual([{ a: 'zero', b: 'same-hour', minutes: 30 }]);
  });
  it('lists dates without a published schedule', () => {
    expect(pendingDates([{ coversFrom: '2026-10-19', coversTo: '2026-10-25' }], '2026-10-24', '2026-10-27')).toEqual([
      '2026-10-26',
      '2026-10-27',
    ]);
  });
});

describe('drafts and commit planning', () => {
  const base = {
    is_deadline: false,
    repeat_weekdays: [] as never[],
    repeat_until: null,
    course_code: null,
    evidence: '',
    confidence: 0.95,
    question: null,
  };
  it('expands repeating classes and flags bad dates', () => {
    const ex: Extraction = {
      detected_type: 'syllabus',
      employer: null,
      course: { code: 'NUR 410', title: 'Adult Health', instructor: null },
      covers_from: null,
      covers_to: null,
      items: [
        { ...base, kind: 'event', title: 'Adult Health lecture', category: 'school', date: '2026-10-20', start: '09:00', end: '10:15', repeat_weekdays: ['tue', 'thu'], repeat_until: '2026-10-31' },
        { ...base, kind: 'task', title: 'Care plan', category: 'school', date: '2026-02-30', start: null, end: null },
      ],
    };
    const drafts = toDrafts(ex, '2026-10-19');
    expect(drafts.filter((d) => d.title === 'Adult Health lecture').map((d) => d.date)).toEqual([
      '2026-10-20', '2026-10-22', '2026-10-27', '2026-10-29',
    ]);
    const bad = drafts.find((d) => d.title === 'Care plan')!;
    expect(bad.date).toBeNull();
    expect(bad.needsInput).toBe(true);
  });
  it('turns a schedule import into creates, updates, and removes', () => {
    const existing = [
      item({ id: 'b', date: '2026-10-30', start: '16:00', end: '22:00', category: 'work', employer: 'Olive Garden' }),
      item({ id: 'c', date: '2026-10-31', start: '11:00', end: '17:00', category: 'work', employer: 'Olive Garden' }),
      item({ id: 'other', date: '2026-10-31', start: '11:00', end: '17:00', category: 'work', employer: 'Target' }),
    ];
    const ex: Extraction = {
      detected_type: 'work_schedule',
      employer: 'Olive Garden',
      course: null,
      covers_from: '2026-10-26',
      covers_to: '2026-11-01',
      items: [
        { ...base, kind: 'event', title: 'Olive Garden shift', category: 'work', date: '2026-10-27', start: '16:00', end: '22:00' },
        { ...base, kind: 'event', title: 'Olive Garden shift', category: 'work', date: '2026-10-30', start: '17:00', end: '23:00' },
      ],
    };
    const plan = planCommit(ex, toDrafts(ex, '2026-10-19'), existing, () => null);
    expect(plan.create.map((c) => c.date)).toEqual(['2026-10-27']);
    expect(plan.update).toEqual([{ id: 'b', patch: { start: '17:00', end: '23:00' } }]);
    expect(plan.remove).toEqual(['c']);
  });
  it('skips exact duplicates', () => {
    const existing = [item({ id: 'x', kind: 'task', title: 'Buy scrubs', date: '2026-10-21' })];
    const ex: Extraction = {
      detected_type: 'general', employer: null, course: null, covers_from: null, covers_to: null,
      items: [{ ...base, kind: 'task', title: 'Buy scrubs', category: 'personal', date: '2026-10-21', start: null, end: null }],
    };
    const plan = planCommit(ex, toDrafts(ex, '2026-10-19'), existing, () => null);
    expect(plan.create).toEqual([]);
    expect(plan.skipped).toBe(1);
  });
});

describe('notes from the document', () => {
  const base = { is_deadline: false, repeat_weekdays: [] as never[], repeat_until: null, course_code: null, evidence: '', confidence: 0.95, question: null };
  const ex = (notes: string | null): Extraction => ({
    detected_type: 'syllabus', employer: null, course: null, covers_from: null, covers_to: null,
    items: [{ ...base, kind: 'event', title: 'Lab 3', category: 'school', date: '2026-10-21', start: '14:00', end: '16:00', notes }],
  });
  it('carries the details into a new item', () => {
    const plan = planCommit(ex(' Bring a lab coat '), toDrafts(ex(' Bring a lab coat '), '2026-10-19'), [], () => null);
    expect(plan.create[0]!.notes).toBe('Bring a lab coat');
  });
  it('fills an empty note on re-import and never replaces the student’s own', () => {
    const blank = item({ id: 'a', title: 'Lab 3', date: '2026-10-21', start: '13:00', end: '16:00', category: 'school', notes: null });
    const written = { ...blank, id: 'b', notes: 'Ask about the makeup lab' };
    const doc = ex('Bring a lab coat');
    expect(planCommit(doc, toDrafts(doc, '2026-10-19'), [blank], () => null).update[0]!.patch).toMatchObject({ notes: 'Bring a lab coat' });
    expect(planCommit(doc, toDrafts(doc, '2026-10-19'), [written], () => null).update[0]!.patch).not.toHaveProperty('notes');
  });
});

describe('typical term end', () => {
  it('ends a fall class in mid-December, spring in mid-May, summer in early August', () => {
    expect(typicalTermEnd('2026-08-24')).toEqual({ date: '2026-12-11', term: 'fall', name: 'fall semester' });
    expect(typicalTermEnd('2027-01-19')).toEqual({ date: '2027-05-14', term: 'spring', name: 'spring semester' });
    expect(typicalTermEnd('2027-06-01')).toEqual({ date: '2027-08-06', term: 'summer', name: 'summer session' });
  });
  it('gives a class that starts late in a term the next one', () => {
    expect(typicalTermEnd('2026-11-20')).toMatchObject({ date: '2027-05-14', term: 'spring' });
    expect(typicalTermEnd('2026-12-20')).toMatchObject({ date: '2027-05-14', term: 'spring' });
  });
  it('follows the region the person is in', () => {
    expect(typicalTermEnd('2026-09-28', 'GB')).toEqual({ date: '2026-12-11', term: 'autumn', name: 'autumn term' });
    expect(typicalTermEnd('2027-01-11', 'GB')).toMatchObject({ date: '2027-03-26', name: 'spring term' });
    expect(typicalTermEnd('2027-03-01', 'AU')).toMatchObject({ date: '2027-06-04', name: 'semester 1' });
    expect(typicalTermEnd('2026-10-12', 'DE')).toMatchObject({ date: '2027-02-12', name: 'winter semester' });
    expect(typicalTermEnd('2026-09-01', 'SE')).toMatchObject({ date: '2027-01-15', name: 'autumn semester' });
    expect(typicalTermEnd('2027-04-08', 'JP')).toMatchObject({ date: '2027-07-30', name: 'spring semester' });
    expect(typicalTermEnd('2026-09-08', 'CA')).toMatchObject({ date: '2026-12-04', name: 'fall term' });
  });
  it('uses quarters where the person chose them, and the US calendar where none is known', () => {
    expect(typicalTermEnd('2027-01-04', 'US', 'quarter')).toMatchObject({ date: '2027-03-19', name: 'winter quarter' });
    expect(typicalTermEnd('2026-09-28', 'US', 'quarter')).toMatchObject({ date: '2026-12-11', name: 'fall quarter' });
    expect(typicalTermEnd('2026-08-24', 'BR')).toEqual(typicalTermEnd('2026-08-24', 'US'));
  });
  it('reads the region set for the app', () => {
    setDateLocale({ region: 'AU' });
    expect(typicalTermEnd('2026-07-20').name).toBe('semester 2');
  });
});

describe('date locale', () => {
  it('reads a device locale', () => {
    expect(dateLocaleFrom({ locale: 'en-GB', region: 'GB', hour12: false })).toEqual({ locale: 'en-GB', region: 'GB', hour12: false, dayFirst: true, termSystem: 'semester' });
    expect(dateLocaleFrom({ locale: 'de-DE' })).toMatchObject({ region: 'DE', hour12: false, dayFirst: true });
    expect(dateLocaleFrom({ locale: 'en-US' })).toMatchObject({ region: 'US', hour12: true, dayFirst: false });
    expect(dateLocaleFrom({ locale: 'ja-JP' })).toMatchObject({ region: 'JP', dayFirst: false });
    expect(dateLocaleFrom({ locale: 'en' }).region).toBe('US');
  });
  it('formats on a 24-hour clock', () => {
    setDateLocale({ hour12: false });
    expect(formatTime('16:00')).toBe('16:00');
    expect(formatTime('09:30', true)).toBe('09:30');
    expect(formatRange('16:00', '22:00')).toBe('16:00–22:00');
    expect(formatHour(8)).toBe('08');
  });
  it('puts the day first where the region does', () => {
    expect(monthDay('2026-10-24')).toBe('Oct 24');
    expect(fullDate('2026-10-24')).toBe('Oct 24, 2026');
    expect(formatHour(16)).toBe('4 pm');
    setDateLocale({ dayFirst: true });
    expect(monthDay('2026-10-24')).toBe('24 Oct');
    expect(fullDate('2026-10-24')).toBe('24 Oct 2026');
  });
});

describe('newCourses', () => {
  const draft = (title: string, courseCode: string | null, kind: 'event' | 'task' = 'event') => ({ include: true, kind, title, courseCode });
  it('adds one course per class code in a class schedule', () => {
    const ex = { detected_type: 'course_schedule' as const, course: null };
    const drafts = [
      draft('Human Anatomy', 'BIOL 201'), draft('Human Anatomy', 'BIOL 201'),
      draft('Anatomy lab', 'biol 201 '), draft('Statistics', 'STAT 110'), draft('Quiz 1', 'CHEM 101', 'task'), draft('Club', null),
    ];
    expect(newCourses(ex, drafts, [{ code: 'STAT 110', title: 'Statistics' }])).toEqual([
      { code: 'BIOL 201', title: 'Human Anatomy', instructor: null },
    ]);
  });
  it('adds only the named course for a syllabus', () => {
    const ex = { detected_type: 'syllabus' as const, course: { code: 'NUR 410', title: 'Adult Health', instructor: 'Dr. Ade' } };
    expect(newCourses(ex, [draft('Lecture', 'NUR 410'), draft('Other', 'BIO 1')], [])).toEqual([
      { code: 'NUR 410', title: 'Adult Health', instructor: 'Dr. Ade' },
    ]);
    expect(newCourses(ex, [], [{ code: 'nur 410', title: 'Something' }])).toEqual([]);
  });
});

describe('re-imports', () => {
  const base = { is_deadline: true, repeat_weekdays: [] as never[], repeat_until: null, evidence: '', confidence: 0.95, question: null, start: null, end: null };
  const syllabus = (items: Extraction['items']): Extraction => ({ detected_type: 'syllabus', employer: null, course: null, covers_from: null, covers_to: null, items });

  it('updates the closest title, and leaves done, notes and series alone', () => {
    const existing = [
      item({ id: 'q6', kind: 'task', title: 'Chapter 6 reading quiz', date: '2026-10-30' }),
      item({ id: 'q5', kind: 'task', title: 'Chapter 5 reading quiz', date: '2026-10-30', done: true, notes: 'got 9/10', courseId: 'bio', seriesId: 's' }),
    ];
    const ex = syllabus([{ ...base, kind: 'task', title: 'Chapter 5 reading quiz due', category: 'school', date: '2026-10-30', course_code: 'BIO 1' }]);
    const plan = planCommit(ex, toDrafts(ex, '2026-10-19'), existing, () => 'bio');
    expect(plan.update).toEqual([{ id: 'q5', patch: { title: 'Chapter 5 reading quiz due', start: null, end: null, isDeadline: true } }]);
  });

  it('never matches another course\'s item', () => {
    const engl = item({ id: 'e', kind: 'task', title: 'Reading response', date: '2026-10-30', courseId: 'engl' });
    expect(matchExisting({ kind: 'task', title: 'Reading response', date: '2026-10-30', start: null, end: null, courseId: 'hist' }, [engl])).toBeNull();
    expect(matchExisting({ kind: 'task', title: 'Reading response', date: '2026-10-30', start: null, end: null, courseId: 'engl' }, [engl])).toEqual({ type: 'duplicate', existingId: 'e' });
  });

  it('matches course codes however they are spaced, then titles', () => {
    expect(courseKey('biol-201')).toBe(courseKey('BIOL 201'));
    const courses = [{ id: 'a', code: 'BIOL201', title: 'Biology' }, { id: 'b', code: null, title: 'Intro to Psychology' }];
    expect(findCourse(courses, 'BIOL 201')?.id).toBe('a');
    expect(findCourse(courses, 'PSYC 101', 'intro to psychology')?.id).toBe('b');
    expect(newCourses({ detected_type: 'course_schedule', course: null }, [{ include: true, kind: 'event', title: 'Biology', courseCode: 'BIOL 201' }], courses)).toEqual([]);
  });

  it('matches a work schedule to an employer written with or without accents', () => {
    const existing = [item({ id: 'old', date: '2026-10-28', start: '09:00', end: '13:00', category: 'work', employer: 'Campus Café' })];
    const ex: Extraction = {
      detected_type: 'work_schedule', employer: 'Campus Cafe', course: null, covers_from: '2026-10-26', covers_to: '2026-11-01',
      items: [{ ...base, is_deadline: false, kind: 'event', title: 'Campus Cafe shift', category: 'work', date: '2026-10-28', start: '10:00', end: '14:00', course_code: null }],
    };
    const plan = planCommit(ex, toDrafts(ex, '2026-10-19'), existing, () => null);
    expect(plan.update).toEqual([{ id: 'old', patch: { start: '10:00', end: '14:00' } }]);
    expect(plan.create).toEqual([]);
  });
});

describe('repeating classes in review', () => {
  const cls = (over: Partial<Extraction['items'][number]> = {}): Extraction => ({
    detected_type: 'course_schedule', employer: null, course: null, covers_from: null, covers_to: null,
    items: [{ kind: 'event', title: 'Biology', category: 'school', date: '2027-01-11', start: '09:00', end: '10:00', is_deadline: false, repeat_weekdays: ['mon'], repeat_until: null, course_code: 'BIOL 201', evidence: '', confidence: 0.95, question: null, ...over }],
  });

  it('skips breaks and expands past a guessed end so a later one can be picked', () => {
    const drafts = toDrafts(cls(), '2026-10-27', { breaks: [{ start: '2027-03-15', end: '2027-03-19' }] });
    expect(drafts.map((d) => d.date)).not.toContain('2027-03-15');
    const guess = drafts[0]!.seriesUntil!;
    expect(drafts.some((d) => d.date! > guess)).toBe(true);
  });

  it('starts a class read mid-term from today, not from its first lecture', () => {
    const drafts = toDrafts(cls(), '2027-02-03');
    expect(drafts[0]!.date).toBe('2027-02-08');
  });

  it('asks for a missing time before asking how long it repeats', () => {
    const [first] = toDrafts(cls({ start: null, end: null }), '2026-10-27');
    expect(first!.question).toBe('What time does this start?');
    expect(first!.needsInput).toBe(true);
  });
});
