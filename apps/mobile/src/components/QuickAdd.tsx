import { useLingui } from '@lingui/react/macro';
import { router, type Href } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { StatusPill } from '@/components/Controls';
import { T } from '@/components/Text';
import { enter, exit } from '@/lib/motion';
import { chooseFileForAdd } from '@/lib/web-drop';
import { useCourseList, useStore } from '@/store';
import { corner, radius, textStyle, useTheme, shadow, space, size } from '@/theme';

type Action = { id: string; label: string; hint: string; run: () => void };

/** Leaves the words in Add's draft and opens Add, which reads them (`source: 'quick'`). */
function addWords(words: string) {
  useStore.getState().setCaptureDraft(words);
  router.navigate({ pathname: '/add', params: { source: 'quick', at: String(Date.now()) } });
}

/**
 * ⌘K on a wide web window: one box from anywhere. Typed words become an import, read the same way
 * Add reads them, with the review before anything is saved; the rows below go to a screen, a
 * course or a setting. ↑ ↓ choose, Enter runs, Esc closes.
 */
export function QuickAdd({ onClose }: { onClose: () => void }) {
  const { t } = useLingui();
  const { c } = useTheme();
  const courses = useCourseList();
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  // Focus once the box is on screen; autoFocus alone loses to the fade-in on the web.
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  useEffect(() => { const id = setTimeout(() => input.current?.focus(), 30); return () => clearTimeout(id); }, []);
  const go = (href: Href) => () => router.navigate(href);
  const words = query.trim();

  const all: Action[] = [
    ...(words ? [{ id: 'add', label: t`Add “${words}”`, hint: 'Enter', run: () => addWords(words) }] : []),
    { id: 'file', label: t`Import a screenshot or PDF`, hint: '⌘V', run: chooseFileForAdd },
    { id: 'today', label: t`Go to Today`, hint: '1', run: go('/') },
    { id: 'plan', label: t`Go to Plan`, hint: '2', run: go('/plan') },
    { id: 'school', label: t`Go to School`, hint: '3', run: go('/school') },
    { id: 'you', label: t`Go to You`, hint: '4', run: go('/you') },
    { id: 'create', label: t`New to-do or event`, hint: 'N', run: () => router.push({ pathname: '/create', params: { kind: 'task' } }) },
    ...courses.map((k) => ({ id: `course-${k.id}`, label: t`Go to ${k.code ?? k.title}`, hint: t`Course`, run: () => router.push(`/course/${k.id}`) })),
    ...([['reminders', t`Reminders`], ['appearance', t`Appearance`], ['canvas', 'Canvas or Brightspace'], ['data', t`Your data`]] as const).map(([key, name]) => ({
      id: `setting-${key}`, label: name, hint: t`Setting`, run: () => router.navigate({ pathname: '/you', params: { open: key } }),
    })),
  ];
  // The add row stays first; the rest are filtered by what's typed.
  const shown = all.filter((a) => a.id === 'add' || !words || a.label.toLowerCase().includes(words.toLowerCase())).slice(0, 8);
  const pick = Math.min(index, Math.max(0, shown.length - 1));
  const run = (a: Action | undefined) => { if (!a) return; onClose(); a.run(); };

  // Arrows and Esc while the box has focus (the web only, where this shows).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); setIndex((i) => i + 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex((i) => Math.max(0, i - 1)); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <Animated.View entering={enter.fade} exiting={exit.fade} style={[styles.scrim, { backgroundColor: c.backdrop }]}>
      <Pressable accessibilityLabel={t`Close`} onPress={onClose} style={StyleSheet.absoluteFill} />
      <View accessibilityViewIsModal style={[styles.box, { backgroundColor: c.surface, borderColor: c.line }]}>
        <TextInput ref={input} autoFocus value={query} onChangeText={(v) => { setQuery(v); setIndex(0); }} onSubmitEditing={() => run(shown[pick])}
          placeholder={t`Type a plan, like “exam Friday 9am bio”, or go somewhere`} placeholderTextColor={c.inkTertiary}
          accessibilityLabel={t`Quick add`} style={[textStyle('body', c.inkPrimary), styles.input, { borderBottomColor: c.line }]} />
        {shown.map((a, i) => (
          <Pressable key={a.id} accessibilityRole="button" onPress={() => run(a)} onHoverIn={() => setIndex(i)}
            style={[styles.row, { backgroundColor: i === pick ? c.row : 'transparent' }]}>
            <T token="subhead" numberOfLines={1} style={{ flex: 1 }}>{a.label}</T>
            <StatusPill label={a.hint} tabular={false} />
          </Pressable>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 20, alignItems: 'center', paddingTop: 110 },
  box: { width: 620, maxWidth: '92%', ...corner(radius.container), borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', boxShadow: shadow.dialog },
  input: { paddingHorizontal: space.lg, paddingVertical: space.md, borderBottomWidth: StyleSheet.hairlineWidth, outlineStyle: 'none' } as never,
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: size.compact, paddingHorizontal: space.lg },
});
