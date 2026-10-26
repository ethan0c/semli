import { forwardRef, type ComponentRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

import { IconButton } from '@/components/Controls';
import { T } from '@/components/Text';
import type { VoiceState, VoiceTranscript } from '@/lib/voice';
import { corner, radius, textStyle, useTheme, space } from '@/theme';

/** The mic grows with the voice: a whisper leaves it still, a normal voice lifts it a tenth. */
const MIC_GROWTH = 0.12;

export type ComposerVoice = {
  state: VoiceState;
  transcript: VoiceTranscript;
  level: SharedValue<number>;
  onStart: () => void;
  onStop: () => void;
};

/**
 * The Add composer: a white rounded rectangle with the attachments inside it and a primary send
 * circle. Shared by the Add screen and the "Now, your week" onboarding step. With `voice`, a mic
 * joins the toolbar and, while listening, the transcript takes the input's place: settled words
 * in primary ink, the phrase still being worked out in secondary. The mic turns into a stop
 * button while it listens, and send stays available: it stops listening, then sends.
 */
export const Composer = forwardRef<ComponentRef<typeof TextInput>, {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  busy?: boolean;
  canSend: boolean;
  autoFocus?: boolean;
  onPickImage: () => void;
  /** Left out where there's no camera to reach for (the web on a laptop). */
  onCamera?: () => void;
  onPickPdf: () => void;
  onSend: () => void;
  id?: string;
  voice?: ComposerVoice;
}>(function Composer({ value, onChangeText, placeholder, busy, canSend, autoFocus, onPickImage, onCamera, onPickPdf, onSend, id, voice }, ref) {
  const { c } = useTheme();
  const listening = voice?.state === 'listening' || voice?.state === 'stopping';
  return (
    <View style={[styles.composer, { backgroundColor: c.surface, borderColor: c.line }]}>
      {listening && voice ? (
        <View style={styles.input} accessibilityLabel="Listening" accessibilityRole="text">
          {voice.transcript.stable || voice.transcript.tail ? (
            <T token="body">
              {value.slice(0, value.length - `${voice.transcript.stable} ${voice.transcript.tail}`.trim().length).trimEnd()}
              {value.length > `${voice.transcript.stable} ${voice.transcript.tail}`.trim().length ? ' ' : ''}
              {voice.transcript.stable}
              {voice.transcript.tail ? <T token="body" color={c.inkSecondary}>{`${voice.transcript.stable ? ' ' : ''}${voice.transcript.tail}`}</T> : null}
            </T>
          ) : (
            <T token="body" color={c.inkTertiary}>{value ? `${value} ` : ''}Listening…</T>
          )}
        </View>
      ) : (
        <TextInput
          ref={ref}
          id={id}
          accessibilityLabel="What would you like to add?"
          value={value}
          onChangeText={onChangeText}
          multiline
          autoFocus={autoFocus}
          editable={!busy}
          placeholder={placeholder ?? 'Exam Friday at 9 am, work Saturday 4–10 pm…'}
          placeholderTextColor={c.inkTertiary}
          style={[styles.input, textStyle('body', c.inkPrimary)]}
        />
      )}
      <View style={styles.toolbar}>
        <IconButton icon="image" label="Add a screenshot" tone="bare" size={40} disabled={busy || listening} onPress={onPickImage} />
        {onCamera ? <IconButton icon="camera" label="Take a photo" tone="bare" size={40} disabled={busy || listening} onPress={onCamera} /> : null}
        <IconButton icon="file" label="Add a PDF" tone="bare" size={40} disabled={busy || listening} onPress={onPickPdf} />
        <View style={{ flex: 1 }} />
        {voice ? <Mic voice={voice} disabled={!!busy} /> : null}
        <IconButton icon="send" label="Read it" tone="primary" size={40} disabled={!canSend || voice?.state === 'stopping'} haptic="ready" onPress={onSend} />
      </View>
    </View>
  );
});

function Mic({ voice, disabled }: { voice: ComposerVoice; disabled: boolean }) {
  // Stopping stays tappable: a second tap ends a session Apple is slow to close.
  const on = voice.state !== 'idle';
  const grow = useAnimatedStyle(() => ({ transform: [{ scale: interpolate(voice.level.value, [0, 1], [1, 1 + MIC_GROWTH]) }] }));
  return (
    <Animated.View style={grow}>
      <IconButton icon={on ? 'stop' : 'mic'} tone={on ? 'ink' : 'bare'} size={40} haptic="select" disabled={disabled}
        label={on ? 'Stop listening' : 'Speak what’s coming up'} onPress={on ? voice.onStop : voice.onStart} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  composer: { ...corner(radius.field), borderWidth: 1 },
  input: { minHeight: 112, maxHeight: 240, paddingHorizontal: space.md, paddingTop: space.sm, paddingBottom: space.snug, textAlignVertical: 'top' },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: space.hair, paddingHorizontal: space.xs, paddingBottom: space.xs, paddingTop: space.hair },
});
