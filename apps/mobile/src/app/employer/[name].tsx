import { addDays, diffDays, formatRange, formatTime, monthDay, pendingDates, relativeDay, toMinutes, weekOf, weekdayLong, hoursMinutes, spanMinutes, monthName, count } from '@dayli/core';
import type { Item } from '@dayli/schema';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { GroupLabel, ListRow, StatusPill, TextButton } from '@/components/Controls';
import { Sheet } from '@/components/Sheet';
import { Icon } from '@/components/Icon';
import { T } from '@/components/Text';
import { Ticker } from '@/components/Ticker';
import { WeekChart, compactRange, type WeekDay } from '@/components/WeekChart';
import { Press, PressRow } from '@/components/Press';
import { feedback } from '@/lib/feedback';
import { enter, exit } from '@/lib/motion';
import { useNow } from '@/lib/now';
import { useItemList, useScheduleList, useStore } from '@/store';
import { SCREEN_GUTTER, radius, useTheme, fade, iconSize, space, size } from '@/theme';
import { sourceName } from '@/lib/source-name';

/** Hours to the nearest half: 30, 7.5, 1. */
const hours = (mins: number) => Math.round(mins / 30) / 2;

const same = (a: string | null | undefined, b: string) => (a ?? '').trim().toLowerCase() === b.trim().toLowerCase();

export default function EmployerScreen() {
  const { c } = useTheme();
  const now = useNow();
  const params = useLocalSearchParams<{ name: string }>();
  const name = decodeURIComponent(params.name ?? '');
  const items = useItemList();
  const schedules = useScheduleList();
  const batches = useStore((s) => s.batches);
  const reminders = useStore((s) => s.settings.reminders);
  const removeEmployer = useStore((s) => s.removeEmployer);
  const [removing, setRemoving] = useState(false);

  const shifts = useMemo(() => items.filter((it) => same(it.employer, name)), [items, name]);
  const nowMin = toMinutes(now.time);

  // The one big number: minutes until the next shift starts, or until the current one ends.
  const ongoing = shifts.find((it) => it.date === now.date && it.start && it.end && toMinutes(it.start) <= nowMin && nowMin < toMinutes(it.end));
  const next = ongoing ?? shifts.find((it) => it.start && !it.done && (it.date > now.date || (it.date === now.date && toMinutes(it.start) >= nowMin)));
  const big = !next ? 'Clear'
    : ongoing ? hoursMinutes(toMinutes(ongoing.end!) - nowMin)
      : hoursMinutes(toMinutes(next.start!) - nowMin + diffDays(now.date, next.date) * 1440);
  const eyebrow = !next ? 'Work' : ongoing ? 'Work · shift ends in' : 'Work · next shift in';
  const line = next ? `${relativeDay(now.date, next.date)} · ${next.end ? formatRange(next.start!, next.end) : formatTime(next.start!)}` : null;

  // This week, only this employer's shifts; done or past ones in green.
  const week = weekOf(now.date);
  const nextWeek = weekOf(addDays(now.date, 7));
  const onDay = (date: string) => shifts.filter((it) => it.date === date);
  const past = (it: Item) => it.done || it.date < now.date || (it.date === now.date && !!it.end && toMinutes(it.end) <= nowMin);
  const days: WeekDay[] = week.map((date) => {
    const todays = onDay(date);
    const timed = todays.filter((it) => it.start && it.end);
    const untimed = todays.some((it) => !it.start);
    return {
      date,
      blocks: timed.map((it) => ({ id: it.id, start: it.start!, end: it.end!, tone: past(it) ? 'green' as const : 'ink' as const })),
      unknown: untimed && timed.length === 0,
      label: timed.length ? timed.map((it) => compactRange(it.start!, it.end!)).join(' ') : untimed ? 'no time' : 'off',
      labelTone: untimed && timed.length === 0 ? 'amber' : undefined,
    };
  });
  const thisWeekMins = shifts.filter((it) => week.includes(it.date)).reduce((n, it) => n + spanMinutes(it.start, it.end), 0);
  const nextWeekMins = shifts.filter((it) => nextWeek.includes(it.date)).reduce((n, it) => n + spanMinutes(it.start, it.end), 0);

  // Next week's shifts: covered by a schedule, or still to add.
  const mine = schedules.filter((s) => same(s.employer, name));
  const nextWeekCovered = mine.length > 0 && pendingDates(mine, nextWeek[0]!, nextWeek[6]!).length === 0;
  const covering = mine.filter((s) => s.coversTo >= nextWeek[0]!).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const coveringBatch = covering?.batchId ? batches.find((b) => b.id === covering.batchId) : undefined;
  const addedWhen = (iso: string) => {
    const date = iso.slice(0, 10);
    const ago = diffDays(date, now.date);
    return ago === 0 ? 'today' : ago === 1 ? 'yesterday' : ago < 7 ? weekdayLong(date) : monthDay(date);
  };
  const addedSub = covering ? `From ${sourceName(coveringBatch?.source ?? covering.sourceId ?? 'an import')}, ${addedWhen(covering.createdAt)}` : 'Added';

  // Imports that created shifts here, newest first.
  const imports = useMemo(() => batches
    .filter((b) => b.changes.some((ch) => ch.op === 'create' && ch.after && same(ch.after.employer, name)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [batches, name]);
  const first = imports[imports.length - 1];
  const allShots = imports.every((b) => /^(screenshot|photo)$/i.test(b.source ?? ''));
  const importsSub = first ? `${imports.length} ${allShots ? (imports.length === 1 ? 'screenshot' : 'screenshots') : (imports.length === 1 ? 'import' : 'imports')} since ${monthName(first.createdAt)}` : null;

  const lead = reminders.eventLead === 60 ? '1 hour' : `${reminders.eventLead} min`;
  const reminderLine = reminders.enabled ? `Reminder ${lead} before each shift` : 'Reminders are off';

  const upcomingCount = shifts.filter((it) => it.date >= now.date).length;
  const remove = (scope: 'upcoming' | 'all') => {
    feedback('remove');
    removeEmployer(name, scope, now.date);
    router.back();
  };

  return (
    <Sheet
      title={name}
      nav="push"
      footer={
        removing ? (
          <Animated.View entering={enter.drop} exiting={exit.fade} style={styles.scope}>
            <GroupLabel>{`Remove ${name}?`}</GroupLabel>
            {[
              { label: 'Upcoming shifts only', value: count(upcomingCount, 'shift'), scope: 'upcoming' as const },
              { label: 'All shifts, including past shifts', value: count(shifts.length, 'shift'), scope: 'all' as const },
            ].map((o) => (
              <PressRow key={o.scope} accessibilityRole="button" accessibilityLabel={`${o.label}, ${o.value}`} onPress={() => remove(o.scope)}
                bleed={8} round={radius.small} style={[styles.scopeRow, { borderBottomColor: c.line }]}>
                <T token="body" color={c.conflict} style={{ flex: 1 }}>{o.label}</T>
                <T token="callout" color={c.inkSecondary} tabular>{o.value}</T>
              </PressRow>
            ))}
            <TextButton label="Cancel" tone="muted" onPress={() => setRemoving(false)} style={{ alignSelf: 'center' }} />
            <T token="caption" color={c.inkSecondary} style={{ textAlign: 'center' }}>Also stops reminders to add next week’s shifts. Tap Undo after removing, or open Your data → Recent changes.</T>
          </Animated.View>
        ) : (
          <TextButton label={`Remove ${name}`} tone="danger" haptic="tap" onPress={() => setRemoving(true)} />
        )
      }>
      <ScrollView contentContainerStyle={styles.body}>
        <Press accessibilityRole={next ? 'button' : undefined} disabled={!next} onPress={() => next && router.push(`/item/${next.id}`)}
          accessibilityLabel={next ? `${eyebrow} ${big}, ${line}` : 'Work. No shifts coming up'}
          scale={1} dim={fade.pressed} style={styles.top}>
          <T token="callout" color={c.inkSecondary}>{eyebrow}</T>
          {next ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
              <View style={{ flexShrink: 1 }}><Ticker value={big} token="displayXl" /></View>
              <Icon name="chevronRight" size={iconSize.title} color={c.disclosureInk} />
            </View>
          ) : <Ticker value={big} token="displayXl" />}
          {line
            ? <T token="lead" style={styles.line}>{line}</T>
            : <T token="callout" color={c.inkSecondary} style={{ paddingTop: space.snug }}>No shifts coming up</T>}
        </Press>

        <View style={styles.chart}>
          <WeekChart days={days} today={now.date} height={96}
            accessibilityLabel={`This week's shifts as seven day bars: ${days.map((d) => `${weekdayLong(d.date)} ${d.label}`).join(', ')}.`} />
          <Ticker value={`${count(hours(thisWeekMins), 'hour')} this week · ${hours(nextWeekMins)} next week`} token="caption" color={c.inkSecondary} />
        </View>

        <View style={styles.rows}>
          {nextWeekCovered ? (
            <ListRow title="Next week's shifts" sub={addedSub} trailing={<StatusPill label="Added" tone="green" />} chevron={false}
              onPress={coveringBatch ? () => router.push(`/import/${coveringBatch.id}`) : undefined} />
          ) : (
            <ListRow title="Next week's shifts" sub="Not added yet" trailing={<StatusPill label="Add them" tone="amber" />} chevron={false}
              onPress={() => router.navigate({ pathname: '/add', params: { source: 'image', at: String(Date.now()) } })} />
          )}
          <ListRow title={reminderLine} onPress={() => router.push('/settings/reminders')} last={!importsSub} />
          {importsSub ? <ListRow title="Imports" sub={importsSub} onPress={() => router.push(`/import/${imports[0]!.id}`)} last /> : null}
        </View>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: SCREEN_GUTTER, paddingTop: space.xs, paddingBottom: space.xl },
  top: { gap: space.hair },
  line: { paddingTop: space.snug },
  chart: { paddingTop: space.xl, gap: space.xs },
  rows: { paddingTop: space.md },
  scope: { alignSelf: 'stretch' },
  scopeRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: size.compact, borderBottomWidth: StyleSheet.hairlineWidth },
});
