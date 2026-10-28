import { SHARE_DAYS, addDays, formatRange, formatTime, localParts, monthDay, shareEntries, weekdayLong, type SharedEntry } from '@dayli/core';
import type { Category } from '@dayli/schema';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, Share, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Chip, GroupLabel, TextButton } from '@/components/Controls';
import { NativeToggle } from '@/components/Native';
import { Segmented } from '@/components/Segmented';
import { Button, Sheet } from '@/components/Sheet';
import { T } from '@/components/Text';
import { Wordmark } from '@/components/Wordmark';
import { track } from '@/lib/analytics';
import { SHARING_ENABLED } from '@/lib/auth';
import { reportError } from '@/lib/errors';
import { feedback } from '@/lib/feedback';
import { enter, exit, layout } from '@/lib/motion';
import { SHARE_CATEGORIES, createShare, shareEndsAt, shareable, type ShareEnd, loadShares, shareUrl, stopShare, useShares, type ShareLink } from '@/lib/shares';
import { accountOf, useSession } from '@/lib/supabase';
import { useStore } from '@/store';
import { SCREEN_GUTTER, corner, radius, useTheme, space, size } from '@/theme';

const CATEGORY_LABELS: Record<Category, string> = { school: 'School', work: 'Work', personal: 'Personal' };

function entryTime(entry: SharedEntry): string {
  if (!entry.start) return entry.isDeadline ? 'Due' : entry.kind === 'event' ? 'All day' : 'Any time';
  if (entry.isDeadline && entry.kind === 'task') return `Due ${formatTime(entry.start, true)}`;
  if (!entry.end || entry.kind === 'task') return formatTime(entry.start, true);
  return `${formatRange(entry.start, entry.end)}${entry.end <= entry.start ? ' · next day' : ''}`;
}

function ago(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 2) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.round(hours / 24)} d ago`;
}

/** The share sheet on the phone; a laptop copies the address instead. */
async function send(url: string, title: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    await navigator.clipboard.writeText(url);
    return 'Link copied.';
  }
  await Share.share({ url, message: `${title}: ${url}` });
  return null;
}

/** A read-only link to the coming two weeks, for a parent or a friend (table `schedule_shares`). */
export default function ShareScheduleScreen() {
  if (!SHARING_ENABLED) return <Redirect href="/plan" />;
  return <ShareSchedule />;
}

function ShareSchedule() {
  const { c } = useTheme();
  const signedIn = useSession((s) => !!accountOf(s.session));
  const items = useStore((s) => s.items);
  const showToast = useStore((s) => s.showToast);
  const links = useShares((s) => s.links);
  const [categories, setCategories] = useState<Category[]>(SHARE_CATEGORIES);
  const [showTitles, setShowTitles] = useState(true);
  const [end, setEnd] = useState<ShareEnd>('never');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (signedIn) loadShares().catch((e: unknown) => reportError('shares.load', e)); }, [signedIn]);

  const today = localParts(new Date()).date;
  const to = addDays(today, SHARE_DAYS - 1);
  const sampleBatchId = useStore((s) => s.settings.sampleBatchId);
  const preview = shareEntries(shareable(Object.values(items), sampleBatchId), today, to, categories, showTitles);
  const dates = [...new Set(preview.map((e) => (e.date < today ? today : e.date)))];

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const url = await createShare(categories, showTitles, end);
      feedback('success');
      const note = await send(url, 'My schedule');
      showToast(note ?? 'Your link is ready. It updates as you use Semli.');
    } catch (e) {
      reportError('shares.create', e);
      setError(/Too many/.test(String((e as { message?: unknown })?.message)) ? 'You have 20 links already. Stop one you no longer need first.' : 'Semli couldn’t make the link. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Share your schedule" footer={signedIn ? <>
      <Button label={busy ? 'Making your link…' : 'Create link'} disabled={busy || !categories.length} onPress={() => void create()} />
      {error ? <T token="caption" color={c.conflict} style={styles.center}>{error}</T> : null}
    </> : <Button label="Create a free account" onPress={() => router.push('/account')} />}>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.hero}>
          <T token="display" accessibilityRole="header">Your next two weeks, shared.</T>
          <T token="body" color={c.inkSecondary}>
            {signedIn
              ? 'Anyone with the link can view your schedule in a browser. They don’t need the app. It updates as you use Semli, and you can stop sharing at any time.'
              : 'Create a free account or sign in to share your schedule and manage your links.'}
          </T>
        </View>

        {signedIn && links.length ? (
          <View style={{ gap: space.xs }}>
            <GroupLabel>Your links</GroupLabel>
            {links.map((link) => (
              <Animated.View key={link.id} layout={layout} entering={enter.fade} exiting={exit.fade}>
                <LinkRow link={link} />
              </Animated.View>
            ))}
          </View>
        ) : null}

        <View style={{ gap: space.md }}>
          <GroupLabel>{links.length ? 'A new link' : 'Choose what they see'}</GroupLabel>
          <View style={styles.chips}>
            {SHARE_CATEGORIES.map((key) => (
              <Chip key={key} label={CATEGORY_LABELS[key]} on={categories.includes(key)}
                onPress={() => setCategories((current) => current.includes(key) ? current.filter((k) => k !== key) : [...current, key])} />
            ))}
          </View>
          <View style={[styles.toggle, { borderBottomColor: c.line }]}>
            <View style={{ flex: 1, gap: space.xxs }}>
              <T token="body">Show event and task names</T>
              <T token="caption" color={c.inkSecondary}>Turn off to show “Busy” and “To-do” instead.</T>
            </View>
            <NativeToggle label="Show event and task names" value={showTitles} onChange={setShowTitles} />
          </View>
          <View style={{ gap: space.xs }}>
            <T token="body">When sharing ends</T>
            <Segmented label="When sharing ends" value={end} onChange={setEnd} options={[
              { key: 'never', label: 'When I stop it' },
              { key: 'week', label: 'In a week' },
              { key: 'term', label: 'End of term' },
            ]} />
            <T token="caption" color={c.inkSecondary}>
              {end === 'never' ? 'The link stays active until you stop sharing.'
                : `Expires on ${monthDay(localParts(new Date(shareEndsAt(end)!)).date)}${end === 'term' ? ', based on your estimated term end' : ''}. You can stop sharing sooner.`}
            </T>
          </View>
        </View>

        <View style={{ gap: space.sm }}>
          <GroupLabel>What they’ll see</GroupLabel>
          <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
            <Wordmark width={56} ink={c.inkPrimary} dot={c.accent} />
            <T token="headline">My schedule</T>
            <T token="callout" color={c.inkSecondary}>{monthDay(today)} – {monthDay(to)} · Read-only</T>
          </View>
          {dates.length ? dates.map((day) => (
            <View key={day}>
              <T token="headline" style={{ paddingVertical: space.sm }}>{weekdayLong(day)}, {monthDay(day)}</T>
              {preview.filter((e) => (e.date < today ? today : e.date) === day).map((entry, i) => (
                <View key={i} style={[styles.entry, { borderBottomColor: c.line }]}>
                  <T token="body" style={{ flex: 1 }}>{entry.title}</T>
                  <T token="subhead" tabular color={c.inkSecondary}>{entryTime(entry)}</T>
                </View>
              ))}
            </View>
          )) : (
            <T token="callout" color={c.inkSecondary}>{categories.length ? 'No plans to share in the next two weeks.' : 'Choose school, work or both.'}</T>
          )}
          <T token="caption" color={c.inkSecondary} style={{ paddingTop: space.sm }}>
            The page title uses your first name, if you’ve added one. Personal plans, notes, files, your iPhone calendar and sign-in details aren’t included.
          </T>
        </View>
      </ScrollView>
    </Sheet>
  );
}

/** One live link: what it shows, how fresh it is, send it again, or stop it for good. */
function LinkRow({ link }: { link: ShareLink }) {
  const { c } = useTheme();
  const showToast = useStore((s) => s.showToast);
  const [confirming, setConfirming] = useState(false);
  const shows = `${link.options.categories.map((k) => CATEGORY_LABELS[k]).join(' and ')}${link.options.showTitles ? '' : ', names hidden'}`;
  const resend = async () => {
    try {
      const note = await send(shareUrl(link.token), link.title);
      track('share_link_sent', {});
      if (note) showToast(note);
    } catch (e) {
      reportError('shares.send', e);
    }
  };
  const stop = async () => {
    try {
      await stopShare(link.id);
      feedback('remove');
      showToast('Sharing stopped. This link no longer opens your schedule.');
    } catch (e) {
      reportError('shares.stop', e);
      showToast('Semli couldn’t stop the link. Check your connection and try again.');
    }
  };
  return (
    <View style={[styles.link, { borderBottomColor: c.line }]}>
      <View style={{ gap: space.xxs }}>
        <T token="body">{shows}</T>
        <T token="caption" color={c.inkSecondary}>{link.expiresAt ? `Expires ${monthDay(localParts(new Date(link.expiresAt)).date)}` : 'Until you stop sharing'} · Updated {ago(link.updatedAt)}</T>
      </View>
      {confirming ? (
        <View style={{ gap: space.xs }}>
          <T token="caption" color={c.inkSecondary}>Stop sharing with this link? It will stop working for everyone and can’t be used again. You can create a new link later.</T>
          <View style={styles.actions}>
            <TextButton label="Stop sharing" tone="danger" onPress={() => void stop()} />
            <TextButton label="Keep sharing" tone="muted" onPress={() => setConfirming(false)} />
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          <TextButton label={Platform.OS === 'web' ? 'Copy link' : 'Send again'} onPress={() => void resend()} />
          <TextButton label="Stop sharing" tone="muted" onPress={() => setConfirming(true)} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: SCREEN_GUTTER, paddingTop: space.sm, paddingBottom: space.xxl, gap: space.xl },
  hero: { gap: space.sm },
  center: { textAlign: 'center', flexShrink: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  card: { borderWidth: StyleSheet.hairlineWidth, ...corner(radius.field), padding: space.lg, gap: space.xs },
  entry: { minHeight: size.compact, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  link: { gap: space.sm, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.lg },
});

