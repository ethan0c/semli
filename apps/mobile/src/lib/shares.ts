import { SHARE_SNAPSHOT_DAYS, addDays, localParts, shareEntries, typicalTermEnd, type SharedEntry } from '@dayli/core';
import type { Category, Item } from '@dayli/schema';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';

import { track } from './analytics';
import { SHARING_ENABLED } from './auth';
import { reportError } from './errors';
import { SITE_URL } from './links';
import { firstOf } from './milestones';
import { realRecords } from './planner-preview';
import { accountOf, supabase, useSession } from './supabase';
import { useStore } from '../store';

/*
 * Schedule share links (table `schedule_shares`): a read-only page on the site showing the coming
 * two weeks, for a parent or a friend. The phone sends only the projection a reader may see, and
 * sends it again whenever the plan changes, so the page stays current while the owner uses Semli.
 * School and work only; personal plans and the iPhone's calendar never leave the phone.
 */

export type ShareLink = {
  id: string;
  token: string;
  title: string;
  options: { categories: Category[]; showTitles: boolean; timezone: string };
  createdAt: string;
  updatedAt: string;
  /** When the link stops on its own; null runs until it's stopped. */
  expiresAt: string | null;
};

/** How long a new link lasts: until it's stopped (the parent's link), a week, or the end of the term. */
export type ShareEnd = 'never' | 'week' | 'term';

/** The moment a link with this end stops: a week from now, or the last minute of the term's estimated last day. */
export function shareEndsAt(end: ShareEnd, now = new Date()): string | null {
  if (end === 'never') return null;
  if (end === 'week') return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  return new Date(`${typicalTermEnd(localParts(now).date).date}T23:59:00`).toISOString();
}

const live = (link: ShareLink) => !link.expiresAt || new Date(link.expiresAt).getTime() > Date.now();

/** What a link may show; personal plans are never shared. */
export const SHARE_CATEGORIES: Category[] = ['school', 'work'];
/** The site's own host, not the bare domain, so the link opens without a redirect. */
export const shareUrl = (token: string) => `${SITE_URL.replace('://', '://www.')}/s/${token}`;
/** Plan changes are sent this long after the last one, so a burst of edits is one write per link. */
const PUSH_AFTER_MS = 5_000;
/** Opening the app sends a fresh copy at most this often, so the two weeks move on even without edits. */
const REFRESH_EVERY_MS = 60 * 60 * 1000;

export const useShares = create<{ links: ShareLink[]; loaded: boolean; pushedAt: number }>(() => ({ links: [], loaded: false, pushedAt: 0 }));

const signedIn = () => SHARING_ENABLED && !!supabase && !!accountOf(useSession.getState().session);

/** The person's own plans: never the onboarding sample week, which only looks like a plan. */
export function shareable(items: Item[], sampleBatchId: string | null): Item[] {
  return realRecords(items).filter((i) => !sampleBatchId || i.batchId !== sampleBatchId);
}

/** What a link with these options shows right now, from yesterday to three weeks out. */
export function snapshot(options: Pick<ShareLink['options'], 'categories' | 'showTitles'>): SharedEntry[] {
  const today = localParts(new Date()).date;
  const { items: all, settings } = useStore.getState();
  const items = shareable(Object.values(all), settings.sampleBatchId);
  const categories = options.categories.filter((c) => SHARE_CATEGORIES.includes(c));
  return shareEntries(items, addDays(today, -1), addDays(today, SHARE_SNAPSHOT_DAYS - 1), categories, options.showTitles);
}

type Row = { id: string; token: string; title: string; options: ShareLink['options']; created_at: string; updated_at: string; expires_at: string | null };
const toLink = (r: Row): ShareLink => ({ id: r.id, token: r.token, title: r.title, options: r.options, createdAt: r.created_at, updatedAt: r.updated_at, expiresAt: r.expires_at });
const COLUMNS = 'id, token, title, options, created_at, updated_at, expires_at';

export async function loadShares(): Promise<void> {
  if (!signedIn()) return;
  const { data, error } = await supabase!.from('schedule_shares').select(COLUMNS).is('revoked_at', null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`).order('created_at', { ascending: false });
  if (error) throw error;
  useShares.setState({ links: (data as Row[]).map(toLink), loaded: true });
}

/** Makes a link and returns its address. The title is the owner's first name, never their email. */
export async function createShare(categories: Category[], showTitles: boolean, end: ShareEnd = 'never'): Promise<string> {
  if (!signedIn()) throw new Error('Sign in to share your schedule.');
  const first = firstOf(useStore.getState().settings.name);
  const options = { categories: categories.filter((c) => SHARE_CATEGORIES.includes(c)), showTitles, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone };
  const { data, error } = await supabase!.from('schedule_shares')
    .insert({ title: first ? `${first}’s schedule` : 'My schedule', options, entries: snapshot(options), expires_at: shareEndsAt(end) })
    .select(COLUMNS).single();
  if (error) throw error;
  const link = toLink(data as Row);
  useShares.setState((s) => ({ links: [link, ...s.links] }));
  track('share_link_created', { categories: options.categories.join(','), titles: showTitles, ends: end });
  return shareUrl(link.token);
}

/** Stops a link for good: the page says it stopped, and what it showed is cleared on the server. */
export async function stopShare(id: string): Promise<void> {
  const { error } = await supabase!.from('schedule_shares').update({ revoked_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
  useShares.setState((s) => ({ links: s.links.filter((l) => l.id !== id) }));
  track('share_link_stopped', {});
}

let pushing: Promise<void> | null = null;

/** Sends every live link a fresh copy of what it shows. A failure waits for the next change or launch. */
export function pushShares(): Promise<void> {
  pushing ??= (async () => {
    // A link past its end reads as stopped on the site; it drops out here too.
    const links = useShares.getState().links.filter(live);
    useShares.setState({ links });
    if (!signedIn() || !links.length) return;
    const now = new Date().toISOString();
    await Promise.all(links.map(async (link) => {
      const { error } = await supabase!.from('schedule_shares').update({ entries: snapshot(link.options) }).eq('id', link.id);
      if (error) throw error;
    }));
    useShares.setState((s) => ({ pushedAt: Date.now(), links: s.links.map((l) => ({ ...l, updatedAt: now })) }));
  })().catch((error: unknown) => reportError('shares.push', error)).finally(() => { pushing = null; });
  return pushing;
}

/** In the root layout: loads the account's links once signed in, then keeps them current. */
export function useShareSync() {
  const account = useSession((s) => accountOf(s.session)?.user.id ?? null);
  const items = useStore((s) => s.items);
  useEffect(() => {
    if (!SHARING_ENABLED) return;
    if (!account) { useShares.setState({ links: [], loaded: false, pushedAt: 0 }); return; }
    loadShares().then(() => pushShares()).catch((error: unknown) => reportError('shares.load', error));
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && Date.now() - useShares.getState().pushedAt > REFRESH_EVERY_MS) void pushShares();
    });
    return () => sub.remove();
  }, [account]);
  useEffect(() => {
    if (!SHARING_ENABLED || !account || !useShares.getState().links.length) return;
    const timer = setTimeout(() => void pushShares(), PUSH_AFTER_MS);
    return () => clearTimeout(timer);
  }, [account, items]);
}
