import { monthDay, weekdayLong } from '@dayli/core';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { T } from '@/components/Text';
import { Press } from '@/components/Press';
import { SCREEN_GUTTER, useTheme, useTopInset, fade, iconSize, space, size } from '@/theme';

/**
 * The top of every main tab: at most one small line above the big value, and the meaning under
 * it. Planner tabs pass `date` for that line; You and Add pass none. `size` keeps 56 for numbers
 * and countdowns and gives word titles 34 (docs/headers.md).
 */
export function TabHeader({ date, context, title, size = 'number', value, details, trailing, onPress, accessibilityLabel, inset = true, onPhoto = false }: {
  date?: string;
  context?: ReactNode;
  title?: string;
  size?: 'number' | 'title';
  value?: ReactNode;
  details?: ReactNode;
  trailing?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  inset?: boolean;
  /** The header sits on a photo (Today's sky): its date line is ink, since grey can't hold 4.5:1 on a sky. */
  onPhoto?: boolean;
}) {
  const { c } = useTheme();
  const top = useTopInset();
  const dateLabel = date ? `${weekdayLong(date)}, ${monthDay(date)}` : null;
  const line = context ?? (dateLabel ? <T token="callout" color={onPhoto ? c.inkPrimary : c.inkSecondary} numberOfLines={1}>{dateLabel}</T> : null);
  const big = value ?? <T token={size === 'number' && (title?.length ?? 0) <= FITS_XL ? 'displayXl' : 'display'} accessibilityRole="header" numberOfLines={1}>{title}</T>;
  const content = (
    <>
      {line ? <View style={styles.line}>{line}</View> : null}
      {/* Sized up front, not shrunk to fit: iOS can draw a fitted title full size for a frame first. */}
      {onPress ? (
        // A header that opens something says so with the title chevron, as "On your list ›" does.
        <View style={styles.valueRow}>
          <View style={{ flexShrink: 1 }}>{big}</View>
          <Icon name="chevronRight" size={iconSize.nav} color={c.disclosureInk} />
        </View>
      ) : big}
      {details ? <View style={styles.details}>{details}</View> : null}
    </>
  );
  return (
    <View style={[styles.root, { paddingTop: inset ? top + 20 : 8 }]}>
      {onPress ? (
        <Press accessibilityRole="button" accessibilityLabel={accessibilityLabel ? [dateLabel, accessibilityLabel].filter(Boolean).join(', ') : undefined} onPress={onPress}
          scale={1} dim={fade.pressed} style={styles.content}>
          {content}
        </Press>
      ) : <View style={styles.content}>{content}</View>}
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );
}

/** The longest title that fits at 56 beside a trailing button on the narrowest phone ("Tomorrow", "12 days"). */
const FITS_XL = 9;

const styles = StyleSheet.create({
  root: { paddingHorizontal: SCREEN_GUTTER, flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  content: { flex: 1, minWidth: 0, gap: space.snug },
  line: { minHeight: size.target, justifyContent: 'center' },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  details: { paddingTop: space.snug, gap: space.xxs },
  trailing: { paddingTop: space.hair, flexShrink: 0 },
});
