import { formatTime, monthDay, weekdayShort } from '@dayli/core';
import type { StreamedItem } from '@/lib/api';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { motion } from '@dayli/tokens';

import { SkeletonReview } from '@/components/Skeleton';
import { T } from '@/components/Text';
import { Swap } from '@/components/Ticker';
import { ease, enter, exit, layout } from '@/lib/motion';
import { useTheme, space } from '@/theme';

/**
 * What an import is doing, step by step, for each kind of input. The steps move forward and hold on
 * the last one rather than looping: a heading that cycles back to "Reading" looks like a restart.
 * Showing the work and saying how long it usually takes make a wait feel shorter (labor illusion,
 * Buell & Norton 2011; uncertain waits feel longest, Maister); see docs/import-speed.md.
 */
const STEPS = {
  // Timings from the fast-mode benchmark (Oct 27, 2026): medians 1.2 s, 3.4 s and 8.3 s; slowest 25 s.
  message: { lines: ['Reading your message', 'Finding dates and times', 'Comparing with your plan', 'Getting your review ready'], every: 1500, usually: 'Usually a few seconds' },
  image: { lines: ['Reading your image', 'Finding dates and times', 'Comparing with your plan', 'Getting your review ready'], every: 1500, usually: 'Usually under 10 seconds' },
  pdf: { lines: ['Reading your document', 'Finding dates and deadlines', 'Checking the schedule', 'Comparing with your plan', 'Getting your review ready'], every: 4000, usually: 'Allow around 30 seconds for a long document' },
} as const;
/** Past this, the screen says they can leave: about where attention runs out (Nielsen's 10 seconds). */
const LEAVE_AFTER_MS = 10_000;

/** A 2px indeterminate line, the only loading indicator in the app. Sits under a header or at the top of content. */
export function ProgressLine() {
  const { c } = useTheme();
  const x = useSharedValue(0);
  useEffect(() => {
    x.value = withRepeat(withTiming(1, { duration: motion.sweep, easing: ease }), -1, false);
  }, [x]);
  const bar = useAnimatedStyle(() => ({ transform: [{ translateX: -160 + x.value * 560 }] }));
  return (
    <View style={[styles.track, { backgroundColor: c.row }]} accessibilityRole="progressbar" accessibilityLabel="Loading">
      <Animated.View style={[styles.bar, { backgroundColor: c.inkPrimary }, bar]} />
    </View>
  );
}

/**
 * The import loading state: a progress line, a light heading that changes, and the review
 * drawn as placeholders where the result will land. No box, no dots.
 */
/** One row the reader has already found, shown while the rest is still being read. */
function FoundRow({ item }: { item: StreamedItem }) {
  const { c } = useTheme();
  const when = item.date ? `${weekdayShort(item.date)}, ${monthDay(item.date)}${item.start ? ` · ${formatTime(item.start)}` : ''}` : 'No date yet';
  return (
    <View style={[styles.found, { borderBottomColor: c.line }]}>
      <T token="body" numberOfLines={1} style={{ flex: 1 }}>{item.title}</T>
      <T token="callout" color={c.inkSecondary} tabular>{when}</T>
    </View>
  );
}

export function Reading({ source, chart = 'week', found = [] }: { source: string; chart?: 'week' | 'term'; /** Rows already read, as they arrive. */ found?: StreamedItem[] }) {
  const { c } = useTheme();
  const kind = chart === 'term' ? 'pdf' : /^your /.test(source) ? 'message' : 'image';
  const steps = STEPS[kind];
  const [line, setLine] = useState(0);
  const [long, setLong] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setLine((n) => Math.min(n + 1, steps.lines.length - 1)), steps.every);
    const leave = setTimeout(() => setLong(true), LEAVE_AFTER_MS);
    return () => { clearInterval(id); clearTimeout(leave); };
  }, [steps]);
  return (
    <View style={{ gap: space.md }} accessibilityLiveRegion="polite">
      <ProgressLine />
      <View style={{ gap: space.xxs }}>
        <Swap value={found.length ? `Found ${found.length} so far…` : `${steps.lines[line]}…`} token="display" />
        <T token="callout" color={c.inkSecondary}>
          {long
            ? 'You can keep using Semli while you wait. Your review will open when it’s ready.'
            : `${source[0]?.toUpperCase() + source.slice(1)} · ${steps.usually}. You’ll review the dates before anything is added to your plan.`}
        </T>
      </View>
      {/* What's been read so far, row by row; the placeholders below stand for the rest. */}
      {found.length ? (
        <View>
          {found.map((item, i) => (
            <Animated.View key={`${i}-${item.title}`} entering={enter.fade} exiting={exit.fade} layout={layout}><FoundRow item={item} /></Animated.View>
          ))}
        </View>
      ) : null}
      <SkeletonReview chart={chart} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 2, borderRadius: 1, overflow: 'hidden' },
  bar: { width: 160, height: 2, borderRadius: 1 },
  found: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth },
});
