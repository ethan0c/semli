import { IMPORT_MESSAGES, type ExtractRequest } from '@dayli/schema';
import { File } from 'expo-file-system';
import { router, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useEffectEvent, useRef, useState, type ComponentRef } from 'react';
import { Platform, ScrollView, StyleSheet, type TextInput, View } from 'react-native';

import { Composer } from '@/components/Composer';
import { Heard } from '@/components/Heard';
import { GroupLabel, ListRow } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { Reading } from '@/components/Reading';
import { RecentShots } from '@/components/RecentShots';
import { T } from '@/components/Text';
import { TabHeader } from '@/components/TabHeader';
import { track } from '@/lib/analytics';
import { requestImport } from '@/lib/import-auth';
import { InputError, extractionContext, inputFromFile, pickImageInput, pickPdfInput } from '@/lib/capture-input';
import { feedback } from '@/lib/feedback';
import { reportError } from '@/lib/errors';
import { usePlusAccess } from '@/lib/plus-access';
import { VOICE_AVAILABLE, useVoiceCapture } from '@/lib/voice';
import { takeDroppedFile } from '@/lib/web-drop';
import { COLUMN, useWebLayout } from '@/lib/layout';
import { useNow } from '@/lib/now';
import { purchaseErrorMessage } from '@/lib/revenuecat';
import { hasFreeImports } from '@/lib/plans';
import { useStore } from '@/store';
import { diffDays, localParts, monthDay, relativeDay , count } from '@dayli/core';
import { NAV_INSET, SCREEN_GUTTER, useTheme, space } from '@/theme';

/**
 * Add, the fifth tab: a composer with the attachments inside it, the recent screenshots,
 * and three "start with" rows. Reading shows a progress line and rows that fill in.
 * Arriving with `?source=image|file` opens that picker straight away, once.
 */
export function AddScreen() {
  const { c } = useTheme();
  const { twoPane } = useWebLayout();
  const params = useLocalSearchParams<{ source?: string; at?: string }>();
  const { requireImportAccess, requirePlus } = usePlusAccess();
  const importing = useRef(false);
  const [text, setText] = useState(() => useStore.getState().captureDraft);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setErrorText] = useState<string | null>(null);
  const setError = (message: string | null) => {
    if (message) feedback('error');
    setErrorText(message);
  };
  const apiUrl = useStore((s) => s.settings.apiUrl);
  const setPending = useStore((s) => s.setPending);
  const recordImport = useStore((s) => s.recordImport);
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  // Spoken words land in the same text as typed ones; the composer stays the source of truth.
  const onVoiceText = useCallback((value: string) => { setText(value); useStore.getState().setCaptureDraft(value); }, []);
  const voice = useVoiceCapture({ prefix: text, onText: onVoiceText });
  const spoke = useRef(false);

  async function run(input: ExtractRequest['input'], source: string) {
    if (importing.current) return;
    importing.current = true;
    setError(null);
    setBusy(source);
    track('import_started', { kind: input.kind });
    try {
      try {
        if (!(await requireImportAccess())) return;
      } catch (failure) {
        setError(purchaseErrorMessage(failure));
        return;
      }
      // With the free allowance used up, this read is Plus's; review says so the first time.
      const plusRead = !hasFreeImports(useStore.getState().usage);
      const req = { input, context: extractionContext(input) };
      let res = await requestImport(apiUrl, req);
      // The server's count wins over this phone's (a reinstall resets the local one).
      if (!res.ok && res.error === IMPORT_MESSAGES.quota && (await requirePlus('quota'))) res = await requestImport(apiUrl, req);
      if (!res.ok) {
        track('import_failed', { kind: input.kind });
        setError(res.error);
        return;
      }
      if (res.extraction.items.length === 0) {
        setError(IMPORT_MESSAGES.empty);
        return;
      }
      feedback('ready');
      useStore.getState().setCaptureDraft('');
      spoke.current = false;
      recordImport();
      track('import_succeeded', { kind: input.kind, items: res.extraction.items.length, type: res.extraction.detected_type });
      setPending({ extraction: res.extraction, source, ...(plusRead ? { plus: true } : {}), ...(Platform.OS === 'web' ? { input } : {}) });
      router.push('/review');
    } catch (failure) {
      reportError('import.prepare_or_review', failure);
      setError(IMPORT_MESSAGES.unavailable);
    } finally {
      importing.current = false;
      setBusy(null);
    }
  }

  const pick = async (fn: () => Promise<{ input: ExtractRequest['input']; source: string } | null>) => {
    setError(null);
    try {
      const picked = await fn();
      if (picked) await run(picked.input, picked.source);
    } catch (e) {
      reportError('import.pick_file', e);
      setError(e instanceof InputError ? e.message : IMPORT_MESSAGES.file);
    }
  };

  const canSend = text.trim().length > 0 && !busy;
  /** Send while listening stops first, then sends with the last words in. */
  async function send() {
    const listening = voice.state !== 'idle';
    if (listening) await voice.stop();
    const latest = (listening ? useStore.getState().captureDraft : text).trim();
    if (latest) await run({ kind: 'text', text: latest }, spoke.current ? 'Voice' : 'Message');
  }
  const shownError = error ?? voice.error;

  /** A tapped screenshot thumbnail; an empty uri means "open the photo picker". */
  async function openShot(uri: string) {
    if (!uri) return pick(() => pickImageInput(false));
    setError(null);
    try {
      const data = await new File(uri).base64();
      const lower = uri.toLowerCase();
      const mediaType = lower.endsWith('.png') ? 'image/png' : lower.endsWith('.webp') ? 'image/webp' : 'image/jpeg';
      await run({ kind: 'image', mediaType, data }, 'Screenshot');
    } catch (failure) {
      reportError('import.open_screenshot', failure);
      setError("We couldn't open that screenshot. Try choosing it from your photos instead.");
    }
  }

  // A row elsewhere ("Next week's shifts", "A syllabus") lands here with a source and opens
  // its picker once per arrival; `at` changes on every push so the same source can repeat.
  const openedAt = useRef<string | null>(null);
  const openSource = useEffectEvent((source: string, at: string) => {
    if (openedAt.current === at) return;
    openedAt.current = at;
    if (source === 'image') void pick(() => pickImageInput(false));
    if (source === 'file') void pick(pickPdfInput);
    // Quick add (⌘K) leaves its words in the draft and comes here to read them.
    if (source === 'quick') {
      const draft = useStore.getState().captureDraft.trim();
      if (draft) { setText(draft); void run({ kind: 'text', text: draft }, 'Message'); }
    }
    if (source === 'drop') {
      const file = takeDroppedFile();
      if (file) void pick(async () => {
        const picked = await inputFromFile(file);
        if (!picked) throw new InputError('Semli reads screenshots, photos and PDFs. Try one of those, or type the details.');
        return picked;
      });
    }
  });
  const focused = useIsFocused();
  useEffect(() => {
    // A browser opens a file picker only from a click, so on the web only a dropped file opens by itself.
    if (!focused || !params.source || (Platform.OS === 'web' && params.source !== 'drop' && params.source !== 'quick')) return;
    const source = params.source;
    const at = params.at ?? source;
    const timer = setTimeout(() => openSource(source, at), source === 'drop' || source === 'quick' ? 0 : 350);
    return () => clearTimeout(timer);
  }, [focused, params.source, params.at]);

  const composer = (
    <ScrollView style={{ flex: 1, backgroundColor: c.canvas }} contentContainerStyle={{ paddingBottom: NAV_INSET }}
      keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="never">
      <TabHeader title="Add" size="title"
        details={<T token="callout" color={c.inkSecondary}>{Platform.OS === 'web'
          ? 'Type your plans, drop a screenshot or PDF anywhere on the page, or paste one. Review the results before saving.'
          : 'Type your plans or add a screenshot or PDF. Review the results before saving.'}</T>} />
      <View style={styles.body}>
        {busy ? <Reading source={busy === 'Message' ? 'your message' : busy === 'Voice' ? 'your voice note' : busy} chart={/\.pdf$/i.test(busy) ? 'term' : 'week'} /> : null}

        <Composer
          ref={inputRef}
          id="capture-text"
          value={text}
          onChangeText={(value) => { setText(value); useStore.getState().setCaptureDraft(value); if (!value) spoke.current = false; }}
          busy={!!busy}
          canSend={canSend}
          onPickImage={() => void pick(() => pickImageInput(false))}
          onCamera={Platform.OS === 'web' ? undefined : () => void pick(() => pickImageInput(true))}
          onPickPdf={() => void pick(pickPdfInput)}
          onSend={() => void send()}
          voice={VOICE_AVAILABLE ? { state: voice.state, transcript: voice.transcript, level: voice.level, levels: voice.levels, startedAt: voice.startedAt, onStart: () => { spoke.current = true; setError(null); void voice.start(); }, onStop: () => void voice.stop() } : undefined}
        />

        {shownError ? (
          <View accessibilityRole="alert" style={styles.status}>
            <Icon name="alert" size={16} color={c.conflict} />
            <T token="subhead" color={c.conflict} style={{ flex: 1 }}>{shownError}</T>
          </View>
        ) : null}

        {!busy ? <Heard text={text} /> : null}

        {!busy ? <RecentShots disabled={!!busy} onPick={(uri) => void openShot(uri)} /> : null}

        {!busy ? (
          <View>
            <GroupLabel>Or start with</GroupLabel>
            <ListRow leading={<Icon name="file" size={20} color={c.inkPrimary} />} title="A syllabus" sub="Classes, exams and due dates for the whole term" onPress={() => void pick(pickPdfInput)} />
            <ListRow leading={<Icon name="school" size={20} color={c.inkPrimary} />} title="Canvas" sub="Import due dates free. Keep them in sync with Plus." onPress={() => router.push('/settings/canvas')} />
            <ListRow leading={<Icon name="work" size={20} color={c.inkPrimary} />} title="A work schedule" sub="A screenshot from the scheduling app or the group chat" onPress={() => void pick(() => pickImageInput(false))} />
            <ListRow leading={<Icon name="pen" size={20} color={c.inkPrimary} />} title="Something by hand" sub="A to-do or event with the date you pick" last onPress={() => router.push({ pathname: '/create', params: { kind: 'task' } })} />
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
  if (!twoPane) return composer;
  // A wide web window lists recent imports beside the composer, each opening its review.
  return (
    <View style={styles.panes}>
      <View style={{ width: COLUMN }}>{composer}</View>
      <RecentImports />
    </View>
  );
}

/** The latest imports, newest first: what came in and when, each opening its page. */
function RecentImports() {
  const { c } = useTheme();
  const now = useNow();
  const batches = useStore((s) => s.batches);
  const imports = batches.filter((b) => b.source && !b.undone).slice(0, 8);
  return (
    <ScrollView style={[styles.pane, { borderLeftColor: c.line }]} contentContainerStyle={styles.paneBody}>
      <T token="titleSm" accessibilityRole="header" style={{ paddingBottom: space.xs }}>Recent imports</T>
      {imports.length ? imports.map((b, i) => {
        const at = localParts(new Date(b.createdAt));
        const day = Math.abs(diffDays(at.date, now.date)) <= 1 ? relativeDay(now.date, at.date) : monthDay(at.date);
        const added = b.changes.filter((ch) => ch.op === 'create').length;
        return <ListRow key={b.id} title={b.source ?? b.label} sub={`${day} · ${count(added, 'item')} added`} last={i === imports.length - 1}
          onPress={() => router.push(`/import/${b.id}`)} />;
      }) : <T token="callout" color={c.inkSecondary}>Your imports will show here, each with what came in and a way to undo it.</T>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  panes: { flex: 1, flexDirection: 'row' },
  pane: { flex: 1, borderLeftWidth: StyleSheet.hairlineWidth },
  paneBody: { paddingHorizontal: SCREEN_GUTTER, paddingTop: space.xl, paddingBottom: space.xxxl },
  body: { paddingHorizontal: SCREEN_GUTTER, paddingTop: space.xl, gap: space.lg },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.xxs },
});
