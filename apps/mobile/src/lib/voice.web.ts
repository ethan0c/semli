import { useCallback, useEffect, useRef, useState } from 'react';
import { useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';

import { track } from '@/lib/analytics';
import { reportError } from '@/lib/errors';
import { feedback } from '@/lib/feedback';
import { springs } from '@/lib/motion';

/*
 * Voice capture on the web: the browser's own speech recognition (Chrome sends the audio to
 * Google, Safari to Apple; Firefox has none, so the mic is hidden there). The same hook as
 * `voice.ts`, called directly rather than through expo-speech-recognition, whose web mode passes
 * on only the newest piece of a continuous session and has no volume. Each result here carries
 * every piece so far, which is what the composer expects. The bars come from the microphone
 * through an analyser; the server still never hears audio.
 */

export type VoiceState = 'idle' | 'listening' | 'stopping';
export type VoiceTranscript = {
  /** Words the browser has settled on: shown in primary ink. */
  stable: string;
  /** The tail still being worked out: shown in secondary ink. */
  tail: string;
};

type Alternative = { transcript: string };
type Result = { isFinal: boolean; length: number; [i: number]: Alternative };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<Result> }) => void) | null;
  onerror: ((event: { error: string; message?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

function recognitionClass(): (new () => Recognition) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const VOICE_AVAILABLE = recognitionClass() !== null && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
/** More than this and the model does worse, not better; one week at a time. */
const MAX_CHARS = 2000;
/** How many recent volume readings the composer draws as bars (one every 100 ms). */
export const LEVEL_HISTORY = 28;
const LEVEL_EVERY_MS = 100;
/** Speech sits around 0.02 to 0.1 RMS on a laptop mic; this brings a normal voice to about two thirds. */
const LEVEL_GAIN = 8;
/** How long a stop may wait for the browser's last result before the session is ended anyway. */
const STOP_GRACE_MS = 1500;

export const VOICE_ERRORS = {
  denied: 'To speak your plans, allow microphone access in your browser’s settings for this site. Then click the microphone again.',
  deniedManual: 'To speak your plans, allow microphone access in your browser’s settings for this site. Then click the microphone again.',
  offline: 'You need an internet connection to speak your plans. You can still type them.',
  unavailable: 'This browser can’t turn speech into text. You can still type your plans.',
  noMic: 'We couldn’t find a microphone. Connect one or type your plans.',
  failed: 'The microphone stopped listening. Your text is still here. Click the microphone to try again.',
  long: 'This message is getting too long. Review what you’ve said, then add the rest in a new message.',
} as const;

/** The whole session so far: settled pieces, then the ones still changing. */
function read(results: ArrayLike<Result>): VoiceTranscript {
  let stable = '';
  let tail = '';
  for (let i = 0; i < results.length; i++) {
    const words = results[i][0]?.transcript.trim();
    if (!words) continue;
    if (results[i].isFinal) stable = `${stable} ${words}`.trim();
    else tail = `${tail} ${words}`.trim();
  }
  return { stable, tail };
}

type Meter = { stream: MediaStream; context: AudioContext; timer: ReturnType<typeof setInterval> };

/** Same shape as the iPhone hook, so the composer and Add screen don't know which one they have. */
export function useVoiceCapture({ prefix, onText }: { prefix: string; onText: (text: string) => void }): {
  state: VoiceState;
  transcript: VoiceTranscript;
  level: SharedValue<number>;
  error: string | null;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  clearError: () => void;
  openSettings: (() => Promise<void>) | null;
  levels: number[];
  startedAt: number;
} {
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState<VoiceTranscript>({ stable: '', tail: '' });
  const [error, setError] = useState<string | null>(null);
  const level = useSharedValue(0);
  const [levels, setLevels] = useState<number[]>(() => Array(LEVEL_HISTORY).fill(0));
  const [startedAt, setStartedAt] = useState(0);
  const session = useRef<{ prefix: string; said: string; startedAt: number; active: boolean; recognition: Recognition | null; meter: Meter | null }>(
    { prefix: '', said: '', startedAt: 0, active: false, recognition: null, meter: null },
  );
  const stopped = useRef<{ timer: ReturnType<typeof setTimeout> | null; waiting: (() => void)[] }>({ timer: null, waiting: [] });

  const release = useCallback(() => {
    const meter = session.current.meter;
    session.current.meter = null;
    if (!meter) return;
    clearInterval(meter.timer);
    for (const t of meter.stream.getTracks()) t.stop();
    void meter.context.close().catch(() => {});
  }, []);

  const finish = useCallback((reason: 'stop' | 'end' | 'error') => {
    if (stopped.current.timer) clearTimeout(stopped.current.timer);
    stopped.current.timer = null;
    for (const resolve of stopped.current.waiting.splice(0)) resolve();
    release();
    if (!session.current.active) return;
    session.current.active = false;
    session.current.recognition = null;
    const said = session.current.said;
    const words = said ? said.split(/\s+/).length : 0;
    track('voice_stopped', { reason, seconds: Math.round((Date.now() - session.current.startedAt) / 1000), words });
    setTranscript((t) => ({ stable: `${t.stable} ${t.tail}`.trim(), tail: '' }));
    level.set(withSpring(0, springs.gentle));
    setLevels(Array(LEVEL_HISTORY).fill(0));
    setState('idle');
  }, [level, release]);

  // Leaving the Add screen mid-sentence ends the session; the words stay in the draft.
  useEffect(() => {
    const pending = stopped.current;
    return () => {
      if (pending.timer) clearTimeout(pending.timer);
      session.current.recognition?.abort();
      release();
    };
  }, [release]);

  const meter = useCallback((stream: MediaStream): Meter | null => {
    try {
      const context = new AudioContext();
      void context.resume().catch(() => {});
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      context.createMediaStreamSource(stream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      const timer = setInterval(() => {
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (const s of samples) sum += s * s;
        const v = Math.min(1, Math.sqrt(sum / samples.length) * LEVEL_GAIN);
        level.set(withSpring(v, springs.snappy));
        setLevels((l) => [...l.slice(1), v]);
      }, LEVEL_EVERY_MS);
      return { stream, context, timer };
    } catch (failure) {
      // The bars are a nicety; listening goes on without them.
      reportError('voice.meter', failure);
      for (const t of stream.getTracks()) t.stop();
      return null;
    }
  }, [level]);

  const start = useCallback(async () => {
    const Recognition = recognitionClass();
    if (session.current.active || !Recognition) return;
    setError(null);
    // Asking for the mic first is the permission prompt, and its answer is clearer than the recognizer's.
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (failure) {
      const name = (failure as { name?: string }).name;
      track('voice_failed', { reason: name === 'NotAllowedError' ? 'denied' : name === 'NotFoundError' ? 'no-mic' : 'mic' });
      if (name === 'NotAllowedError') setError(VOICE_ERRORS.denied);
      else if (name === 'NotFoundError') setError(VOICE_ERRORS.noMic);
      else { reportError('voice.mic', failure); setError(VOICE_ERRORS.failed); }
      return;
    }
    try {
      const recognition = new Recognition();
      recognition.lang = navigator.language || 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.onresult = (event) => {
        if (!session.current.active) return;
        const next = read(event.results);
        const said = `${next.stable} ${next.tail}`.trim();
        session.current.said = said;
        setTranscript(next);
        const head = session.current.prefix.trim();
        onText(head ? `${head} ${said}`.trimEnd() : said);
        if (said.length >= MAX_CHARS) {
          setError(VOICE_ERRORS.long);
          recognition.stop();
        }
      };
      recognition.onerror = (event) => {
        if (event.error === 'aborted') return;
        if (event.error !== 'no-speech') reportError('voice.recognize', new Error(`${event.error}: ${event.message ?? ''}`));
        track('voice_failed', { reason: event.error });
        if (event.error === 'not-allowed') setError(VOICE_ERRORS.denied);
        else if (event.error === 'network') setError(VOICE_ERRORS.offline);
        else if (event.error === 'audio-capture') setError(VOICE_ERRORS.noMic);
        else if (event.error === 'service-not-allowed' || event.error === 'language-not-supported') setError(VOICE_ERRORS.unavailable);
        else if (event.error !== 'no-speech') setError(VOICE_ERRORS.failed);
        finish('error');
      };
      recognition.onend = () => finish('end');
      session.current = { prefix, said: '', startedAt: Date.now(), active: true, recognition, meter: meter(stream) };
      setStartedAt(session.current.startedAt);
      setTranscript({ stable: '', tail: '' });
      setState('listening');
      feedback('select');
      track('voice_started', { onDevice: false });
      recognition.start();
    } catch (failure) {
      reportError('voice.start', failure);
      for (const t of stream.getTracks()) t.stop();
      release();
      session.current.active = false;
      setState('idle');
      setError(VOICE_ERRORS.failed);
    }
  }, [prefix, onText, finish, meter, release]);

  // Stop asks for the last result. If it never comes, or the person clicks stop again, the
  // session is aborted so the mic can never stay on; the words so far stay in the composer.
  const stop = useCallback(() => {
    const recognition = session.current.recognition;
    if (!session.current.active || !recognition) return Promise.resolve();
    const done = new Promise<void>((resolve) => stopped.current.waiting.push(resolve));
    const force = () => { recognition.abort(); finish('stop'); };
    if (stopped.current.timer) { force(); return done; }
    setState('stopping');
    recognition.stop();
    stopped.current.timer = setTimeout(force, STOP_GRACE_MS);
    return done;
  }, [finish]);

  return {
    state, transcript, level, error, start, stop, clearError: () => setError(null), levels, startedAt,
    // A browser can't open its own site settings from a page; the error says where to look.
    openSettings: null,
  };
}
