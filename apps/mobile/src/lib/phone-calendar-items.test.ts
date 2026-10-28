import { PHONE_CALENDAR_SOURCE } from '@dayli/core';
import type { Item } from '@dayli/schema';
import { describe, expect, it } from 'vitest';

import { mergePhoneItems, parsePhoneItemId, phoneEventItems, type PhoneEvent } from './phone-calendar-items';

const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute);
const event = (patch: Partial<PhoneEvent>): PhoneEvent => ({
  id: 'ev1', calendarId: 'work', title: 'Team meeting', startDate: at(26, 9), endDate: at(26, 10), allDay: false, canceled: false, ...patch,
});

describe('phone calendar events', () => {
  it('reads a timed event as a fixed, read-only event on its day', () => {
    const [item] = phoneEventItems(event({}));
    expect(item).toMatchObject({ kind: 'event', title: 'Team meeting', date: '2026-10-26', start: '09:00', end: '10:00', sourceId: PHONE_CALENDAR_SOURCE, timeFlexibility: 'fixed', done: false });
    expect(parsePhoneItemId(item!.id)).toEqual({ eventId: 'ev1', start: at(26, 9) });
  });

  it('keeps an overnight shift on its first day, ending the next morning', () => {
    expect(phoneEventItems(event({ startDate: at(26, 22), endDate: at(27, 6) }))[0]).toMatchObject({ date: '2026-10-26', start: '22:00', end: '06:00' });
  });

  it('holds the rest of the first day for a timed event that runs for days', () => {
    expect(phoneEventItems(event({ startDate: at(26, 14), endDate: at(29, 11) }))[0]).toMatchObject({ date: '2026-10-26', start: '14:00', end: '23:59' });
  });

  it('shows an all-day event on each of its days, up to two weeks', () => {
    const trip = phoneEventItems(event({ title: 'Conference', allDay: true, startDate: at(26, 0), endDate: at(28, 0) }));
    expect(trip.map((i) => [i.date, i.start])).toEqual([['2026-10-26', null], ['2026-10-27', null]]);
    expect(new Set(trip.map((i) => i.id)).size).toBe(2);
    expect(phoneEventItems(event({ allDay: true, startDate: at(1, 0), endDate: new Date(2026, 11, 1) }))).toHaveLength(14);
  });

  it('leaves out canceled events and names untitled ones', () => {
    expect(phoneEventItems(event({ canceled: true }))).toEqual([]);
    expect(phoneEventItems(event({ title: ' ' }))[0]!.title).toBe('Busy');
  });

  it('shows an event already in the plan once, and keeps the plan order', () => {
    const planned = { ...phoneEventItems(event({}))[0]!, id: 'mine', sourceId: null } as Item;
    const lunch = phoneEventItems(event({ id: 'ev2', title: 'Lunch', startDate: at(26, 12), endDate: at(26, 13) }))[0]!;
    const early = phoneEventItems(event({ id: 'ev3', title: 'Gym', startDate: at(26, 7), endDate: at(26, 8) }))[0]!;
    const dupe = phoneEventItems(event({ title: 'team  MEETING' }))[0]!;
    expect(mergePhoneItems([planned], [lunch, dupe, early]).map((i) => i.title)).toEqual(['Gym', 'Team meeting', 'Lunch']);
  });
});
