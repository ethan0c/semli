import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import { AppState, Appearance, LogBox, Platform, StyleSheet, View } from 'react-native';
import { I18nProvider } from '@lingui/react';
import { PostHogProvider } from 'posthog-react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { addDays, localParts } from '@dayli/core';
import * as Sentry from '@sentry/react-native';
import * as Application from 'expo-application';
import { motion, palettes } from '@dayli/tokens';

import { syncRingingAlarms } from '@/lib/alarms';
import { AppErrorBoundary, RecoveryScreen } from '@/components/AppErrorBoundary';
import { StorageWarning } from '@/components/StorageWarning';
import { reportError, scrubUrl, scrubUrls } from '@/lib/errors';
import { useStorageStatus } from '@/lib/storage';
import { CanvasAutoSync } from '@/lib/canvas-sync';
import { LaunchUpdate } from '@/components/LaunchUpdate';
import { CloudBackup } from '@/lib/cloud';
import type { Session } from '@supabase/supabase-js';

import { accountOf, useSession } from '@/lib/supabase';
import { ACCOUNT_REQUIRED } from '@/lib/web';
import { frameStyle, useWebLayout } from '@/lib/layout';
import { columnHeader } from '@/components/ColumnHeader';
import { Sidebar } from '@/components/DesktopTabs';
import { PlanChoice } from '@/components/PlanChoice';
import { Toast } from '@/components/Overlay';
import { devAppearance, devClock, devCommand, devImport, setDevImport, setDevToday } from '@/lib/dev';
import { i18n } from '@/lib/i18n';
import { SHOWCASE, SKY, preloadPhotos } from '@/lib/images';
import { skySlot } from '@/lib/sky';
import { useDateLocaleSync } from '@/lib/locale';
import { useAppLanguage } from '@/lib/use-app-language';
import { setDevTime } from '@/lib/now';
import { hideSplash } from '@/lib/splash';
import { sampleScheduleExtraction, sampleScheduleUpdate, sampleSyllabusExtraction, sampleWeek, testFortnight } from '@/store/sample';
import { configureNotifications, useNotificationTaps, useReminderSync } from '@/lib/notifications';

import { PurchasesProvider } from '@/providers/PurchasesProvider';
import { navigationButtonOptions } from '@/components/NavButtons';
import { preloadSounds } from '@/lib/feedback';
import { useStore } from '@/store';
import { useTheme, headerTitle } from '@/theme';
import { SURFACE, WEB_VERSION, posthog, posthogLogs } from '@/lib/analytics';
import { usePhoneCalendarSync } from '@/lib/phone-calendar';
import { seedDevShares, useShareSync } from '@/lib/shares';

// NativeTabs sends PRELOAD and ROUTE_NAMES_CHANGED actions the stack has no handler for; the
// warnings are noise (nothing is lost) and their toast sits at the bottom of every dev recording.
if (__DEV__) LogBox.ignoreLogs([/^The action '(PRELOAD|ROUTE_NAMES_CHANGED)'/]);

SplashScreen.preventAutoHideAsync();
// Fade the white splash out instead of cutting to the first screen (iOS; Android has its own exit).
SplashScreen.setOptions({ fade: true, duration: motion.duration.slow });
const SPLASH_FALLBACK_MS = 1500;
configureNotifications();

export { AppErrorBoundary as ErrorBoundary };
export const unstable_settings = { screenErrorBoundary: AppErrorBoundary };

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
Sentry.init({
  dsn: SENTRY_DSN,
  enabled: !!SENTRY_DSN,
  environment: __DEV__ ? 'development' : 'production',
  // Matches the name the Expo plugin uploads source maps and dSYMs under, so frames resolve. The web
  // has no native version, so each deploy is its own release.
  release: Platform.OS === 'web'
    ? `app.semli.web@${WEB_VERSION}`
    : `${Application.applicationId}@${Application.nativeApplicationVersion}+${Application.nativeBuildVersion}`,
  dist: Platform.OS === 'web' ? undefined : Application.nativeBuildVersion ?? undefined,
  // One project for the app and the web planner; filter on `platform`.
  initialScope: { tags: { platform: SURFACE } },
  tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  sendDefaultPii: false,
  // Trace headers go only to Semli's own API, not to schools' calendar servers or Supabase.
  tracePropagationTargets: [/^https:\/\/www\.semli\.app\//],
  // Request addresses are scrubbed before they leave the phone: a calendar feed link is a password.
  beforeBreadcrumb: (breadcrumb) => {
    const url = breadcrumb.data?.url;
    if (typeof url === 'string') breadcrumb.data = { ...breadcrumb.data, url: scrubUrl(url) };
    if (breadcrumb.message) breadcrumb.message = scrubUrls(breadcrumb.message);
    return breadcrumb;
  },
  beforeSendSpan: (span) => {
    if (span.description) span.description = scrubUrls(span.description);
    for (const key of ['url', 'http.url', 'url.full', 'http.query', 'url.query']) {
      const value = span.data?.[key];
      if (typeof value === 'string') span.data[key] = key.endsWith('query') ? '' : scrubUrl(value);
    }
    return span;
  },
});

function AnalyticsRoot({ children }: { children: ReactNode }) {
  return posthog ? <PostHogProvider client={posthog}>{children}</PostHogProvider> : <>{children}</>;
}

function RootLayout() {
  // Names match packages/tokens fontFamily.
  const [fontsLoaded, fontError] = useFonts({
    'Geist-Light': require('../../assets/fonts/Geist-Light.ttf'),
    'Geist-Regular': require('../../assets/fonts/Geist-Regular.ttf'),
    'Geist-Medium': require('../../assets/fonts/Geist-Medium.ttf'),
    'Geist-SemiBold': require('../../assets/fonts/Geist-SemiBold.ttf'),
    'EBGaramond-Regular': require('../../assets/fonts/EBGaramond-Regular.ttf'),
  });
  const hydrated = useStore((s) => s.hydrated);
  const loadFailed = useStorageStatus((s) => s.loadFailed);
  const onboarded = useStore((s) => s.settings.onboarded);
  // The web plans only for a signed-in account: without one, only the auth screens are open.
  const sessionReady = useSession((s) => s.ready);
  const signedIn = useSession((s) => !!accountOf(s.session));
  const webGuest = ACCOUNT_REQUIRED && !signedIn;
  // On a wide web window every pushed screen sits in the reading column; the tab shell and photo paywall take the width.
  // A wide web window keeps the sidebar beside every screen and lines each one up on the app's frame,
  // its header included; the tab shell, the welcome and the photo paywall set their own.
  const { sidebar, twoPane } = useWebLayout();
  const column = sidebar ? frameStyle(twoPane) : null;
  // Small forms open as dialogs over the screen they came from (see Sheet's `dialog`).
  const dialogScreen = { presentation: 'transparentModal' as const, headerShown: false, animation: 'fade' as const, contentStyle: { backgroundColor: 'transparent' } };
  const appearance = useStore((s) => s.settings.appearance);
  const { c, dark } = useTheme();
  const pathname = usePathname();
  const showSidebar = sidebar && onboarded && !webGuest && !pathname.startsWith('/auth') && !pathname.startsWith('/onboarding');
  const photoPaywall = pathname === '/paywall' || pathname === '/settings/plan';
  // Photos the first screen shows are decoded behind the splash, at most 300 ms: the hour's sky,
  // which both Today and the welcome screen open under, and the Plus photo for a new person.
  const [photosReady, setPhotosReady] = useState(false);
  useEffect(() => {
    if (!hydrated) return;
    const sky = SKY[skySlot(localParts(new Date()).time, dark)];
    const sources = [sky, SHOWCASE.plus];
    void preloadPhotos(sources).finally(() => setPhotosReady(true));
    // Once per launch: later sky changes fade in on their own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);
  const ready = (fontsLoaded || !!fontError) && hydrated && photosReady && (!ACCOUNT_REQUIRED || sessionReady);
  useDateLocaleSync(hydrated);
  useAppLanguage();
  useEffect(() => { if (fontError) reportError('fonts.load', fontError); }, [fontError]);
  useReminderSync();
  usePhoneCalendarSync();
  useShareSync();
  useNotificationTaps(ready);
  const alarmItems = useStore((s) => s.items);
  const alarmsEnabled = useStore((s) => s.settings.reminders.urgentAlarmsEnabled);
  useEffect(() => {
    if (!hydrated) return;
    void syncRingingAlarms().catch(() => {});
  }, [hydrated, alarmItems, alarmsEnabled]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && useStore.getState().hydrated) void syncRingingAlarms().catch(() => {});
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!ready) return;
    posthogLogs.info('app_ready', { app_state: 'hydrated' });
    if (useStore.getState().settings.onboarded) { hideSplash(); return; }
    // A new install opens on the welcome, which hides the splash once its own logo sits exactly
    // under it. The timer only covers a launch that lands somewhere else, such as a deep link.
    const fallback = setTimeout(hideSplash, SPLASH_FALLBACK_MS);
    return () => clearTimeout(fallback);
  }, [ready]);

  // Sounds load up front, so the first chime of each kind plays (lib/feedback.ts).
  useEffect(() => { if (ready) preloadSounds(); }, [ready]);

  // Development: a command file in Documents seeds a state for screenshots (see lib/dev.ts).
  useEffect(() => {
    if (!ready) return;
    void Promise.all([devClock(), devCommand(), devAppearance(), devImport()]).then(([clock, cmd, appearance, imp]) => {
      setDevTime(clock);
      if (appearance) useStore.getState().setSettings({ appearance });
      // A clock with a day ("2026-10-19 09:41") seeds the week around that day.
      const today = /^\d{4}-\d{2}-\d{2}/.exec(clock ?? '')?.[0] ?? localParts(new Date()).date;
      setDevImport(imp, today);
      if (!cmd) return;
      const store = useStore.getState();
      const demo = cmd === 'demo' || cmd === 'share';
      if (cmd === 'sample' || cmd === 'moment' || cmd === 'spread' || cmd === 'item' || cmd === 'review' || cmd === 'review-syllabus' || cmd === 'review-update' || cmd === 'hours' || cmd === 'list' || demo) {
        // Every first-time tip counts as seen, so the captures show the screens without them.
        store.setSettings({ onboarded: true, seeded: true, isStudent: true, major: 'nursing', firsts: { overlap: true, urgent: true, canvas: true, reimport: true, hours: true, week: true, added: true, plusImport: true }, ...(cmd === 'hours' || cmd === 'list' ? { todayView: cmd } : {}), breaks: cmd === 'moment' ? [{ label: 'Fall break', start: addDays(today, 9), end: addDays(today, 13) }] : [] });
        if (cmd === 'hours' || cmd === 'list') setDevToday({ noMoment: true });
        if (cmd === 'spread') {
          // Two weeks with a dense run of deadlines, so Today shows the heavy-week moment, its list open.
          if (Object.keys(store.items).length === 0) {
            const t = testFortnight(today);
            store.applyPlan(t.plan, 'Test data · next two weeks', { source: 'Test data', courses: t.courses });
          }
          setDevToday({ spreadOpen: true });
        } else if (Object.keys(store.items).length === 0) {
          const week = sampleWeek(today, { student: true, preview: true });
          useStore.setState({ items: Object.fromEntries(week.items.map((i) => [i.id, i])), courses: week.courses, schedules: week.schedules });
        }
        // A fresh install opened the welcome cover before the settings changed; Today is under it.
        setTimeout(() => router.navigate('/'), 400);
      }
      if (cmd === 'plus') {
        // Back into onboarding, where dev-step.txt = plus opens the paywall page without a cover.
        store.setSettings({ onboarded: false, seeded: true, isStudent: true, major: 'nursing' });
        if (Object.keys(store.items).length === 0) {
          const week = sampleWeek(today, { student: true, preview: true });
          useStore.setState({ items: Object.fromEntries(week.items.map((i) => [i.id, i])), courses: week.courses, schedules: week.schedules });
        }
      }
      if (cmd === 'review' || cmd === 'review-update') {
        store.setPending({ extraction: (cmd === 'review' ? sampleScheduleExtraction : sampleScheduleUpdate)(today), source: 'Screenshot' });
        setTimeout(() => router.push('/review'), 2500);
      }
      if (cmd === 'review-syllabus') {
        store.setPending({ extraction: sampleSyllabusExtraction(today), source: 'NURS210-syllabus.pdf' });
        setTimeout(() => router.push('/review'), 2500);
      }
      // A recording: the sample week with no prompts in the way. Maestro taps through the real
      // screens (design/clips/flows) and an import is answered from the samples (dev-import.txt).
      if (demo) store.setSettings({ remindersAsked: true });
      if (cmd === 'share') {
        // The share screen as a signed-in person with two links, with no account or server.
        seedDevShares();
        useSession.setState({ session: { access_token: 'dev', refresh_token: 'dev', expires_in: 3600, token_type: 'bearer', user: { id: 'dev', aud: 'authenticated', is_anonymous: false, email: 'maya@example.com', app_metadata: {}, user_metadata: {}, created_at: '' } } as unknown as Session, ready: true });
        setTimeout(() => router.push('/share-schedule'), 2500);
      }
      if (cmd === 'item') {
        // The item screen's reminder line, shown with class reminders on so it names a real reminder.
        store.setSettings({ reminders: { ...store.settings.reminders, classReminders: true, eventLead: 30 } });
        const first = Object.values(useStore.getState().items).find((i) => i.kind === 'event' && i.date >= today);
        if (first) setTimeout(() => router.push(`/item/${first.id}`), 2500);
      }
    });
  }, [ready]);

  // Native views (tab bar, SwiftUI pickers) follow this; our tokens follow it through useTheme.
  // The web has no native views and react-native-web has no setColorScheme.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Appearance.setColorScheme(appearance === 'system' ? 'unspecified' : appearance);
  }, [appearance]);

  if (loadFailed) return <RecoveryScreen title="We couldn’t open your saved plan." message="Please try again. If this keeps happening, close and reopen Semli. Your saved data hasn’t been replaced." onRetry={() => useStore.persist.rehydrate()} />;
  if (!ready) return null;

  const theme = dark ? DarkTheme : DefaultTheme;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <I18nProvider i18n={i18n}>
    <AnalyticsRoot>
    <PurchasesProvider>
      <LaunchUpdate />
      <CanvasAutoSync />
      <CloudBackup />
      <ThemeProvider value={{ ...theme, colors: { ...theme.colors, background: c.canvas } }}>
        <StorageWarning />
        <View style={[styles.app, { backgroundColor: c.canvas }]}>
        {showSidebar ? <Sidebar /> : null}
        <View style={styles.stack}>
        <Stack
          screenOptions={{
            // Sheet screens (review, create, item) declare headerShown below; a full-screen cover
            // that turns its header on after mounting lays out without it and slides under the status bar.
            headerShown: false,
            headerStyle: { backgroundColor: c.canvas },
            headerShadowVisible: false,
            headerTintColor: c.inkPrimary,
            headerTitleStyle: headerTitle(c.inkPrimary),
            headerTitleAlign: 'center',
            headerBackButtonDisplayMode: 'minimal',
            contentStyle: { backgroundColor: c.canvas, ...column },
            ...(sidebar ? { header: columnHeader('frame') } : null),
          }}>
          {/* Auth is the fallback for a new install; existing planners still resolve / to tabs. */}
          {/* On a new install it is the first screen and takes over the splash logo, so it must not slide up. */}
          <Stack.Screen name="auth" options={{ presentation: 'fullScreenModal', animation: onboarded ? 'default' : 'none', contentStyle: { backgroundColor: c.canvas } }} />
          {/* Review is a full-screen cover: it can be reached from onboarding too, so it sits outside the guards. */}
          <Stack.Screen name="review" dangerouslySingular={() => 'review'} options={{ presentation: 'fullScreenModal', gestureEnabled: false, headerShown: true, ...navigationButtonOptions('close'), ...(sidebar ? { contentStyle: { backgroundColor: c.canvas, ...frameStyle(twoPane, true) } } : null) }} />
          <Stack.Screen name="paywall" options={{ presentation: 'fullScreenModal', headerShown: true, headerTransparent: true, headerStyle: { backgroundColor: 'transparent' }, contentStyle: { backgroundColor: palettes.dark.canvas, width: '100%' }, title: '', headerTintColor: palettes.dark.inkPrimary, ...navigationButtonOptions('close') }} />
          <Stack.Screen name="account" dangerouslySingular={() => 'account'} options={sidebar ? dialogScreen : { presentation: 'fullScreenModal', headerShown: true, ...navigationButtonOptions('close') }} />
          <Stack.Protected guard={!onboarded && !webGuest}>
            {/* No sidebar here; onboarding centres its own steps so the Plus photo can take the width. */}
            <Stack.Screen name="onboarding" options={{ animation: 'fade', contentStyle: { backgroundColor: c.canvas } }} />
          </Stack.Protected>
          {/* Signed in on the web but not set up yet: / goes on to onboarding. Without this the
              router falls back to its first open route, /auth, and the welcome asks to sign in again. */}
          <Stack.Protected guard={onboarded && !webGuest} redirectTo={ACCOUNT_REQUIRED && signedIn && !onboarded ? '/onboarding' : undefined}>
            <Stack.Screen name="(tabs)" options={{ contentStyle: { backgroundColor: c.canvas } }} />
            {/* Legacy capture links redirect to Add without presenting an empty modal. */}
            <Stack.Screen name="capture" />
            {/* Flows slide up as full-screen covers with an X; detail screens push with a back chevron.
                Every one is singular: opening a screen already in the stack brings that one to the top, so
                item → course → item, two overlapping items, a double tap or a second "n" never stack copies. */}
            <Stack.Screen name="create" dangerouslySingular={() => 'create'} options={sidebar ? dialogScreen : { presentation: 'fullScreenModal', headerShown: true, ...navigationButtonOptions('close') }} />
            <Stack.Screen name="share-schedule" dangerouslySingular={() => 'share-schedule'} options={{ presentation: 'fullScreenModal', headerShown: true, ...navigationButtonOptions('close') }} />
            <Stack.Screen name="item/[id]" dangerouslySingular options={{ headerShown: true, ...navigationButtonOptions('back') }} />
            <Stack.Screen name="repeat/[id]" dangerouslySingular options={{ headerShown: true, ...navigationButtonOptions('back') }} />
            <Stack.Screen name="course/[id]" dangerouslySingular options={{ headerShown: true, ...navigationButtonOptions('back') }} />
            <Stack.Screen name="employer/[name]" dangerouslySingular options={{ headerShown: true, ...navigationButtonOptions('back') }} />
            <Stack.Screen name="import/[id]" dangerouslySingular options={{ headerShown: true, ...navigationButtonOptions('back') }} />
            {/* Settings frames its own screens, so its Semli Plus page can run the photo full width. */}
            <Stack.Screen name="settings" options={{ contentStyle: { backgroundColor: c.canvas } }} />
          </Stack.Protected>
        </Stack>
        {/* Pushed screens (an item, a course, settings) cover the tabs and the toast they hold, so
            their deletes and moves would offer an Undo nobody could see (Oct 27, 2026). */}
        {PUSHED.test(pathname) ? <Toast offset={-32} /> : null}
        </View>
        </View>
        <PlanChoice />
        {/* One owner restores the theme's icons when leaving either always-dark paywall. */}
        <StatusBar style={photoPaywall || dark ? 'light' : 'dark'} hidden={false} />
      </ThemeProvider>
    </PurchasesProvider>
    </AnalyticsRoot>
    </I18nProvider>
    </GestureHandlerRootView>
  );
}

export default Sentry.wrap(RootLayout);

/** Routes pushed over the tabs, where the tabs' own toast can't be seen. */
const PUSHED = /^\/(item|repeat|course|employer|import|settings)(\/|$)/;

const styles = StyleSheet.create({
  app: { flex: 1, flexDirection: 'row' },
  stack: { flex: 1, minWidth: 0 },
});
