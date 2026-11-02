import { diffDays, formatTime, localParts, monthDay, relativeDay } from '@dayli/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Chip, ListRow } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { FieldRow, Group, Row } from '@/components/Settings';
import { Button } from '@/components/Sheet';
import { T } from '@/components/Text';
import { feedback } from '@/lib/feedback';
import { enter, exit, layout } from '@/lib/motion';
import { useNow } from '@/lib/now';
import { usePlusAccess } from '@/lib/plus-access';
import { WORK_STEPS, WORK_SYSTEMS, normalizeWorkFeedUrl, type WorkSystem } from '@/lib/work-feed';
import { syncWorkFeed } from '@/lib/work-feed-sync';
import { usePurchases } from '@/providers/PurchasesProvider';
import { useItemList, useStore } from '@/store';
import { useTheme, screen, space } from '@/theme';

/**
 * A job's schedule through its calendar link. The fallback for a job with no link (Krowd,
 * Starbucks, Walmart) is the screenshot import and its schedule comparison.
 */
export default function WorkScheduleScreen() {
  const { c } = useTheme();
  const now = useNow();
  const work = useStore((s) => s.settings.workFeed);
  const setSettings = useStore((s) => s.setSettings);
  const { requirePlus } = usePlusAccess();
  const { isPlus } = usePurchases();
  const synced = useItemList().filter((i) => i.externalId?.startsWith('work:')).length;
  const [link, setLink] = useState('');
  const [employer, setEmployer] = useState(work.employer ?? '');
  const [system, setSystem] = useState<WorkSystem>('wheniwork');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connected = !!work.feedUrl;
  // A sync already happened on this phone, so the free one is used: connecting again is Plus.
  const freeSyncUsed = !!work.lastSyncedAt;

  const connect = async () => {
    const parsed = normalizeWorkFeedUrl(link);
    if (!parsed.ok) { feedback('error'); setError(parsed.error); return; }
    setError(null);
    setBusy(true);
    try {
      if (freeSyncUsed && !(await requirePlus('work_feed', { onError: setError }))) return;
      const res = await syncWorkFeed({ url: parsed.url, employer: employer.trim() });
      if (!res.ok) { feedback('error'); setError(res.error); return; }
      feedback('ready');
      setLink('');
    } finally {
      setBusy(false);
    }
  };

  const setLastError = (lastError: string) => setSettings({ workFeed: { ...useStore.getState().settings.workFeed, lastError } });
  const syncNow = async () => {
    setBusy(true);
    try {
      if (!(await requirePlus('work_feed', { onError: setLastError }))) return;
      await syncWorkFeed();
    } finally {
      setBusy(false);
    }
  };

  // Keeps `lastSyncedAt`: it is the record that the free first sync was used.
  const disconnect = () => {
    feedback('tap');
    setSettings({ workFeed: { ...useStore.getState().settings.workFeed, feedUrl: null, lastError: null } });
    useStore.getState().showToast(`${work.employer ?? 'Work schedule'} disconnected. Your shifts are still in your plan.`);
  };

  const syncedLabel = (() => {
    if (busy) return 'Syncing…';
    if (!work.lastSyncedAt) return 'Not synced yet';
    const at = localParts(new Date(work.lastSyncedAt));
    const day = Math.abs(diffDays(at.date, now.date)) <= 1 ? relativeDay(now.date, at.date) : monthDay(at.date);
    return `Synced ${day.toLowerCase()}, ${formatTime(at.time)}`;
  })();

  const fallback = (
    <Group title="No calendar link?" footer="Many jobs, like Olive Garden’s Krowd, Starbucks and Walmart, don’t offer one. Screenshot your schedule instead; Semli compares each new one with your saved shifts.">
      <ListRow leading={<Icon name="image" size={20} color={c.inkPrimary} />} title="Screenshot your schedule"
        sub="Uses one import" last onPress={() => router.navigate({ pathname: '/add', params: { source: 'image', at: String(Date.now()) } })} />
    </Group>
  );

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic">
      {connected ? (
        <Animated.View key="on" layout={layout} entering={enter.fade} exiting={exit.fade} style={styles.stack}>
          <View style={styles.top}>
            <T token="callout" color={c.inkSecondary}>{syncedLabel}</T>
            <T token="displayXl" tabular>{`${synced} ${synced === 1 ? 'shift' : 'shifts'}`}</T>
            <T token="lead" color={c.inkSecondary} style={styles.line}>{isPlus
              ? `Semli checks ${work.employer} for schedule changes when you open the app. Shifts you moved by hand stay where you put them.`
              : `Your ${work.employer} shifts are imported. Automatic updates require Semli Plus.`}</T>
          </View>
          {work.lastError ? (
            <View accessibilityRole="alert" style={styles.status}>
              <Icon name="alert" size={16} color={c.conflict} />
              <T token="subhead" color={c.conflict} style={{ flex: 1 }}>{work.lastError}</T>
            </View>
          ) : null}
          <Group footer="Disconnecting keeps every shift already in your plan.">
            <Row label={isPlus ? 'Sync now' : 'Keep it in sync with Plus'} onPress={busy ? undefined : () => void syncNow()} />
            <Row label="Disconnect" destructive onPress={disconnect} last />
          </Group>
          {work.lastError ? fallback : null}
        </Animated.View>
      ) : (
        <Animated.View key="off" layout={layout} entering={enter.fade} exiting={exit.fade} style={styles.stack}>
          <View style={styles.top}>
            <T token="display" accessibilityRole="header">Connect your work schedule</T>
            <T token="lead" color={c.inkSecondary} style={styles.line}>{freeSyncUsed && !isPlus
              ? 'You’ve used your free schedule import. Reconnect with Semli Plus to keep your shifts up to date.'
              : 'If your job uses When I Work, 7shifts, When to Work or another app with a calendar link, your shifts can come in on their own. Your first import is free. Plus keeps it in sync.'}</T>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            {WORK_SYSTEMS.map((s) => <Chip key={s.id} label={s.label} on={system === s.id} onPress={() => { setSystem(s.id); setError(null); }} />)}
          </View>
          <Group title="Paste your schedule link" footer={`${WORK_STEPS[system].join(' ')} Semli reads your schedule without changing it.`}>
            <FieldRow label="Job" value={employer} onChange={(v) => { setEmployer(v); setError(null); }} placeholder="Campus Rec" />
            <FieldRow label="Calendar link" value={link} onChange={(v) => { setLink(v); setError(null); }} placeholder="https://… or webcal://…" last />
          </Group>
          {error ? (
            <Animated.View entering={enter.drop} exiting={exit.fade} accessibilityRole="alert" style={styles.status}>
              <Icon name="alert" size={16} color={c.conflict} />
              <T token="subhead" color={c.conflict} style={{ flex: 1 }}>{error}</T>
            </Animated.View>
          ) : null}
          <Button label={busy ? 'Connecting…' : freeSyncUsed && !isPlus ? 'Reconnect with Plus' : 'Connect schedule'}
            disabled={busy || !link.trim() || !employer.trim()} onPress={() => void connect()} />
          {fallback}
        </Animated.View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { ...screen.settingsBody, gap: 0 },
  stack: { gap: space.xl },
  top: { gap: space.hair },
  line: { paddingTop: space.snug },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xxs },
});
