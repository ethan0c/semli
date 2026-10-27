import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { motion } from '@dayli/tokens';

import { SkeletonReview } from '@/components/Skeleton';
import { T } from '@/components/Text';
import { Swap } from '@/components/Ticker';
import { ease } from '@/lib/motion';
import { useTheme, space } from '@/theme';

/**
 * What an import is doing, step by step, for each kind of input. The steps move forward and hold on
 * the last one rather than looping: a heading that cycles back to "Reading" looks like a restart.
 * Showing the work and saying how long it usually takes make a wait feel shorter (labor illusion,
 * Buell & Norton 2011; uncertain waits feel longest, Maister); see docs/import-speed.md.
 */
const STEPS = {
  message: { lines: ['Reading your message', 'Matching it to your plan', 'Working out the times', 'Almost there'], every: 2500, usually: 'Usually about 10 seconds' },
  image: { lines: ['Reading the schedule', 'Finding your shifts', 'Checking every day', 'Checking what changed'], every: 4000, usually: 'Usually under 20 seconds' },
  pdf: { lines: ['Reading the document', 'Finding every due date', 'Checking the schedule tables', 'Putting your term together', 'Almost there'], every: 9000, usually: 'A long syllabus can take up to a minute' },
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
export function Reading({ source, chart = 'week' }: { source: string; chart?: 'week' | 'term' }) {
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
        <Swap value={`${steps.lines[line]}…`} token="display" />
        <T token="callout" color={c.inkSecondary}>
          {long
            ? 'You can keep using Semli. Your review opens when it’s ready.'
            : `${source[0]?.toUpperCase() + source.slice(1)} · ${steps.usually}. Nothing is saved until you confirm.`}
        </T>
      </View>
      <SkeletonReview chart={chart} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 2, borderRadius: 1, overflow: 'hidden' },
  bar: { width: 160, height: 2, borderRadius: 1 },
});
