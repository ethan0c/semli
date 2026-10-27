import { router } from 'expo-router';
import { dateLocale, fullDate, localParts, count } from '@dayli/core';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import type { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import Animated from 'react-native-reanimated';

import { Radio, StatusPill } from '@/components/Controls';
import { Press, PressRow } from '@/components/Press';
import { PlusFeatures, PlusWelcome, type PlusDestination } from '@/components/PlusWelcome';
import { Skeleton } from '@/components/Skeleton';
import { T } from '@/components/Text';
import { track } from '@/lib/analytics';
import { feedback } from '@/lib/feedback';
import { durations, enter, exit } from '@/lib/motion';
import { LINKS, openLink } from '@/lib/links';
import { notificationsAllowed, requestNotifications, trialRenews } from '@/lib/notifications';
import { PLUS_ENTITLEMENT, customerCenterEnabled, hasSemliPro, offeringFor, usingTestStore } from '@/lib/revenuecat';
import { plusMonthLine } from '@/lib/plus-month';
import { usePurchases } from '@/providers/PurchasesProvider';
import { useStore } from '@/store';
import { useTheme, type Palette, radius, size, fade, space } from '@/theme';

/** The three Semli Plus terms. Packages come from RevenueCat; see docs/revenuecat-offerings-brief.md. */
const TERMS = [
  { key: 'monthly', label: 'Monthly', period: '/ month', billed: 'a month', months: 1, pick: (o: PurchasesOffering | null) => o?.monthly ?? null },
  // Apple has no four-month term: the semester plan is a six-month subscription and every price line says so.
  { key: 'semester', label: '6 months', period: '/ 6 months', billed: 'every 6 months', months: 6, pick: (o: PurchasesOffering | null) => o?.sixMonth ?? null },
  { key: 'yearly', label: 'Yearly', period: '/ year', billed: 'a year', months: 12, pick: (o: PurchasesOffering | null) => o?.annual ?? null },
] as const;

type TermKey = (typeof TERMS)[number]['key'];

function trialDays(pack: PurchasesPackage | null | undefined): number | null {
  const intro = pack?.product.introPrice;
  if (!intro || intro.price !== 0) return null;
  const n = intro.periodNumberOfUnits;
  const unit = intro.periodUnit.toLowerCase();
  return unit === 'day' ? n : unit === 'week' ? n * 7 : unit === 'month' ? n * 30 : null;
}

/** "$2.50 / mo", "4,16 € / mo", "¥117 / mo": StoreKit's own formatting for the storefront. */
function perMonth(pack: PurchasesPackage, months: number): string {
  const { pricePerMonthString, price, currencyCode } = pack.product;
  if (pricePerMonthString) return `${pricePerMonthString} / mo`;
  try {
    return `${new Intl.NumberFormat(dateLocale().locale, { style: 'currency', currency: currencyCode }).format(price / months)} / mo`;
  } catch {
    return `${pack.product.priceString} / ${months} mo`;
  }
}

/** Shared purchase controls for the photographic onboarding, settings and gated paywalls. */
export function PlanPicker({ onContinueFree, onComplete, onWelcome, freeImportsLeft, palette, headline }: {
  onContinueFree?: () => void; onComplete?: () => void; onWelcome?: () => void; freeImportsLeft?: number; palette?: Palette;
  /** Optional heading based on the person’s imports. */
  headline?: string;
}) {
  const theme = useTheme();
  const c = palette ?? theme.c;
  const { offering, offerings, customerInfo, isPlus, loading, busy, error, unavailableReason, refresh, purchase, restore, manageSubscription } = usePurchases();
  // What Plus has done lately, so a subscriber sees it working, not only an absence of limits.
  const usage = useStore((st) => st.usage);
  const itemMap = useStore((st) => st.items);
  const plusLately = isPlus ? plusMonthLine(usage, Object.values(itemMap), localParts(new Date()).date) : null;
  const student = useStore((s) => s.settings.isStudent);
  const setSettings = useStore((s) => s.setSettings);
  const [welcome, setWelcome] = useState<'celebrate' | 'tour' | null>(null);
  const trial = useStore((s) => s.settings.trial);
  const [previewPlans, setPreviewPlans] = useState(false);
  const actionInProgress = useRef(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Yearly by default: since Oct 21, 2026 it is the cheapest per month ($24.99 student, $44.99 regular),
  // and annual is what Education buys and keeps (docs/conversion.md). 6 months stays the lower upfront price.
  const [term, setTerm] = useState<TermKey>('yearly');
  // The trial timeline promises the day-5 reminder only once notifications are on, and offers to turn them on.
  const [canRemind, setCanRemind] = useState<boolean | null>(null);
  useEffect(() => { notificationsAllowed().then(setCanRemind, () => setCanRemind(false)); }, []);
  const disabled = busy || loading || !!unavailableReason;

  const other = offeringFor(offerings, !student);
  const plans = TERMS.map((t) => ({ ...t, pack: t.pick(offering), otherPack: t.pick(other) }));
  const current = plans.find((p) => p.key === term && p.pack) ?? plans.find((p) => p.pack) ?? null;
  const selected = current?.pack ?? null;
  const days = trialDays(selected);
  const monthly = plans.find((p) => p.key === 'monthly')?.pack ?? null;
  const entitlement = customerInfo?.entitlements.active[PLUS_ENTITLEMENT];

  const showWelcome = (stage: 'celebrate' | 'tour') => { setWelcome(stage); onWelcome?.(); };

  async function buyPlan() {
    if (!selected || !current || actionInProgress.current || previewPlans) return;
    actionInProgress.current = true;
    setNotice(null);
    try {
      const info = await purchase(selected);
      if (!info) return;
      if (hasSemliPro(info)) {
        showWelcome('celebrate');
        feedback('success');
        track('purchase_completed', { term: current.key, student, trial: !!days });
        // The store's answer decides, not the product's intro offer (Oct 27, 2026): someone who
        // already used a trial pays today and must not get a "trial ends" reminder.
        // useReminderSync clears it once the entitlement stops being a renewing trial.
        const entitled = info.entitlements.active[PLUS_ENTITLEMENT];
        if (trialRenews(info) && entitled?.expirationDate) setSettings({ trial: { endsAt: entitled.expirationDate, label: `${selected.product.priceString} ${current.billed}` } });
        else setSettings({ trial: null });
      } else {
        setNotice('Your purchase completed, but Plus isn’t active yet. Try Restore below. If it still doesn’t work, email hello@semli.app.');
      }
    } catch {
      // The provider exposes actionable failures in `error`.
    } finally {
      actionInProgress.current = false;
    }
  }

  async function restorePlan() {
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    setNotice(null);
    try {
      const info = await restore();
      if (hasSemliPro(info)) track('purchase_restored', {});
      setNotice(hasSemliPro(info) ? 'Your Semli Plus purchase is restored.' : 'No Semli Plus purchases were found for this store account.');
    } catch {
      // The provider displays a friendly error.
    } finally {
      actionInProgress.current = false;
    }
  }

  const legal = async (url: string) => {
    if (!(await openLink(url))) setNotice('We couldn’t open that page. It is at semli.app.');
  };

  const leave = () => { if (onComplete) onComplete(); else { setWelcome(null); onWelcome?.(); } };
  // Each Plus row closes this screen, then opens the feature where it starts.
  const goTo = (to: PlusDestination) => {
    leave();
    setTimeout(() => {
      if (to === 'canvas') router.push('/settings/canvas');
      else router.navigate({ pathname: '/add', params: to === 'shifts' ? { source: 'image', at: String(Date.now()) } : {} });
    }, durations.base);
  };

  if (welcome) return <PlusWelcome celebrate={welcome === 'celebrate'} trialEndsAt={trial?.endsAt} onGo={goTo} onDone={leave} c={c} />;

  if (isPlus && !previewPlans) {
    return (
      <View style={{ gap: space.xl }}>
        <View style={{ gap: space.hair }}>
          <T token="callout" color={c.inkSecondary}>Semli <T token="callout" color={c.accentInk}>Plus</T> · Active</T>
          <T token="displayXl" color={c.inkPrimary}>Unlimited</T>
          <T token="callout" color={c.inkSecondary} style={{ paddingTop: space.xxs }}>
            {entitlement?.expirationDate ? `${entitlement.willRenew ? 'Renews' : 'Access until'} ${fullDate(localParts(new Date(entitlement.expirationDate)).date)}.` : 'Your Plus subscription is active.'}
          </T>
          {plusLately ? <T token="body" color={c.inkPrimary} style={{ paddingTop: space.sm }}>{plusLately}</T> : null}
        </View>
        <PlusFeatures c={c} onGo={goTo} />
        {onComplete ? <Press accessibilityRole="button" onPress={onComplete} style={styles.textBtn}><T token="subhead" color={c.inkSecondary}>Continue</T></Press> : null}
        {customerCenterEnabled || customerInfo?.managementURL ? (
          <Press accessibilityRole="button" disabled={disabled} onPress={() => { setNotice(null); void manageSubscription().catch(() => {}); }} style={styles.textBtn}>
            <T token="subhead" color={c.inkSecondary}>{busy ? 'Opening…' : 'Manage subscription'}</T>
          </Press>
        ) : null}
        {__DEV__ ? <Press accessibilityRole="button" onPress={() => showWelcome('celebrate')} style={styles.textBtn}><T token="caption" color={c.inkSecondary}>Preview welcome · development only</T></Press> : null}
        {__DEV__ ? <Press accessibilityRole="button" onPress={() => { setPreviewPlans(true); onWelcome?.(); }} style={styles.textBtn}><T token="caption" color={c.inkSecondary}>Preview paywall · development only</T></Press> : null}
        {notice || error ? <T token="caption" color={c.inkSecondary} accessibilityRole="alert">{notice ?? error}</T> : null}
        <Links onRestore={() => void restorePlan()} onLegal={legal} disabled={disabled} c={c} />
      </View>
    );
  }

  return (
    <View style={{ gap: space.xl }}>
      {previewPlans ? <Press accessibilityRole="button" onPress={() => setPreviewPlans(false)} style={styles.textBtn}><T token="caption" color={c.accentInk}>End preview · purchases disabled</T></Press> : null}
      <View style={{ gap: space.sm }}>
        <T token="displaySerif" color={c.inkPrimary}>{headline ?? 'Get Semli Plus.'}</T>
        <T token="callout" color={c.inkSecondary}>
          Semli <T token="callout" color={c.accentInk}>Plus</T>{days ? ` · ${days} days free, then` : ''}
        </T>
        {loading ? (
          <Animated.View key="loading" exiting={exit.fade}><Skeleton width={180} height={48} round={12} /></Animated.View>
        ) : (
          <Animated.View key="price" entering={enter.fade} style={styles.priceRow}>
            <T token="displayXl" color={c.inkPrimary} tabular adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1} style={{ flexShrink: 1 }}>{selected?.product.priceString ?? '—'}</T>
            {current ? <T token="title" color={c.inkSecondary} style={{ paddingBottom: space.snug }}>{current.period}</T> : null}
          </Animated.View>
        )}
        <T token="callout" color={c.inkSecondary} style={{ paddingTop: space.xxs }}>
          Unlimited imports, Canvas sync, work schedule comparisons, suggested times for overlapping events, and alarms for urgent items. Your calendar, to-dos, reminders and overlap warnings are free.
        </T>
      </View>

      <View accessibilityRole="radiogroup" accessibilityLabel="Choose a Semli Plus plan">
        {plans.map(({ key, label, pack, months }) => {
          const on = !!pack && current?.key === key;
          const saving = pack && monthly && months > 1 ? Math.round((1 - pack.product.price / months / monthly.product.price) * 100) : 0;
          return (
            <PressRow key={key} accessibilityRole="radio" accessibilityLabel={`${label}, ${pack?.product.priceString ?? 'price unavailable'}`}
              accessibilityState={{ selected: on, disabled: disabled || !pack }} disabled={disabled || !pack}
              onPress={() => { setTerm(key); feedback('select'); setNotice(null); }} highlight={c.row} bleed={8} round={radius.small}
              style={[styles.planRow, { borderBottomColor: c.line, opacity: !pack && !loading ? fade.disabled : 1 }]}>
              <Radio on={on} />
              <T token="body" color={c.inkPrimary} style={{ flex: 1 }}>{label}</T>
              {saving >= 5 ? <StatusPill label={`Save ${saving}%`} tone="green" tabular={false} /> : null}
              <Animated.View key={pack ? 'price' : 'none'} entering={pack ? enter.fade : undefined}>
                <T token="callout" color={c.inkSecondary} tabular>{pack ? (months > 1 ? perMonth(pack, months) : `${pack.product.priceString} / mo`) : loading ? '' : 'Unavailable'}</T>
              </Animated.View>
              {!pack && loading ? <Animated.View exiting={exit.fade}><Skeleton width={64} height={14} round={7} /></Animated.View> : null}
            </PressRow>
          );
        })}
        {/* Student pricing follows the onboarding answer; a quiet switch, not a toggle (no toggles on paywalls). */}
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => { feedback('select'); setNotice(null); setSettings({ isStudent: !student }); }} style={styles.studentLink}>
          <T token="caption" color={c.inkSecondary}>
            {student ? 'Student pricing. ' : 'Regular pricing. '}
            <T token="caption" color={c.accentInk}>{student ? 'Not a student?' : 'In college? See student prices'}</T>
          </T>
        </Pressable>
      </View>

      {days && selected && current ? (
        <View style={{ gap: space.md }}>
          {[
            { when: 'Today', what: 'Your free trial starts.', color: c.added },
            { when: `Day ${Math.max(1, days - 2)}`, what: canRemind !== true ? 'Turn on notifications for a reminder before your trial ends.' : 'You’ll get a reminder before your trial ends.', color: c.changed, remind: canRemind !== true },
            { when: `Day ${days}`, what: `${selected.product.priceString} ${current.billed}. Cancel before the trial ends to avoid a charge.`, color: c.inkPrimary },
          ].map((r) => (
            <View key={r.when} style={styles.timelineRow}>
              <View style={[styles.timelineDot, { backgroundColor: r.color }]} />
              <T token="subhead" color={c.inkPrimary} style={{ width: 54 }}>{r.when}</T>
              <View style={{ flex: 1, gap: space.hair }}>
                <T token="callout" color={c.inkSecondary}>{r.what}</T>
                {'remind' in r && r.remind ? (
                  <Pressable accessibilityRole="button" onPress={() => { feedback('select'); requestNotifications().then(setCanRemind, () => setCanRemind(false)); }} style={styles.remind}>
                    <T token="subhead" color={c.accentInk}>Remind me</T>
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {!loading && !unavailableReason && !offering?.availablePackages.length && !error ? (
        <T token="callout" color={c.inkSecondary}>Plans aren’t available right now. You can keep using Semli for free.</T>
      ) : null}
      {unavailableReason || error || notice ? <T token="caption" color={c.inkSecondary} accessibilityRole="alert">{unavailableReason ?? error ?? notice}</T> : null}

      <View style={{ gap: space.sm, paddingTop: space.xxs, alignItems: 'center' }}>
        <Press haptic="tap" accessibilityRole="button" accessibilityState={{ disabled: disabled || !selected || previewPlans }} disabled={disabled || !selected || previewPlans} onPress={() => void buyPlan()}
          style={[styles.cta, { backgroundColor: c.controlFill, opacity: disabled || !selected || previewPlans ? 0.4 : 1 }]}>
          <T token="headline" color={c.controlInk}>{busy ? 'One moment…' : days ? 'Start free trial' : 'Get Semli Plus'}</T>
        </Press>
        <T token="subhead" color={c.inkPrimary} style={styles.center}>{Platform.OS === 'web' ? 'Cancel anytime from Your plan in You.' : 'Cancel anytime in Apple Settings.'}</T>
        <T token="caption" color={c.inkSecondary} style={styles.center}>
          {selected && current ? `${days ? `${days}-day free trial, then ` : ''}${selected.product.priceString} ${current.billed}. Renews automatically until you cancel${Platform.OS === 'web' ? '' : ' in Settings'}.` : 'Prices are shown before you confirm.'}
        </T>
        {onContinueFree ? (
          <Pressable accessibilityRole="button" disabled={busy} onPress={onContinueFree} style={styles.textBtn}>
            <T token="subhead" color={c.inkSecondary}>{`Continue free${freeImportsLeft !== undefined ? ` · ${count(freeImportsLeft, 'free import')} left` : ' · 5 imports to start, then 3 a month'}`}</T>
          </Pressable>
        ) : null}
        {!unavailableReason && (error || !offering) ? (
          <Pressable accessibilityRole="button" onPress={() => { setNotice(null); void refresh(); }} style={styles.textBtn}>
            <T token="subhead" color={c.inkSecondary}>Refresh plans</T>
          </Pressable>
        ) : null}
        <Links onRestore={() => void restorePlan()} onLegal={legal} disabled={disabled} c={c} />
        {usingTestStore && !unavailableReason ? <T token="caption" color={c.inkSecondary} style={styles.center}>Test purchases don’t charge you.</T> : null}
      </View>
    </View>
  );
}

function Links({ onRestore, onLegal, disabled, c }: { onRestore: () => void; onLegal: (url: string) => void; disabled: boolean; c: Palette }) {
  return (
    <View style={styles.links}>
      <Pressable accessibilityRole="button" disabled={disabled} onPress={onRestore} style={styles.link}><T token="caption" color={c.inkSecondary}>Restore</T></Pressable>
      <T token="caption" color={c.inkTertiary}>·</T>
      <Pressable accessibilityRole="link" onPress={() => onLegal(LINKS.terms)} style={styles.link}><T token="caption" color={c.inkSecondary}>Terms</T></Pressable>
      <T token="caption" color={c.inkTertiary}>·</T>
      <Pressable accessibilityRole="link" onPress={() => onLegal(LINKS.privacy)} style={styles.link}><T token="caption" color={c.inkSecondary}>Privacy</T></Pressable>
    </View>
  );
}

/** Closes the paywall wherever it was opened from. */
export function closePaywall() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

const styles = StyleSheet.create({
  priceRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs },
  cta: { alignSelf: 'stretch', minHeight: size.control, paddingVertical: space.sm, paddingHorizontal: space.lg, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: size.row, paddingVertical: space.sm, flexWrap: 'wrap', borderBottomWidth: StyleSheet.hairlineWidth },
  studentLink: { minHeight: size.target, justifyContent: 'center', paddingTop: space.xs },
  remind: { minHeight: 32, justifyContent: 'center', alignSelf: 'flex-start' },
  timelineRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, minHeight: 32 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, marginTop: space.snug },
  center: { textAlign: 'center' },
  textBtn: { minHeight: size.target, justifyContent: 'center' },
  links: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  link: { minHeight: 36, paddingHorizontal: space.sm, justifyContent: 'center' },
});
