import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/** Every web shortcut, for the list `?` opens. Keys are what `KeyboardEvent.key` reports. */
export const SHORTCUTS: { keys: string; does: string }[] = [
  { keys: '⌘K', does: 'Quick add, or go anywhere' },
  { keys: 'N', does: 'New to-do or event' },
  { keys: '⌘V', does: 'Import a screenshot on the clipboard' },
  { keys: '1 – 4', does: 'Today, Plan, School, You' },
  { keys: '← →', does: 'Previous or next day on Plan' },
  { keys: '⇧← ⇧→', does: 'Previous or next week on Plan' },
  { keys: 'T', does: 'Back to today on Plan' },
  { keys: 'J K', does: 'Next or previous item on Plan' },
  { keys: 'Esc', does: 'Close the open item or this list' },
  { keys: '?', does: 'Show these shortcuts' },
];

const typing = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
};

/** The listener both hooks share: runs the mapped action for a key, unless the person is typing. */
function listen(latest: { current: Record<string, () => void> }): () => void {
  const onKey = (e: KeyboardEvent) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || typing(e.target)) return;
    const key = e.shiftKey && e.key.startsWith('Arrow') ? `Shift+${e.key}` : e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const run = latest.current[key] ?? (key === '?' ? undefined : latest.current[e.key]);
    if (!run) return;
    e.preventDefault();
    run();
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}

/**
 * Single-key shortcuts on the web, keyed by `KeyboardEvent.key` (Shift+arrows as "Shift+ArrowLeft").
 * Ignored while typing in a field and when ⌘, Ctrl or Alt is held, so they never take a browser's
 * own shortcut or a letter someone meant to type.
 */
export function useWebShortcuts(map: Record<string, () => void>, enabled = true): void {
  const latest = useRef(map);
  useEffect(() => { latest.current = map; });
  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    return listen(latest);
  }, [enabled]);
}

/**
 * The same, for a tab screen: listens only while the screen is focused. It follows focus through
 * `useFocusEffect` instead of `useIsFocused`, so switching tabs never re-renders the screen; on
 * iOS and Android it does nothing at all.
 */
export function useScreenShortcuts(map: Record<string, () => void>, enabled = true): void {
  const latest = useRef(map);
  useEffect(() => { latest.current = map; });
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'web' || !enabled) return;
    return listen(latest);
  }, [enabled]));
}
