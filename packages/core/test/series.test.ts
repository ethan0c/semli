import type { SeriesRule } from '@dayli/schema';
import { describe, expect, it } from 'vitest';
import { anchorRule, defaultRule, describeRule, inferRule, itemsAlike, rebuildSeries, sameRule, seriesDates } from '../src';

const rule: SeriesRule = { every: 1, days: ['mon', 'wed'], until: '2026-11-18', skipped: [], start: '09:00', end: '10:15' };
const occ = (id: string, date: string, over: Partial<{ start: string | null; end: string | null; done: boolean; editedAt: string | null }> = {}) =>
  ({ id, date, start: '09:00', end: '10:15', done: false, editedAt: null, ...over });

describe('series rules', () => {
  it('puts occurrences on the rule’s days, skipping skips and breaks', () => {
    expect(seriesDates(rule, '2026-10-26')).toEqual(['2026-10-26', '2026-10-28', '2026-11-02', '2026-11-04', '2026-11-09', '2026-11-11', '2026-11-16', '2026-11-18']);
    expect(seriesDates({ ...rule, skipped: ['2026-11-04'] }, '2026-10-26', [{ start: '2026-11-09', end: '2026-11-13' }])).toEqual(['2026-10-26', '2026-10-28', '2026-11-02', '2026-11-16', '2026-11-18']);
    expect(seriesDates({ ...rule, every: 2 }, '2026-10-26')).toEqual(['2026-10-26', '2026-10-28', '2026-11-09', '2026-11-11']);
    expect(seriesDates({ ...rule, every: 0, until: '2026-10-28' }, '2026-10-26')).toEqual(['2026-10-26', '2026-10-27', '2026-10-28']);
    expect(seriesDates({ ...rule, until: '2026-10-01' }, '2026-10-26')).toEqual([]);
  });
  it('reads a rule off existing occurrences', () => {
    expect(inferRule([occ('a', '2026-10-26'), occ('b', '2026-10-28'), occ('c', '2026-11-02')])).toMatchObject({ every: 1, days: ['mon', 'wed'], until: '2026-11-02', start: '09:00', end: '10:15' });
    expect(inferRule([occ('a', '2026-10-30'), occ('b', '2026-11-13')]).every).toBe(2);
  });
  it('moves the time of every upcoming occurrence and leaves the past, the done, and the hand-moved alone', () => {
    const series = [occ('past', '2026-10-19'), occ('done', '2026-10-26', { done: true }), occ('moved', '2026-10-28', { start: '14:00', end: '15:15', editedAt: '2026-10-20T00:00:00Z' }), occ('nov2', '2026-11-02'), occ('nov4', '2026-11-04')];
    const r = rebuildSeries(series, { ...rule, start: '10:00', end: '11:15', until: '2026-11-04' }, '2026-10-26', '2026-10-26');
    expect(r.update).toEqual([{ id: 'nov2', patch: { start: '10:00', end: '11:15' } }, { id: 'nov4', patch: { start: '10:00', end: '11:15' } }]);
    expect(r.kept).toBe(1);
    // Oct 26 is held by the done one and Oct 28 by the hand-moved one: nothing new lands on either.
    expect(r.create).toEqual([]);
    expect(r.remove).toEqual([]);
  });
  it('changing the days creates and removes only from now on', () => {
    const series = [occ('a', '2026-10-26'), occ('b', '2026-10-28'), occ('c', '2026-11-02'), occ('d', '2026-11-04')];
    const r = rebuildSeries(series, { ...rule, days: ['tue', 'thu'], until: '2026-11-05' }, '2026-10-28', '2026-10-26');
    expect(r.remove).toEqual(['b', 'c', 'd']);
    expect(r.create).toEqual(['2026-10-29', '2026-11-03', '2026-11-05']);
  });
  it('extending the end creates the new dates and nothing else', () => {
    const series = [occ('a', '2026-11-16'), occ('b', '2026-11-18')];
    const r = rebuildSeries(series, { ...rule, until: '2026-11-25' }, '2026-11-16', '2026-10-26');
    expect(r.create).toEqual(['2026-11-23', '2026-11-25']);
    expect(r.update).toEqual([]);
    expect(r.remove).toEqual([]);
  });
  it('keeps clock times across the clocks changing', () => {
    const r = rebuildSeries([occ('a', '2026-03-02'), occ('b', '2026-03-09')], { ...rule, days: ['mon'], until: '2026-03-16' }, '2026-03-02', '2026-03-01');
    expect(r.create).toEqual(['2026-03-16']);
    expect(r.update).toEqual([]);
  });
  it('describes a rule the way a student would say it', () => {
    expect(describeRule(rule)).toBe('Every Mon & Wed');
    expect(describeRule({ ...rule, days: ['mon', 'tue', 'wed', 'thu', 'fri'] })).toBe('Every weekday');
    expect(describeRule({ ...rule, every: 2, days: ['fri'] })).toBe('Every 2 weeks on Fri');
    expect(describeRule({ ...rule, every: 0 })).toBe('Every day');
  });
  it('starts a new series on the item’s own day through the end of its term, and keeps that day when the rule is edited', () => {
    const r = defaultRule('2026-10-27', { start: '09:00', end: '10:15' });
    expect(r).toMatchObject({ every: 1, days: ['tue'], start: '09:00', end: '10:15', skipped: [] });
    expect(r.until).toBe('2026-12-11');
    expect(anchorRule({ ...r, days: ['mon', 'wed'] }, '2026-10-27').days).toEqual(['mon', 'tue', 'wed']);
    expect(anchorRule({ ...r, every: 0, days: [] }, '2026-10-27').days).toEqual([]);
    expect(anchorRule({ ...r, until: '2026-10-01' }, '2026-10-27').until).toBe('2026-10-27');
    expect(anchorRule({ ...r, until: '2028-01-01' }, '2026-10-27').until).toBe('2027-10-27');
  });
});

describe('sameRule', () => {
  const rule: SeriesRule = { every: 1, days: ['mon', 'wed'], until: '2026-12-11', skipped: [], start: '09:00', end: '10:15' };
  it('ignores the order of days', () => {
    expect(sameRule(rule, { ...rule, days: ['wed', 'mon'] })).toBe(true);
  });
  it('sees a change of days, end or time', () => {
    expect(sameRule(rule, { ...rule, days: ['mon'] })).toBe(false);
    expect(sameRule(rule, { ...rule, until: '2026-12-04' })).toBe(false);
    expect(sameRule(rule, { ...rule, start: '10:00' })).toBe(false);
  });
  it('treats no rule as different from a rule', () => {
    expect(sameRule(rule, null)).toBe(false);
    expect(sameRule(null, null)).toBe(true);
  });
});

describe('itemsAlike', () => {
  const base = { kind: 'event' as const, title: 'Morning cardio', start: null, end: null, done: false };
  const items = [
    { ...base, id: 'a', date: '2026-10-26' },
    { ...base, id: 'b', date: '2026-10-27' },
    { ...base, id: 'c', date: '2026-11-02', title: ' morning Cardio ' },
    { ...base, id: 'd', date: '2026-11-03', done: true },
    { ...base, id: 'e', date: '2026-11-04', start: '07:00', end: '07:45' },
    { ...base, id: 'f', date: '2026-11-05', title: 'Evening cardio' },
  ];
  it('finds upcoming items with the same name and times, linked or not', () => {
    expect(itemsAlike(items[1]!, items).map((it) => it.id)).toEqual(['c']);
  });
  it('leaves out earlier, done, already-timed and differently named items', () => {
    expect(itemsAlike(items[0]!, items).map((it) => it.id)).toEqual(['b', 'c']);
  });
});
