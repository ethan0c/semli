import { conflictIds, describeRule, diffDays, formatRange, formatTime, fullDate, inferRule, isFlexibleEvent, isLocalDate, isLocalTime, localParts, monthDay, relativeDay, todayItems, toMinutes, weekOf, weekdayLong, weekdayShort, longMonthDay, clockTime, clockPeriod } from '@dayli/core';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { GroupLabel, SectionTitle, StatusPill, TextButton, itemStatus } from '@/components/Controls';
import { Notes } from '@/components/Notes';
import { DayBar } from '@/components/DayBar';
import { ItemRow } from '@/components/ItemRow';
import { InlinePicker, NativeToggle } from '@/components/Native';
import { OverlapNotice } from '@/components/OverlapNotice';
import { RingingAlarmInfo } from '@/components/RingingAlarmInfo';
import { Press, PressRow } from '@/components/Press';
import { Segmented } from '@/components/Segmented';
import { Button, Sheet } from '@/components/Sheet';
import { T } from '@/components/Text';
import { feedback } from '@/lib/feedback';
import { defaultTimes, plusMinutes } from '@/lib/times';
import { enter, exit, layout } from '@/lib/motion';
import { useNow } from '@/lib/now';
import { isClass } from '@/lib/reminder-plan';
import { usePlusAccess } from '@/lib/plus-access';
import { useItemList, useStore } from '@/store';
import { SAMPLE_SOURCE } from '@/store/sample';
import { SCREEN_GUTTER, corner, radius, textStyle, useTheme, size, fade, space } from '@/theme';
import { sourceName } from '@/lib/source-name';


function gap(now: { date: string; time: string }, date: string, time: string | null): string | null {
  if (!time) return null;
  const mins = toMinutes(time) - toMinutes(now.time) + diffDays(now.date, date) * 1440;
  if (mins < 0) return null;
  if (mins < 60) return `In ${mins}m`;
  if (mins < 1440) return `In ${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
  return null;
}


/** A plain text row: body text, 28 high, no icon, no hairline. Highlights when it can be pressed. */
function Row({ children, trailing, onPress, accessibilityLabel }: { children: ReactNode; trailing?: ReactNode; onPress?: () => void; accessibilityLabel?: string }) {
  if (!onPress) return <View style={styles.row}>{children}{trailing}</View>;
  return (
    <PressRow onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}
      bleed={8} round={radius.small} style={styles.row}>
      {children}
      {trailing}
    </PressRow>
  );
}

/**
 * One event or to-do: its time, date, repeats, reminders and the day around it. A pushed screen
 * on the phone (app/item/[id].tsx); on a wide web window, a pane beside Plan's list, where
 * `onClose` closes the pane and `onOpen` shows another item in it.
 */
export function ItemDetail({ id, onClose, onOpen }: { id?: string; onClose?: () => void; onOpen?: (id: string) => void }) {
  const { c } = useTheme();
  const now = useNow();
  const open = (next: string) => (onOpen ? onOpen(next) : router.push(`/item/${next}`));
  const item = useStore((s) => (id ? s.items[id] : undefined));
  const courses = useStore((s) => s.courses);
  const batches = useStore((s) => s.batches);
  const items = useItemList();
  const reminders = useStore((s) => s.settings.reminders);
  const toggleDone = useStore((s) => s.toggleDone);
  const updateItem = useStore((s) => s.updateItem);
  const { requirePlus } = usePlusAccess();
  // Urgent items ring like an alarm, which is part of Plus. Turning it off is always allowed.
  const setUrgent = async (urgent: boolean) => {
    if (!id || (urgent && !(await requirePlus('urgent')))) return;
    feedback('select');
    updateItem(id, { urgent });
  };
  const removeItem = useStore((s) => s.removeItem);
  const removeItems = useStore((s) => s.removeItems);
  const [title, setTitle] = useState(item?.title ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [editing, setEditing] = useState<'time' | 'date' | 'notes' | null>(null);
  const [scope, setScope] = useState(false);
  // Edits live in a draft until Done, so a wheel scrolled ten times is one change and one undo.
  const [draft, setDraft] = useState<{ start: string | null; end: string | null; date: string }>({ start: null, end: null, date: '' });
  /** On a repeating item: this occurrence, or every one from here on. Time defaults to all; date is always this one. */
  const [reach, setReach] = useState<'one' | 'series'>('series');
  const applySeries = useStore((s) => s.applySeries);
  const storedRule = useStore((s) => (item?.seriesId ? s.series[item.seriesId] : undefined));
  const showToast = useStore((s) => s.showToast);

  if (!item) {
    return (
      <Sheet title="Item unavailable" nav="push" inline={!!onClose} onClose={onClose}>
        <T token="callout" color={c.inkSecondary} style={{ padding: space.lg, paddingHorizontal: SCREEN_GUTTER }}>
          We couldn’t find this item. It may have been deleted. Go back to return to your plan.
        </T>
      </Sheet>
    );
  }

  const isEvent = item.kind === 'event';
  const noun = isEvent ? 'event' : 'to-do';
  const course = item.courseId ? courses.find((k) => k.id === item.courseId) : null;
  const where = [item.employer ?? course?.code ?? course?.title, item.category === 'school' ? 'Coursework' : item.category === 'work' ? 'Work' : 'Personal'].filter(Boolean).join(' · ');
  const whereHref = item.employer ? `/employer/${encodeURIComponent(item.employer)}` : item.courseId && course ? `/course/${item.courseId}` : null;
  const batch = item.batchId ? batches.find((b) => b.id === item.batchId) : undefined;
  const sourceDate = longMonthDay((batch?.createdAt ?? item.createdAt).slice(0, 10));
  const source = item.sourceId === SAMPLE_SOURCE ? 'Sample data'
    : item.sourceId ? `From ${sourceName(item.sourceId)}, ${sourceDate}`
      : batch ? `${batch.label}, ${sourceDate}` : null;
  const conflicts = conflictIds(items);
  const status = itemStatus(item, now.date, conflicts.has(item.id));
  const until = gap(now, item.date, item.start);
  const eyebrow = [relativeDay(now.date, item.date), until].filter(Boolean).join(' · ');
  const sameWeek = items.filter((it) => it.id !== item.id && !it.done && it.date >= now.date && diffDays(now.date, it.date) <= 7
    && ((item.employer && it.employer === item.employer) || (item.courseId && it.courseId === item.courseId))).slice(0, 4);
  const endsNextDay = item.start && item.end && item.end < item.start;
  const timeLabel = item.start ? `${clockTime(item.start)}${item.end ? ` to ${clockTime(item.end)}` : ''} ${clockPeriod(item.end ?? item.start)}`.trim() : null;

  // The series this occurrence belongs to, when it repeats.
  const series = item.seriesId ? items.filter((it) => it.seriesId === item.seriesId) : [];
  const repeats = !!item.seriesId;
  const rule = repeats ? (storedRule ?? inferRule(series)) : null;
  const seriesEnd = rule?.until ?? series.reduce((max, it) => (it.date > max ? it.date : max), item.date);
  const seriesLeft = series.filter((it) => it.date >= now.date).length;
  const fromNow = series.filter((it) => it.date >= item.date);
  const week = new Set(weekOf(item.date));
  const thisWeek = fromNow.filter((it) => week.has(it.date));
  const seriesNoun = /lecture/i.test(item.title) ? 'lecture' : noun;
  const count = (n: number) => `${n} ${n === 1 ? seriesNoun : `${seriesNoun}s`}`;

  const dayItems = todayItems(items, item.date);
  const showDay = dayItems.some((it) => it.kind === 'event' && it.start);

  const lead = reminders.eventLead === 60 ? '1 hour' : `${reminders.eventLead} min`;
  // The summary stands in for the morning reminder when it is on.
  const morningWay = reminders.briefing ? 'in the morning summary' : reminders.morning !== false ? 'the morning of' : null;
  const deadlineLine = reminders.dayBefore !== false
    ? morningWay ? `Reminder the evening before${reminders.briefing ? ',' : ''} and ${morningWay}` : 'Reminder the evening before'
    : morningWay ? `Reminder ${morningWay}` : 'No deadline reminders · Turn them on in You';
  const reminderLine = reminders.enabled
    ? isEvent && item.start
      ? isClass(item) && !reminders.classReminders ? 'No reminder before repeating classes · Turn them on in You' : `Reminder ${lead} before`
      : item.isDeadline ? deadlineLine : 'Included in the daily summary'
    : 'Reminders are off · Turn them on in You';

  const openEditor = (which: 'time' | 'date') => {
    feedback('select');
    if (editing === which) { setEditing(null); return; }
    const times = item.start ? { start: item.start, end: item.end } : defaultTimes(item);
    setDraft({ start: times.start, end: times.end, date: item.date });
    setReach('series');
    setEditing(which);
  };
  /** The start drags the end with it, keeping the length; the end alone changes the length. */
  const setStart = (start: string) => {
    if (!isLocalTime(start)) return;
    setDraft((d) => {
      const length = d.start && d.end ? (toMinutes(d.end) - toMinutes(d.start) + 1440) % 1440 : null;
      return { ...d, start, end: isEvent ? (length !== null ? plusMinutes(start, length) : d.end) : null };
    });
  };
  const seriesLabel = (what: string) => `${what} ${count(fromNow.filter((it) => !it.done && !it.editedAt).length)}`;
  const leftAlone = (kept: number) => (kept ? ` ${kept} you moved ${kept === 1 ? 'stays' : 'stay'}.` : '');
  const saveTime = (times: { start: string | null; end: string | null }) => {
    setEditing(null);
    if (times.start === item.start && times.end === item.end) return;
    const timeText = times.start ? (times.end ? formatRange(times.start, times.end) : formatTime(times.start, true)) : 'no time';
    if (repeats && rule && reach === 'series') {
      const r = applySeries(item.seriesId!, { ...rule, start: times.start, end: times.end }, item.date, now.date, seriesLabel(`Moved`) + ` to ${timeText}`);
      // The occurrence on screen may be hand-moved itself; it follows the rule when it is the one being edited.
      if (item.editedAt) updateItem(item.id, { start: times.start, end: times.end, editedAt: null }, { silent: true });
      if (r.kept) showToast(`${seriesLabel('Moved')} to ${timeText}.${leftAlone(r.kept)}`, r.batchId ?? undefined);
    } else {
      updateItem(item.id, { start: times.start, end: times.end });
    }
    feedback('success');
  };
  const saveDate = (date: string) => {
    setEditing(null);
    if (!isLocalDate(date) || date === item.date) return;
    updateItem(item.id, { date });
    feedback('success');
  };
  const followFeed = () => {
    if (!item.feed) return;
    updateItem(item.id, { date: item.feed.date, start: item.feed.start, end: item.feed.end, editedAt: null, feed: null }, { silent: true });
    feedback('success');
  };
  const feedDiffers = !!item.editedAt && !!item.feed && (item.feed.date !== item.date || item.feed.start !== item.start || item.feed.end !== item.end);
  const reachControl = repeats ? (
    <Segmented size="small" label="Change which" value={reach} onChange={(next) => { feedback('select'); setReach(next); }}
      options={[{ key: 'one', label: `This ${seriesNoun}` }, { key: 'series', label: 'Every one from now' }]} />
  ) : null;
  const deleteAndLeave = (fn: () => void) => { fn(); if (onClose) onClose(); else router.back(); };

  return (
    <Sheet
      title={isEvent ? 'Event' : 'To-do'}
      nav="push"
      inline={!!onClose}
      onClose={onClose}
      footer={
        scope ? (
          <Animated.View entering={enter.drop} exiting={exit.fade} style={styles.scope}>
            <GroupLabel>{`Delete which ${seriesNoun}s?`}</GroupLabel>
            {[
              { label: 'Just this one', value: `${weekdayShort(item.date)}, ${monthDay(item.date)}`, run: () => removeItem(item.id) },
              { label: 'This week', value: count(thisWeek.length), run: () => removeItems(thisWeek.map((it) => it.id), `Deleted ${count(thisWeek.length)}`) },
              { label: 'From now on', value: count(fromNow.length), run: () => removeItems(fromNow.map((it) => it.id), `Deleted ${count(fromNow.length)}`) },
            ].map((o) => (
              <PressRow key={o.label} accessibilityRole="button" accessibilityLabel={`${o.label}, ${o.value}`} onPress={() => { feedback('remove'); deleteAndLeave(o.run); }}
                bleed={8} round={radius.small} style={[styles.scopeRow, { borderBottomColor: c.line }]}>
                <T token="body" color={c.conflict} style={{ flex: 1 }}>{o.label}</T>
                <T token="callout" color={c.inkSecondary} tabular>{o.value}</T>
              </PressRow>
            ))}
            <TextButton label="Cancel" tone="muted" onPress={() => setScope(false)} style={{ alignSelf: 'center' }} />
            <T token="caption" color={c.inkSecondary} style={{ textAlign: 'center' }}>Tap Undo after deleting, or open Your data → Recent changes to restore deleted items.</T>
          </Animated.View>
        ) : (
          <>
            {!isEvent ? <Button label={item.done ? 'Mark as not done' : 'Mark as done'} onPress={() => { feedback(item.done ? 'uncomplete' : 'complete'); toggleDone(item.id); }} /> : null}
            {repeats
              ? <TextButton label={`Delete this ${noun}`} tone="danger" haptic="tap" onPress={() => setScope(true)} />
              : <TextButton label={`Delete this ${noun}`} tone="danger" haptic="remove" onPress={() => deleteAndLeave(() => removeItem(item.id))} />}
          </>
        )
      }>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.head}>
          <View style={styles.eyebrowRow}>
            <T token="callout" color={c.inkSecondary}>{eyebrow}</T>
            <StatusPill label={status.label} tone={status.tone} />
          </View>
          <TextInput
            accessibilityLabel="Title"
            value={title}
            onChangeText={setTitle}
            onBlur={() => title.trim() && title !== item.title && updateItem(item.id, { title: title.trim() })}
            multiline
            style={[textStyle('displaySm', c.inkPrimary), { padding: 0, minWidth: 0 }]}
          />
          {item.start ? (
            <Press accessibilityRole="button" accessibilityLabel={`Time, ${timeLabel}, tap to change`} accessibilityState={{ expanded: editing === 'time' }}
              onPress={() => openEditor('time')} scale={1} dim={fade.pressed}>
              <T token="displayXl" tabular style={styles.time}>
                {clockTime(item.start)}{item.end ? <T token="displayXl" color={c.inkSecondary} style={styles.time}> – </T> : null}{item.end ? clockTime(item.end) : ''}
                <T token="titleSm" color={c.inkSecondary}> {[clockPeriod(item.end ?? item.start), endsNextDay ? 'next day' : ''].filter(Boolean).join(', ')}</T>
              </T>
            </Press>
          ) : (
            <Press accessibilityRole="button" accessibilityLabel="Add a time" haptic="select" onPress={() => openEditor('time')} style={[styles.addTime, { backgroundColor: c.row }]}>
              <T token="subhead">Add a time</T>
            </Press>
          )}
          {editing === 'time' ? (
            <Animated.View entering={enter.drop} exiting={exit.fade} style={styles.editor}>
              {reachControl}
              <View style={styles.wheels}>
                <View style={{ flex: 1, gap: space.xxs }}>
                  <T token="caption" color={c.inkSecondary}>{isEvent ? 'Starts' : 'Due'}</T>
                  <InlinePicker mode="time" date={item.date} time={draft.start} onChange={setStart} />
                </View>
                {isEvent ? (
                  <View style={{ flex: 1, gap: space.xxs }}>
                    <T token="caption" color={c.inkSecondary}>{draft.start && draft.end && draft.end < draft.start ? 'Ends, next day' : 'Ends'}</T>
                    <InlinePicker mode="time" date={item.date} time={draft.end} onChange={(end) => isLocalTime(end) && setDraft((d) => ({ ...d, end }))} />
                  </View>
                ) : null}
              </View>
              <View style={styles.editorActions}>
                <TextButton label="No time" tone="muted" onPress={() => saveTime({ start: null, end: null })} />
                <View style={{ flex: 1 }} />
                <TextButton label="Cancel" tone="muted" onPress={() => setEditing(null)} />
                <TextButton label="Done" onPress={() => saveTime({ start: draft.start, end: isEvent ? draft.end : null })} />
              </View>
            </Animated.View>
          ) : null}
        </View>

        {/* Straight under the time, so the overlap and its one action show without scrolling. */}
        <OverlapNotice key={item.id} item={item} items={items} />

        <Animated.View layout={layout} style={styles.rows}>
          {editing === 'date' ? (
            <Animated.View entering={enter.drop} exiting={exit.fade} style={styles.editor}>
              <T token="body">{`${weekdayLong(draft.date)}, ${longMonthDay(draft.date)}`}</T>
              <InlinePicker mode="date" date={draft.date} time={draft.start} onChange={(date) => isLocalDate(date) && setDraft((d) => ({ ...d, date }))} />
              {repeats ? <T token="caption" color={c.inkSecondary}>{`Moves this ${seriesNoun} only. To change the days it meets, change where it repeats below.`}</T> : null}
              <View style={styles.editorActions}>
                <View style={{ flex: 1 }} />
                <TextButton label="Cancel" tone="muted" onPress={() => setEditing(null)} />
                <TextButton label="Done" onPress={() => saveDate(draft.date)} />
              </View>
            </Animated.View>
          ) : (
            <Row onPress={() => openEditor('date')} accessibilityLabel={`Date, ${weekdayLong(item.date)}, ${longMonthDay(item.date)}, tap to change`}>
              <T token="body">{`${weekdayLong(item.date)}, ${longMonthDay(item.date)}`}{item.isDeadline ? <T token="body" color={c.inkSecondary}> · Deadline</T> : null}</T>
            </Row>
          )}
          <Row onPress={whereHref ? () => router.push(whereHref) : undefined} accessibilityLabel={whereHref ? `${where}, open` : undefined}>
            <T token="body">{where}</T>
          </Row>
          {source ? (
            <Row onPress={item.batchId && batch ? () => router.push(`/import/${item.batchId}`) : undefined} accessibilityLabel={batch ? `${source}, open the import` : undefined}>
              <T token="body">{source}</T>
            </Row>
          ) : null}
          {feedDiffers && item.feed ? (
            <Row trailing={<TextButton label="Use Canvas’s" onPress={followFeed} accessibilityLabel="Use the date Canvas has" />}>
              <T token="body" color={c.inkSecondary} style={{ flex: 1 }}>{`Canvas has this on ${weekdayShort(item.feed.date)}, ${monthDay(item.feed.date)}${item.feed.start ? ` at ${formatTime(item.feed.start, true)}` : ''}`}</T>
            </Row>
          ) : null}
          {/* The Repeat screen owns the rule: days, how often, until when, and making a one-off repeat. */}
          <Row onPress={() => router.push(`/repeat/${item.id}`)}
            accessibilityLabel={repeats && rule ? `${describeRule(rule)} until ${monthDay(seriesEnd)}, ${seriesLeft} left, tap to change how it repeats` : 'Doesn’t repeat, tap to make it repeat'}>
            <T token="body" color={repeats ? c.inkPrimary : c.inkSecondary} style={{ flex: 1 }}>{repeats && rule ? `${describeRule(rule)} until ${monthDay(seriesEnd)} · ${seriesLeft} left` : 'Doesn’t repeat'}</T>
          </Row>
          <Row trailing={<NativeToggle label="Urgent" value={!!item.urgent} onChange={(urgent) => void setUrgent(urgent)} />}>
            <T token="body" style={{ flex: 1 }}>Urgent</T>
          </Row>
          {item.urgent && !item.done ? <RingingAlarmInfo timed={!!item.start} itemID={item.id} /> : null}
          {isEvent && !item.isDeadline && item.icon !== 'exam' ? (
            <Row trailing={<NativeToggle label="Flexible time" value={isFlexibleEvent(item)} onChange={(value) => updateItem(item.id, { timeFlexibility: value ? 'flexible' : 'fixed' })} />}>
              <T token="body" style={{ flex: 1 }}>Flexible time</T>
            </Row>
          ) : null}
          <Row onPress={reminders.enabled ? undefined : () => router.push('/settings/reminders')}>
            <T token="body" color={reminders.enabled ? c.inkPrimary : c.inkSecondary}>{reminderLine}</T>
          </Row>
        </Animated.View>

        {showDay ? (
          <View style={styles.around}>
            <GroupLabel>{`${weekdayLong(item.date)} around it`}</GroupLabel>
            <DayBar items={dayItems} now={{ date: item.date, time: now.time }} conflicts={conflicts} highlight={item.id} />
          </View>
        ) : null}

        <View style={{ gap: space.snug }}>
          <GroupLabel>Notes</GroupLabel>
          {item.notes && editing !== 'notes' ? (
            <Notes text={item.notes} onEdit={() => setEditing('notes')} onChange={(next) => { setNotes(next); updateItem(item.id, { notes: next }); }} />
          ) : editing === 'notes' ? (
            <Animated.View entering={enter.drop}>
              <TextInput
                accessibilityLabel="Notes"
                autoFocus
                multiline
                value={notes}
                onChangeText={setNotes}
                onBlur={() => { const next = notes.trim() || null; if (next !== item.notes) updateItem(item.id, { notes: next }); setEditing(null); }}
                placeholder="Add a note…"
                placeholderTextColor={c.inkTertiary}
                style={[textStyle('body', c.inkPrimary), styles.notes, { backgroundColor: c.row }]}
              />
            </Animated.View>
          ) : (
            <TextButton label="Add a note" tone="muted" onPress={() => setEditing('notes')} style={{ alignSelf: 'flex-start', minHeight: 32 }} />
          )}
        </View>

        {item.done && item.completedAt ? <T token="caption" color={c.inkSecondary}>Done {fullDate(localParts(new Date(item.completedAt)).date)}</T> : null}

        {sameWeek.length ? (
          <View>
            <SectionTitle title="Same week" />
            {sameWeek.map((it, i) => (
              <Animated.View key={it.id} layout={layout} entering={enter.fade} exiting={exit.fade}>
                <ItemRow item={it} today={now.date} last={i === sameWeek.length - 1} onPress={() => open(it.id)}
                  onToggle={() => { feedback(it.done ? 'uncomplete' : 'complete'); toggleDone(it.id); }} onDelete={() => removeItem(it.id)} />
              </Animated.View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: SCREEN_GUTTER, paddingTop: space.xs, paddingBottom: space.xl, gap: space.sm },
  head: { gap: space.sm, paddingBottom: space.xs },
  eyebrowRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  time: { fontSize: 44, lineHeight: 48, letterSpacing: -1.4, paddingTop: space.xxs },
  addTime: { alignSelf: 'flex-start', height: size.pill, borderRadius: radius.pill, paddingHorizontal: space.sm, alignItems: 'center', justifyContent: 'center', marginTop: space.xs },
  editor: { gap: space.sm, paddingTop: space.xs },
  wheels: { flexDirection: 'row', gap: space.sm },
  editorActions: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rows: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 28, paddingHorizontal: space.xxs },
  around: { gap: space.xs, paddingTop: space.sm },
  notes: { ...corner(radius.field), padding: space.sm, minHeight: 88, textAlignVertical: 'top' },
  scope: { alignSelf: 'stretch' },
  scopeRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: size.compact, borderBottomWidth: StyleSheet.hairlineWidth },
});
