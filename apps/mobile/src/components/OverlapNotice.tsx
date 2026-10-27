import { findConflicts, formatRange, isFlexibleEvent } from '@dayli/core';
import type { Item } from '@dayli/schema';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { GroupLabel, TextButton } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/Sheet';
import { T } from '@/components/Text';
import { useNow } from '@/lib/now';
import { useReschedule } from '@/lib/use-reschedule';
import { useTheme, space, size } from '@/theme';

/** Free conflict facts, with an explicitly confirmed Plus suggestion for the flexible event. */
export function OverlapNotice({ item, items }: { item: Item; items: Item[] }) {
  const { c } = useTheme();
  const now = useNow();
  const otherIds = new Set(findConflicts(items).flatMap((pair) => pair.a === item.id ? [pair.b] : pair.b === item.id ? [pair.a] : []));
  const others = items.filter((other) => otherIds.has(other.id));
  const { isPlus, loading, suggestion, label: suggestedLabel, busy, notice, apply: applySuggestion, openPlus } = useReschedule(item, items);
  if (!others.length) return null;
  const flexible = isFlexibleEvent(item);
  const movable = others.filter(isFlexibleEvent);
  const upcoming = item.start && `${item.date}T${item.start}` > `${now.date}T${now.time}`;

  return (
    <View style={[styles.root, { borderTopColor: c.line }]}>
      <View style={styles.heading}>
        <Icon name="alert" size={18} color={c.conflict} />
        <T token="subhead" color={c.conflict} accessibilityRole="header">Time overlap</T>
      </View>
      {others.map((other) => (
        <View key={other.id} style={styles.fact}>
          <T token="body">{`Overlaps with ${other.title}${other.start && other.end ? ` (${formatRange(other.start, other.end)})` : ''}.`}</T>
          {flexible || !isFlexibleEvent(other) ? <TextButton label={`View ${other.title}`} tone="muted" onPress={() => router.push(`/item/${other.id}`)} style={styles.link} /> : null}
        </View>
      ))}
      {!flexible ? (
        <>
          <T token="callout" color={c.inkSecondary}>{item.category === 'work' ? 'This is a work shift.' : 'This event has a fixed time.'}{movable.length ? ' The other event has a flexible time and may be easier to move.' : ' Check whether either time can change before editing it.'}</T>
          {movable.map((other) => <TextButton key={other.id} label={`Review ${other.title} instead`} onPress={() => router.push(`/item/${other.id}`)} style={styles.link} />)}
        </>
      ) : !upcoming ? (
        <T token="callout" color={c.inkSecondary}>This event has already started. You can still edit its time above.</T>
      ) : loading && !isPlus ? (
        <T token="callout" color={c.inkSecondary}>Checking Plus access…</T>
      ) : !isPlus ? (
        <View style={styles.suggestion}>
          <GroupLabel>Semli Plus</GroupLabel>
          <Button label="Find a time with Plus" variant="secondary" onPress={() => void openPlus()} />
        </View>
      ) : suggestion ? (
        <View style={styles.suggestion}>
          <GroupLabel>Suggested time · Plus</GroupLabel>
          <T token="title">{suggestedLabel}</T>
          <T token="callout" color={c.inkSecondary}>{suggestion.date === item.date ? 'This keeps the same day and duration' : 'This keeps the same duration on the next available day'}, with 15 minutes between events. Your calendar is free at this time. Check with anyone joining you before moving it.</T>
          {item.seriesId ? <T token="caption" color={c.inkSecondary}>Only this event will move. Later repeats won’t change.</T> : null}
          <Button label={busy ? 'Checking…' : 'Move to this time'} disabled={busy} onPress={() => void applySuggestion()} />
        </View>
      ) : (
        <T token="callout" color={c.inkSecondary}>We couldn’t find a free time between 8 am and 10 pm in the next seven days. Suggestions need to fit before any course deadline. Events with missing times can also limit suggestions. You can choose another date or time above.</T>
      )}
      {notice ? <T token="callout" color={c.conflict} accessibilityRole="alert">{notice}</T> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.md, paddingBottom: space.snug, gap: space.sm },
  heading: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  fact: { gap: space.hair },
  link: { alignSelf: 'flex-start', minHeight: size.target },
  suggestion: { gap: space.sm, paddingTop: space.xxs },
});
