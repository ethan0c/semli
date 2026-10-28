import type { Category, Item } from '@dayli/schema';
import { dayNumber, isLocalDate, weekOf } from './dates';
import { intervalOf } from './intervals';

export type ShareOptions = { date: string; range: 'day' | 'week'; categories: Category[]; showTitles: boolean };
export type SharedEntry = Pick<Item, 'date' | 'start' | 'end' | 'kind' | 'category' | 'isDeadline' | 'title'>;

/** A live link shows this many days from the day it's opened. */
export const SHARE_DAYS = 14;
/**
 * What the phone sends for a live link: from yesterday (an overnight shift still on) to three weeks
 * out, so a reader who opens it a week after the owner last opened Semli still sees two weeks.
 */
export const SHARE_SNAPSHOT_DAYS = 21;

/** Project only the fields a reader needs, for the dates from `from` to `to`. Never pass source records into a share view. */
export function shareEntries(items: Item[], from: string, to: string, categories: Category[], showTitles: boolean): SharedEntry[] {
  const start = dayNumber(from) * 1440;
  const end = (dayNumber(to) + 1) * 1440;
  return items.filter((item) => {
    if (item.done || !categories.includes(item.category)) return false;
    const iv = item.kind === 'event' ? intervalOf(item) : null;
    return iv ? iv.start < end && iv.end > start : item.date >= from && item.date <= to;
  }).sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? '') || a.title.localeCompare(b.title))
    .map((item) => ({
      date: item.date, start: item.start, end: item.end, kind: item.kind, category: item.category,
      isDeadline: item.isDeadline, title: showTitles ? item.title : item.kind === 'event' ? 'Busy' : 'To-do',
    }));
}

/** A day or a week of the plan, as a reader would see it. */
export function schedulePreview(items: Item[], options: ShareOptions): { from: string; to: string; entries: SharedEntry[] } {
  if (!isLocalDate(options.date)) throw new Error('Choose a valid date.');
  const dates = options.range === 'day' ? [options.date] : weekOf(options.date);
  const from = dates[0]!;
  const to = dates.at(-1)!;
  return { from, to, entries: shareEntries(items, from, to, options.categories, options.showTitles) };
}
