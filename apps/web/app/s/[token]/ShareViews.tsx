'use client';

import { useSyncExternalStore, type ReactNode } from 'react';

import styles from './share.module.css';

type View = 'list' | 'week';
const KEY = 'semli.share-view';

/** The app's own glyphs (components/Icon.tsx): bars for the week by the hour, lines for the list. */
const PATHS: Record<View, string> = { list: 'M4 7h16M4 12h16M4 17h10', week: 'M5 20V10M12 20V4M19 20v-7' };

/** The reader's choice: kept in their browser, and for this visit when storage is blocked. */
let chosen: View | null = null;
const listeners = new Set<() => void>();
function saved(): View {
  if (chosen) return chosen;
  try {
    return localStorage.getItem(KEY) === 'week' ? 'week' : 'list';
  } catch {
    return 'list';
  }
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => { listeners.delete(listener); window.removeEventListener('storage', listener); };
}
function choose(view: View) {
  chosen = view;
  try { localStorage.setItem(KEY, view); } catch { /* the choice lasts this visit */ }
  for (const l of listeners) l();
}

/**
 * The compact list or the expanded two-week grid, switched from the corner as Today switches its
 * list and its hours. The list comes first, as on Today; the reader's choice is kept in their browser.
 */
export function ShareViews({ head, list, week }: { head: ReactNode; list: ReactNode; week: ReactNode | null }) {
  // The server and the first paint show the list; the saved choice takes over once the page is live.
  const view = useSyncExternalStore(subscribe, saved, () => 'list' as View);
  const next: View = view === 'list' ? 'week' : 'list';
  const toggle = () => choose(next);
  return (
    <>
      <div className={styles.headRow}>
        {head}
        {week ? (
          <button type="button" className={styles.viewToggle} onClick={toggle}
            aria-label={view === 'list' ? 'Show the two weeks by the hour' : 'Show the list'}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={PATHS[next]} />
            </svg>
          </button>
        ) : null}
      </div>
      {view === 'week' && week ? week : list}
    </>
  );
}
