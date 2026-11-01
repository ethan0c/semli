import { monthDay, weekdayLong } from '@dayli/core';
import { motion } from '@dayli/tokens';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton, TextButton } from '@/components/Controls';
import { DisclosureChevron } from '@/components/DisclosureChevron';
import { Press } from '@/components/Press';
import { T } from '@/components/Text';
import { Ticker, useDateDirection } from '@/components/Ticker';
import { calendarDays, calendarMonthLabel, moveCalendarMonth } from '@/lib/calendar';
import { feedback } from '@/lib/feedback';
import { useTheme, radius, size, fade, iconSize, space } from '@/theme';

/** "October", or "January 2027" when the selected month is not in this year. */
function monthTitle(selected: string, today: string): string {
  const label = calendarMonthLabel(selected);
  return selected.slice(0, 4) === today.slice(0, 4) ? label.split(' ')[0]! : label;
}

/** Plan's title: the selected month, which opens the month grid. Replaces the date lines and the week arrows. */
export function PlanMonthTitle({ selected, today, expanded, onToggle }: { selected: string; today: string; expanded: boolean; onToggle: () => void }) {
  // The month slides up for a later week and down for an earlier one, the way the swipe went.
  const direction = useDateDirection(selected);
  return (
    <Press accessibilityRole="button" accessibilityLabel={`Choose date, ${weekdayLong(selected)}, ${monthDay(selected)}, ${selected.slice(0, 4)}`}
      accessibilityState={{ expanded }} onPress={() => { feedback('select'); onToggle(); }}
      scale={1} dim={fade.pressed} style={styles.title}>
      <View style={{ flexShrink: 1 }}><Ticker value={monthTitle(selected, today)} token="display" direction={direction} /></View>
      <DisclosureChevron expanded={expanded} size={iconSize.title} turn={MONTH_TURN} />
    </Press>
  );
}

/** Points down while the grid is closed and turns to point up as it opens. */
const MONTH_TURN = [90, -90] as const;

/** Back to this week, shown only when Plan is on another one. Pills act: fully round. */
export function TodayPill({ onPress }: { onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Press accessibilityRole="button" accessibilityLabel="Go to today" haptic="select" onPress={onPress}
      style={[styles.pill, { backgroundColor: c.row }]}>
      <T token="subhead">Today</T>
    </Press>
  );
}

/** Month browsing stays local until a day (or Today) is selected. */
export function PlanMonthCalendar({ selected, today, onSelect }: { selected: string; today: string; onSelect: (date: string) => void }) {
  const { c } = useTheme();
  const [month, setMonth] = useState(`${selected.slice(0, 7)}-01`);
  const dates = calendarDays(month);
  const weeks = Array.from({ length: 6 }, (_, row) => dates.slice(row * 7, row * 7 + 7));
  const pick = (date: string) => { feedback('select'); onSelect(date); };
  return (
    <View style={[styles.calendar, { borderColor: c.line }]}>
      <View style={styles.monthRow}>
        <IconButton icon="chevronLeft" label="Previous month" tone="glass" size={44} haptic="select" onPress={() => setMonth((m) => moveCalendarMonth(m, -1))} />
        <T token="headline" accessibilityRole="header" style={styles.monthTitle}>{calendarMonthLabel(month)}</T>
        <IconButton icon="chevronRight" label="Next month" tone="glass" size={44} haptic="select" onPress={() => setMonth((m) => moveCalendarMonth(m, 1))} />
      </View>
      <View style={styles.weekdays} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label, i) => <T key={i} token="caption" color={c.inkSecondary} maxFontSizeMultiplier={MAX_TEXT_SCALE} style={styles.weekday}>{label}</T>)}
      </View>
      <View>
        {weeks.map((week) => (
          <View key={week[0]} style={styles.week}>
            {week.map((date) => {
              const on = date === selected;
              const isToday = date === today;
              const inMonth = date.slice(0, 7) === month.slice(0, 7);
              return (
                <Press key={date} accessibilityRole="button" accessibilityState={{ selected: on }}
                  accessibilityLabel={`${weekdayLong(date)}, ${monthDay(date)}, ${date.slice(0, 4)}${isToday ? ', today' : ''}`}
                  onPress={() => pick(date)} scale={motion.press.iconScale} style={styles.day}>
                  <View style={[styles.dayCircle, {
                    backgroundColor: on ? c.controlFill : 'transparent',
                    borderColor: isToday && !on ? c.accent : 'transparent',
                  }]}>
                    <T token="subhead" tabular maxFontSizeMultiplier={MAX_TEXT_SCALE} color={on ? c.controlInk : inMonth ? c.inkPrimary : c.inkSecondary}>{Number(date.slice(8))}</T>
                  </View>
                </Press>
              );
            })}
          </View>
        ))}
      </View>
      <View style={styles.today}><TextButton label="Today" onPress={() => onSelect(today)} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { minHeight: size.target, flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start' },
  pill: { minHeight: size.pill, paddingHorizontal: space.sm, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  calendar: { borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: space.sm, marginBottom: space.sm, gap: space.xs },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  monthTitle: { flex: 1, textAlign: 'center' },
  weekdays: { flexDirection: 'row', paddingTop: space.xxs },
  weekday: { flex: 1, textAlign: 'center' },
  week: { flexDirection: 'row' },
  day: { flex: 1, minHeight: size.target, alignItems: 'center', justifyContent: 'center' },
  dayCircle: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  today: { alignItems: 'center' },
});
