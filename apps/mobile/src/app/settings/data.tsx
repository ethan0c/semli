import { diffDays, formatTime, localParts, monthDay, relativeDay , count } from '@dayli/core';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { ListRow, StatusPill, TextButton } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { Group, Row } from '@/components/Settings';
import { T } from '@/components/Text';
import { eraseThisPhone } from '@/lib/auth-client';
import { buildBackup, buildIcs, shareText } from '@/lib/export';
import { friendlyError } from '@/lib/errors';
import { feedback } from '@/lib/feedback';
import { enter, exit, layout } from '@/lib/motion';
import { useNow } from '@/lib/now';
import { accountOf, useSession } from '@/lib/supabase';
import { useCourseList, useItemList, useScheduleList, useStore, type Batch } from '@/store';
import { THIS_DEVICE } from '@/lib/web';
import { testFortnight } from '@/store/sample';
import { EDIT_DAYS, IMPORT_DAYS, undoQuestion } from '@/store/undo';
import { useTheme, screen, space, size } from '@/theme';

const RECENT = 3;

/** "from a screenshot", "from a photo", "from a PDF", "from your message". */
function fromSource(source: string | null | undefined): string | null {
  if (!source) return null;
  const s = source.toLowerCase();
  if (s === 'screenshot') return 'from a screenshot';
  if (s === 'photo') return 'from a photo';
  if (s === 'message') return 'from your message';
  if (s === 'voice') return 'from your voice note';
  if (s.endsWith('.pdf')) return 'from a PDF';
  return `from ${source}`;
}

export default function DataScreen() {
  const { c } = useTheme();
  const now = useNow();
  const items = useItemList();
  const courses = useCourseList();
  const schedules = useScheduleList();
  const batches = useStore((s) => s.batches);
  const undoBatch = useStore((s) => s.undoBatch);
  const stored = { items: useStore((s) => s.items), series: useStore((s) => s.series), courses: useStore((s) => s.courses) };
  const setSettings = useStore((s) => s.setSettings);
  const applyPlan = useStore((s) => s.applyPlan);
  // Signed in, the account keeps the setup answers and only the plan is cleared; a guest starts over.
  const signedIn = useSession((s) => !!accountOf(s.session));
  const cloud = useStore((s) => s.settings.cloud);
  const backupStatus = cloud.error ? 'Backup needs attention' : cloud.backedUpAt ? 'Backed up to your account' : 'Backup pending';
  const [confirm, setConfirm] = useState(false);
  // The batch whose Undo was tapped, waiting on a second tap: an old import can hold weeks of work.
  const [undoing, setUndoing] = useState<string | null>(null);
  const [allChanges, setAllChanges] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [eraseError, setEraseError] = useState<string | null>(null);

  const jobs = useMemo(() => new Set(items.map((it) => it.employer?.trim().toLowerCase()).filter(Boolean)).size, [items]);
  const since = useMemo(() => items.map((it) => it.createdAt.slice(0, 10)).sort()[0], [items]);
  const summary = [
    `${count(courses.length, 'course')}`,
    `${count(jobs, 'job')}`,
    since ? `since ${monthDay(since)}` : null,
  ].filter(Boolean).join(' · ');

  const share = async (name: string, text: string, mime: string) => {
    feedback('tap');
    setExportError(null);
    try {
      const ok = await shareText(name, text, mime);
      if (!ok) setExportError('Sharing isn’t available on this device. Try again after updating Semli.');
    } catch (error) {
      setExportError(friendlyError(error, 'We couldn’t export your plan. Check that your device has free storage, then try again.', 'export.share'));
    }
  };
  const exportPlan = () => share('semli-plan.json', buildBackup({ items, courses, schedules, exportedAt: new Date().toISOString() }), 'application/json');
  // A guest's one destructive action. Signed in, the plan leaves this phone through Sign out or Delete account.
  const erase = async () => {
    setEraseError(null);
    try {
      await eraseThisPhone();
      setConfirm(false);
      if (router.canDismiss()) router.dismissAll();
      router.replace('/auth');
    } catch (error) {
      setEraseError(friendlyError(error, 'We couldn’t erase your plan. Check your connection and try again.', 'data.erase'));
    }
  };
  const exportCalendar = () => share('semli.ics', buildIcs(items, courses), 'text/calendar');

  const whenLabel = (b: Batch) => {
    const at = localParts(new Date(b.createdAt));
    const day = Math.abs(diffDays(at.date, now.date)) <= 1 ? relativeDay(now.date, at.date) : monthDay(at.date);
    return [`${day}, ${formatTime(at.time)}`, fromSource(b.source) ?? (b.changes.length > 1 ? `${b.changes.length} changes` : null)].filter(Boolean).join(' · ');
  };
  const shown = allChanges ? batches : batches.slice(0, RECENT);
  const rest = batches.length - RECENT;

  const batchRow = (b: Batch, last: boolean) => (
    <Animated.View key={b.id} layout={layout} entering={enter.fade} exiting={exit.fade}>
      <ListRow title={b.label} sub={whenLabel(b)} last={last} chevron={false} onPress={() => router.push(`/import/${b.id}`)}
        accessibilityLabel={`${b.label}, ${whenLabel(b)}${b.undone ? ', undone' : ''}`}
        trailing={b.undone
          ? <StatusPill label="Undone" />
          : b.changes.length > 0 || b.workDatesBefore ? <TextButton label="Undo" haptic="tap" onPress={() => setUndoing(undoing === b.id ? null : b.id)} accessibilityLabel={`Undo ${b.label}`} /> : null} />
      {undoing === b.id && !b.undone ? (
        <Animated.View entering={enter.drop} exiting={exit.fade} style={styles.confirm} accessibilityRole="alert">
          <T token="callout" color={c.inkSecondary} style={{ flexBasis: '100%' }}>{undoQuestion(b, stored.items, stored.series, stored.courses)}</T>
          <TextButton label="Cancel" tone="muted" onPress={() => setUndoing(null)} />
          <TextButton label="Undo" tone="danger" haptic="undo" onPress={() => { undoBatch(b.id); setUndoing(null); }} />
        </Animated.View>
      ) : null}
    </Animated.View>
  );

  return (
    <ScrollView contentContainerStyle={styles.body} contentInsetAdjustmentBehavior="automatic">
      <View style={styles.top}>
        <T token="callout" color={c.inkSecondary}>{signedIn ? backupStatus : `Saved on ${THIS_DEVICE}`}</T>
        <T token="displayXl" tabular>{`${count(items.length, 'item')}`}</T>
        <T token="lead" style={styles.line}>{summary}</T>
      </View>

      <Group title="Export" footer={exportError ?? undefined}>
        <ListRow title="Export my plan" sub="A copy of your plan as a file" onPress={() => void exportPlan()} />
        <ListRow title="Add to Calendar" sub="Export events to Apple or Google Calendar" onPress={() => void exportCalendar()} last />
      </Group>

      <Group title="Recent changes" footer={batches.length ? `Edits can be undone for ${EDIT_DAYS} days, imports for ${IMPORT_DAYS}.` : undefined}>
        {batches.length === 0 ? (
          <View style={styles.empty}>
            <T token="callout" color={c.inkSecondary}>Your imports and edits will appear here, with options to undo recent changes.</T>
          </View>
        ) : (
          <Animated.View layout={layout}>
            {shown.map((b, i) => batchRow(b, i === shown.length - 1))}
            {rest > 0 ? (
              <Pressable accessibilityRole="button" accessibilityState={{ expanded: allChanges }} onPress={() => { feedback('select'); setAllChanges((o) => !o); }} style={styles.disclosure}>
                <T token="caption" color={c.inkSecondary}>{allChanges ? 'Fewer changes' : `All ${batches.length} changes`}</T>
                <Icon name={allChanges ? 'chevronLeft' : 'chevronRight'} size={16} color={c.inkSecondary} />
              </Pressable>
            ) : null}
          </Animated.View>
        )}
      </Group>

      {__DEV__ ? (
        <Group title="Development" footer="Two weeks of classes, shifts and deadlines from today, as one import. Undo it from Recent changes.">
          <Row label="Fill the next two weeks" onPress={() => { const t = testFortnight(now.date); applyPlan(t.plan, 'Test data · next two weeks', { source: 'Test data', courses: t.courses }); feedback('success'); }} last />
        </Group>
      ) : null}

      <Group title="Reset" footer={signedIn ? `To remove your plan from ${THIS_DEVICE} while keeping your account backup, sign out in Account settings.` : eraseError ?? 'Semli can’t read an exported file back in yet. To move your plan to another device, sign in instead.'}>
        <Row label="Replay the intro" value="Keeps everything" onPress={() => { feedback('tap'); setSettings({ onboarded: false, onboardingImportDone: false }); router.dismissTo('/'); }} last={signedIn} />
        {signedIn ? null : confirm ? (
          <Animated.View entering={enter.drop} exiting={exit.fade} style={styles.confirm} accessibilityRole="alert">
            <T token="callout" color={c.inkSecondary} style={{ flexBasis: '100%' }}>{`Erase your plan? Your courses, tasks and setup will be removed from ${THIS_DEVICE}. This can’t be undone.`}</T>
            <TextButton label="Export first" onPress={() => void exportPlan()} />
            <TextButton label="Cancel" tone="muted" onPress={() => setConfirm(false)} />
            <TextButton label="Erase" tone="danger" haptic="warning" onPress={() => void erase()} />
          </Animated.View>
        ) : (
          <Row label="Erase plan" destructive onPress={() => { feedback('tap'); setConfirm(true); }} last />
        )}
      </Group>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: screen.settingsBody,
  top: { gap: space.hair },
  line: { paddingTop: space.snug },
  empty: { paddingVertical: space.md },
  disclosure: { minHeight: size.target, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  confirm: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm, minHeight: 52, paddingVertical: space.xxs },
});
