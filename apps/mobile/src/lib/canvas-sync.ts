import { localParts, normalizeTitle } from '@dayli/core';
import type { Course } from '@dayli/schema';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { track } from './analytics';
import { reportError } from './errors';
import { CANVAS_MESSAGES, CANVAS_SOURCE, courseCodeOf, fetchCanvasFeed, planCanvasSync, syncSummary, type FeedLoader } from './canvas';
import { supabase } from './supabase';
import { usePurchases } from '../providers/PurchasesProvider';
import { newId, useStore } from '../store';

/** Canvas doesn't let other sites' pages read its feed, so the web asks Semli's server to fetch it. */
const throughSemli: FeedLoader = async (url, signal) => {
  const { data } = await supabase!.auth.getSession();
  return fetch(`${useStore.getState().settings.apiUrl}/api/canvas-feed`, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${data.session?.access_token ?? ''}` },
    body: JSON.stringify({ url }),
  });
};

/** Opening the app resyncs at most this often; "Sync now" always runs. */
const AUTO_SYNC_MS = 3 * 60 * 60 * 1000;

let running: Promise<SyncResult> | null = null;

export type SyncResult = { ok: true; summary: string | null; total: number } | { ok: false; error: string };

/**
 * Fetch the feed and apply the diff as one undoable batch. A failure never touches items:
 * the last good sync stays on screen and the error waits on the Canvas screen.
 */
export function syncCanvas(feedUrl?: string): Promise<SyncResult> {
  running ??= run(feedUrl).catch((error: unknown): SyncResult => {
    reportError('canvas.synchronize', error);
    const { settings, setSettings } = useStore.getState();
    setSettings({ canvas: { ...settings.canvas, lastError: CANVAS_MESSAGES.connection } });
    return { ok: false, error: CANVAS_MESSAGES.connection };
  }).finally(() => { running = null; });
  return running;
}

async function run(feedUrl?: string): Promise<SyncResult> {
  const url = feedUrl ?? useStore.getState().settings.canvas.feedUrl;
  if (!url) return { ok: false, error: CANVAS_MESSAGES.link };
  const setCanvas = (patch: Partial<ReturnType<typeof useStore.getState>['settings']['canvas']>) => {
    const { settings, setSettings } = useStore.getState();
    setSettings({ canvas: { ...settings.canvas, ...patch } });
  };
  const res = await fetchCanvasFeed(url, undefined, Platform.OS === 'web' ? throughSemli : undefined);
  if (!res.ok) {
    setCanvas({ lastError: res.error });
    track('canvas_sync_failed', {});
    return res;
  }

  const state = useStore.getState();
  const today = localParts(new Date()).date;
  const newCourses: Course[] = [];
  const byLabel = (label: string | null) => {
    if (!label) return null;
    const code = courseCodeOf(label);
    const match = [...state.courses, ...newCourses].find((k) =>
      (code && k.code && normalizeTitle(k.code) === normalizeTitle(code)) || normalizeTitle(k.title) === normalizeTitle(label));
    return match?.id ?? null;
  };
  // First pass names the missing courses; create them, then plan again so items get their ids.
  for (const label of planCanvasSync(res.entries, Object.values(state.items), today, byLabel).newCourses) {
    newCourses.push({ id: newId(), code: courseCodeOf(label), title: label, instructor: null, sourceId: CANVAS_SOURCE });
  }
  const plan = planCanvasSync(res.entries, Object.values(state.items), today, byLabel);
  const summary = syncSummary(plan);

  if (summary || newCourses.length) {
    const batchId = state.applyPlan(plan, `Canvas · ${summary ?? 'courses added'}`, { source: CANVAS_SOURCE, courses: newCourses });
    // Every sync after the first pull is Plus's; it says so, so a subscriber sees it working.
    const byPlus = !!state.settings.canvas.lastSyncedAt;
    useStore.getState().showToast(`${byPlus ? 'Canvas synced with Plus' : 'Canvas synced'} · ${summary ?? 'up to date'}`, batchId);
  }
  setCanvas({ feedUrl: url, lastSyncedAt: new Date().toISOString(), lastError: null });
  track('canvas_synced', { total: res.entries.length, added: plan.added, moved: plan.moved, dropped: plan.dropped });
  return { ok: true, summary, total: res.entries.length };
}

/**
 * Resync when the app opens or comes back, if it has been a while. Quiet unless something changed.
 * The first sync is free (it is the onboarding import); keeping it in sync is Plus.
 */
export function CanvasAutoSync() {
  const hydrated = useStore((s) => s.hydrated);
  const { isPlus } = usePurchases();
  useEffect(() => {
    if (!hydrated || !isPlus) return;
    const maybeSync = () => {
      const { feedUrl, lastSyncedAt } = useStore.getState().settings.canvas;
      if (!feedUrl) return;
      if (lastSyncedAt && Date.now() - new Date(lastSyncedAt).getTime() < AUTO_SYNC_MS) return;
      void syncCanvas();
    };
    maybeSync();
    const subscription = AppState.addEventListener('change', (s) => { if (s === 'active') maybeSync(); });
    return () => subscription.remove();
  }, [hydrated, isPlus]);
  return null;
}
