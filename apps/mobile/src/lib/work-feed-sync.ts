import { localParts } from '@dayli/core';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { track } from './analytics';
import { fetchFeed, parseIcs, planCanvasSync, syncSummary } from './canvas';
import { reportError } from './errors';
import { WORK_MESSAGES, workEntries, workTarget } from './work-feed';
import { usePurchases } from '../providers/PurchasesProvider';
import { useStore, type WorkFeedSettings } from '../store';

/** The phone fetches the link itself; see `work-feed.ts` for why the web has no work link yet. */
export const WORK_FEED_AVAILABLE = Platform.OS !== 'web';

/** Opening the app resyncs at most this often; "Sync now" always runs. Matches Canvas. */
const AUTO_SYNC_MS = 3 * 60 * 60 * 1000;

let running: Promise<SyncResult> | null = null;

export type SyncResult = { ok: true; summary: string | null; total: number } | { ok: false; error: string };

const setWorkFeed = (patch: Partial<WorkFeedSettings>) => {
  const { settings, setSettings } = useStore.getState();
  setSettings({ workFeed: { ...settings.workFeed, ...patch } });
};

/**
 * Fetch the job's feed and apply the diff as one undoable batch, as Canvas's sync does: new shifts
 * added, moved ones moved (unless moved by hand), upcoming ones that left the schedule removed.
 * Connect passes the link and the job's name; a resync uses the saved ones.
 */
export function syncWorkFeed(connect?: { url: string; employer: string }): Promise<SyncResult> {
  running ??= run(connect).catch((error: unknown): SyncResult => {
    reportError('work_feed.synchronize', error);
    setWorkFeed({ lastError: WORK_MESSAGES.connection });
    return { ok: false, error: WORK_MESSAGES.connection };
  }).finally(() => { running = null; });
  return running;
}

async function run(connect?: { url: string; employer: string }): Promise<SyncResult> {
  const saved = useStore.getState().settings.workFeed;
  const url = connect?.url ?? saved.feedUrl;
  const employer = connect?.employer ?? saved.employer;
  if (!url || !employer) return { ok: false, error: WORK_MESSAGES.link };

  const res = await fetchFeed(url, { read: (text) => workEntries(parseIcs(text)), messages: WORK_MESSAGES });
  // A disconnect during the fetch stays a disconnect: writing the link back would reconnect it.
  if (useStore.getState().settings.workFeed.feedUrl !== saved.feedUrl) return { ok: false, error: WORK_MESSAGES.disconnected };
  if (!res.ok) {
    setWorkFeed({ lastError: res.error });
    track('work_feed_sync_failed', {});
    return res;
  }

  const state = useStore.getState();
  const plan = planCanvasSync(res.entries, Object.values(state.items), localParts(new Date()).date, () => null, workTarget(employer));
  const summary = syncSummary(plan);
  if (summary) {
    // Saving a plan clears `pending`, which would close an import under review.
    if (useStore.getState().pending) return { ok: false, error: WORK_MESSAGES.reviewing };
    const batchId = state.applyPlan(plan, `${employer} · ${summary}`, { source: employer });
    // Every sync after the first pull is Plus's; it says so, so a subscriber sees it working.
    const byPlus = !!saved.lastSyncedAt;
    useStore.getState().showToast(`${employer} schedule synced${byPlus ? ' with Plus' : ''} · ${summary}`, batchId);
  }
  setWorkFeed({ feedUrl: url, employer, lastSyncedAt: new Date().toISOString(), lastError: null });
  track('work_feed_synced', { total: res.entries.length, added: plan.added, moved: plan.moved, dropped: plan.dropped });
  return { ok: true, summary, total: res.entries.length };
}

/** Resync when the app opens or comes back, if it has been a while. Plus only, like Canvas. */
export function WorkFeedAutoSync() {
  const hydrated = useStore((s) => s.hydrated);
  const reviewing = useStore((s) => s.pending !== null);
  const { isPlus } = usePurchases();
  useEffect(() => {
    if (!WORK_FEED_AVAILABLE || !hydrated || !isPlus || reviewing) return;
    const maybeSync = () => {
      const { pending, settings } = useStore.getState();
      const { feedUrl, lastSyncedAt } = settings.workFeed;
      if (!feedUrl || pending) return;
      if (lastSyncedAt && Date.now() - new Date(lastSyncedAt).getTime() < AUTO_SYNC_MS) return;
      void syncWorkFeed();
    };
    maybeSync();
    const subscription = AppState.addEventListener('change', (s) => { if (s === 'active') maybeSync(); });
    return () => subscription.remove();
  }, [hydrated, isPlus, reviewing]);
  return null;
}
