import { diffDays, formatRange, monthDay, movableOverlap, weekdayShort, type MovableOverlap } from '@dayli/core';
import type { Item } from '@dayli/schema';
import { router } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { GroupLabel, TextButton } from '@/components/Controls';
import { T } from '@/components/Text';
import { profile, track } from '@/lib/analytics';
import { enter, exit, layout } from '@/lib/motion';
import { usePurchases } from '@/providers/PurchasesProvider';
import { useStore, type FirstKind } from '@/store';
import { useTheme, space } from '@/theme';

/**
 * Firsts: things Semli explains once, the first time they happen in a person's own plan, in
 * place of a tour. Each note names the real thing, says what Semli does about it, and opens
 * the screen where that already works. Seen once (either button), it never returns.
 */
export function FirstNote({ kind, label, body, detail, action, onAction, dismiss = 'Got it' }: {
  kind: FirstKind; label: string; body: string; detail: string; action: string; onAction: () => void; dismiss?: string;
}) {
  const { c } = useTheme();
  const { isPlus } = usePurchases();
  const setSettings = useStore((s) => s.setSettings);
  useEffect(() => { track('first_note', { kind, action: 'shown' }); }, [kind]);
  const seen = (action: 'opened' | 'dismissed') => {
    track('first_note', { kind, action, pro: isPlus });
    setSettings({ firsts: { ...useStore.getState().settings.firsts, [kind]: true } });
  };
  return (
    <View style={styles.root} accessibilityRole="summary">
      <GroupLabel>{label}</GroupLabel>
      <T token="body">{body}</T>
      <T token="callout" color={c.inkSecondary}>{detail}</T>
      <View style={styles.actions}>
        <TextButton label={action} onPress={() => { seen('opened'); onAction(); }} />
        <TextButton label={dismiss} tone="muted" onPress={() => seen('dismissed')} />
      </View>
    </View>
  );
}

const when = (date: string, today: string) => date === today ? 'today' : diffDays(today, date) === 1 ? 'tomorrow' : `${weekdayShort(date)}, ${monthDay(date)}`;

/** The first overlap Semli could resolve: it keeps the plan that can't move and moves the one that can. */
export function FirstOverlap({ overlap, today }: { overlap: MovableOverlap; today: string }) {
  const { isPlus } = usePurchases();
  const { flexible, other } = overlap;
  const time = flexible.start && flexible.end ? ` (${formatRange(flexible.start, flexible.end)})` : '';
  return (
    <FirstNote kind="overlap" label="Overlapping events"
      body={`${flexible.title} overlaps ${other.title} ${when(flexible.date, today)}${time}.`}
      detail={isPlus
        ? `Review a suggested time for ${flexible.title}. ${other.title} will stay at its current time.`
        : `With Plus, review a suggested time for ${flexible.title}. ${other.title} will stay at its current time.`}
      action="Review overlap" onAction={() => router.push(`/item/${flexible.id}`)} />
  );
}

/** The first deadline inside two days: where the Urgent switch is, and what it does. */
export function FirstUrgent({ item, today }: { item: Item; today: string }) {
  const { isPlus } = usePurchases();
  return (
    <FirstNote kind="urgent" label="Due soon"
      body={`${item.title} is due ${when(item.date, today)}.`}
      detail={isPlus
        ? 'To set an alarm, open this item, add a time and turn on Urgent. Alarm permission is required.'
        : 'Plus includes alarms for urgent items. Open this item to see the options. Standard reminders are free.'}
      action="Open item" onAction={() => router.push(`/item/${item.id}`)} />
  );
}

/** Picked Canvas in setup but never connected it. Once, not every morning. */
export function FirstCanvas() {
  return (
    <FirstNote kind="canvas" label="Class calendar"
      body="Bring your class due dates into Semli."
      detail="Connect Canvas or Brightspace, including eLC. The first import is free; Plus keeps it in sync."
      action="Connect calendar" onAction={() => router.push('/settings/canvas')} dismiss="Not now" />
  );
}

/** The first busy day on the list view: the toggle to the day by the hour is an icon, so say it once. */
export function FirstHours({ timed }: { timed: number }) {
  const setSettings = useStore((s) => s.setSettings);
  return (
    <FirstNote kind="hours" label="Today’s events"
      body={`${timed} timed events today.`}
      detail="Switch to the hourly view to see gaps and overlapping events. Use the button at the top to switch back."
      action="Show hourly view" onAction={() => { setSettings({ todayView: 'hours' }); track('today_view_changed', { view: 'hours', timed, source: 'first' }); profile({ today_view: 'hours', today_view_source: 'first' }); }} />
  );
}

/** At most one note on Today at a time: the overlap first, then a close deadline, then Canvas, then the hour view. */
export function TodayFirst({ items, now, timedToday, style }: { items: Item[]; now: { date: string; time: string }; timedToday: number; style?: StyleProp<ViewStyle> }) {
  const firsts = useStore((s) => s.settings.firsts);
  const todayView = useStore((s) => s.settings.todayView);
  const lms = useStore((s) => s.settings.lms);
  const canvasConnected = useStore((s) => !!s.settings.canvas.feedUrl);
  const overlap = useMemo(() => (firsts.overlap ? null : movableOverlap(items, now)), [firsts.overlap, items, now]);
  const deadline = useMemo(() => firsts.urgent ? null : items
    .filter((item) => item.isDeadline && !item.done && !item.urgent && item.date >= now.date && diffDays(now.date, item.date) <= 2)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? ''))[0] ?? null, [firsts.urgent, items, now.date]);
  const note = overlap ? <FirstOverlap overlap={overlap} today={now.date} />
    : deadline ? <FirstUrgent item={deadline} today={now.date} />
    : !firsts.canvas && lms === 'canvas' && !canvasConnected ? <FirstCanvas />
    : !firsts.hours && todayView === 'list' && timedToday >= 3 ? <FirstHours timed={timedToday} />
    : null;
  if (!note) return null;
  return <Animated.View layout={layout} entering={enter.fade} exiting={exit.fade} style={style}>{note}</Animated.View>;
}

const styles = StyleSheet.create({
  root: { gap: space.snug },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingTop: space.xxs },
});
