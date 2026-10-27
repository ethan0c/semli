import { describeRule, inferRule, monthDay, rebuildSeries, sameRule, weekdayShort } from '@dayli/core';
import type { SeriesRule } from '@dayli/schema';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { RepeatEditor } from '@/components/RepeatEditor';
import { Button, Sheet } from '@/components/Sheet';
import { T } from '@/components/Text';
import { feedback } from '@/lib/feedback';
import { useNow } from '@/lib/now';
import { useItemList, useStore } from '@/store';
import { SCREEN_GUTTER, useTheme, space } from '@/theme';

/**
 * How one item repeats, pushed from the item screen. Edits the rule with a live preview and says,
 * before anything is saved, what the change comes to for the upcoming occurrences: how many are
 * added, how many removed (and how many of those carry notes), how many hand-moved ones stay.
 * Everything applies from this occurrence onward as one undoable batch.
 */
export function RepeatDetail({ id }: { id?: string }) {
  const { c } = useTheme();
  const now = useNow();
  const item = useStore((s) => (id ? s.items[id] : undefined));
  const items = useItemList();
  const storedRule = useStore((s) => (item?.seriesId ? s.series[item.seriesId] : undefined));
  const breaks = useStore((s) => s.settings.breaks ?? []);
  const applySeries = useStore((s) => s.applySeries);
  const startSeries = useStore((s) => s.startSeries);
  const updateItem = useStore((s) => s.updateItem);
  const showToast = useStore((s) => s.showToast);
  const series = item?.seriesId ? items.filter((it) => it.seriesId === item.seriesId) : [];
  const current: SeriesRule | null = item?.seriesId ? storedRule ?? inferRule(series) : null;
  const [draft, setDraft] = useState<SeriesRule | null>(current);

  if (!item) {
    return (
      <Sheet title="Repeat" nav="push">
        <T token="callout" color={c.inkSecondary} style={{ padding: space.lg, paddingHorizontal: SCREEN_GUTTER }}>
          This item may have been deleted. Go back to your plan.
        </T>
      </Sheet>
    );
  }

  const noun = /lecture/i.test(item.title) ? 'lecture' : item.kind === 'event' ? 'event' : 'to-do';
  const plural = (n: number) => `${n} ${n === 1 ? noun : `${noun}s`}`;
  // A series keeps its rule's times, even none (all day); a one-off starting to repeat takes its own.
  const times = current ? { start: current.start, end: current.end } : { start: item.start, end: item.end };
  // Turning repeat off is the rule ending on this occurrence: it stays, the later ones go.
  const next = draft ? { ...draft, start: times.start, end: times.end } : current ? { ...current, until: item.date } : null;
  const changed = !sameRule(next, current);
  const preview = current && next && changed ? rebuildSeries(series, next, item.date, now.date, breaks) : null;
  const withNotes = preview ? preview.remove.filter((rid) => items.find((it) => it.id === rid)?.notes).length : 0;
  // What the change comes to, said next to the button that applies it. Hand-moved ones that stay are
  // only worth saying when something else moves.
  const effect = preview ? [
    preview.create.length ? `Adds ${plural(preview.create.length)}` : null,
    preview.remove.length ? `Removes ${plural(preview.remove.length)}${withNotes ? ` (${withNotes} with notes)` : ''}` : null,
    preview.update.length && !preview.create.length && !preview.remove.length ? `Updates ${plural(preview.update.length)}` : null,
  ].filter(Boolean) : [];
  const summary = effect.length ? `${effect.join(' · ')}.${preview?.kept ? ` ${plural(preview.kept)} you moved won't change.` : ''}` : null;
  const hasEarlier = !!current && series.some((it) => it.date < item.date);
  const stopping = !draft && !!current;

  const save = () => {
    if (!changed) { router.back(); return; }
    if (stopping && current && item.seriesId) {
      const r = applySeries(item.seriesId, { ...current, until: item.date }, item.date, now.date, `Stopped repeating ${item.title}`);
      // This one is a one-off from here; the rule still describes the earlier ones.
      updateItem(item.id, { seriesId: null }, { silent: true, into: r.batchId });
      showToast(r.removed ? `Stopped repeating ${item.title}. Removed ${plural(r.removed)}.` : `Stopped repeating ${item.title}.`, r.batchId ?? undefined);
    } else if (next && !item.seriesId) {
      const r = startSeries(item.id, next, now.date);
      showToast(`${item.title} repeats ${describeRule(next).toLowerCase()} through ${monthDay(next.until)}.`, r.batchId ?? undefined);
    } else if (next && item.seriesId) {
      const r = applySeries(item.seriesId, next, item.date, now.date, `Changed how ${item.title} repeats`);
      const kept = r.kept ? ` ${plural(r.kept)} you moved won't change.` : '';
      showToast(`${item.title} repeats ${describeRule(next).toLowerCase()} through ${monthDay(next.until)}.${kept}`, r.batchId ?? undefined);
    }
    feedback('success');
    router.back();
  };

  const scopeLine = !current ? `Starts ${weekdayShort(item.date)}, ${monthDay(item.date)}.`
    : stopping ? `This ${noun} stays. You can undo this.`
      : hasEarlier ? `Applies from ${weekdayShort(item.date)}, ${monthDay(item.date)}. Earlier ${noun}s won't change.` : null;

  return (
    <Sheet title="Repeat" nav="push" footer={
      <>
        {changed && (summary || scopeLine) ? (
          <View style={styles.summary}>
            {summary ? <T token="callout" color={c.inkPrimary} style={styles.center}>{summary}</T> : null}
            {scopeLine ? <T token="caption" color={c.inkSecondary} style={styles.center}>{scopeLine}</T> : null}
          </View>
        ) : null}
        <Button label={!changed ? 'Done' : stopping ? (preview?.remove.length ? `Stop and remove ${plural(preview.remove.length)}` : 'Stop repeating') : 'Save changes'} onPress={save} />
      </>
    }>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <RepeatEditor rule={draft} from={item.date} today={now.date} times={times} noun={noun} breaks={breaks} onChange={setDraft} />
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: SCREEN_GUTTER, paddingTop: space.xs, paddingBottom: space.xl },
  summary: { gap: space.xxs, paddingBottom: space.xs },
  center: { textAlign: 'center' },
});
