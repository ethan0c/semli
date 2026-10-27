import type { Item, SeriesRule, Weekday } from '@dayli/schema';
import { WEEKDAYS, addDays, dayNumber, weekOf, weekdayOf } from './dates';

/**
 * Repeating items. A series is ordinary items sharing a seriesId plus one SeriesRule. Every edit
 * that touches how it repeats goes through `rebuildSeries`, which works out the future from the
 * rule and never touches the past, anything done, or an occurrence the person moved by hand.
 */

/** At most a year of occurrences from any one rule. */
export const MAX_SERIES_DAYS = 366;

export type Break = { start: string; end: string };
type Occurrence = Pick<Item, 'id' | 'date' | 'start' | 'end' | 'done' | 'editedAt'>;

/** A rule read off existing occurrences: for series made before rules were stored, and for one-offs being made to repeat. */
export function inferRule(occurrences: Pick<Item, 'date' | 'start' | 'end'>[]): SeriesRule {
  const dates = [...new Set(occurrences.map((o) => o.date))].sort();
  const days = WEEKDAYS.filter((d) => dates.some((date) => weekdayOf(date) === d));
  const first = occurrences.find((o) => o.date === dates[0]) ?? occurrences[0];
  // Every day when every weekday is used over a run of consecutive dates; otherwise weekly, or
  // every two weeks when same-weekday dates are always 14 days apart.
  const sameDayGaps = dates.slice(1).map((d, i) => dayNumber(d) - dayNumber(dates[i]!)).filter((g) => g % 7 === 0);
  const every = days.length === 7 ? 0 : sameDayGaps.length && sameDayGaps.every((g) => g % 14 === 0) ? 2 : 1;
  return { every, days: days.length ? days : [weekdayOf(dates[0] ?? '2026-01-05')], until: dates[dates.length - 1] ?? dates[0] ?? '', skipped: [], start: first?.start ?? null, end: first?.end ?? null };
}

/** The dates a rule puts occurrences on, from `from` (its week anchors every-N-weeks) through `until`, minus skips and breaks. */
export function seriesDates(rule: SeriesRule, from: string, breaks: Break[] = []): string[] {
  if (!rule.until || rule.until < from) return [];
  const out: string[] = [];
  const anchor = dayNumber(weekOf(from)[0]!);
  const last = Math.min(dayNumber(rule.until), dayNumber(from) + MAX_SERIES_DAYS);
  for (let d = from; dayNumber(d) <= last; d = addDays(d, 1)) {
    if (rule.every > 0) {
      if (!rule.days.includes(weekdayOf(d))) continue;
      const weeks = Math.floor((dayNumber(d) - anchor) / 7);
      if (weeks % rule.every !== 0) continue;
    }
    if (rule.skipped.includes(d)) continue;
    if (breaks.some((b) => d >= b.start && d <= b.end)) continue;
    out.push(d);
  }
  return out;
}

export type SeriesRebuild = {
  create: string[];
  update: { id: string; patch: Partial<Item> }[];
  remove: string[];
  /** Occurrences left alone because the person moved them by hand. */
  kept: number;
};

/**
 * What changing a series to `rule` from `from` onward means for its occurrences. Earlier, done
 * and hand-moved occurrences stay as they are; the rest are moved to the rule's times, created on
 * the rule's dates, or removed from dates the rule no longer covers.
 */
export function rebuildSeries(occurrences: Occurrence[], rule: SeriesRule, from: string, today: string, breaks: Break[] = []): SeriesRebuild {
  const result: SeriesRebuild = { create: [], update: [], remove: [], kept: 0 };
  const start = from < today ? today : from;
  const wanted = new Set(seriesDates(rule, start, breaks));
  const have = new Set<string>();
  for (const o of occurrences.filter((o) => o.date >= start)) {
    // Done and hand-moved occurrences stay as they are, and still hold their date: no second one lands on it.
    if (o.done || o.editedAt) { have.add(o.date); if (o.editedAt) result.kept++; continue; }
    if (!wanted.has(o.date) || have.has(o.date)) { result.remove.push(o.id); continue; }
    have.add(o.date);
    const patch: Partial<Item> = {};
    if (o.start !== rule.start) patch.start = rule.start;
    if (o.end !== rule.end) patch.end = rule.end;
    if (Object.keys(patch).length) result.update.push({ id: o.id, patch });
  }
  for (const d of wanted) if (!have.has(d)) result.create.push(d);
  return result;
}

/** "Mon & Wed", "every weekday", "every 2 weeks on Fri", for a repeat row. */
export function describeRule(rule: SeriesRule): string {
  const short = (d: Weekday) => d.charAt(0).toUpperCase() + d.slice(1);
  if (rule.every === 0) return 'Every day';
  const weekdays: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
  const days = rule.days.length === 5 && weekdays.every((d) => rule.days.includes(d)) ? 'weekdays'
    : rule.days.length === 7 ? 'every day'
      : rule.days.map(short).join(rule.days.length === 2 ? ' & ' : ', ');
  return rule.every === 1 ? (days === 'weekdays' || days === 'every day' ? `Every ${days === 'weekdays' ? 'weekday' : 'day'}` : `Every ${days}`) : `Every ${rule.every} weeks on ${days}`;
}
