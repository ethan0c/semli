import { addDays, diffDays, formatTime, monthDay, relativeDay, weekdayShort } from '@dayli/core';
import type { Item } from '@dayli/schema';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { motion } from '@dayli/tokens';

import { GlassCircle } from '@/components/Glass';
import { Icon, type IconKey } from '@/components/Icon';
import { Press, PressRow } from '@/components/Press';
import { T } from '@/components/Text';
import { Swap, Ticker } from '@/components/Ticker';
import type { Cue } from '@/lib/feedback';
import { durations, ease, layout } from '@/lib/motion';
import { radius, useTheme, size, fade, iconSize, space } from '@/theme';

/*
 * The five button roles and the small parts every screen shares.
 * Pills act, rectangles hold: every control here is fully round; rows and fields are not.
 * See docs/design-system.md.
 */

/** Text button: accent, underlined. `muted` is the quiet alternative (accent, no underline), `danger` for destructive. */
export function TextButton({ label, onPress, tone = 'accent', haptic = 'select', accessibilityLabel, disabled = false, style }: {
  label: string; onPress: () => void; tone?: 'accent' | 'muted' | 'danger'; haptic?: Cue; accessibilityLabel?: string; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  const color = tone === 'danger' ? c.conflict : c.accentInk;
  return (
    <Press accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ disabled }} disabled={disabled} haptic={haptic} onPress={onPress} style={[styles.textBtn, style, disabled && { opacity: 0.5 }]}>
      <T token="subhead" color={color} style={tone === 'muted' ? undefined : styles.underline}>
        {label}
      </T>
    </Press>
  );
}

/** Icon button: a 44 circle, grey, ink or theme primary. `glass` is for chrome at the top of a screen: Liquid Glass on iOS 26, the grey circle elsewhere. */
export function IconButton({ icon, onPress, label, tone = 'grey', size = 44, haptic = 'tap', disabled, style }: {
  icon: IconKey; onPress: () => void; label: string; tone?: 'grey' | 'ink' | 'primary' | 'bare' | 'glass'; size?: number; haptic?: Cue; disabled?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const { c } = useTheme();
  if (tone === 'glass') {
    return (
      <Press accessibilityRole="button" accessibilityLabel={label} haptic={haptic} onPress={onPress} disabled={disabled} scale={motion.press.iconScale} style={[{ opacity: disabled ? fade.disabled : 1 }, style]}>
        <GlassCircle size={size}><Icon name={icon} size={size >= 44 ? 22 : 18} color={c.inkPrimary} /></GlassCircle>
      </Press>
    );
  }
  const bg = tone === 'primary' ? c.controlFill : tone === 'ink' ? c.inkPrimary : tone === 'grey' ? c.row : 'transparent';
  return (
    <Press accessibilityRole="button" accessibilityLabel={label} haptic={haptic} onPress={onPress} disabled={disabled} scale={motion.press.iconScale}
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: disabled ? fade.disabled : 1 }, style]}>
      <Icon name={icon} size={size >= 44 ? 22 : 18} color={tone === 'primary' ? c.controlInk : tone === 'ink' ? c.onPrimary : c.inkPrimary} strokeWidth={tone === 'ink' || tone === 'primary' ? 2 : 1.75} />
    </Press>
  );
}

/** Chip: the 40-high secondary, for multi-select and filters. */
export function Chip({ label, icon, on, onPress }: { label: string; icon?: IconKey; on: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Press accessibilityRole="checkbox" accessibilityState={{ checked: on }} haptic="select" onPress={onPress}
      style={[styles.chip, { backgroundColor: on ? c.controlFill : c.row }]}>
      {icon ? <Icon name={icon} size={16} color={on ? c.controlInk : c.inkPrimary} /> : null}
      <T token="subhead" color={on ? c.controlInk : c.inkPrimary}>
        {label}
      </T>
    </Press>
  );
}

/** Tile: the 64-high secondary with an icon over a label (Screenshot, Camera, PDF). */
export function Tile({ icon, label, onPress, disabled }: { icon: IconKey; label: string; onPress: () => void; disabled?: boolean }) {
  const { c } = useTheme();
  return (
    <Press accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} haptic="tap" onPress={onPress} disabled={disabled}
      style={[styles.tile, { backgroundColor: c.row, opacity: disabled ? fade.disabled : 1 }]}>
      <Icon name={icon} size={20} color={c.inkPrimary} />
      <T token="caption" color={c.inkPrimary}>
        {label}
      </T>
    </Press>
  );
}

export type PillTone = 'grey' | 'red' | 'green' | 'amber' | 'redText';

/** Status pill. Red is behind, green is ahead, amber needs input, grey is a time or a neutral state. */
export function StatusPill({ label, tone = 'grey', tabular = true, multiline = false }: { label: string; tone?: PillTone; tabular?: boolean; multiline?: boolean }) {
  const { c } = useTheme();
  const look = {
    grey: { bg: c.row, ink: c.inkPrimary },
    redText: { bg: c.row, ink: c.conflict },
    red: { bg: c.conflict, ink: c.onPrimary },
    green: { bg: c.addedBg, ink: c.added },
    amber: { bg: c.changedBg, ink: c.changed },
  }[tone];
  // A new label slides in while the colour blends and the pill eases to its new width.
  const fill = useAnimatedStyle(() => ({ backgroundColor: withTiming(look.bg, { duration: durations.base, easing: ease }) }));
  return (
    <Animated.View layout={layout} style={[styles.pill, multiline && styles.pillMultiline, fill]}>
      <Swap value={label} token="subhead" color={look.ink} style={tabular ? TABULAR : undefined} numberOfLines={multiline ? 0 : 1} />
    </Animated.View>
  );
}

const TABULAR = { fontVariant: ['tabular-nums'] } as const;

/** Section title at 24 Regular with a chevron when it leads somewhere. */
export function SectionTitle({ title, onPress, detail, direction }: {
  title: string; onPress?: () => void; detail?: string;
  /** For a title that changes as the person moves through days: it slides this way (1 later, -1 earlier). */
  direction?: 1 | -1;
}) {
  const { c } = useTheme();
  const inner = (
    <View style={styles.sectionTitle}>
      {direction
        ? <View accessibilityRole="header" style={{ flexShrink: 1 }}><Ticker value={title} token="title" direction={direction} /></View>
        : <T token="title" accessibilityRole="header" style={{ flexShrink: 1 }}>{title}</T>}
      {onPress ? <Icon name="chevronRight" size={iconSize.title} color={c.disclosureInk} /> : null}
      {/* Details are counts ("3 plans · 1 overlap") that change while the screen is open, so they roll. */}
      {detail ? <View style={styles.detail}><Ticker value={detail} token="caption" color={c.inkSecondary} /></View> : null}
    </View>
  );
  if (!onPress) return inner;
  return (
    <Press accessibilityRole="button" onPress={onPress} scale={1} dim={fade.pressed}>
      {inner}
    </Press>
  );
}

/** Sentence-case group label above a run of rows. */
export function GroupLabel({ children }: { children: string }) {
  const { c } = useTheme();
  return (
    <T token="overline" color={c.inkSecondary} style={styles.groupLabel}>
      {children}
    </T>
  );
}

/** A hairline row: optional leading element, title and sub, trailing element or chevron. Highlights on press, never shrinks. */
export function ListRow({ title, sub, leading, trailing, onPress, chevron = !!onPress, last, accessibilityLabel, destructive }: {
  title: string; sub?: string | null; leading?: ReactNode; trailing?: ReactNode; onPress?: () => void; chevron?: boolean; last?: boolean; accessibilityLabel?: string; destructive?: boolean;
}) {
  const { c } = useTheme();
  return (
    <PressRow onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={accessibilityLabel} bleed={8} round={radius.small}
      style={[styles.row, !last ? { borderBottomColor: c.line, borderBottomWidth: StyleSheet.hairlineWidth } : null]}>
      {leading}
      <View style={styles.rowText}>
        <T token="body" color={destructive ? c.conflict : c.inkPrimary} numberOfLines={2}>{title}</T>
        {sub ? <T token="caption" color={c.inkSecondary} numberOfLines={2}>{sub}</T> : null}
      </View>
      {trailing}
      {chevron ? <Icon name="chevronRight" size={iconSize.disclosure} color={c.disclosureInk} /> : null}
    </PressRow>
  );
}

/** The 36-high grey pill that opens a native date or time picker; white with an ink ring while it is open. */
export function PickerPill({ label, open, onPress, accessibilityLabel }: { label: string; open: boolean; onPress: () => void; accessibilityLabel?: string }) {
  const { c } = useTheme();
  return (
    <Press accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ expanded: open }} haptic="select" onPress={onPress}
      style={[styles.pickerPill, open ? { backgroundColor: c.surface, borderColor: c.inkPrimary } : { backgroundColor: c.row, borderColor: 'transparent' }]}>
      <T token="subhead" tabular numberOfLines={1}>{label}</T>
    </Press>
  );
}

/** One choice of several: filled with a dot when chosen, an outline when not. The one radio everywhere. */
export function Radio({ on }: { on: boolean }) {
  const { c } = useTheme();
  return (
    <View style={[styles.radio, on ? { backgroundColor: c.controlFill } : { borderWidth: 1.5, borderColor: c.controlOutline }]}>
      {on ? <View style={[styles.radioDot, { backgroundColor: c.controlInk }]} /> : null}
    </View>
  );
}

/** A 10px dot in the category or course tint, big enough to tell six hues apart in a row; with a course's check ring, the only place those colors appear. */
export function CategoryDot({ color, size = 10 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

/**
 * What the status pill on a row should say for an item, given today's date.
 * `compact` gives the short form for lists that already carry context: "Fri 9 am", "Oct 27".
 */
export function itemStatus(item: Pick<Item, 'kind' | 'date' | 'start' | 'end' | 'done' | 'isDeadline'> & { category?: Item['category'] }, today: string, conflict = false, compact = false): { label: string; tone: PillTone } {
  if (item.done) return { label: 'Done', tone: 'green' };
  // A shift the source gave no time for: Semli needs one before it can remind you.
  if (item.kind === 'event' && item.category === 'work' && !item.start && item.date >= today) return { label: 'Add a time', tone: 'amber' };
  const time = item.start ? formatTime(item.start) : null;
  if (compact && item.date > today) {
    const days = diffDays(today, item.date);
    const when = days <= 6 ? weekdayShort(item.date) : monthDay(item.date);
    const overdueish = item.isDeadline && days === 1;
    return { label: `${when}${time && days <= 6 ? ` ${time}` : ''}`, tone: overdueish ? 'red' : conflict ? 'redText' : 'grey' };
  }
  if (item.kind === 'event') {
    if (item.date === today) return { label: time ?? 'All day', tone: conflict ? 'redText' : 'grey' };
    return { label: `${relativeDay(today, item.date)}${time ? ` ${time}` : ''}`, tone: conflict ? 'redText' : 'grey' };
  }
  if (item.date < today) return { label: 'Overdue', tone: 'red' };
  if (item.isDeadline && item.date === today) return { label: 'Due today', tone: 'red' };
  if (item.isDeadline && item.date === addDays(today, 1)) return { label: `Due ${time ? `tomorrow ${time}` : 'tomorrow'}`, tone: 'red' };
  if (item.date === today) return { label: time ?? 'Any time', tone: 'grey' };
  return { label: `${relativeDay(today, item.date)}${time ? ` ${time}` : ''}`, tone: 'grey' };
}

const styles = StyleSheet.create({
  pickerPill: { height: size.pill, paddingHorizontal: space.sm, borderRadius: radius.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radio: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 7, height: 7, borderRadius: 4 },
  textBtn: { minHeight: size.target, justifyContent: 'center', paddingHorizontal: space.hair },
  underline: { textDecorationLine: 'underline' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: space.snug, paddingHorizontal: space.sm, height: 40, borderRadius: 999 },
  tile: { flex: 1, height: 64, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', gap: space.xxs },
  pill: { height: size.chip, paddingHorizontal: space.sm, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', maxWidth: 160 },
  pillMultiline: { height: 'auto', minHeight: 28, paddingVertical: space.xxs, maxWidth: '100%' },
  detail: { marginLeft: 'auto', flexShrink: 1 },
  sectionTitle: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs, paddingBottom: space.sm },
  groupLabel: { paddingBottom: space.hair },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: size.row, paddingVertical: space.xs },
  rowText: { flex: 1, minWidth: 0, gap: space.hair },
});
