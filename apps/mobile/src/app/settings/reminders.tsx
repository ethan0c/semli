import { useEffect, useState } from 'react';
import { AppState, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { TimeField } from '@/components/Native';
import { Segmented } from '@/components/Segmented';
import { Group, Row, ToggleRow } from '@/components/Settings';
import { RingingAlarmInfo } from '@/components/RingingAlarmInfo';
import { T } from '@/components/Text';
import { track } from '@/lib/analytics';
import { feedback } from '@/lib/feedback';
import { friendlyError } from '@/lib/errors';
import { openSystemSettings } from '@/lib/links';
import { notificationPermission, notificationsAllowed, requestNotifications, sendTestNotification, syncReminders } from '@/lib/notifications';
import type { ReminderPrefs } from '@/lib/reminder-plan';
import { useStore } from '@/store';
import { useTheme, screen, space } from '@/theme';

type LeadKey = '10' | '30' | '60';
const LEADS: { key: LeadKey; label: string }[] = [
  { key: '10', label: '10 min' },
  { key: '30', label: '30 min' },
  { key: '60', label: '1 hour' },
];

/** Reminders ring on the iPhone; on the web these settings are edited for it. */
const WEB = Platform.OS === 'web';

export default function RemindersScreen() {
  const { c } = useTheme();
  const prefs = useStore((s) => s.settings.reminders);
  const setSettings = useStore((s) => s.setSettings);
  const [allowed, setAllowed] = useState<boolean | null>(WEB ? true : null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const failed = (failure: unknown) => setError(friendlyError(failure, 'We couldn’t update your reminders. Please try again.', 'reminders.settings'));

  // Re-check when the app comes back, since the user may have changed it in iOS Settings.
  useEffect(() => {
    if (WEB) return;
    const check = () => void notificationsAllowed().then(setAllowed).catch((failure: unknown) => setError(friendlyError(failure, 'We couldn’t check reminder permission. Please try again.', 'reminders.check_permission')));
    check();
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') check(); });
    return () => sub.remove();
  }, []);

  const update = (patch: Partial<ReminderPrefs>) => {
    setSettings({ reminders: { ...prefs, ...patch } });
    track('reminders_changed', { enabled: patch.enabled ?? prefs.enabled, briefing: patch.briefing ?? prefs.briefing });
  };

  /**
   * Ask the system if we still can; otherwise send them to iOS Settings, which is the only place
   * left to allow it. Settings opens only when it was blocked before this tap (Oct 27, 2026): a
   * "Don't Allow" just now is an answer, and jumping to Settings on top of it overrides it.
   */
  const ensureAllowed = async (): Promise<boolean> => {
    try {
      const before = await notificationPermission();
      const ok = await requestNotifications();
      setAllowed(ok);
      if (!ok && before === 'blocked' && !(await openSystemSettings())) setError('Open your device Settings, choose Semli, then allow Notifications.');
      return ok;
    } catch (failure) { failed(failure); return false; }
  };

  const enable = async () => {
    setError(null);
    try {
      if (await ensureAllowed()) { update({ enabled: true }); await syncReminders(); }
    } catch (failure) { failed(failure); }
  };

  const toggle = (key: 'enabled' | 'briefing') => async (on: boolean) => {
    feedback('select');
    if (on && !WEB && !(await ensureAllowed())) return;
    update({ [key]: on });
    if (key === 'briefing') track('briefing_changed', { briefing: on });
    setError(null);
    try { await syncReminders(); } catch (failure) { failed(failure); }
  };

  const hairline = { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line };

  const timeRow = (label: string, key: keyof Pick<ReminderPrefs, 'dayBeforeAt' | 'morningAt' | 'quietStart' | 'quietEnd' | 'briefingAt'>, last = false) => (
    <View style={[styles.row, !last ? hairline : null]}>
      <T style={{ flex: 1 }}>{label}</T>
      <TimeField date={null} time={prefs[key]} onChange={(v) => v && update({ [key]: v } as Partial<ReminderPrefs>)} />
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.body} contentInsetAdjustmentBehavior="automatic">
      {error ? <Group footer={error}><Row label="Retry reminder setup" onPress={() => { void syncReminders().then(() => setError(null)).catch(failed); }} last /></Group> : null}
      {WEB ? <T token="callout" color={c.inkSecondary}>Reminders ring on your iPhone. Changes you make here apply there.</T> : null}
      {allowed === false ? (
        <Group footer="Allow notifications to receive reminders on this iPhone. If prompted, enable them in Settings → Semli → Notifications.">
          <Row label="Turn on reminders" onPress={() => void enable()} last />
        </Group>
      ) : null}

      <Group title="Event and deadline reminders" footer="Repeating classes stay quiet unless you turn on class reminders. Deadlines due on the same day are grouped together.">
        <ToggleRow label="Reminders" value={prefs.enabled && allowed !== false} onChange={(on) => void toggle('enabled')(on)} />
        <ToggleRow label="Before each class" value={!!prefs.classReminders} onChange={(on) => { feedback('select'); update({ classReminders: on }); }} />
        <View style={[styles.row, hairline]}>
          <T style={{ flex: 1 }}>Before an event</T>
          <View style={styles.segment}>
            <Segmented
              size="small"
              tick={false}
              label="Before an event"
              options={LEADS}
              value={String(prefs.eventLead) as LeadKey}
              onChange={(key) => update({ eventLead: Number(key) as ReminderPrefs['eventLead'] })}
            />
          </View>
        </View>
        <ToggleRow label="Evening before a deadline" value={prefs.dayBefore !== false} onChange={(on) => { feedback('select'); update({ dayBefore: on }); }} />
        {prefs.dayBefore !== false ? timeRow('At', 'dayBeforeAt') : null}
        <ToggleRow label="Morning of a deadline" value={prefs.morning !== false} last={prefs.morning === false} onChange={(on) => { feedback('select'); update({ morning: on }); }} />
        {prefs.morning !== false ? timeRow('At', 'morningAt', true) : null}
      </Group>

      <Group title="Quiet hours" footer="Event reminders and evening deadline reminders wait until quiet hours end, unless that would be too late. Choose your morning reminder and daily summary times separately.">
        {timeRow('From', 'quietStart')}
        {timeRow('Until', 'quietEnd', true)}
      </Group>

      <Group title="Daily summary" footer="Today’s plans, what’s due, and the next deadline within three days. When the summary arrives before a deadline, it replaces that morning’s deadline reminder. Nothing scheduled? No summary.">
        <ToggleRow label="Daily summary" value={prefs.briefing && allowed !== false} onChange={(on) => void toggle('briefing')(on)} />
        {timeRow('At', 'briefingAt', true)}
      </Group>

      <Group title="Urgent ringing alarms" footer="Part of Semli Plus. Standard reminders are always free.">
        <RingingAlarmInfo settings />
      </Group>

      {WEB ? null : <Group footer={sent ? 'Test reminder scheduled for five seconds from now.' : undefined}>
        <Row
          label={sending ? 'Sending…' : 'Send a test reminder'}
          onPress={sending ? undefined : () => {
            feedback('tap');
            setSent(false); setError(null); setSending(true);
            void (async () => {
              try { if (await ensureAllowed()) { await sendTestNotification(); setSent(true); } }
              catch (failure) { setError(friendlyError(failure, 'We couldn’t send a test reminder. Please try again.', 'reminders.send_test')); }
              finally { setSending(false); }
            })();
          }}
          last
        />
      </Group>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: screen.settingsBody,
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 52, paddingVertical: space.snug },
  segment: { width: 212 },
});
