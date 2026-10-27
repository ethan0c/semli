import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { TextButton } from '@/components/Controls';
import { T } from '@/components/Text';
import { disableRingingAlarms, enableRingingAlarms, syncRingingAlarms, useAlarmState } from '@/lib/alarms';
import { openSystemSettings } from '@/lib/links';
import { friendlyError } from '@/lib/errors';
import { usePlusAccess } from '@/lib/plus-access';
import { usePurchases } from '@/providers/PurchasesProvider';
import { useStore } from '@/store';
import { useTheme, space } from '@/theme';

export function RingingAlarmInfo({ timed = true, itemID, draft = false, settings = false }: {
  timed?: boolean; itemID?: string; draft?: boolean; settings?: boolean;
}) {
  const { c } = useTheme();
  const { isPlus } = usePurchases();
  const { requirePlus } = usePlusAccess();
  const state = useAlarmState();
  const enabled = useStore((s) => !!s.settings.reminders.urgentAlarmsEnabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void syncRingingAlarms().catch(() => {}); }, []);
  const unavailable = state.syncing || state.authorization === 'checking' || state.authorization === 'unsupported' || state.authorization === 'needs-build';
  const armed = itemID && state.scheduledIDs.includes(itemID);
  const message = !isPlus ? 'Urgent items ring like an alarm, even when Semli is closed. That is part of Semli Plus.'
    : !timed ? 'Add a time to set a ringing alarm.'
    : state.syncing ? 'Updating ringing alarms…'
    : state.authorization === 'checking' ? 'Checking ringing alarm access…'
    : state.authorization === 'needs-build' ? 'Update Semli to use ringing alarms. This item is still marked urgent.'
    : state.authorization === 'unsupported' ? (Platform.OS === 'web' ? 'Urgent items ring on your iPhone, with iOS 26 or later. Mark them urgent here and the alarm is set there.' : 'Ringing alarms are available on iOS 26 or later. Urgent labels and standard reminders still work.')
    : state.authorization === 'denied' ? 'Allow Alarms for Semli in system Settings to enable ringing alarms.'
    : !enabled || state.authorization !== 'authorized' ? 'Enable ringing alarms to ring at the time of urgent events and to-dos. Stop the alarm from the system alarm screen.'
    : settings ? 'Ringing alarms are on for timed urgent items. They work separately from ordinary reminders. The nearest 32 alarms are kept scheduled.'
    : draft ? 'Saving this timed urgent item will set a ringing alarm.'
    : armed ? 'Ringing alarm set. Use Stop on the system alarm screen to dismiss it.'
    : 'No ringing alarm is set for this item. Check that its time is in the future, or try again.';

  async function act() {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      // A purchase on the paywall carries on to the enable it was opened for (Oct 27, 2026),
      // instead of returning to this row for a second tap.
      if (!isPlus && !(await requirePlus('urgent', { onError: setError }))) return;
      if (!isPlus) await enableRingingAlarms();
      else if (state.error) await syncRingingAlarms();
      else if (state.authorization === 'denied') { if (!(await openSystemSettings())) setError('Open Settings → Semli → Alarms.'); }
      else if (enabled && settings) await disableRingingAlarms();
      else if (enabled && state.authorization === 'authorized') await syncRingingAlarms();
      else await enableRingingAlarms();
    } catch (failure) { setError(friendlyError(failure, 'We couldn’t update ringing alarms. Please try again.', 'alarms.update')); }
    finally { setBusy(false); }
  }
  return <View style={{ gap: space.snug, paddingVertical: space.sm }}>
    <T token="caption" color={c.inkSecondary}>{message}</T>
    {state.error || error ? <T token="caption" color={c.conflict} accessibilityRole="alert">{error ?? state.error}</T> : null}
    {!isPlus ? <TextButton label={busy ? 'One moment…' : 'Get Semli Plus'} onPress={() => void act()} tone="muted" style={{ alignSelf: 'flex-start' }} />
    : !unavailable && timed && (!draft || !enabled || state.authorization !== 'authorized') && (!armed || settings || !enabled) ? <TextButton
      label={busy ? 'One moment…' : state.error ? 'Retry alarm setup' : state.authorization === 'denied' ? 'Open alarm settings' : enabled && settings ? 'Turn off ringing alarms' : enabled ? 'Retry alarm setup' : 'Enable ringing alarms'}
      onPress={() => void act()} tone="muted" style={{ alignSelf: 'flex-start' }} /> : null}
  </View>;
}
