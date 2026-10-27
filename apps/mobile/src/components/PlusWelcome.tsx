import { monthDay, localParts } from '@dayli/core';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Icon, type IconKey } from '@/components/Icon';
import { Press } from '@/components/Press';
import { T } from '@/components/Text';
import { durations, ease, enter, springs } from '@/lib/motion';
import type { Palette } from '@/theme';
import { corner, radius, size, iconSize, space } from '@/theme';

/** Where each Plus feature starts. Every row does the thing; none of them only describes it. */
export type PlusDestination = 'import' | 'shifts' | 'canvas';

const FEATURES: { icon: IconKey; title: string; detail: string; to: PlusDestination }[] = [
  { icon: 'file', title: 'Unlimited imports', detail: 'Add syllabi, screenshots and messages without an import limit.', to: 'import' },
  { icon: 'work', title: 'Update your work schedule', detail: 'Upload a new schedule and review changes before saving.', to: 'shifts' },
  { icon: 'book', title: 'Sync your class calendar', detail: 'Keep due dates from Canvas or Brightspace, including eLC, up to date.', to: 'canvas' },
];

/** The Plus features as rows that open each one: ink glyphs, no tiles, a highlight on press. */
export function PlusFeatures({ c, onGo }: { c: Palette; onGo: (to: PlusDestination) => void }) {
  return (
    <View>
      {FEATURES.map(({ icon, title, detail, to }, i) => (
        <Pressable key={to} accessibilityRole="button" accessibilityLabel={`${title}. ${detail}`} onPress={() => onGo(to)}
          style={({ pressed }) => [styles.row, i < FEATURES.length - 1 ? { borderBottomColor: c.line, borderBottomWidth: StyleSheet.hairlineWidth } : null,
            pressed ? { backgroundColor: c.row, marginHorizontal: -space.xs, paddingHorizontal: space.xs, ...corner(radius.small) } : null]}>
          <Icon name={icon} size={20} color={c.inkPrimary} />
          <View style={{ flex: 1, minWidth: 0, gap: space.hair }}>
            <T token="body" color={c.inkPrimary}>{title}</T>
            <T token="caption" color={c.inkSecondary}>{detail}</T>
          </View>
          <Icon name="chevronRight" size={iconSize.disclosure} color={c.disclosureInk} />
        </Pressable>
      ))}
    </View>
  );
}

/**
 * The one screen after a new purchase: a tick that lands with a short burst, what the person now
 * has (and, on a trial, when it ends and that a reminder comes first), then three ways to start.
 * `celebrate` is false when it is reopened from You → Your plan: same screen, no burst.
 */
export function PlusWelcome({ celebrate, trialEndsAt, onGo, onDone, c }: {
  celebrate: boolean; trialEndsAt?: string | null; onGo: (to: PlusDestination) => void; onDone: () => void; c: Palette;
}) {
  const trialDate = trialEndsAt ? monthDay(localParts(new Date(trialEndsAt)).date) : null;
  return (
    <Animated.View entering={enter.rise} style={{ gap: space.xxl }}>
      <View style={{ gap: space.sm }}>
        <View style={styles.seal}>
          {celebrate ? <Burst c={c} /> : null}
          <Tick c={c} animate={celebrate} />
        </View>
        <T token="subhead" color={c.inkSecondary}>Semli <T token="subhead" color={c.accentInk}>Plus</T></T>
        <T token="displaySerif" color={c.inkPrimary} accessibilityRole="header">{celebrate ? 'Plus is active.' : 'Your Plus subscription.'}</T>
        <T token="body" color={c.inkSecondary}>
          {trialDate ? `Your free trial ends ${trialDate}. Manage your subscription in You → Your plan.` : 'Your subscription includes the features below.'}
        </T>
      </View>
      <View style={{ gap: space.xs }}>
        <T token="subhead" color={c.inkSecondary}>Included with Plus</T>
        <PlusFeatures c={c} onGo={onGo} />
      </View>
      <View style={{ gap: space.sm }}>
        <Press haptic="tap" accessibilityRole="button" onPress={onDone} style={[styles.cta, { backgroundColor: c.controlFill }]}>
          <T token="headline" color={c.controlInk}>Done</T>
        </Press>
        <T token="caption" color={c.inkSecondary} style={{ textAlign: 'center' }}>Manage Plus in You → Your plan.</T>
      </View>
    </Animated.View>
  );
}

/** Green means done: the purchase went through. It pops in on the snappy spring with the burst. */
function Tick({ c, animate }: { c: Palette; animate: boolean }) {
  const p = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (animate) p.value = withSpring(1, springs.snappy);
  }, [animate, p]);
  const style = useAnimatedStyle(() => ({ opacity: Math.min(1, p.value * 2), transform: [{ scale: 0.4 + 0.6 * p.value }] }));
  return (
    <Animated.View style={[styles.tick, { backgroundColor: c.added }, style]}>
      <Icon name="tick" size={30} color={c.onPrimary} strokeWidth={2.5} />
    </Animated.View>
  );
}

function Burst({ c }: { c: Palette }) {
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
    {Array.from({ length: 16 }, (_, i) => <Particle key={i} index={i} color={[c.accentInk, c.added, c.changed, c.inkPrimary][i % 4]} />)}
  </View>;
}

function Particle({ index, color }: { index: number; color: string }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: durations.slow * 4, easing: ease });
  }, [progress]);
  const style = useAnimatedStyle(() => {
    const angle = index * Math.PI * 2 / 16;
    const distance = 52 + index % 3 * 16;
    return {
      opacity: Math.sin(progress.value * Math.PI),
      transform: [
        { translateX: Math.cos(angle) * distance * progress.value },
        { translateY: Math.sin(angle) * distance * progress.value + 16 * progress.value * progress.value },
        { rotate: `${index * 27 + progress.value * 120}deg` },
      ],
    };
  });
  return <Animated.View style={[styles.particle, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: size.item, paddingVertical: space.sm },
  seal: { width: 64, height: 64, marginBottom: space.xs, alignItems: 'center', justifyContent: 'center' },
  tick: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  particle: { position: 'absolute', left: 29.5, top: 27, width: 5, height: 10, borderRadius: 2 },
  cta: { minHeight: size.control, paddingVertical: space.sm, paddingHorizontal: space.lg, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
