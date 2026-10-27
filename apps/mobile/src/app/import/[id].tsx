import { dateLocale, formatTime, localParts, monthDay, weekdayShort , count } from '@dayli/core';
import type { Item } from '@dayli/schema';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { SectionTitle, StatusPill, TextButton, type PillTone } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { Sheet } from '@/components/Sheet';
import { T } from '@/components/Text';
import { compactRange } from '@/components/WeekChart';
import { PressRow } from '@/components/Press';
import { feedback } from '@/lib/feedback';
import { enter, exit, layout } from '@/lib/motion';
import { useStore, type Change } from '@/store';
import { undoQuestion } from '@/store/undo';
import { SCREEN_GUTTER, corner, radius, useTheme, screen, size, space } from '@/theme';

const isShot = (source: string | null | undefined) => /^(screenshot|photo)$/i.test(source ?? '');

/** "Oct 19 to 25", "Oct 29 to Nov 2", "Oct 19"; "19 to 25 Oct" where the day comes first. */
function span(dates: string[]): string | null {
  const sorted = [...dates].sort();
  const from = sorted[0];
  const to = sorted[sorted.length - 1];
  if (!from || !to) return null;
  if (from === to) return monthDay(from);
  if (from.slice(0, 7) !== to.slice(0, 7)) return `${monthDay(from)} to ${monthDay(to)}`;
  return dateLocale().dayFirst ? `${Number(from.slice(-2))} to ${monthDay(to)}` : `${monthDay(from)} to ${Number(to.slice(-2))}`;
}

/** What one change did, as a row: the day and title on the left, the time or state on the right. */
function ChangeRow({ change, exists, last, onPress }: { change: Change; exists: boolean; last: boolean; onPress?: () => void }) {
  const { c } = useTheme();
  const it = (change.after ?? change.before)!;
  const gone = change.op === 'delete' || !exists;
  const label = `${weekdayShort(it.date)} ${Number(it.date.slice(-2))} · ${it.title}`;
  let pill: { label: string; tone: PillTone; muted?: boolean };
  if (change.op === 'delete') pill = { label: 'Removed', tone: 'redText' };
  else if (!exists) pill = { label: 'Deleted later', tone: 'grey', muted: true };
  else if (change.op === 'update') {
    // Only a date or time change is a move; a renamed or noted item was edited.
    const b = change.before!;
    pill = { label: b.date !== it.date || b.start !== it.start || b.end !== it.end ? 'Moved' : 'Edited', tone: 'grey' };
  }
  else if (it.start && it.end) pill = { label: compactRange(it.start, it.end), tone: 'grey' };
  else if (it.start) pill = { label: formatTime(it.start, true), tone: 'grey' };
  else if (it.kind === 'event') pill = { label: 'Add a time', tone: 'amber' };
  else pill = { label: 'Any time', tone: 'grey' };
  const ink = gone ? c.controlOutline : c.inkPrimary;
  return (
    <PressRow onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${label}, ${pill.label}`} bleed={8} round={radius.small}
      style={[styles.change, !last ? { borderBottomColor: c.line, borderBottomWidth: StyleSheet.hairlineWidth } : null]}>
      <View style={styles.well}>
        {it.kind === 'event'
          ? <View style={[styles.dot, { backgroundColor: ink }]} />
          : <View style={[styles.ring, { borderColor: ink, backgroundColor: c.surface }]} />}
      </View>
      <T token="body" color={gone ? c.inkSecondary : c.inkPrimary} numberOfLines={1} style={[{ flex: 1 }, gone ? styles.struck : null]}>{label}</T>
      {pill.muted
        ? <View style={[styles.mutedPill, { backgroundColor: c.row }]}><T token="subhead" color={c.inkSecondary}>{pill.label}</T></View>
        : <StatusPill label={pill.label} tone={pill.tone} />}
    </PressRow>
  );
}

export default function ImportScreen() {
  const { c } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const batch = useStore((s) => s.batches.find((b) => b.id === id));
  const items = useStore((s) => s.items);
  const courses = useStore((s) => s.courses);
  const reminders = useStore((s) => s.settings.reminders);
  const undoBatch = useStore((s) => s.undoBatch);
  const series = useStore((s) => s.series);
  const [asking, setAsking] = useState(false);

  if (!batch) {
    return (
      <Sheet title="Import unavailable" nav="push">
        <T token="callout" color={c.inkSecondary} style={{ padding: space.lg, paddingHorizontal: SCREEN_GUTTER }}>
          We couldn’t find this import. Go back to return to your plan.
        </T>
      </Sheet>
    );
  }

  const created = batch.changes.filter((ch) => ch.op === 'create' && ch.after).map((ch) => ch.after as Item);
  const others = batch.changes.filter((ch) => ch.op !== 'create');
  const when = localParts(new Date(batch.createdAt));
  const shot = isShot(batch.source);
  const sourceLabel = batch.source ? batch.source.charAt(0).toUpperCase() + batch.source.slice(1) : batch.label;
  const eyebrow = `${sourceLabel} · ${weekdayShort(when.date)}, ${monthDay(when.date)} · ${formatTime(when.time)}`;

  const madeCourse = courses.some((k) => k.batchId === batch.id) || (batch.removedCourses?.length ?? 0) > 0;
  const allShifts = created.length > 0 && created.every((it) => it.kind === 'event' && it.category === 'work');
  const noun = allShifts ? (created.length === 1 ? 'shift' : 'shifts') : madeCourse ? (created.length === 1 ? 'date' : 'dates') : created.length === 1 ? 'plan' : 'plans';
  const big = created.length ? `${created.length} ${noun}` : `${count(batch.changes.length, 'change')}`;

  const employer = created.find((it) => it.employer)?.employer;
  const course = courses.find((k) => k.batchId === batch.id) ?? courses.find((k) => created.some((it) => it.courseId === k.id));
  const who = employer ?? course?.code ?? course?.title ?? null;
  const dates = span(created.map((it) => it.date));
  const line = [who, dates].filter(Boolean).join(' · ') || batch.label;
  const timed = created.filter((it) => it.kind === 'event' && it.start).length;
  const remindersLine = reminders.enabled && timed > 0 ? (timed === created.length ? `Reminders set for all ${timed}.` : `Reminders set for ${timed} of ${created.length}.`) : null;

  // Every change opens here (from Recent changes, an item's "Added from"); only imports are imports.
  const imported = !!batch.source;
  const caption = asking ? undoQuestion(batch, items, series, courses) : imported ? 'Undo the changes made by this import.' : 'Undo this change.';
  const undo = () => {
    if (!asking) { feedback('tap'); setAsking(true); return; }
    feedback('undo');
    undoBatch(batch.id);
    router.back();
  };

  return (
    <Sheet
      title={imported ? 'Import' : 'Change'}
      nav="push"
      footer={
        <>
          {batch.undone
            ? <View style={{ minHeight: size.target, justifyContent: 'center' }}><StatusPill label="Undone" /></View>
            : asking
              ? <View style={styles.asking}>
                  <TextButton label="Cancel" tone="muted" onPress={() => setAsking(false)} />
                  <TextButton label="Undo" tone="danger" haptic="tap" onPress={undo} />
                </View>
              : <TextButton label={imported ? 'Undo this import' : 'Undo this change'} tone="danger" haptic="tap" onPress={undo} />}
          {!batch.undone ? <T token="caption" color={c.inkSecondary} style={{ textAlign: 'center' }}>{caption}</T> : null}
        </>
      }>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.top}>
          <View style={styles.topText}>
            <T token="callout" color={c.inkSecondary}>{eyebrow}</T>
            <T token="displayXl" tabular>{big}</T>
            <T token="lead" style={styles.line} numberOfLines={2}>{line}</T>
            {remindersLine ? <T token="callout" color={c.inkSecondary}>{remindersLine}</T> : null}
          </View>
          <View style={[styles.thumb, { backgroundColor: c.row }]} accessible accessibilityRole="image" accessibilityLabel={shot ? 'Imported image' : `Import source: ${sourceLabel}`}>
            <Icon name={shot ? 'image' : 'file'} size={24} color={c.inkSecondary} />
          </View>
        </View>

        <Animated.View layout={layout} style={styles.section}>
          <SectionTitle title={created.length ? 'What it added' : 'What it changed'} />
          {created.map((it, i) => (
            <Animated.View key={it.id} layout={layout} entering={enter.fade} exiting={exit.fade}>
              <ChangeRow change={{ op: 'create', before: null, after: it }} exists={!!items[it.id]} last={i === created.length - 1 && others.length === 0}
                onPress={items[it.id] ? () => router.push(`/item/${it.id}`) : undefined} />
            </Animated.View>
          ))}
          {others.map((ch, i) => {
            const target = ch.after ?? ch.before;
            const exists = !!target && !!items[target.id];
            return (
              <Animated.View key={`${ch.op}-${target?.id ?? i}`} layout={layout} entering={enter.fade} exiting={exit.fade}>
                <ChangeRow change={ch} exists={exists} last={i === others.length - 1}
                  onPress={exists && ch.op !== 'delete' ? () => router.push(`/item/${target!.id}`) : undefined} />
              </Animated.View>
            );
          })}
          {batch.changes.length === 0 ? <T token="callout" color={c.inkSecondary} style={{ paddingVertical: space.sm }}>Nothing was added or changed.</T> : null}
        </Animated.View>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: SCREEN_GUTTER, paddingTop: space.xs, paddingBottom: space.xl },
  asking: { flexDirection: 'row', justifyContent: 'center', gap: space.lg },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  topText: { flex: 1, minWidth: 0, gap: space.hair },
  line: { paddingTop: space.snug },
  thumb: { width: 84, height: 122, ...corner(radius.field), overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  section: screen.section,
  change: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 52 },
  well: { width: 22, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  ring: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  struck: { textDecorationLine: 'line-through' },
  mutedPill: { height: size.chip, paddingHorizontal: space.sm, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
