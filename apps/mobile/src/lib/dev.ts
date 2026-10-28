import type { ExtractResponse, Extraction } from '@dayli/schema';
import { File, Paths } from 'expo-file-system';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';

import { sampleScheduleExtraction, sampleScheduleUpdate, sampleSyllabusExtraction } from '@/store/sample';

/** On the web there is no Documents folder: the same commands come from the URL (`?dev=sample&clock=09:41`). */
function webParam(name: string): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(name)?.trim() || null;
}

/**
 * Development only: a file named `dev-step.txt` in the app's Documents folder names an
 * onboarding step to open at launch, so screens can be screenshotted without tapping through.
 * Steps: plate, deadlines, own, canvas, result, remind, plus (or welcome).
 * Write it with: echo result > "$(xcrun simctl get_app_container booted app.semli.mobile data)/Documents/dev-step.txt"
 */
export async function devStep(): Promise<string | null> {
  if (!__DEV__) return null;
  if (Platform.OS === 'web') return webParam('step');
  try {
    const f = new File(Paths.document, 'dev-step.txt');
    if (!f.exists) return null;
    return (await f.text()).trim() || null;
  } catch {
    return null;
  }
}

/** Reads the dev file as a command: "sample", "moment", "spread", "item", "hours", "list", "plus", "review", "review-syllabus", or "review-update". */
export async function devCommand(): Promise<string | null> {
  if (!__DEV__) return null;
  if (Platform.OS === 'web') return webParam('dev');
  try {
    const f = new File(Paths.document, 'dev-command.txt');
    if (!f.exists) return null;
    return (await f.text()).trim() || null;
  } catch {
    return null;
  }
}

/**
 * Development only: `dev-import.txt` names the import a recording makes, answered from the
 * samples instead of the API: "schedule" (next week's shifts), "update" (this week's, changed)
 * or "syllabus". The screens are the real ones; only the network is skipped.
 */
export type DevImport = 'schedule' | 'update' | 'syllabus';
export async function devImport(): Promise<DevImport | null> {
  if (!__DEV__) return null;
  const v = Platform.OS === 'web' ? webParam('import') : await (async () => {
    try {
      const f = new File(Paths.document, 'dev-import.txt');
      return f.exists ? (await f.text()).trim() : null;
    } catch {
      return null;
    }
  })();
  return v === 'schedule' || v === 'update' || v === 'syllabus' ? v : null;
}

let devImportMode: { mode: DevImport; today: string } | null = null;
export function setDevImport(mode: DevImport | null, today: string) {
  if (__DEV__) devImportMode = mode ? { mode, today } : null;
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** The recording's import, answered from the samples: rows arrive one by one, as a real read would. */
export async function devImportAnswer(hooks?: { onItem: (item: Extraction['items'][number]) => void }): Promise<ExtractResponse | null> {
  if (!__DEV__ || !devImportMode) return null;
  const { mode, today } = devImportMode;
  const extraction = mode === 'syllabus' ? sampleSyllabusExtraction(today) : mode === 'update' ? sampleScheduleUpdate(today) : sampleScheduleExtraction(today);
  await wait(1400);
  for (const item of extraction.items) {
    hooks?.onItem(item);
    await wait(mode === 'syllabus' ? 240 : 340);
  }
  await wait(700);
  return { ok: true, extraction };
}

/** The syllabus a recording "picks": the Files sheet is system UI, so it is skipped and the PDF is named. */
export function devImportFile(): { input: { kind: 'pdf'; data: string }; source: string } | null {
  if (!__DEV__ || devImportMode?.mode !== 'syllabus') return null;
  return { input: { kind: 'pdf', data: '' }, source: 'NURS210-syllabus.pdf' };
}

/** Development only: `dev-clock.txt` holds an HH:mm the app shows as now, so screenshots match the 9:41 status bar. */
export async function devClock(): Promise<string | null> {
  if (!__DEV__) return null;
  if (Platform.OS === 'web') return webParam('clock');
  try {
    const f = new File(Paths.document, 'dev-clock.txt');
    if (!f.exists) return null;
    return (await f.text()).trim() || null;
  } catch {
    return null;
  }
}

/** Development only: `dev-appearance.txt` holds light, dark or system, so a capture can show either appearance. */
export async function devAppearance(): Promise<'light' | 'dark' | 'system' | null> {
  if (!__DEV__) return null;
  if (Platform.OS === 'web') { const v = webParam('appearance'); return v === 'light' || v === 'dark' || v === 'system' ? v : null; }
  try {
    const f = new File(Paths.document, 'dev-appearance.txt');
    if (!f.exists) return null;
    const v = (await f.text()).trim();
    return v === 'light' || v === 'dark' || v === 'system' ? v : null;
  } catch {
    return null;
  }
}

/**
 * Development only: when set, the review screen confirms itself after this many milliseconds,
 * so a recording shows the whole import without a tap. Set by the `demo` commands at launch.
 */
export let devAutoConfirmMs = 0;
export function setDevAutoConfirm(ms: number) {
  if (__DEV__) devAutoConfirmMs = ms;
}

/**
 * Development only: how Today opens for a capture. `spreadOpen` (set by `spread`) opens the
 * heavy-week moment with its spread list showing; `noMoment` (set by `list` and `hours`) shows the
 * everyday header with the sky, whatever the sample data. Reactive, because the command runs after
 * Today has mounted.
 */
type DevToday = { spreadOpen: boolean; noMoment: boolean };
let devToday: DevToday = { spreadOpen: false, noMoment: false };
const devTodayListeners = new Set<() => void>();
export function setDevToday(next: Partial<DevToday>) {
  if (!__DEV__) return;
  devToday = { ...devToday, ...next };
  devTodayListeners.forEach((l) => l());
}
export function useDevToday(): DevToday {
  return useSyncExternalStore((l) => { devTodayListeners.add(l); return () => { devTodayListeners.delete(l); }; }, () => devToday);
}
