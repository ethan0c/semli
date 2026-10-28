import { useRef, useState, type ComponentRef } from 'react';
import { Stack, router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { colors, WORDMARK_RATIO, palettes } from '@dayli/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TextButton } from '@/components/Controls';
import { navigationButtonOptions } from '@/components/NavButtons';
import { Button } from '@/components/Sheet';
import { ACCOUNT_REQUIRED } from '@/lib/web';
import { T } from '@/components/Text';
import { SkyHeader } from '@/components/SkyHeader';
import { Wordmark } from '@/components/Wordmark';
import { ACCOUNTS_ENABLED, authErrorMessage } from '@/lib/auth';
import { authClient, leaveAuth, useLeaveIfSignedIn } from '@/lib/auth-client';
import { forgetAccount, providerLabel, useLastAccount, type LastAccount } from '@/lib/last-account';
import { durations, ease, enter, springs } from '@/lib/motion';
import { useNow } from '@/lib/now';
import { hideSplash, splashShowing } from '@/lib/splash';
import { useStore } from '@/store';
import { SCREEN_GUTTER, useTheme, space, size } from '@/theme';

const LOGO = 192;
/** The native splash draws the wordmark 240 points wide, centred on white (app.json). */
const SPLASH_LOGO = 240;
const SPLASH_BG = colors.white;

/**
 * Semli's first screen: one way forward. The account waits until there is a plan worth saving
 * (Apple's HIG: delay sign-in; see docs/conversion.md), so a new person goes straight into
 * onboarding as a guest, and someone returning signs in from "I have an account", where Apple,
 * Google and email all are. After a sign-out on this phone, "Continue as <name>" leads instead.
 */
export default function AuthWelcomeScreen() {
  useLeaveIfSignedIn();
  const { c, dark } = useTheme();
  const { active, landed, root, slot, logo, backdrop, reveal, onRootLayout, onSlotLayout, onLogoLayout } = useLaunchHandoff();
  const insets = useSafeAreaInsets();
  const now = useNow();
  const onboarded = useStore((s) => s.settings.onboarded);
  // After a sign-out on this phone: one tap back into that account instead of a fresh guest plan.
  const last = useLastAccount();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const lock = useRef(false);
  const continueAs = async (account: LastAccount) => {
    if (account.provider === 'email') { router.push({ pathname: '/auth/login', params: account.email ? { email: account.email } : {} }); return; }
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setNotice(null);
    try {
      const result = await (account.provider === 'apple' ? authClient.signInWithApple() : authClient.signInWithGoogle());
      if (result?.signedIn) { leaveAuth(); return; }
    } catch (error) { setNotice(authErrorMessage(error, `auth.${account.provider}`)); }
    setBusy(false);
    lock.current = false;
  };
  return (
    <View ref={root} onLayout={onRootLayout} style={{ flex: 1, backgroundColor: c.canvas }}>
      <Stack.Screen options={{ headerShown: onboarded, title: '', ...navigationButtonOptions('close') }} />
      {/* The hour's sky, the same one Today opens under, so store, welcome and Today read as one place.
          It fades into the paper above the wordmark; the words and buttons sit on the paper. */}
      <SkyHeader time={now.time} />
      <ScrollView contentContainerStyle={[styles.page, styles.measure, { paddingTop: onboarded ? 24 : insets.top + 24, paddingBottom: Math.max(insets.bottom, 24) }]}>
        <View style={styles.hero}>
          <Animated.View ref={slot} onLayout={onSlotLayout} entering={active ? undefined : enter.rise} style={{ opacity: landed ? 1 : 0 }}>
            <Wordmark width={LOGO} ink={c.inkPrimary} dot={c.accent} />
          </Animated.View>
          <Animated.View entering={active ? undefined : enter.fade} style={[styles.copy, reveal]}>
            <T token="displaySerif" style={styles.center} accessibilityRole="header">The daily planner for college students.</T>
            <T token="callout" color={c.inkSecondary} style={styles.center}>Import a syllabus or work schedule, then see your events and deadlines for the day.</T>
          </Animated.View>
        </View>
        <Animated.View entering={active ? undefined : enter.rise} style={[styles.actions, reveal]}>
          {notice ? <T token="callout" color={c.conflict} accessibilityRole="alert" style={styles.center}>{notice}</T> : null}
          {ACCOUNTS_ENABLED && last ? <>
            <Button block label={`Continue as ${last.firstName ?? last.maskedEmail ?? 'you'} · ${providerLabel(last.provider)}`} variant="accent" disabled={busy} onPress={() => void continueAs(last)} />
            {ACCOUNT_REQUIRED
              ? <Button block label="Use another account" variant="secondary" disabled={busy} onPress={() => router.push('/auth/login')} />
              : <Button block label="Get started" variant="secondary" disabled={busy} onPress={() => leaveAuth()} />}
            <TextButton label="Not you? Remove" tone="muted" disabled={busy} onPress={() => void forgetAccount()} style={styles.textAction} />
          </> : ACCOUNT_REQUIRED ? <>
            {/* The web has no guest plan: a laptop's plan comes from the account. */}
            <Button block label="Create an account" variant="accent" onPress={() => router.push('/auth/signup')} />
            <TextButton label="I have an account" tone="muted" onPress={() => router.push('/auth/login')} style={styles.textAction} />
          </> : <>
            <Button block label="Get started" variant="accent" onPress={() => leaveAuth()} />
            {ACCOUNTS_ENABLED ? <TextButton label="I have an account" tone="muted" onPress={() => router.push('/auth/login')} style={styles.textAction} /> : null}
          </>}
          <T token="caption" color={c.inkSecondary} style={styles.center}>{ACCOUNT_REQUIRED ? 'Free to start. Your plan stays in sync with the Semli iPhone app.' : 'Free to start. No account needed.'}</T>
        </Animated.View>
      </ScrollView>
      {landed ? null : (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: SPLASH_BG }, backdrop]} />
          <Animated.View onLayout={onLogoLayout} style={[styles.launchLogo, logo]}>
            <Wordmark width={LOGO} ink={c.inkPrimary} dot={c.accent} />
            {/* The splash is ink on white in both modes; in dark mode that ink fades to the dark theme's. */}
            {dark ? (
              <Animated.View style={[StyleSheet.absoluteFill, backdrop]}>
                <Wordmark width={LOGO} ink={palettes.light.inkPrimary} dot={palettes.light.accent} />
              </Animated.View>
            ) : null}
          </Animated.View>
        </View>
      )}
    </View>
  );
}

/**
 * On a cold launch the splash logo is still on screen. Instead of a second logo entering, this
 * screen draws one exactly where the splash's sits, hides the splash under it, and moves that
 * logo into the hero while the white dissolves into the theme and the words and buttons fade in.
 * Opened later (from You, or after Replay the intro) the screen keeps its usual entrance.
 */
function useLaunchHandoff() {
  const [active] = useState(splashShowing);
  const [landed, setLanded] = useState(!active);
  const root = useRef<ComponentRef<typeof View>>(null);
  const slot = useRef<ComponentRef<typeof View>>(null);
  const laidOut = useRef({ root: false, slot: false, logo: false, started: false });
  const progress = useSharedValue(0);
  const shown = useSharedValue(active ? 0 : 1);
  const dx = useSharedValue(0);
  const dy = useSharedValue(0);

  const start = () => {
    const l = laidOut.current;
    if (!active || l.started || !l.root || !l.slot || !l.logo) return;
    l.started = true;
    root.current?.measureInWindow((rx, ry, rw, rh) => {
      slot.current?.measureInWindow((x, y, w, h) => {
        dx.value = x + w / 2 - (rx + rw / 2);
        dy.value = y + h / 2 - (ry + rh / 2);
        // The drawn logo now covers the splash's pixel for pixel, so hiding it is invisible.
        hideSplash();
        progress.value = withSpring(1, springs.gentle, (finished) => {
          if (finished) scheduleOnRN(setLanded, true);
        });
        shown.value = withDelay(durations.fast, withTiming(1, { duration: durations.base, easing: ease }));
      });
    });
  };
  const onRootLayout = () => { laidOut.current.root = true; start(); };
  const onSlotLayout = () => { laidOut.current.slot = true; start(); };
  const onLogoLayout = () => { laidOut.current.logo = true; start(); };

  const logo = useAnimatedStyle(() => ({
    transform: [
      { translateX: progress.value * dx.value },
      { translateY: progress.value * dy.value },
      { scale: interpolate(progress.value, [0, 1], [SPLASH_LOGO / LOGO, 1]) },
    ],
  }));
  const backdrop = useAnimatedStyle(() => ({ opacity: interpolate(progress.value, [0, 1], [1, 0], Extrapolation.CLAMP) }));
  const reveal = useAnimatedStyle(() => ({ opacity: shown.value }));

  return { active, landed, root, slot, logo, backdrop, reveal, onRootLayout, onSlotLayout, onLogoLayout };
}

const styles = StyleSheet.create({
  page: { flexGrow: 1, paddingHorizontal: SCREEN_GUTTER, gap: space.xxl },
  // On a wide web window the sky spans the page and the words and buttons keep a phone's measure.
  measure: { width: '100%', maxWidth: 520, alignSelf: 'center' },
  launchLogo: { position: 'absolute', top: '50%', left: '50%', width: LOGO, height: LOGO / WORDMARK_RATIO, marginLeft: -LOGO / 2, marginTop: -LOGO / WORDMARK_RATIO / 2 },
  hero: { flex: 1, minHeight: 320, alignItems: 'center', justifyContent: 'center', gap: space.xxl },
  copy: { gap: space.sm, maxWidth: 330 },
  center: { textAlign: 'center' },
  actions: { gap: space.sm },
  textAction: { alignSelf: 'center', minHeight: size.target },
});
