import { WEEKDAYS, addDays, anchorRule, defaultRule, isLocalDate, lastUntil, monthDay, seriesDates, typicalTermEnd, weekOf, weekdayLong, weekdayOf } from '@dayli/core';
import type { SeriesRule, Weekday } from '@dayli/schema';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Chip, GroupLabel, PickerPill } from '@/components/Controls';
import { InlinePicker } from '@/components/Native';
import { Press } from '@/components/Press';
import { T } from '@/components/Text';
import { feedback } from '@/lib/feedback';
import { enter, exit, layout } from '@/lib/motion';
import { useTheme, space } from '@/theme';

export type Break = { label?: string; start: string; end: string };

const DAY_LABEL: Record<Weekday, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
const EVERY: { key: 'never' | '1' | '2' | '0'; label: string }[] = [
  { key: 'never', label: 'Never' }, { key: '1', label: 'Every week' }, { key: '2', label: 'Every 2 weeks' }, { key: '0', label: 'Every day' },
];
/** How many weeks the preview shows, from the week of the first occurrence. */
const PREVIEW_WEEKS = 4;

/**
 * How something repeats, edited in place: how often, which days, until when, with what it comes to
 * underneath (a count and four weeks of dots). Shared by the Repeat screen and Create. `from` is
 * the occurrence the rule is edited from; its own day always stays in the rule, so the thing on
 * screen is never one the rule removes. `null` means it does not repeat.
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

  return (
    <View style={styles.root}>
      <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel="Repeats">
        {EVERY.map((o) => {
          const selected = rule ? String(rule.every) === o.key : o.key === 'never';
          return (
            <Press key={o.key} accessibilityRole="radio" accessibilityState={{ selected }} haptic="select" onPress={() => { if (!selected) setEvery(o.key); }}
              style={[styles.option, { backgroundColor: selected ? c.controlFill : c.row }]}>
              <T token="subhead" color={selected ? c.controlInk : c.inkPrimary}>{o.label}</T>
            </Press>
          );
        })}
      </View>

      {rule ? (
        <Animated.View entering={enter.fade} exiting={exit.fade} layout={layout} style={styles.root}>
          {rule.every > 0 ? (
            <View style={{ gap: space.xs }}>
              <GroupLabel>On</GroupLabel>
              <View style={styles.options} accessibilityLabel="Days">
                {WEEKDAYS.map((d) => <Chip key={d} label={DAY_LABEL[d]} on={rule.days.includes(d)} onPress={() => toggleDay(d)} />)}
              </View>
              {nudged ? <T token="caption" color={c.inkSecondary}>{`${weekdayLong(from)} stays: it’s the day of this one.`}</T> : null}
            </View>
          ) : null}

          <View style={{ gap: space.xs }}>
            <GroupLabel>Until</GroupLabel>
            <View style={styles.options}>
              <Chip label={`End of ${term.name}`} on={rule.until === term.date} onPress={() => { feedback('select'); setUntilOpen(false); set({ ...rule, until: term.date }); }} />
              <PickerPill label={rule.until === term.date ? 'Pick a date' : `${monthDay(rule.until)}`} open={untilOpen}
                accessibilityLabel={`Until ${monthDay(rule.until)}, pick a date`} onPress={() => { feedback('select'); setUntilOpen((v) => !v); }} />
            </View>
            {untilOpen ? (
              <Animated.View entering={enter.fade} exiting={exit.fade} layout={layout}>
                <InlinePicker mode="date" date={rule.until} time={null} onChange={(date) => isLocalDate(date) && set({ ...rule, until: date })} />
                {rule.until === lastUntil(from) ? <T token="caption" color={c.inkSecondary}>Up to a year at a time.</T> : null}
              </Animated.View>
            ) : null}
          </View>

          <View style={{ gap: space.xs }} accessibilityLabel={`${plural(dates.length)} through ${monthDay(rule.until)}`}>
            <T token="body">
              {dates.length ? `${plural(dates.length)} through ${monthDay(rule.until)}` : `No ${noun}s before ${monthDay(rule.until)}`}
              {skippedByBreaks.length ? <T token="body" color={c.inkSecondary}>{` · skips ${skippedByBreaks.map((b) => b.label ?? 'the break').join(', ')}`}</T> : null}
            </T>
            <View style={styles.weeks} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {weeks.map((week, i) => (
                <View key={i} style={styles.week}>
                  {week.map((d) => <View key={d} style={[styles.dot, { backgroundColor: on.has(d) ? c.inkPrimary : d < start || d > rule.until ? 'transparent' : c.line }]} />)}
                </View>
              ))}
            </View>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.md },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  option: { height: 40, paddingHorizontal: space.sm, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  weeks: { gap: space.xs, alignSelf: 'flex-start' },
  week: { flexDirection: 'row', gap: space.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
