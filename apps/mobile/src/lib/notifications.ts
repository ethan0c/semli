import { localParts } from '@dayli/core';
import { router } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import Purchases, { type CustomerInfo } from 'react-native-purchases';

import { track } from '@/lib/analytics';
import { reportError, withErrorLogging } from './errors';
import { planReminders, type PlannedNotification } from '@/lib/reminder-plan';
import { PLUS_ENTITLEMENT, purchasesUnavailableReason } from '@/lib/revenuecat';
import { useStore } from '@/store';

/** Show reminders while the app is open too; a reminder you can't see is not a reminder. */
export function configureNotifications() {
  if (Platform.OS === 'web') return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

export async function notificationsAllowed(): Promise<boolean> {
  return withErrorLogging('reminders.check_permission', async () => {
    if (Platform.OS === 'web') return false;
    const current = await Notifications.getPermissionsAsync();
    return current.granted;
  });
}

/**
 * Where permission stands before asking: `blocked` means iOS will not show the prompt again
 * (a "Don't Allow" from before), so only Settings can turn it on.
 */
export async function notificationPermission(): Promise<'granted' | 'ask' | 'blocked'> {
  return withErrorLogging('reminders.check_permission', async () => {
    if (Platform.OS === 'web') return 'blocked';
    const current = await Notifications.getPermissionsAsync();
    return current.granted ? 'granted' : current.canAskAgain ? 'ask' : 'blocked';
  });
}

/**
 * Whether this phone lets Semli notify, re-checked when the app returns from Settings.
 * null while checking, on the web (which edits the iPhone's reminders), or if the check failed.
 */
export function useNotificationsAllowed(): boolean | null {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    // The check reports its own failure; an unknown answer shows the saved preference.
    const check = () => void notificationsAllowed().then(setAllowed, () => setAllowed(null));
    check();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') check(); });
    return () => sub.remove();
  }, []);
  return allowed;
}

/** Ask once, in context (after the first confirmed import). Returns whether reminders can fire. */
export async function requestNotifications(): Promise<boolean> {
  return withErrorLogging('reminders.request_permission', async () => {
    if (Platform.OS === 'web') return false;
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const next = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } });
    track('reminders_permission', { granted: next.granted });
    return next.granted;
  });
}

function triggerFor(p: PlannedNotification): Notifications.DateTriggerInput {
  const [y, m, d] = p.date.split('-').map(Number);
  const [hh, mm] = p.time.split(':').map(Number);
  return { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(y!, m! - 1, d!, hh!, mm!, 0) };
}

let lastSignature = '';

/**
 * Replace every pending local notification with the current plan. Idempotent: the same
 * plan is not rescheduled, so this can run on every store change.
 */
export async function syncReminders(): Promise<number> {
  return withErrorLogging('reminders.synchronize', async () => {
    if (Platform.OS === 'web') return 0;
    const { items, settings } = useStore.getState();
    const allowed = await notificationsAllowed();
    const plan = allowed ? planReminders(Object.values(items), settings.reminders, localParts(new Date()), { trial: settings.trial }) : [];
    const signature = JSON.stringify(plan.map((p) => [p.id, p.date, p.time, p.title, p.body, p.url]));
    if (signature === lastSignature) return plan.length;
    // A failed replacement may leave a partial schedule. Never reuse its old signature.
    lastSignature = '';
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const p of plan) {
      await Notifications.scheduleNotificationAsync({
        identifier: p.id,
        content: { title: p.title, body: p.body, sound: 'default', data: { itemId: p.itemId, kind: p.kind, url: p.url } },
        trigger: triggerFor(p),
      });
    }
    lastSignature = signature;
    return plan.length;
  });
}

/** Fire a sample reminder in a few seconds, so the settings page can prove it works. */
export async function sendTestNotification(): Promise<void> {
  return withErrorLogging('reminders.send_test', async () => {
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Test reminder', body: 'Notifications are working. You can change reminder times in Semli.', sound: 'default' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5 },
    });
  });
}

/** A free trial that will turn into a charge: the only case the trial-ends reminder is for. */
export function trialRenews(info: CustomerInfo | null): boolean {
  const entitlement = info?.entitlements.active[PLUS_ENTITLEMENT];
  return entitlement?.periodType === 'TRIAL' && entitlement.willRenew === true;
}

/** The store's latest answer, kept so a plan that hydrates after it arrives is still checked. */
let latestCustomerInfo: CustomerInfo | null = null;

/** Drops the trial reminder once the trial converted, was cancelled, or ended (Oct 27, 2026). */
function settleTrial() {
  const { hydrated, settings, setSettings } = useStore.getState();
  if (!hydrated || !settings.trial || !latestCustomerInfo || trialRenews(latestCustomerInfo)) return;
  setSettings({ trial: null });
}

/** Keeps the schedule in step with the plan: on changes to items or preferences, and when the app returns. */
export function useReminderSync() {
  const items = useStore((s) => s.items);
  const reminders = useStore((s) => s.settings.reminders);
  const trial = useStore((s) => s.settings.trial);
  const hydrated = useStore((s) => s.hydrated);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // syncReminders reports its own failure (withErrorLogging), so these catches only stop an
  // unhandled rejection; the next change or return to the app tries again.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void syncReminders().catch(() => {}), 1500);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [items, reminders, trial]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void syncReminders().catch(() => {}));
    return () => sub.remove();
  }, []);
  // This runs outside PurchasesProvider, so it listens to the store itself. Like the provider's
  // listener, it can attach before RevenueCat is configured.
  useEffect(() => {
    if (purchasesUnavailableReason) return;
    const listener = (info: CustomerInfo) => {
      latestCustomerInfo = info;
      try { settleTrial(); } catch (failure) { reportError('reminders.trial', failure); }
    };
    Purchases.addCustomerInfoUpdateListener(listener);
    return () => { Purchases.removeCustomerInfoUpdateListener(listener); };
  }, []);
  // Not on `trial` changes: right after a purchase the kept answer can still be the one from
  // before it, and would clear the trial PlanPicker just recorded. The listener brings the new one.
  useEffect(() => { settleTrial(); }, [hydrated]);
}

/**
 * A tapped reminder opens what it is about: the item, Today for a summary, or the plan for the
 * trial reminder. Also when the tap launched the app, once the plan has loaded. Reminders
 * scheduled before `url` existed carry only `itemId`.
 */
export function useNotificationTaps(ready: boolean) {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (Platform.OS === 'web' || !ready || !response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    Notifications.clearLastNotificationResponse();
    const { settings, items } = useStore.getState();
    if (!settings.onboarded) return;
    const data = response.notification.request.content.data ?? {};
    const itemId = typeof data.itemId === 'string' ? data.itemId : null;
    const url = typeof data.url === 'string' ? data.url : itemId ? `/item/${itemId}` : '/';
    track('notification_opened', { kind: typeof data.kind === 'string' ? data.kind : 'test' });
    // Something deleted since the reminder was scheduled opens Today instead.
    if (url.startsWith('/item/') && !(itemId && items[itemId])) router.navigate('/');
    else if (url === '/') router.navigate('/');
    else router.push(url as never);
  }, [ready, response]);
}
