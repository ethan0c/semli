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
import { CANVAS_MESSAGES, FEED_PLACEHOLDER, FEED_STEPS, feedName, normalizeFeedUrl, type FeedSystem } from '@/lib/canvas';
import { syncCanvas } from '@/lib/canvas-sync';
import { feedback } from '@/lib/feedback';
import { enter, exit, layout } from '@/lib/motion';
import { useNow } from '@/lib/now';
import { usePlusAccess } from '@/lib/plus-access';
import { usePurchases } from '@/providers/PurchasesProvider';
import { useItemList, useStore } from '@/store';
import { useTheme, screen, space } from '@/theme';

/**
 * Canvas through its calendar feed link. The fallback for a school that hides the feed is the
 * import that already exists: a screenshot of the Canvas to-do list, or the syllabus PDF.
 */
export default function CanvasScreen() {
  const { c } = useTheme();
  const now = useNow();
  const canvas = useStore((s) => s.settings.canvas);
  const setSettings = useStore((s) => s.setSettings);
  const { requirePlus } = usePlusAccess();
  const { isPlus } = usePurchases();
  const synced = useItemList().filter((i) => i.externalId?.startsWith('canvas:')).length;
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const connected = !!canvas.feedUrl;
  // Canvas or Brightspace (UGA's eLC): the connected one names itself; the connect form asks which.
  const [system, setSystem] = useState<FeedSystem>('canvas');
  const name = connected ? feedName(canvas.feedUrl) : system === 'canvas' ? 'Canvas' : 'eLC or Brightspace';
  // A sync already happened on this phone, so the free one is used: connecting again is Plus.
  const freeSyncUsed = !!canvas.lastSyncedAt;

  const connect = async () => {
    const url = normalizeFeedUrl(link);
    if (!url) { feedback('error'); setError(CANVAS_MESSAGES.link); return; }
    setError(null);
    setBusy(true);
    try {
      // Disconnect then Connect was a free sync every time (Oct 27, 2026); only the first is free.
      if (freeSyncUsed && !(await requirePlus('canvas', { onError: setError }))) return;
      const res = await syncCanvas(url);
      if (!res.ok) { feedback('error'); setError(res.error); return; }
      feedback('ready');
      setLink('');
    } finally {
      setBusy(false);
    }
  };

  // The first sync is free; later ones are Plus.
  const setLastError = (lastError: string) => setSettings({ canvas: { ...useStore.getState().settings.canvas, lastError } });
  const syncNow = async () => {
    setBusy(true);
    try {
      if (!(await requirePlus('canvas', { onError: setLastError }))) return;
      await syncCanvas();
    } finally {
      setBusy(false);
    }
  };

  // Keeps `lastSyncedAt`: it is the record that the free first sync was used, and it outlives the link.
  const disconnect = () => {
    feedback('tap');
    setSettings({ canvas: { ...useStore.getState().settings.canvas, feedUrl: null, lastError: null } });
    useStore.getState().showToast(`${feedName(canvas.feedUrl)} disconnected. Your imported dates are still in your plan.`);
  };

  const syncedLabel = (() => {
    if (busy) return 'Syncing…';
    if (!canvas.lastSyncedAt) return 'Not synced yet';
    const at = localParts(new Date(canvas.lastSyncedAt));
    const day = Math.abs(diffDays(at.date, now.date)) <= 1 ? relativeDay(now.date, at.date) : monthDay(at.date);
    return `Synced ${day.toLowerCase()}, ${formatTime(at.time)}`;
  })();

  const fallback = (
    <Group title="Can’t find the calendar link?" footer="If your school doesn’t offer a calendar link, try a screenshot or syllabus PDF. Each uses one import.">
      <ListRow leading={<Icon name="image" size={20} color={c.inkPrimary} />} title="Screenshot your to-do list"
        sub="Semli reads the due dates from it" onPress={() => router.navigate({ pathname: '/add', params: { source: 'image', at: String(Date.now()) } })} />
      <ListRow leading={<Icon name="file" size={20} color={c.inkPrimary} />} title="Upload the syllabus PDF"
        sub="Import exams and due dates from your syllabus" last onPress={() => router.navigate({ pathname: '/add', params: { source: 'file', at: String(Date.now()) } })} />
    </Group>
  );

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic">
      {connected ? (
        <Animated.View key="on" layout={layout} entering={enter.fade} exiting={exit.fade} style={styles.stack}>
          <View style={styles.top}>
            <T token="callout" color={c.inkSecondary}>{syncedLabel}</T>
            <T token="displayXl" tabular>{`${synced} from ${name}`}</T>
            <T token="lead" color={c.inkSecondary} style={styles.line}>{isPlus
              ? `Semli checks for ${name} updates when you open the app. Completed items stay completed.`
              : `Your ${name} due dates are imported. Automatic updates require Semli Plus.`}</T>
          </View>
          {canvas.lastError ? (
            <View accessibilityRole="alert" style={styles.status}>
              <Icon name="alert" size={16} color={c.conflict} />
              <T token="subhead" color={c.conflict} style={{ flex: 1 }}>{canvas.lastError}</T>
            </View>
          ) : null}
          <Group footer="Disconnecting keeps everything already in your plan.">
            <Row label={isPlus ? 'Sync now' : 'Keep it in sync with Plus'} onPress={busy ? undefined : () => void syncNow()} />
            <Row label="Disconnect" destructive onPress={disconnect} last />
          </Group>
          {canvas.lastError ? fallback : null}
        </Animated.View>
      ) : (
        <Animated.View key="off" layout={layout} entering={enter.fade} exiting={exit.fade} style={styles.stack}>
          <View style={styles.top}>
            <T token="display" accessibilityRole="header">Connect your class calendar</T>
            <T token="lead" color={c.inkSecondary} style={styles.line}>{freeSyncUsed && !isPlus
              ? 'You’ve used your free calendar import. Reconnect with Semli Plus to keep your due dates up to date.'
              : 'Add due dates from Canvas or Brightspace, including eLC. Your first calendar import is free. Plus keeps it in sync.'}</T>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
            <Chip label="Canvas" on={system === 'canvas'} onPress={() => { setSystem('canvas'); setError(null); }} />
            <Chip label="Brightspace (eLC)" on={system === 'brightspace'} onPress={() => { setSystem('brightspace'); setError(null); }} />
          </View>
          <Group title="Paste your calendar link"
            footer={`${FEED_STEPS[system].join(' ')} Semli reads your calendar without changing it.`}>
            <FieldRow label="Calendar link" value={link} onChange={(v) => { setLink(v); setError(null); }} placeholder={FEED_PLACEHOLDER[system]} last />
          </Group>
          {error ? (
            <Animated.View entering={enter.drop} exiting={exit.fade} accessibilityRole="alert" style={styles.status}>
              <Icon name="alert" size={16} color={c.conflict} />
              <T token="subhead" color={c.conflict} style={{ flex: 1 }}>{error}</T>
            </Animated.View>
          ) : null}
          <Button label={busy ? 'Connecting…' : freeSyncUsed && !isPlus ? 'Reconnect with Plus' : 'Connect calendar'} disabled={busy || !link.trim()} onPress={() => void connect()} />
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
