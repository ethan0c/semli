import { WEEKDAYS, addDays, anchorRule, defaultRule, isLocalDate, lastUntil, monthDay, seriesDates, typicalTermEnd, weekOf, weekdayLong, weekdayOf, weekdayShort } from '@dayli/core';
import type { SeriesRule, Weekday } from '@dayli/schema';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { FieldRow, GroupLabel, PickerPill, TextButton } from '@/components/Controls';
import { InlinePicker } from '@/components/Native';
import { Press } from '@/components/Press';
import { T } from '@/components/Text';
import { feedback } from '@/lib/feedback';
import { enter, exit, layout } from '@/lib/motion';
import { radius, useTheme, space } from '@/theme';

export type Break = { label?: string; start: string; end: string };

const DAY_LABEL: Record<Weekday, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
const EVERY: { key: 'never' | '1' | '2' | '0'; label: string }[] = [
  { key: 'never', label: 'Never' }, { key: '1', label: 'Every week' }, { key: '2', label: 'Every 2 weeks' }, { key: '0', label: 'Every day' },
];
/** How many weeks the preview calendar shows, from the week of the first occurrence. */
const PREVIEW_WEEKS = 4;

/**
 * How something repeats, edited in place, laid out like Calendar's Repeat: how often as a list of
 * choices, then which days, until when, and a small calendar of what that comes to. Shared by the
 * Repeat screen and Create. `from` is the occurrence the rule is edited from; its own day always
 * stays in the rule, so the thing on screen is never one the rule removes. `null` means it does
 * not repeat.
 */
export function RepeatEditor({ rule, from, today, times, noun, breaks, onChange }: {
  rule: SeriesRule | null;
  from: string;
  today: string;
  times: { start: string | null; end: string | null };
  noun: string;
  breaks: Break[];
  onChange: (rule: SeriesRule | null) => void;
}) {
  const { c } = useTheme();
  const [untilOpen, setUntilOpen] = useState(false);
  const [nudged, setNudged] = useState(false);
  const term = typicalTermEnd(from);
  const own = weekdayOf(from);
  const set = (next: SeriesRule | null) => onChange(next ? anchorRule(next, from) : null);

  const setEvery = (key: (typeof EVERY)[number]['key']) => {
    feedback('select');
    if (key === 'never') { set(null); return; }
    const every = Number(key) as SeriesRule['every'];
    set(rule ? { ...rule, every, days: every === 0 ? [] : rule.days.length ? rule.days : [own] } : defaultRule(from, times, every));
  };
  const toggleDay = (day: Weekday) => {
    if (!rule) return;
    if (day === own) { setNudged(true); feedback('error'); return; }
    feedback('select');
    set({ ...rule, days: rule.days.includes(day) ? rule.days.filter((d) => d !== day) : WEEKDAYS.filter((d) => d === day || rule.days.includes(d)) });
  };

  // The preview counts from the occurrence being edited, or from today when that is in the past.
  const start = from < today ? today : from;
  const dates = rule ? seriesDates(rule, start, breaks) : [];
  const skippedByBreaks = rule ? breaks.filter((b) => seriesDates({ ...rule, skipped: [] }, start).some((d) => d >= b.start && d <= b.end)) : [];
  const plural = (n: number) => `${n} ${n === 1 ? noun : `${noun}s`}`;
  const weeks = Array.from({ length: PREVIEW_WEEKS }, (_, i) => weekOf(addDays(start, i * 7)));
  const on = new Set(dates);
  const atTermEnd = rule?.until === term.date;

  return (
    <View style={styles.root}>
      <View accessibilityRole="radiogroup" accessibilityLabel="Repeats">
        {EVERY.map((o, i) => {
          const selected = rule ? String(rule.every) === o.key : o.key === 'never';
          return <FieldRow key={o.key} label={o.label} radio={selected} last={i === EVERY.length - 1} onPress={() => { if (!selected) setEvery(o.key); }} />;
        })}
      </View>

      {rule ? (
        <Animated.View entering={enter.fade} exiting={exit.fade} layout={layout} style={styles.root}>
          {rule.every > 0 ? (
            <View style={styles.group}>
              <GroupLabel>On</GroupLabel>
              <View style={styles.days} accessibilityLabel="Days">
                {WEEKDAYS.map((d) => {
                  const picked = rule.days.includes(d);
                  return (
                    <Press key={d} accessibilityRole="checkbox" accessibilityState={{ checked: picked }} accessibilityLabel={weekdayLong(dayDate(from, d))}
                      onPress={() => toggleDay(d)} style={[styles.day, { backgroundColor: picked ? c.controlFill : c.row }]}>
                      <T token="subhead" color={picked ? c.controlInk : c.inkPrimary}>{DAY_LABEL[d]}</T>
                    </Press>
                  );
                })}
              </View>
              {nudged ? <T token="caption" color={c.inkSecondary}>{`${weekdayLong(from)} stays: it’s the day of this ${noun}.`}</T> : null}
            </View>
          ) : null}

          <View>
            <FieldRow label="Until" last>
              <PickerPill label={atTermEnd ? `End of ${term.name}` : `${weekdayShort(rule.until)}, ${monthDay(rule.until)}`} open={untilOpen}
                accessibilityLabel={`Until ${monthDay(rule.until)}`} onPress={() => setUntilOpen((v) => !v)} />
            </FieldRow>
            {untilOpen ? (
              <Animated.View entering={enter.fade} exiting={exit.fade} layout={layout} style={styles.group}>
                <InlinePicker mode="date" date={rule.until} time={null} onChange={(date) => isLocalDate(date) && set({ ...rule, until: date })} />
                {rule.until === lastUntil(from) ? <T token="caption" color={c.inkSecondary}>Up to a year at a time.</T> : null}
                {!atTermEnd ? (
                  <TextButton label={`End of ${term.name}, ${monthDay(term.date)}`} tone="muted" style={{ alignSelf: 'flex-start' }}
                    onPress={() => { setUntilOpen(false); set({ ...rule, until: term.date }); }} />
                ) : null}
              </Animated.View>
            ) : null}
          </View>

          <View style={styles.group} accessibilityLabel={`${plural(dates.length)} through ${monthDay(rule.until)}`}>
            <T token="body">
              {dates.length ? `${plural(dates.length)} through ${monthDay(rule.until)}` : `No ${noun}s before ${monthDay(rule.until)}`}
              {skippedByBreaks.length ? <T token="body" color={c.inkSecondary}>{` · skips ${skippedByBreaks.map((b) => b.label ?? 'the break').join(', ')}`}</T> : null}
            </T>
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <View style={styles.week}>
                {WEEKDAYS.map((d) => <T key={d} token="caption" color={c.inkSecondary} style={styles.head}>{DAY_LABEL[d].charAt(0)}</T>)}
              </View>
              {weeks.map((week, i) => (
                <View key={i} style={styles.week}>
                  {week.map((d) => {
                    const lit = on.has(d);
                    const outside = d < start || d > rule.until;
                    // The 1st of a month carries its name, so four weeks across a month read without a header.
                    const label = d.endsWith('-01') ? monthDay(d) : String(Number(d.slice(8)));
                    return (
                      <View key={d} style={styles.cell}>
                        <View style={[styles.mark, lit ? { backgroundColor: c.controlFill } : null]}>
                          <T token="caption" tabular color={lit ? c.controlInk : outside ? c.inkTertiary : c.inkPrimary}>{label}</T>
                        </View>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

/** A date in the week of `from` that falls on `day`, for the day pills' spoken names. */
function dayDate(from: string, day: Weekday): string {
  return weekOf(from)[WEEKDAYS.indexOf(day)] ?? from;
}

const styles = StyleSheet.create({
  root: { gap: space.xl },
  group: { gap: space.xs },
  days: { flexDirection: 'row', gap: space.snug },
  day: { flex: 1, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  week: { flexDirection: 'row' },
  head: { flex: 1, textAlign: 'center', paddingBottom: space.xxs },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 36 },
  mark: { minWidth: 30, height: 30, paddingHorizontal: space.xs, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
