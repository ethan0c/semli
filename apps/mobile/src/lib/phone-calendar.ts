import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDays, localParts } from '@dayli/core';
import type { Item } from '@dayli/schema';
import * as Calendar from 'expo-calendar';
import { useEffect, useMemo } from 'react';
import { AppState, Platform } from 'react-native';
import { create } from 'zustand';

import { track } from './analytics';
import { reportError } from './errors';
import { PHONE_DAYS_AHEAD, PHONE_DAYS_BACK, mergePhoneItems, parsePhoneItemId, phoneEventItems } from './phone-calendar-items';

export { isPhoneEvent, isPhoneItemId } from './phone-calendar-items';

/*
 * The iPhone's own calendar, read on the phone and shown beside the plan: every account the person
 * added to iOS (Outlook, Exchange, Google, iCloud) through one permission. Nothing here enters the
 * plan, the account or the server (decided Oct 28, 2026); the events are read again each time the
 * app opens, and which calendars show is kept on this phone only.
 */

export const PHONE_CALENDAR_AVAILABLE = Platform.OS === 'ios';
const KEY = 'semli.phone-calendar';

export type PhoneCalendarInfo = { id: string; title: string; account: string };
type Prefs = { on: boolean; hidden: string[] };

type State = Prefs & {
  /** Read once at launch; until then nothing shows and nothing is saved. */
  loaded: boolean;
  /** On, but iOS access was turned off in Settings since. */
  denied: boolean;
  calendars: PhoneCalendarInfo[];
  items: Item[];
  /** Calendar names by item id, for a row's subtitle. */
  names: Record<string, string>;
};

export const usePhoneCalendar = create<State>(() => ({ on: false, hidden: [], loaded: false, denied: false, calendars: [], items: [], names: {} }));

function save() {
  const { on, hidden } = usePhoneCalendar.getState();
  AsyncStorage.setItem(KEY, JSON.stringify({ on, hidden } satisfies Prefs)).catch((error: unknown) => reportError('phone_calendar.save', error));
}

/** Birthdays and subscribed calendars (holidays, sports) start hidden; every calendar added later shows. */
const quietByDefault = (c: Calendar.ExpoCalendar) => c.type === Calendar.CalendarType.BIRTHDAYS || c.type === Calendar.CalendarType.SUBSCRIBED;

let reading: Promise<void> | null = null;

/** Reads the calendars and their events again. A failure leaves the last read on screen. */
export function refreshPhoneCalendar(): Promise<void> {
  reading ??= read().catch((error: unknown) => reportError('phone_calendar.read', error)).finally(() => { reading = null; });
  return reading;
}

async function read() {
  if (!PHONE_CALENDAR_AVAILABLE || !usePhoneCalendar.getState().on) return;
  const permission = await Calendar.getCalendarPermissions();
  if (!permission.granted) {
    usePhoneCalendar.setState({ denied: true, items: [], names: {} });
    return;
  }
  const all = (await Calendar.getCalendars(Calendar.EntityTypes.EVENT)).filter((c) => c.type !== Calendar.CalendarType.UNKNOWN);
  const calendars = all
    .map((c) => ({ id: c.id, title: c.title, account: c.source?.name ?? '' }))
    .sort((a, b) => a.account.localeCompare(b.account) || a.title.localeCompare(b.title));
  const { hidden } = usePhoneCalendar.getState();
  const shown = all.filter((c) => !hidden.includes(c.id));
  const today = localParts(new Date()).date;
  const from = new Date(`${addDays(today, -PHONE_DAYS_BACK)}T00:00:00`);
  const to = new Date(`${addDays(today, PHONE_DAYS_AHEAD)}T23:59:59`);
  const events = shown.length ? await Calendar.listEvents(shown.map((c) => c.id), from, to) : [];
  const titles = new Map(all.map((c) => [c.id, c.title]));
  const items: Item[] = [];
  const names: Record<string, string> = {};
  for (const e of events) {
    for (const item of phoneEventItems({ ...e, canceled: e.status === Calendar.EventStatus.CANCELED })) {
      items.push(item);
      names[item.id] = titles.get(e.calendarId) ?? 'iPhone calendar';
    }
  }
  // Turned off while reading: the switch wins.
  if (!usePhoneCalendar.getState().on) return;
  usePhoneCalendar.setState({ denied: false, calendars, items, names });
}

/** At launch: the saved choice, then a read; and again whenever the app comes back to the front. */
export function usePhoneCalendarSync() {
  useEffect(() => {
    if (!PHONE_CALENDAR_AVAILABLE) return;
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        const prefs = raw ? (JSON.parse(raw) as Partial<Prefs>) : {};
        usePhoneCalendar.setState({ on: prefs.on === true, hidden: Array.isArray(prefs.hidden) ? prefs.hidden : [], loaded: true });
        void refreshPhoneCalendar();
      })
      .catch((error: unknown) => {
        reportError('phone_calendar.load', error);
        usePhoneCalendar.setState({ loaded: true });
      });
    const sub = AppState.addEventListener('change', (next) => { if (next === 'active') void refreshPhoneCalendar(); });
    return () => sub.remove();
  }, []);
}

/** Asks iOS for access and turns the calendar on. Returns whether access was given. */
export async function turnOnPhoneCalendar(from: 'settings' | 'onboarding'): Promise<boolean> {
  if (!PHONE_CALENDAR_AVAILABLE) return false;
  try {
    const permission = await Calendar.requestCalendarPermissions();
    track('phone_calendar_permission', { granted: permission.granted, from });
    if (!permission.granted) {
      usePhoneCalendar.setState({ denied: true });
      return false;
    }
    const hidden = (await Calendar.getCalendars(Calendar.EntityTypes.EVENT)).filter(quietByDefault).map((c) => c.id);
    usePhoneCalendar.setState({ on: true, denied: false, hidden });
    save();
    await refreshPhoneCalendar();
    return true;
  } catch (error) {
    reportError('phone_calendar.enable', error);
    return false;
  }
}

export function turnOffPhoneCalendar() {
  usePhoneCalendar.setState({ on: false, denied: false, items: [], names: {}, calendars: [] });
  save();
  track('phone_calendar_off', {});
}

export function showPhoneCalendar(id: string, shown: boolean) {
  const { hidden } = usePhoneCalendar.getState();
  usePhoneCalendar.setState({ hidden: shown ? hidden.filter((h) => h !== id) : [...hidden, id] });
  save();
  void refreshPhoneCalendar();
}

/** The plan with the phone's events beside it, for the screens that show a day or a week. */
export function useWithPhoneCalendar(items: Item[]): Item[] {
  const phone = usePhoneCalendar((s) => s.items);
  return useMemo(() => mergePhoneItems(items, phone), [items, phone]);
}

export function phoneCalendarName(id: string): string {
  return usePhoneCalendar.getState().names[id] ?? 'iPhone calendar';
}

/** Opens iOS's own view of the event; the calendar's app is where it changes. */
export async function openPhoneEvent(id: string) {
  const parsed = parsePhoneItemId(id.replace(/\+\d+$/, ''));
  if (!parsed) return;
  try {
    const event = await Calendar.ExpoCalendarEvent.get(parsed.eventId);
    let occurrence = event;
    try { occurrence = event.getOccurrenceSync({ instanceStartDate: parsed.start }); } catch { /* not a repeating event */ }
    await occurrence.openInCalendar();
  } catch (error) {
    // Deleted in the Calendar app since the last read: read again so it leaves the plan.
    reportError('phone_calendar.open', error);
    void refreshPhoneCalendar();
  }
}
