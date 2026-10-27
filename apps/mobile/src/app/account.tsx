import { diffDays, formatTime, localParts, monthDay, relativeDay } from '@dayli/core';
import { useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { TextButton } from '@/components/Controls';
import { Group, Row } from '@/components/Settings';
import { Button, Sheet } from '@/components/Sheet';
import { T } from '@/components/Text';
import { authErrorMessage } from '@/lib/auth';
import { authClient } from '@/lib/auth-client';
import { feedback } from '@/lib/feedback';
import { durations } from '@/lib/motion';
import { useNow } from '@/lib/now';
import { accountOf, useSession } from '@/lib/supabase';
import { usePurchases } from '@/providers/PurchasesProvider';
import { useStore } from '@/store';
import { THIS_DEVICE } from '@/lib/web';
import { SCREEN_GUTTER, useTheme, space } from '@/theme';

/**
 * Account settings. Two states: a guest's plan is only on this iPhone; a signed-in plan is backed
 * up. Signing out backs up, then removes the plan from this phone until the next sign-in; Delete
 * account removes the account, its backup and the plan here. One destructive action per state.
 */
export default function AccountScreen() {
  const { c } = useTheme();
  const now = useNow();
  const session = useSession((s) => accountOf(s.session));
  const cloud = useStore((s) => s.settings.cloud);
  const { isPlus, manageSubscription } = usePurchases();
  const [confirm, setConfirm] = useState<'sign-out' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const user = session?.user;

  const run = async (action: () => Promise<void>, done: string, operation: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      feedback('success');
      // Leave first, clear after. Clearing resets `onboarded`, which removes the tabs and every
      // signed-in screen (Stack.Protected in app/_layout.tsx); doing that while this sheet is still
      // open sent dismissAll and replace into a stack that was changing under them.
      if (router.canDismiss()) router.dismissAll();
      router.replace('/auth');
      setTimeout(() => {
        useStore.getState().clearAll('everything');
        useStore.getState().showToast(done);
      }, durations.slow);
    } catch (failure) {
      setError(authErrorMessage(failure, operation));
    } finally {
      setBusy(false);
    }
  };

  const backedUp = (() => {
    if (cloud.error) return cloud.error;
    if (!cloud.backedUpAt) return 'Backing up…';
    const at = localParts(new Date(cloud.backedUpAt));
    const day = Math.abs(diffDays(at.date, now.date)) <= 1 ? relativeDay(now.date, at.date) : monthDay(at.date);
    return `Backed up ${day.toLowerCase()}, ${formatTime(at.time)}`;
  })();

  if (!user) {
    return (
      <Sheet dialog title="Account settings">
        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.hero}>
            <T token="display" accessibilityRole="header">{`Saved on ${THIS_DEVICE}`}</T>
            <T token="body" color={c.inkSecondary}>Create a free account to back up your plan and access it on a new phone.</T>
          </View>
          <Group>
            <Row label="Back up your plan" onPress={() => router.replace('/auth/signup')} />
            <Row label="Sign in" onPress={() => router.replace('/auth/login')} last />
          </Group>
        </ScrollView>
      </Sheet>
    );
  }

  const deleting = confirm === 'delete';
  const signingOut = confirm === 'sign-out';
  return (
    <Sheet dialog title={deleting ? 'Delete account' : signingOut ? 'Sign out' : 'Account settings'} footer={deleting ? <>
      <Button label={busy ? 'Deleting…' : 'Delete my account'} disabled={busy} onPress={() => void run(authClient.deleteAccount, 'Account deleted.', 'account.delete')} />
      <TextButton label="Keep my account" tone="muted" onPress={() => setConfirm(null)} />
    </> : signingOut ? <>
      <Button label={busy ? 'Signing out…' : 'Sign out'} disabled={busy} onPress={() => void run(authClient.signOut, 'Signed out. Sign in again to bring your plan back.', 'account.sign_out')} />
      <TextButton label="Stay signed in" tone="muted" onPress={() => setConfirm(null)} />
    </> : undefined}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.hero}>
          <T token="display" accessibilityRole="header">{deleting ? 'Delete your account?' : signingOut ? 'Sign out?' : 'Your account.'}</T>
          <T token="body" color={c.inkSecondary}>{deleting
            ? `Your plan and your backup will be permanently deleted from Semli’s servers and ${THIS_DEVICE}. This can’t be undone.`
            : signingOut
              ? `We’ll back up your latest changes, then remove your plan from ${THIS_DEVICE}. Sign in again to restore it.`
              : `Signed in with ${user.email ?? 'your Apple or Google account'}`}</T>
          {deleting && isPlus ? <>
            <T token="body" color={c.inkSecondary}>Deleting your account doesn’t cancel your Semli Plus subscription. Manage it separately in your store settings.</T>
            <TextButton label="Manage subscription" disabled={busy} onPress={() => {
              setError(null);
              void manageSubscription().catch(() => setError('We couldn’t open your subscription settings. Open your device’s subscription settings to manage Semli Plus.'));
            }} />
          </> : null}
        </View>
        {error ? <T token="callout" color={c.conflict} accessibilityRole="alert">{error}</T> : null}
        {!confirm ? <>
          <Group title="Backup" footer="Your plan is saved to your account a few seconds after each change. Sign in on a new phone to bring it back.">
            <Row label="Status" value={backedUp} />
          </Group>
          <Group>
            <Row label="Sign out" onPress={() => { feedback('tap'); setError(null); setConfirm('sign-out'); }} />
            <Row label="Delete account" destructive onPress={() => { feedback('tap'); setError(null); setConfirm('delete'); }} last />
          </Group>
        </> : null}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: SCREEN_GUTTER, paddingTop: space.xl, paddingBottom: space.xxxl, gap: space.xxl },
  hero: { gap: space.sm },
});
