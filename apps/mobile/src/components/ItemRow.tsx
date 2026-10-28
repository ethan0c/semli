import { localParts } from '@dayli/core';
import type { Item } from '@dayli/schema';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { CategoryDot, IconButton, StatusPill, itemStatus } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { PressRow } from '@/components/Press';
import { SwipeRow } from '@/components/SwipeRow';
import { isPhoneItemId, phoneCalendarName } from '@/lib/phone-calendar';
import { T } from '@/components/Text';
import { useWebLayout } from '@/lib/layout';
import { durations, ease, springs } from '@/lib/motion';
import { courseTint, useStore } from '@/store';
import { iconSize, textStyle, useTheme, space, size } from '@/theme';

type RowItem = Pick<Item, 'kind' | 'title' | 'category' | 'icon' | 'start' | 'end' | 'done' | 'isDeadline' | 'date' | 'urgent'> & { id?: string; courseId?: string | null; employer?: string | null };
type Props = { item: RowItem; conflict?: boolean; planned?: boolean; today?: string; onPress?: () => void; onToggle?: () => void; onDelete?: () => void; last?: boolean };

/**
 * One agenda row: a check (to-dos) or a category dot (events), the title with its context,
 * and a status pill on the right. A class's to-dos draw their check ring in its tint, as its
 * events lead with a dot in it, so a week reads by course at a glance without a tinted card.
 * Swipe right to complete a to-do, left to delete, when the handlers are given. On the web a
 * pointer can't swipe: the row highlights under it and Delete takes the pill's place.
 */
export function ItemRow({ item, conflict, planned, today, onPress, onToggle, onDelete, last }: Props) {
  const { c } = useTheme();
  const courses = useStore((s) => s.courses);
  const course = item.courseId ? courses.find((k) => k.id === item.courseId) : undefined;
  const isEvent = item.kind === 'event';
  const date = today ?? localParts(new Date()).date;
  const status = itemStatus(item, date, conflict);
  const tint = course ? c.tint[courseTint(courses, course.id) ?? 'sky'].ink : c.category[item.category].ink;
  // An iPhone calendar event is read-only here: it names its calendar and can't be deleted from Semli.
  const phone = !!item.id && isPhoneItemId(item.id);
  const remove = phone ? undefined : onDelete;
  const where = phone && item.id ? phoneCalendarName(item.id) : course?.code ?? item.employer ?? (item.category === 'school' ? 'Coursework' : item.category === 'work' ? 'Work' : 'Personal');
  const sub = [where, conflict ? 'Overlaps something else' : null, planned ? 'Working on it today' : null].filter(Boolean).join(' · ');
  const [hover, setHover] = useState(false);
  const pointer = Platform.OS === 'web';
  // Touch rows are 64 tall; a pointer on a wide window needs less (desktop lists run 44–52).
  const { sidebar } = useWebLayout();
  return (
    <SwipeRow onDelete={remove} completed={item.done} onComplete={!isEvent && onToggle ? () => {
      // A swipe is easy to make by accident, so completing one offers Undo; the check needs none.
      const completing = !item.done;
      onToggle();
      if (completing && item.id) useStore.getState().showDoneToast([{ id: item.id, title: item.title }]);
    } : undefined}>
    <View onPointerEnter={pointer ? () => setHover(true) : undefined} onPointerLeave={pointer ? () => setHover(false) : undefined}
      style={[styles.row, sidebar ? { minHeight: 52 } : null, { backgroundColor: hover ? c.row : c.canvas }, !last ? { borderBottomColor: c.line, borderBottomWidth: StyleSheet.hairlineWidth } : null]}>
      {!isEvent ? (
        <Pressable onPress={onToggle} disabled={!onToggle} accessibilityRole="checkbox" hitSlop={8}
          accessibilityLabel={`${item.done ? 'Mark incomplete' : 'Complete'}: ${item.title}`} accessibilityState={{ checked: item.done }} style={styles.checkTarget}>
          <Check done={item.done} color={course ? tint : undefined} />
        </Pressable>
      ) : (
        <View style={styles.checkTarget}><CategoryDot color={tint} /></View>
      )}
      {/* The highlight reaches back under the check, so the whole row lights like a Settings row. */}
      <PressRow onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} bleed={{ left: CHECK + GAP }}
        accessibilityLabel={`${item.title}, ${isEvent ? 'event' : 'to-do'}, ${status.label}${item.urgent ? ', urgent' : ''}${conflict ? ', overlaps another event' : ''}${item.done ? ', completed' : ''}`}
        style={styles.main}>
        <View style={styles.text}>
          <Title text={item.title} done={item.done} color={conflict ? c.conflict : c.inkPrimary} />
          <View style={styles.sub}>
            <T token="caption" color={c.inkSecondary} numberOfLines={1} style={styles.subText}>{item.urgent ? <T token="caption" color={item.done ? c.inkSecondary : c.conflict}>Urgent · </T> : null}{sub}</T>
          </View>
        </View>
        {hover && remove ? null : <StatusPill label={status.label} tone={status.tone} />}
        {/* The row opens the item; the chevron says so, as it does on course and settings rows. */}
        {onPress && !(hover && remove) ? <Icon name="chevronRight" size={iconSize.disclosure} color={c.disclosureInk} /> : null}
      </PressRow>
      {hover && remove ? <IconButton icon="trash" label={`Delete ${item.title}`} size={36} haptic="remove" onPress={remove} /> : null}
    </View>
    </SwipeRow>
  );
}

const AnimatedText = Animated.createAnimatedComponent(Text);

/**
 * A row's title. Checked off, it fades to grey over `base` while its strikethrough draws left to
 * right; opened again, the line withdraws the same way. The strike is iOS's own line-through on a
 * transparent copy of the title, revealed by a clip, so it sits exactly where the system draws it.
 */
function Title({ text, done, color }: { text: string; done: boolean; color: string }) {
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
  const p = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    p.value = withTiming(done ? 1 : 0, { duration: durations.base, easing: ease });
  }, [done, p]);
  const ink = useAnimatedStyle(() => ({ color: interpolateColor(p.value, [0, 1], [color, c.inkSecondary]) }));
  const reveal = useAnimatedStyle(() => ({ width: p.value * width }));
  const base = textStyle('body', color);
  // Only iOS draws a line-through in its own colour over transparent text; elsewhere the title strikes at once.
  const drawn = Platform.OS === 'ios';
  return (
    <View>
      <AnimatedText numberOfLines={2} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={[base, ink, !drawn && done ? styles.done : null]}>{text}</AnimatedText>
      {drawn && width > 0 ? (
        <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.strike, reveal]}>
          <Text numberOfLines={2} style={[base, styles.done, { width, color: 'transparent', textDecorationColor: c.inkSecondary }]}>{text}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * The completion circle stays fixed while its fill and tick grow into place. With `color` (a
 * course's tint) the open ring wears it, a little heavier so the hue reads; done is always green.
 */
export function Check({ done, color }: { done: boolean; color?: string }) {
  const { c } = useTheme();
  const p = useSharedValue(done ? 1 : 0);
  useEffect(() => {
    p.value = withSpring(done ? 1 : 0, springs.snappy);
  }, [done, p]);
  const fill = useAnimatedStyle(() => ({ opacity: Math.min(1, p.value), transform: [{ scale: 0.4 + 0.6 * p.value }] }));
  const tick = useAnimatedStyle(() => ({ opacity: Math.min(1, p.value), transform: [{ scale: Math.max(0, p.value) }] }));
  return (
    <View style={[styles.circle, { borderColor: done ? c.added : color ?? c.controlOutline }, color && !done ? { borderWidth: 2 } : null]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.fill, { backgroundColor: c.added }, fill]} />
      <Animated.View style={tick}>
        <Icon name="tick" size={13} color={c.onPrimary} strokeWidth={2.5} />
      </Animated.View>
    </View>
  );
}

const CHECK = 22;
const GAP = 12;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: GAP, minHeight: size.item },
  // Above the main area, whose press highlight reaches under it.
  checkTarget: { width: CHECK, minHeight: size.compact, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  main: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: GAP, paddingVertical: space.sm },
  text: { flex: 1, minWidth: 0, gap: space.hair },
  sub: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  subText: { flexShrink: 1 },
  done: { textDecorationLine: 'line-through' },
  strike: { position: 'absolute', top: 0, left: 0, bottom: 0, overflow: 'hidden' },
  circle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  fill: { borderRadius: 11 },
});
