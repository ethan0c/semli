import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { nextTranscript } from '@dayli/core';

import { track } from '@/lib/analytics';
import { reportError } from '@/lib/errors';
import { feedback } from '@/lib/feedback';
import { openSystemSettings } from '@/lib/links';
import { springs } from '@/lib/motion';

/*
 * Voice capture: Apple's speech recognition, on the phone when the model is there, through
 * expo-speech-recognition. Everything about the library lives in this file. The transcript is
 * plain text that the composer owns from the moment listening stops; the server never hears
 * audio, it reads the words exactly as it reads a typed message.
 */

export type VoiceState = 'idle' | 'listening' | 'stopping';
export type VoiceTranscript = {
  /** Words that have stayed the same across the last two results: shown in primary ink. */
  stable: string;
  /** The tail still being worked out: shown in secondary ink. */
  tail: string;
};

export const VOICE_AVAILABLE = Platform.OS === 'ios';
/** More than this and the model does worse, not better; one week at a time. */
const MAX_CHARS = 2000;
const LEVEL_FLOOR = 0;
const LEVEL_CEIL = 10;
/** How many recent volume readings the composer draws as bars (one every 100 ms). */
export const LEVEL_HISTORY = 28;
/** How long a stop may wait for Apple's last result before the session is ended anyway. */
const STOP_GRACE_MS = 1500;

export const VOICE_ERRORS = {
  denied: 'Allow microphone and speech recognition access in Settings to add plans by voice.',
  deniedManual: 'Open your device Settings, choose Semli, then allow Microphone and Speech Recognition.',
  offline: 'Voice input needs an internet connection. You can type your plans instead.',
  unavailable: 'Voice input isn’t available on this device. You can type your plans instead.',
  failed: 'Voice input stopped. Your text is still here. Tap the microphone to continue.',
  long: 'This message has reached the voice input limit. Review it, then add the rest in a new message.',
} as const;

function sameWords(previous: string, current: string): string {
  const a = previous.split(/\s+/);
  const b = current.split(/\s+/);
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return b.slice(0, n).join(' ');
}

/**
 * Owns permissions, the session, and the transcript. `onText` receives the whole text each
 * time it changes (what was typed before, plus what has been said), so the composer stays
 * the source of truth and editing after a stop needs nothing special.
 */
export function useVoiceCapture({ prefix, onText }: { prefix: string; onText: (text: string) => void }): {
  state: VoiceState;
  transcript: VoiceTranscript;
  level: SharedValue<number>;
  error: string | null;
  start: () => Promise<void>;
  /** Resolves once listening has ended and the last words are in the text. */
  stop: () => Promise<void>;
  clearError: () => void;
  /**
   * Set while the error is a denied permission: iOS won't ask twice, so Settings is the only way
   * back to voice (Oct 27, 2026). The composer shows it as an "Open Settings" action by the error.
   */
  openSettings: (() => Promise<void>) | null;
  /** The last few seconds of input volume, 0 to 1, oldest first: the composer's live bars. */
  levels: number[];
  /** When listening started, for the elapsed time. */
  startedAt: number;
} {
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState<VoiceTranscript>({ stable: '', tail: '' });
  const [error, setError] = useState<string | null>(null);
  const level = useSharedValue(0);
  const [levels, setLevels] = useState<number[]>(() => Array(LEVEL_HISTORY).fill(0));
  const [startedAt, setStartedAt] = useState(0);
  const session = useRef({ prefix: '', committed: '', last: '', startedAt: 0, active: false });
  const stopped = useRef<{ timer: ReturnType<typeof setTimeout> | null; waiting: (() => void)[] }>({ timer: null, waiting: [] });

  const emit = useCallback((spoken: string) => {
    const said = `${session.current.committed} ${spoken}`.trim();
    const head = session.current.prefix.trim();
    onText(head ? `${head} ${said}`.trimEnd() : said);
  }, [onText]);

  const finish = useCallback((reason: 'stop' | 'end' | 'error') => {
    if (stopped.current.timer) clearTimeout(stopped.current.timer);
    stopped.current.timer = null;
    for (const resolve of stopped.current.waiting.splice(0)) resolve();
    if (!session.current.active) return;
    session.current.active = false;
    const said = `${session.current.committed} ${session.current.last}`.trim();
    const words = said ? said.split(/\s+/).length : 0;
    track('voice_stopped', { reason, seconds: Math.round((Date.now() - session.current.startedAt) / 1000), words });
    setTranscript((t) => ({ stable: `${t.stable} ${t.tail}`.trim(), tail: '' }));
    level.set(withSpring(0, springs.gentle));
    setLevels(Array(LEVEL_HISTORY).fill(0));
    setState('idle');
  }, [level]);

  useSpeechRecognitionEvent('result', (event) => {
    if (!session.current.active) return;
    const current = (event.results[0]?.transcript ?? '').trim();
    const next = nextTranscript(session.current.committed, session.current.last, current);
    if (!next) return;
    const previous = next.committed === session.current.committed ? session.current.last : '';
    session.current.committed = next.committed;
    session.current.last = next.last;
    const stable = event.isFinal ? current : sameWords(previous, current);
    setTranscript({ stable: `${next.committed} ${stable}`.trim(), tail: current.slice(stable.length).trimStart() });
    emit(current);
    if (`${next.committed} ${current}`.length >= MAX_CHARS) {
      setError(VOICE_ERRORS.long);
      ExpoSpeechRecognitionModule.stop();
    }
  });
  useSpeechRecognitionEvent('volumechange', (event) => {
    if (!session.current.active) return;
    const v = Math.min(LEVEL_CEIL, Math.max(LEVEL_FLOOR, event.value)) / LEVEL_CEIL;
    level.set(withSpring(v, springs.snappy));
    setLevels((l) => [...l.slice(1), v]);
  });
  useSpeechRecognitionEvent('end', () => finish('end'));
  useSpeechRecognitionEvent('error', (event) => {
    if (event.error === 'aborted') return;
    if (event.error !== 'no-speech') reportError('voice.recognize', new Error(`${event.error}: ${event.message}`));
    track('voice_failed', { reason: event.error });
    if (event.error === 'not-allowed') setError(VOICE_ERRORS.denied);
    else if (event.error === 'network') setError(VOICE_ERRORS.offline);
    else if (event.error !== 'no-speech') setError(VOICE_ERRORS.failed);
    finish('error');
  });

  // A call, Siri, or leaving the app ends the session; the words stay in the composer.
  useEffect(() => {
    const pending = stopped.current;
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active' && session.current.active) ExpoSpeechRecognitionModule.stop();
    });
    return () => {
      sub.remove();
      if (pending.timer) clearTimeout(pending.timer);
      if (session.current.active) ExpoSpeechRecognitionModule.abort();
    };
  }, []);

  const start = useCallback(async () => {
    if (session.current.active || !VOICE_AVAILABLE) return;
    setError(null);
    try {
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) { setError(VOICE_ERRORS.unavailable); return; }
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!permission.granted) {
        track('voice_failed', { reason: 'denied' });
        setError(VOICE_ERRORS.denied);
        return;
      }
      session.current = { prefix, committed: '', last: '', startedAt: Date.now(), active: true };
      setStartedAt(session.current.startedAt);
      setTranscript({ stable: '', tail: '' });
      setState('listening');
      feedback('select');
      track('voice_started', { onDevice: ExpoSpeechRecognitionModule.supportsOnDeviceRecognition() });
      ExpoSpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: true,
        // Prefer the phone; when its model is missing Apple recognises over its network (the privacy page says so).
        requiresOnDeviceRecognition: ExpoSpeechRecognitionModule.supportsOnDeviceRecognition(),
        addsPunctuation: true,
        iosTaskHint: 'dictation',
        volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
      });
    } catch (failure) {
      reportError('voice.start', failure);
      session.current.active = false;
      setState('idle');
      setError(VOICE_ERRORS.failed);
    }
  }, [prefix]);

  // Stop asks Apple for the last result. If it never answers, or the person taps stop again, the
  // session is aborted so the mic can never stay stuck on; the words so far stay in the composer.
  const stop = useCallback(() => {
    if (!session.current.active) return Promise.resolve();
    const done = new Promise<void>((resolve) => stopped.current.waiting.push(resolve));
    const force = () => { ExpoSpeechRecognitionModule.abort(); finish('stop'); };
    if (stopped.current.timer) { force(); return done; }
    setState('stopping');
    ExpoSpeechRecognitionModule.stop();
    stopped.current.timer = setTimeout(force, STOP_GRACE_MS);
    return done;
  }, [finish]);

  const openSettings = useCallback(async () => {
    if (!(await openSystemSettings())) setError(VOICE_ERRORS.deniedManual);
  }, []);

  return {
    state, transcript, level, error, start, stop, clearError: () => setError(null), levels, startedAt,
    openSettings: error === VOICE_ERRORS.denied ? openSettings : null,
  };
}
