import { localParts, monthDay } from '@dayli/core';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Sheet';
import { T } from '@/components/Text';
import { keepAccountPlan, keepPhonePlan } from '@/lib/cloud';
import { ownItems, planDate } from '@/lib/cloud-snapshot';
import { friendlyError } from '@/lib/errors';
import { useWebLayout } from '@/lib/layout';
import { feedback } from '@/lib/feedback';
import { enter, exit } from '@/lib/motion';
import { THIS_DEVICE, THIS_DEVICE_TITLE } from '@/lib/web';
import { useStore } from '@/store';
import { SCREEN_GUTTER, corner, radius, useTheme, shadow, space } from '@/theme';

const dated = (iso: string | null) => (iso ? ` from ${monthDay(localParts(new Date(iso)).date)}` : '');

/**
 * Signed in while this iPhone and the account both had a plan. Plans are never merged; the
 * person keeps one and the other is replaced. Covers everything until they choose.
 */
export function PlanChoice() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const choice = useStore((s) => s.planChoice);
  const items = useStore((s) => s.items);
  const sampleBatchId = useStore((s) => s.settings.sampleBatchId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A wide web window asks in a dialog over the planner; the phone covers the screen.
  const { sidebar } = useWebLayout();
  if (!choice) return null;
  // The phone's plan is dated by what the person made; the onboarding sample was made today.
  const mine = dated(planDate(ownItems(items, sampleBatchId)));

  const keep = async (action: () => Promise<void>, operation: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      feedback('success');
    } catch (failure) {
      setError(friendlyError(failure, 'We couldn’t save that to your account. Check your connection and try again.', operation));
    } finally {
      setBusy(false);
    }
  };

  if (sidebar) return (
    <Animated.View entering={enter.fade} exiting={exit.fade} style={[StyleSheet.absoluteFill, styles.scrim, { backgroundColor: c.backdrop }]}>
      <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: c.surface, borderColor: c.line }]}>
        <T token="titleSm" accessibilityRole="header">You have two plans</T>
        <T token="callout" color={c.inkSecondary}>
          {`Your account has a plan${dated(choice.remoteAt ?? planDate(choice.remote.items))}. ${THIS_DEVICE_TITLE} has a plan${mine}. Which one do you want to keep? The other one is replaced.`}
        </T>
        {error ? <T token="callout" color={c.conflict} accessibilityRole="alert">{error}</T> : null}
        <View style={styles.dialogActions}>
          <Button label="Keep account plan" disabled={busy} onPress={() => void keep(keepAccountPlan, 'cloud.keep_account_plan')} />
          <Button label={`Keep ${THIS_DEVICE}’s plan`} variant="secondary" disabled={busy} onPress={() => void keep(keepPhonePlan, 'cloud.keep_phone_plan')} />
        </View>
      </View>
    </Animated.View>
  );

  return (
    <Animated.View entering={enter.fade} exiting={exit.fade} accessibilityViewIsModal
      style={[StyleSheet.absoluteFill, styles.page, { backgroundColor: c.canvas, paddingTop: insets.top + 48, paddingBottom: Math.max(insets.bottom, 24) }]}>
      <View style={styles.copy}>
        <T token="display" accessibilityRole="header">You have two plans.</T>
        <T token="body" color={c.inkSecondary}>
          {`Your account has a plan${dated(choice.remoteAt ?? planDate(choice.remote.items))}. ${THIS_DEVICE_TITLE} has a plan${mine}. Which one do you want to keep? The other one is replaced.`}
        </T>
        {error ? <T token="callout" color={c.conflict} accessibilityRole="alert">{error}</T> : null}
      </View>
      <View style={styles.actions}>
        <Button label="Keep account plan" disabled={busy} onPress={() => void keep(keepAccountPlan, 'cloud.keep_account_plan')} />
        <Button label={`Keep ${THIS_DEVICE}’s plan`} variant="secondary" disabled={busy} onPress={() => void keep(keepPhonePlan, 'cloud.keep_phone_plan')} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: SCREEN_GUTTER, justifyContent: 'space-between' },
  copy: { gap: space.sm },
  actions: { gap: space.sm },
  scrim: { alignItems: 'center', justifyContent: 'center' },
  dialog: { width: 520, maxWidth: '92%', ...corner(radius.container), borderWidth: StyleSheet.hairlineWidth, padding: space.xl, gap: space.sm, boxShadow: shadow.dialog },
  // The choice the person is most likely to want sits at the right, as the primary.
  dialogActions: { flexDirection: 'row-reverse', gap: space.xs, paddingTop: space.snug },
});
