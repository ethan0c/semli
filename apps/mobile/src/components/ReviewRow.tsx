import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { CategoryDot } from '@/components/Controls';
import { DisclosureChevron } from '@/components/DisclosureChevron';
import { Press, PressRow } from '@/components/Press';
import { T } from '@/components/Text';
import { durations, enter, exit, layout } from '@/lib/motion';
import { useTheme, radius, size, space } from '@/theme';

/*
 * The small parts of the review screen: a hairline row with a glyph column, the 36-high
 * pill that opens a native picker under its row, and the caption-sized disclosure that
 * expands a list. Rows highlight, pills act.
 */

/** The 22-wide glyph column: a 6px dot, or a 12px ring for an exam. */
export function ReviewGlyph({ kind = 'dot', color }: { kind?: 'dot' | 'ring'; color?: string }) {
  const { c } = useTheme();
  return (
    <View style={styles.glyph}>
      {kind === 'ring' ? (
        <View style={[styles.ring, { borderColor: color ?? c.inkPrimary, backgroundColor: c.surface }]} />
      ) : (
        <CategoryDot color={color ?? c.inkPrimary} />
      )}
    </View>
  );
}

/** Past this many rows a wave stops adding delay, so a long review is never kept waiting. */
const WAVE_CAP = 6;
let wave = { at: 0, count: 0 };

/**
 * Rows that mount together, as the review opens after reading, rise one after another in the
 * order they are drawn, a `stagger` apart. A row that arrives on its own later just rises.
 */
function useWaveEntrance() {
  const [entering] = useState(() => {
    const now = Date.now();
    if (now - wave.at > durations.slow) wave = { at: now, count: 0 };
    return enter.staggered(Math.min(wave.count++, WAVE_CAP));
  });
  return entering;
}

/** A hairline review row: glyph, title and sub, trailing controls, and an editor beneath when open. */
export function ReviewRow({ glyph, title, sub, ask, trailing, struck, below, onPress, accessibilityLabel }: {
  glyph?: ReactNode; title: string; sub?: string | null;
  /** A question the read left for the person ("Which row is yours?"), in amber under the title. */
  ask?: string | null;
  trailing?: ReactNode; struck?: boolean; below?: ReactNode; onPress?: () => void; accessibilityLabel?: string;
}) {
  const { c } = useTheme();
  const entering = useWaveEntrance();
  const head = (
    <View style={styles.head}>
      {glyph}
      <View style={styles.text}>
        <T token="body" color={struck ? c.inkSecondary : c.inkPrimary} numberOfLines={2} style={struck ? styles.struck : undefined}>{title}</T>
        {sub ? <T token="caption" color={c.inkSecondary} numberOfLines={2}>{sub}</T> : null}
        {ask ? <T token="caption" color={c.changed} numberOfLines={3}>{ask}</T> : null}
      </View>
      {trailing}
    </View>
  );
  return (
    <Animated.View layout={layout} entering={entering} exiting={exit.fade} style={[styles.row, { borderBottomColor: c.line }]}>
      {onPress ? (
        <PressRow onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} bleed={8} round={radius.small}>
          {head}
        </PressRow>
      ) : head}
      {below ? <View style={styles.below}>{below}</View> : null}
    </Animated.View>
  );
}

/**
 * The 36-high pill that opens a picker: grey at rest, white with a 1.5 ink ring while its picker
 * is open, ink when it is the chosen option, muted when unset.
 */
export function ReviewPill({ label, onPress, selected, open, muted, accessibilityLabel }: {
  label: string; onPress: () => void; selected?: boolean; open?: boolean; muted?: boolean; accessibilityLabel?: string;
}) {
  const { c } = useTheme();
  return (
    <Press accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} accessibilityState={{ selected: !!selected, ...(open !== undefined ? { expanded: open } : null) }} haptic="select" onPress={onPress}
      style={[styles.pill, selected ? { backgroundColor: c.inkPrimary, borderColor: c.inkPrimary } : open ? { backgroundColor: c.surface, borderColor: c.inkPrimary } : { backgroundColor: c.row, borderColor: 'transparent' }]}>
      <T token="subhead" color={selected ? c.onPrimary : muted ? c.inkSecondary : c.inkPrimary} tabular numberOfLines={1}>{label}</T>
    </Press>
  );
}

/** A row of pills and text buttons under a review row, indented to the text column. */
export function ReviewPillRow({ children }: { children: ReactNode }) {
  return <View style={styles.pills}>{children}</View>;
}

/** Caption-sized disclosure with a chevron that turns when open. */
export function ReviewDisclosure({ label, open, onPress }: { label: string; open: boolean; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <PressRow onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded: open }} bleed={8} round={radius.small} style={styles.disclosure}>
      <T token="caption" color={c.inkSecondary} style={{ flex: 1 }}>{label}</T>
      <DisclosureChevron expanded={open} />
    </PressRow>
  );
}

const styles = StyleSheet.create({
  row: { borderBottomWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: size.row, paddingVertical: space.xs },
  text: { flex: 1, minWidth: 0, gap: space.hair },
  struck: { textDecorationLine: 'line-through' },
  glyph: { width: 22, alignItems: 'center', justifyContent: 'center' },
  ring: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  below: { paddingLeft: space.xxl, paddingBottom: space.sm },
  pills: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.xs },
  pill: { height: size.pill, paddingHorizontal: space.sm, borderRadius: radius.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  disclosure: { minHeight: size.target, flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
