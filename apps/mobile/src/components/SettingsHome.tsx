import Constants from 'expo-constants';
import { fullDate, localParts } from '@dayli/core';
import { plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { appIconColors } from '@dayli/tokens';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { ListRow, TextButton } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { Press } from '@/components/Press';
import { Skeleton } from '@/components/Skeleton';
import { Group, Row, ToggleRow } from '@/components/Settings';
import { T } from '@/components/Text';
import { TabHeader } from '@/components/TabHeader';
import { enter, exit } from '@/lib/motion';
import { ACCOUNTS_ENABLED, SHARING_ENABLED } from '@/lib/auth';
import { accountOf, useSession } from '@/lib/supabase';
import { feedback } from '@/lib/feedback';
import { LINKS, SUPPORT_EMAIL, openLink } from '@/lib/links';
import { deviceRegion, regionName } from '@/lib/locale';
import { LANGUAGE_PICKER, LANGUAGES } from '@/lib/language';
import { profileFor } from '@/lib/majors';
import { useCanDo } from '@/lib/can-do';
import { useNotificationsAllowed } from '@/lib/notifications';
import { freeImportAllowance } from '@/lib/plans';
import { PHONE_CALENDAR_AVAILABLE, usePhoneCalendar } from '@/lib/phone-calendar';
import { PLUS_ENTITLEMENT } from '@/lib/revenuecat';
import { useShares } from '@/lib/shares';
import { usePurchases } from '@/providers/PurchasesProvider';
import { useOpenSetting } from '@/lib/settings-pane';
import { SYSTEM_NAME } from '@/lib/web';
import { useStore } from '@/store';
import { NAV_INSET, SCREEN_GUTTER, useTheme, iconSize, space } from '@/theme';

/** Profile and preferences, shared by the You tab and /settings. */
export function SettingsHome({ inTab = false }: { inTab?: boolean }) {
  const { t, i18n } = useLingui();
  const appearanceLabels = { system: (SYSTEM_NAME === 'system' ? t`Match system` : t`Match iPhone`), light: t`Light`, dark: t`Dark` };
  const { c } = useTheme();
  const { isPlus, customerInfo, loading } = usePurchases();
  const settings = useStore((s) => s.settings);
  const backupStatus = settings.cloud.error ? t`Backup needs attention` : settings.cloud.backedUpAt ? t`Backed up` : t`Backup pending`;
  /** null for a guest. */
  const email = useSession((s) => { const account = accountOf(s.session); return account ? account.user.email ?? '' : null; });
  const setSettings = useStore((s) => s.setSettings);
  const usage = useStore((s) => s.usage);
  const allowance = freeImportAllowance(usage);
  const canDo = useCanDo();
  const notificationsOn = useNotificationsAllowed();
  const openSetting = useOpenSetting();
  const phoneCalendarOn = usePhoneCalendar((s) => s.on && !s.denied);
  const shareCount = useShares((s) => s.links.length);
  const [linkNote, setLinkNote] = useState<string | null>(null);
  const [openedAt] = useState(() => Date.now());
  const open = async (url: string, fallback: string) => {
    feedback('tap');
    setLinkNote((await openLink(url)) ? null : t`We couldn't open that. ${fallback}`);
  };
  const entitlement = customerInfo?.entitlements.active[PLUS_ENTITLEMENT];
  const trialEnds = settings.trial?.endsAt ? Math.max(0, Math.ceil((new Date(settings.trial.endsAt).getTime() - openedAt) / 86_400_000)) : null;
  const { used, allowed } = allowance;
  const tried = canDo.filter((task) => task.done).length;
  const total = canDo.length;
  const renewalDate = entitlement?.expirationDate ? fullDate(localParts(new Date(entitlement.expirationDate)).date) : null;
  const left = Math.max(0, allowed - used);
  // What actually happens, not only the saved choice (Oct 27, 2026): reminders switched on with
  // notifications off in iOS Settings ring nowhere, and only Plus keeps Canvas in sync.
  const reminderStatus = !settings.reminders.enabled ? t`Off`
    : notificationsOn === false ? t`Needs permission`
    : settings.reminders.briefing ? t`On, with daily summary` : t`On`;
  const canvasStatus = !settings.canvas.feedUrl ? t`Off`
    : settings.canvas.lastError ? t`Sync needs attention`
    : isPlus ? t`Auto-sync on` : t`Imported once`;
  // Counts down, so the line reads as what is still yours rather than what is spent.
  const planLabel = isPlus
    ? trialEnds !== null && trialEnds > 0 && entitlement?.periodType === 'TRIAL'
      ? t({ id: 'settings.trial_remaining', message: plural(trialEnds, { one: 'Semli Plus · trial, # day left', other: 'Semli Plus · trial, # days left' }) })
      : renewalDate ? (entitlement?.willRenew ? t`Semli Plus · renews ${renewalDate}` : t`Semli Plus · until ${renewalDate}`) : 'Semli Plus'
    : allowance.toStart
      ? t({ id: 'settings.imports_left', message: plural(left, { 0: 'No free imports left', one: '# free import left', other: '# free imports left' }) })
      : t({ id: 'settings.imports_left_month', message: plural(left, { 0: 'No free imports left this month', one: '# free import left this month', other: '# free imports left this month' }) });

  return (
    <ScrollView style={{ backgroundColor: c.canvas }} contentContainerStyle={{ paddingBottom: inTab ? NAV_INSET : 48 }} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior={inTab ? 'never' : 'automatic'}>
      <TabHeader title={t`You`} size="title" inset={inTab}
        details={loading && !customerInfo ? <Animated.View key="loading" exiting={exit.fade}><Skeleton width={160} height={18} round={4} /></Animated.View> : (
          <Animated.View key="plan" entering={enter.fade}>
          <Press scale={1} haptic="tap" onPress={() => router.push('/settings/plan')} accessibilityRole="button" accessibilityLabel={planLabel} accessibilityHint={t`Opens your plan`} style={styles.plan}>
            {/* One segment per import in the allowance, ink while it is still unused, so it drains like a battery. */}
            {isPlus ? null : <View style={styles.meter}>{Array.from({ length: allowed }, (_, i) => <View key={i} style={[styles.segment, { backgroundColor: i < left ? c.inkPrimary : c.line }]} />)}</View>}
            <View style={styles.planLine}>
              <T token="callout" color={c.inkSecondary} tabular style={styles.planText}>{planLabel}</T>
              <Icon name="chevronRight" size={iconSize.disclosure} color={c.disclosureInk} />
            </View>
          </Press>
          </Animated.View>
        )} />
      <View style={styles.body}>

        <Group title={t`Profile`}>
          <Row label={t`Name`} icon="user" value={settings.name.trim() || t`Add your name`} onPress={() => openSetting('name')} />
          {settings.isStudent ? <Row label={t`Studying`} icon="school" value={i18n._(profileFor(settings.major, true).label)} onPress={() => openSetting('major')} last /> : null}
        </Group>

        <Group title={t`Preferences`}>
          <Row label={t`Reminders`} icon="bell" value={reminderStatus} onPress={() => openSetting('reminders')} />
          <Row label={t`Class calendar`} icon="book" value={canvasStatus} onPress={() => openSetting('canvas')} />
          {/* Only the iPhone can read its own calendar; the web has no such row. */}
          {PHONE_CALENDAR_AVAILABLE ? <Row label="iPhone calendar" icon="calendar" value={phoneCalendarOn ? t`On` : t`Off`} onPress={() => openSetting('phone-calendar')} /> : null}
          {LANGUAGE_PICKER ? <Row label={t`Language`} icon="globe" value={LANGUAGES.find((l) => l.id === settings.language)?.name ?? (SYSTEM_NAME === 'system' ? t`Match system` : t`Match iPhone`)} onPress={() => openSetting('language')} /> : null}
          <Row label={t`Region`} icon="globe" value={regionName(settings.region ?? deviceRegion(), i18n.locale)} onPress={() => openSetting('region')} />
          <Row label={t`Appearance`} icon="appearance" value={appearanceLabels[settings.appearance]} onPress={() => openSetting('appearance')} />
          <ToggleRow label={t`Sounds`} sub={Platform.OS === 'web' ? undefined : t`Follow your ring and silent switch`} icon="volume" value={settings.sounds} onChange={(sounds) => { setSettings({ sounds }); feedback('select'); }} last={Platform.OS === 'web'} />
          {/* A laptop has nothing to vibrate. */}
          {Platform.OS === 'web' ? null : <ToggleRow label={t`Haptics`} icon="vibrate" value={settings.haptics} onChange={(haptics) => { setSettings({ haptics }); feedback('tap'); }} last />}
        </Group>

        {/* Two states: only on this iPhone, or backed up. The guest row is the ask to save the plan. */}
        {ACCOUNTS_ENABLED ? <Group title={t`Account`}>
          {email !== null
            ? <ListRow leading={<Icon name="lock" size={20} color={c.inkPrimary} />} title={email || t`Your account`} sub={t`Account settings · ${backupStatus}`} onPress={() => router.push('/account')} last={!SHARING_ENABLED} />
            : <ListRow leading={<Icon name="lock" size={20} color={c.inkPrimary} />} title={t`Back up your plan`} sub={t`Create a free account to back up your plan`} onPress={() => router.push('/account')} last={!SHARING_ENABLED} />}
          {SHARING_ENABLED ? <Row label={t`Share your schedule`} icon="share" value={shareCount ? `${shareCount} ${shareCount === 1 ? 'link' : 'links'}` : undefined} onPress={() => router.push('/share-schedule')} last /> : null}
        </Group> : null}

        <Group label={<T token="overline" color={c.inkSecondary} style={styles.groupLabel}>Semli <T token="overline" color={c.accentInk}>Plus</T></T>}>
          <Row label={t`Your plan`} icon="sparkle" value={isPlus ? (renewalDate ? (entitlement?.willRenew ? t`Renews ${renewalDate}` : t`Until ${renewalDate}`) : t`Active`) : t`Free`} onPress={() => router.push('/settings/plan')} last />
        </Group>

        <Group title={t`Your stuff`} footer={linkNote ?? undefined}>
          <Row label={t`What Semli can do`} icon="list" value={t`${tried} of ${total} tried`} onPress={() => openSetting('can-do')} />
          <Row label={t`Your data`} icon="file" value={email !== null ? backupStatus : t`On this phone`} onPress={() => openSetting('data')} />
          <Row label={t`Help and feedback`} icon="mail" value={SUPPORT_EMAIL} onPress={() => void open(LINKS.support, t`Email us at ${SUPPORT_EMAIL}.`)} />
          <Row label={t`Rate Semli`} icon="star" onPress={() => void open(LINKS.review, t`Open the App Store to leave a rating.`)} last />
        </Group>

        {__DEV__ ? <Group title={t`Development`}>
          <Row label={t`Plan diagnostics`} icon="search" onPress={() => openSetting('plan-status')} />
          <Row label={t`Semli server`} icon="chart" value={settings.apiUrl.replace(/^https?:\/\//, '')} onPress={() => openSetting('server')} last />
        </Group> : null}

        <View style={styles.about}>
          <View style={styles.markRow}>
            <View style={[styles.mark, { backgroundColor: appIconColors.background }]}><View style={[styles.markBig, { backgroundColor: appIconColors.foreground }]} /><View style={[styles.markSmall, { backgroundColor: appIconColors.accent }]} /></View>
            <T token="caption" color={c.inkSecondary} tabular>Semli {Constants.expoConfig?.version ?? ''}</T>
          </View>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <TextButton label={t`Privacy`} tone="muted" onPress={() => void open(LINKS.privacy, t`Read it at semli.app/privacy.`)} />
            <TextButton label={t`Terms`} tone="muted" onPress={() => void open(LINKS.terms, t`Read it at semli.app/terms.`)} />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: SCREEN_GUTTER, paddingTop: space.xl, gap: space.xl },
  groupLabel: { paddingBottom: space.hair },
  plan: { alignSelf: 'flex-start', maxWidth: '100%', gap: space.sm, paddingVertical: space.xxs },
  meter: { flexDirection: 'row', gap: space.xxs },
  segment: { width: 20, height: 4, borderRadius: 2 },
  planLine: { flexDirection: 'row', alignItems: 'center', gap: space.xxs },
  planText: { flexShrink: 1 },
  about: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center', justifyContent: 'space-between', paddingTop: space.xs },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  mark: { width: 24, height: 24, borderRadius: 6 },
  markBig: { position: 'absolute', left: 5, bottom: 4, width: 11, height: 11, borderRadius: 6 },
  markSmall: { position: 'absolute', right: 5, top: 5, width: 5, height: 5, borderRadius: 3 },
});
