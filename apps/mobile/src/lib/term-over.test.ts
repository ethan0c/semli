import type { Item } from '@dayli/schema';
import { describe, expect, it } from 'vitest';

import { termOver } from './term-over';

const item = (patch: Partial<Item>): Item => ({
  id: Math.random().toString(36), kind: 'event', title: 'Lecture', category: 'school', icon: 'school', date: '2026-12-09',
  start: '09:00', end: '10:00', isDeadline: false, done: false, completedAt: null, courseId: 'bio', employer: null,
  sourceId: null, batchId: null, seriesId: 's1', notes: null, createdAt: '', ...patch,
});
const term = [item({ date: '2026-08-24' }), item({ date: '2026-12-09' }), item({ courseId: 'stat', seriesId: 's2', date: '2026-12-08' })];

describe('term over', () => {
  it('asks a week after the last class, naming the term and its finished courses', () => {
    expect(termOver(term, '2026-12-15')).toBeNull();
    expect(termOver(term, '2026-12-16')).toEqual({ lastClass: '2026-12-09', name: 'fall semester', oldCourses: ['bio', 'stat'] });
  });

  it('stays quiet once next term is in, and when the term is long gone', () => {
    expect(termOver([...term, item({ date: '2027-01-12', seriesId: 's3', courseId: 'chem' })], '2026-12-20')).toBeNull();
    expect(termOver(term, '2027-03-20')).toBeNull();
  });

  it('keeps a course that still has something ahead', () => {
    const paper = item({ kind: 'task', seriesId: null, courseId: 'stat', date: '2026-12-21', start: null, end: null });
    expect(termOver([...term, paper], '2026-12-18')?.oldCourses).toEqual(['bio']);
  });

  it('needs classes, not one-off school events', () => {
    expect(termOver([item({ seriesId: null })], '2026-12-20')).toBeNull();
  });
});
