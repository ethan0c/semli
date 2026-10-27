import { conflictIds, describeRule, diffDays, formatRange, formatTime, fullDate, inferRule, isFlexibleEvent, isLocalDate, isLocalTime, localParts, monthDay, relativeDay, todayItems, toMinutes, weekOf, weekdayLong, weekdayShort, longMonthDay, clockTime, clockPeriod } from '@dayli/core';
import type { Item } from '@dayli/schema';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { FieldRow, GroupLabel, PickerPill, SectionTitle, StatusPill, TextButton, itemStatus } from '@/components/Controls';
import { Notes } from '@/components/Notes';
import { DayBar } from '@/components/DayBar';
import { ItemRow } from '@/components/ItemRow';
import { InlinePicker, NativeToggle } from '@/components/Native';
import { OverlapNotice } from '@/components/OverlapNotice';
import { RingingAlarmInfo } from '@/components/RingingAlarmInfo';
import { Press, PressRow } from '@/components/Press';
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
import { SCREEN_GUTTER, corner, radius, textStyle, useTheme, size, space } from '@/theme';
import { sourceName } from '@/lib/source-name';


function gap(now: { date: string; time: string }, date: string, time: string | null): string | null {
  if (!time) return null;
  const mins = toMinutes(time) - toMinutes(now.time) + diffDays(now.date, date) * 1440;
  if (mins < 0) return null;
  if (mins < 60) return `In ${mins}m`;
  if (mins < 1440) return `In ${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
  return null;
}

type Times = { start: string | null; end: string | null };
type Open = 'start' | 'end' | 'date' | null;

/**
 * One event or to-do. The big time on top, then labelled rows the way Calendar and Create lay them
 * out: Date, All day, Starts, Ends and Repeat; then where it belongs and where it came from; then
 * Urgent, Flexible time and Reminder. A date or time pill opens its picker under its own row, one
 * at a time, and the change saves when the picker closes or the screen is left. On a repeating
 * item a changed time then asks, inline, whether it is for just this one or every one from now.
 *
 * A pushed screen on the phone (app/item/[id].tsx); on a wide web window, a pane beside Plan's
 * list, where `onClose` closes the pane and `onOpen` shows another item in it.
 */
export function ItemDetail({ id, onClose, onOpen }: { id?: string; onClose?: () => void; onOpen?: (id: string) => void }) {
  const { c } = useTheme();
  const item = useStore((s) => (id ? s.items[id] : undefined));
  if (!item) {
    return (
      <Sheet title="Item unavailable" nav="push" inline={!!onClose} onClose={onClose}>
        <T token="callout" color={c.inkSecondary} style={{ padding: space.lg, paddingHorizontal: SCREEN_GUTTER }}>
          This item may have been deleted. Go back to your plan to see what’s there.
        </T>
      </Sheet>
    );
  }
  return <ItemScreen item={item} onClose={onClose} onOpen={onOpen} />;
}

function ItemScreen({ item, onClose, onOpen }: { item: Item; onClose?: () => void; onOpen?: (id: string) => void }) {
  const { c } = useTheme();
  const now = useNow();
  const open = (next: string) => (onOpen ? onOpen(next) : router.push(`/item/${next}`));
  const courses = useStore((s) => s.courses);
  const batches = useStore((s) => s.batches);
  const items = useItemList();
  const reminders = useStore((s) => s.settings.reminders);
  const toggleDone = useStore((s) => s.toggleDone);
  const updateItem = useStore((s) => s.updateItem);
  const { requirePlus } = usePlusAccess();
  // Urgent items ring like an alarm, which is part of Plus. Turning it off is always allowed.
  const setUrgent = async (urgent: boolean) => {
    if (urgent && !(await requirePlus('urgent'))) return;
    feedback('select');
    updateItem(item.id, { urgent });
  };
  const removeItem = useStore((s) => s.removeItem);
  const removeItems = useStore((s) => s.removeItems);
  const [title, setTitle] = useState(item.title);
  const [notes, setNotes] = useState(item.notes ?? '');
  const [notesOpen, setNotesOpen] = useState(false);
  const [scope, setScope] = useState(false);
  /** Which picker is open under its row; one at a time, so a stray scroll never changes a second field. */
  const [picker, setPicker] = useState<Open>(null);
  /** The times being edited. Wheels change this, not the item, so ten scrolls are one change and one undo. */
  const [times, setTimes] = useState<Times | null>(null);
  const [date, setDate] = useState<string | null>(null);
  /** A repeating item's changed time, waiting for "Just this one" or "Every one from now". */
  const [asking, setAsking] = useState(false);
  const applySeries = useStore((s) => s.applySeries);
  const storedRule = useStore((s) => (item.seriesId ? s.series[item.seriesId] : undefined));
  const showToast = useStore((s) => s.showToast);
  // Leaving the screen saves what is open, as Calendar does; a repeating time defaults to every one from now.
  const flush = useRef<() => void>(() => {});
  const gone = useRef(false);
  useEffect(() => () => { if (!gone.current) flush.current(); }, []);

  const isEvent = item.kind === 'event';
  const noun = isEvent ? 'event' : 'to-do';
  const course = item.courseId ? courses.find((k) => k.id === item.courseId) : null;
  const categoryName = item.category === 'school' ? 'Coursework' : item.category === 'work' ? 'Work' : 'Personal';
  const belongs = item.employer ? { label: 'Job', value: item.employer, href: `/employer/${encodeURIComponent(item.employer)}` }
    : course ? { label: 'Class', value: course.code ?? course.title, href: `/course/${course.id}` }
      : { label: 'Category', value: categoryName, href: null };
  const batch = item.batchId ? batches.find((b) => b.id === item.batchId) : undefined;
  const sourceDate = monthDay((batch?.createdAt ?? item.createdAt).slice(0, 10));
  const sourceLabel = item.sourceId === SAMPLE_SOURCE ? 'Sample data'
    : item.sourceId ? `${capitalize(sourceName(item.sourceId))}, ${sourceDate}`
      : batch ? `${batch.label}, ${sourceDate}` : null;
  const conflicts = conflictIds(items);
  const status = itemStatus(item, now.date, conflicts.has(item.id));
  const until = gap(now, item.date, item.start);
  const eyebrow = [relativeDay(now.date, item.date), until].filter(Boolean).join(' · ');
  const sameWeek = items.filter((it) => it.id !== item.id && !it.done && it.date >= now.date && diffDays(now.date, it.date) <= 7
    && ((item.employer && it.employer === item.employer) || (item.courseId && it.courseId === item.courseId))).slice(0, 4);

  // What the screen shows: the times being edited while a picker or the scope question is open.
  const shown: Times = times ?? { start: item.start, end: item.end };
  const shownDate = date ?? item.date;
  const endsNextDay = !!shown.start && !!shown.end && shown.end < shown.start;
  const timeChanged = !!times && (times.start !== item.start || times.end !== item.end);

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
  const morning = reminders.briefing ? 'morning summary' : reminders.morning !== false ? 'that morning' : null;
  const reminderValue = !reminders.enabled ? 'Off'
    : isEvent && item.start
      ? isClass(item) && !reminders.classReminders ? 'Off for classes' : `${lead} before`
      : item.isDeadline
        ? reminders.dayBefore !== false ? (morning ? `Evening before and ${morning}` : 'Evening before') : morning ? capitalize(morning) : 'Off'
        : 'In the daily summary';

  /** The start drags the end with it, keeping the length; the end alone changes the length. */
  const setStart = (start: string) => {
    if (!isLocalTime(start)) return;
    setTimes((d) => {
      const base = d ?? shown;
      const length = base.start && base.end ? (toMinutes(base.end) - toMinutes(base.start) + 1440) % 1440 : null;
      return { start, end: isEvent ? (length !== null ? plusMinutes(start, length) : base.end) : null };
    });
  };
  const timeText = (t: Times) => (t.start ? (t.end ? formatRange(t.start, t.end) : formatTime(t.start, true)) : isEvent ? 'all day' : 'no time');
  const seriesLabel = (what: string) => `${what} ${count(fromNow.filter((it) => !it.done && !it.editedAt).length)}`;
  const leftAlone = (kept: number) => (kept ? ` ${count(kept)} you moved won't change.` : '');

  /** Saves times to this occurrence, or to every one from it on. */
  const commitTimes = (t: Times, reach: 'one' | 'series') => {
    setTimes(null);
    setAsking(false);
    if (t.start === item.start && t.end === item.end) return;
    if (repeats && rule && reach === 'series') {
      const r = applySeries(item.seriesId!, { ...rule, start: t.start, end: t.end }, item.date, now.date, `${seriesLabel('Moved')} to ${timeText(t)}`);
      // The occurrence on screen may be hand-moved itself; it follows the rule when it is the one being edited.
      if (item.editedAt) updateItem(item.id, { start: t.start, end: t.end, editedAt: null }, { silent: true });
      if (r.kept) showToast(`${seriesLabel('Moved')} to ${timeText(t)}.${leftAlone(r.kept)}`, r.batchId ?? undefined);
    } else {
      updateItem(item.id, { start: t.start, end: t.end });
    }
    feedback('success');
  };
  /** New times are settled: saved at once on a one-off, asked about on a repeating item. */
  const settleTimes = (t: Times) => {
    if (t.start === item.start && t.end === item.end) { setTimes(null); setAsking(false); return; }
    if (repeats) { setTimes(t); setAsking(true); return; }
    commitTimes(t, 'one');
  };
  const commitDate = () => {
    if (date && isLocalDate(date) && date !== item.date) { updateItem(item.id, { date }); feedback('success'); }
    setDate(null);
  };
  /** Closes whatever picker is open, saving what it changed, before `next` opens (or nothing does). */
  const closePicker = (next: Open) => {
    const timeOpen = picker === 'start' || picker === 'end';
    if (timeOpen && next !== 'start' && next !== 'end' && times) settleTimes(times);
    if (picker === 'date') commitDate();
  };
  const togglePicker = (which: Exclude<Open, null>) => {
    feedback('select');
    const next = picker === which ? null : which;
    closePicker(next);
    if (next === 'start' || next === 'end') {
      setAsking(false);
      if (!times) setTimes(item.start ? { start: item.start, end: item.end } : defaultTimes(item));
    }
    if (next === 'date') setDate(item.date);
    setPicker(next);
  };
  /** All day on an event, Set a time on a to-do. */
  const setTimed = (timed: boolean) => {
    feedback('select');
    closePicker(null);
    if (!timed) { setPicker(null); settleTimes({ start: null, end: null }); return; }
    setAsking(false);
    setTimes(defaultTimes(item));
    setPicker('start');
  };
  useEffect(() => {
    flush.current = () => {
      if (picker === 'date') commitDate();
      if (times && timeChanged) commitTimes(times, repeats ? 'series' : 'one');
    };
  });
  const leave = (to: string) => { closePicker(null); setPicker(null); router.push(to); };
  const followFeed = () => {
    if (!item.feed) return;
    updateItem(item.id, { date: item.feed.date, start: item.feed.start, end: item.feed.end, editedAt: null, feed: null }, { silent: true });
    feedback('success');
  };
  const feedDiffers = !!item.editedAt && !!item.feed && (item.feed.date !== item.date || item.feed.start !== item.start || item.feed.end !== item.end);
  const deleteAndLeave = (fn: () => void) => { gone.current = true; fn(); if (onClose) onClose(); else router.back(); };

  const timePicker = (which: 'start' | 'end') => picker === which && times ? (
    <Animated.View entering={enter.fade} exiting={exit.fade} layout={layout}>
      <InlinePicker mode="time" date={item.date} time={which === 'start' ? times.start : times.end}
        onChange={(value) => { if (which === 'start') setStart(value); else if (isLocalTime(value)) setTimes((d) => ({ ...(d ?? shown), end: value })); }} />
    </Animated.View>
  ) : null;

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
              { label: 'Rest of this week', value: count(thisWeek.length), run: () => removeItems(thisWeek.map((it) => it.id), `Deleted ${count(thisWeek.length)}`) },
              { label: 'This and later ones', value: count(fromNow.length), run: () => removeItems(fromNow.map((it) => it.id), `Deleted ${count(fromNow.length)}`) },
            ].map((o) => (
              <PressRow key={o.label} accessibilityRole="button" accessibilityLabel={`${o.label}, ${o.value}`} onPress={() => { feedback('remove'); deleteAndLeave(o.run); }}
                bleed={8} round={radius.small} style={[styles.scopeRow, { borderBottomColor: c.line }]}>
                <T token="body" color={c.conflict} style={{ flex: 1 }}>{o.label}</T>
                <T token="callout" color={c.inkSecondary} tabular>{o.value}</T>
              </PressRow>
            ))}
            <TextButton label="Cancel" tone="muted" onPress={() => setScope(false)} style={{ alignSelf: 'center' }} />
            <T token="caption" color={c.inkSecondary} style={{ textAlign: 'center' }}>You can undo this after deleting, or restore items in You → Your data → Recent changes.</T>
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
            {/* Only a status worth saying: a plain time is already the big number. */}
            {status.tone !== 'grey' ? <StatusPill label={status.label} tone={status.tone} /> : null}
          </View>
          <TextInput
            accessibilityLabel="Title"
            value={title}
            onChangeText={setTitle}
            onBlur={() => title.trim() && title !== item.title && updateItem(item.id, { title: title.trim() })}
            multiline
            style={[textStyle('displaySm', c.inkPrimary), { padding: 0, minWidth: 0 }]}
          />
          {shown.start ? (
            <T token="displayXl" tabular style={styles.time} accessibilityLabel={timeText(shown)}>
              {clockTime(shown.start)}{shown.end ? <T token="displayXl" color={c.inkSecondary} style={styles.time}> – </T> : null}{shown.end ? clockTime(shown.end) : ''}
              <T token="titleSm" color={c.inkSecondary}> {[clockPeriod(shown.end ?? shown.start), endsNextDay ? 'next day' : ''].filter(Boolean).join(', ')}</T>
            </T>
          ) : null}
        </View>

        {/* Straight under the time, so the overlap and its one action show without scrolling. */}
        <OverlapNotice key={item.id} item={item} items={items} />

        {/* When: the date, the time and how it repeats. */}
        <Animated.View layout={layout}>
          <FieldRow label={item.isDeadline ? 'Due date' : 'Date'}>
            <PickerPill label={`${weekdayShort(shownDate)}, ${monthDay(shownDate)}`} open={picker === 'date'}
              accessibilityLabel={`${item.isDeadline ? 'Due date' : 'Date'}, ${weekdayLong(shownDate)}, ${longMonthDay(shownDate)}`} onPress={() => togglePicker('date')} />
          </FieldRow>
          {picker === 'date' ? (
            <Animated.View entering={enter.fade} exiting={exit.fade} layout={layout} style={styles.pickerNote}>
              <InlinePicker mode="date" date={shownDate} time={shown.start} onChange={(next) => isLocalDate(next) && setDate(next)} />
              {repeats ? <T token="caption" color={c.inkSecondary}>{`Only this ${seriesNoun} will move. To change which days it repeats, open Repeat.`}</T> : null}
            </Animated.View>
          ) : null}
          <FieldRow label={isEvent ? 'All day' : 'Set a time'}>
            <NativeToggle label={isEvent ? 'All day' : 'Set a time'} value={isEvent ? !shown.start : !!shown.start} onChange={(v) => setTimed(isEvent ? !v : v)} />
          </FieldRow>
          {shown.start ? (
            <>
              <FieldRow label={isEvent ? 'Starts' : 'Time'}>
                <PickerPill label={formatTime(shown.start)} open={picker === 'start'} accessibilityLabel={`${isEvent ? 'Starts' : 'Time'}, ${formatTime(shown.start)}`} onPress={() => togglePicker('start')} />
              </FieldRow>
              {timePicker('start')}
              {isEvent ? (
                <>
                  <FieldRow label="Ends">
                    <PickerPill label={shown.end ? formatTime(shown.end) : 'Add time'} open={picker === 'end'} accessibilityLabel={shown.end ? `Ends, ${formatTime(shown.end)}` : 'Add an end time'} onPress={() => togglePicker('end')} />
                  </FieldRow>
                  {timePicker('end')}
                  {endsNextDay ? <T token="caption" color={isWork(item) ? c.inkSecondary : c.changed} style={styles.pickerNote}>{isWork(item) ? 'Ends the next day.' : 'This ends the next day. Check the end time if that wasn’t intended.'}</T> : null}
                </>
              ) : null}
            </>
          ) : null}
          {asking && times ? (
            <Animated.View entering={enter.drop} exiting={exit.fade} style={styles.ask}>
              <T token="callout" color={c.inkSecondary}>Apply this time change to:</T>
              <View style={styles.askRow}>
                <Press accessibilityRole="button" haptic="select" onPress={() => commitTimes(times, 'one')} style={[styles.askPill, { backgroundColor: c.row }]}>
                  <T token="subhead">Just this one</T>
                </Press>
                <Press accessibilityRole="button" haptic="select" onPress={() => commitTimes(times, 'series')} style={[styles.askPill, { backgroundColor: c.controlFill }]}>
                  <T token="subhead" color={c.controlInk}>This and later</T>
                </Press>
              </View>
              <TextButton label="Cancel time change" tone="muted" onPress={() => { feedback('select'); setTimes(null); setAsking(false); }} style={{ alignSelf: 'flex-start' }} />
            </Animated.View>
          ) : null}
          {/* The Repeat screen owns the rule: days, how often, until when, and making a one-off repeat. */}
          <FieldRow label="Repeat" last onPress={() => leave(`/repeat/${item.id}`)}
            value={repeats && rule ? `${describeRule(rule)}, through ${monthDay(seriesEnd)}` : 'Never'}
            accessibilityLabel={repeats && rule ? `Repeat, ${describeRule(rule)} through ${monthDay(seriesEnd)}, ${count(seriesLeft)} remaining` : 'Repeat, never'} />
        </Animated.View>

        {/* Where it belongs and where it came from. */}
        <Animated.View layout={layout}>
          <FieldRow label={belongs.label} value={belongs.value} last={!sourceLabel && !feedDiffers}
            onPress={belongs.href ? () => leave(belongs.href!) : undefined} />
          {sourceLabel ? (
            <FieldRow label="Added from" value={sourceLabel} last={!feedDiffers}
              onPress={item.batchId && batch ? () => leave(`/import/${item.batchId}`) : undefined} />
          ) : null}
          {feedDiffers && item.feed ? (
            <FieldRow label="Canvas has" value={`${weekdayShort(item.feed.date)}, ${monthDay(item.feed.date)}${item.feed.start ? `, ${formatTime(item.feed.start, true)}` : ''}`} last>
              <TextButton label="Use Canvas date" onPress={followFeed} accessibilityLabel="Use the date and time from Canvas" />
            </FieldRow>
          ) : null}
        </Animated.View>

        <Animated.View layout={layout}>
          <FieldRow label="Urgent">
            <NativeToggle label="Urgent" value={!!item.urgent} onChange={(urgent) => void setUrgent(urgent)} />
          </FieldRow>
          {item.urgent && !item.done ? <RingingAlarmInfo timed={!!item.start} itemID={item.id} /> : null}
          {isEvent && !item.isDeadline && item.icon !== 'exam' ? (
            <FieldRow label="Flexible time">
              <NativeToggle label="Flexible time" value={isFlexibleEvent(item)} onChange={(value) => updateItem(item.id, { timeFlexibility: value ? 'flexible' : 'fixed' })} />
            </FieldRow>
          ) : null}
          <FieldRow label="Reminder" value={reminderValue} last onPress={() => leave('/settings/reminders')} />
        </Animated.View>

        {showDay ? (
          <View style={styles.around}>
            <GroupLabel>{`Your ${weekdayLong(item.date)}`}</GroupLabel>
            <DayBar items={dayItems} now={{ date: item.date, time: now.time }} conflicts={conflicts} highlight={item.id} />
          </View>
        ) : null}

        <View style={{ gap: space.snug }}>
          <GroupLabel>Notes</GroupLabel>
          {item.notes && !notesOpen ? (
            <Notes text={item.notes} onEdit={() => setNotesOpen(true)} onChange={(next) => { setNotes(next); updateItem(item.id, { notes: next }); }} />
          ) : notesOpen ? (
            <Animated.View entering={enter.drop}>
              <TextInput
                accessibilityLabel="Notes"
                autoFocus
                multiline
                value={notes}
                onChangeText={setNotes}
                onBlur={() => { const next = notes.trim() || null; if (next !== item.notes) updateItem(item.id, { notes: next }); setNotesOpen(false); }}
                placeholder="Add a note…"
                placeholderTextColor={c.inkTertiary}
                style={[textStyle('body', c.inkPrimary), styles.notes, { backgroundColor: c.row }]}
              />
            </Animated.View>
          ) : (
            <TextButton label="Add a note" tone="muted" onPress={() => setNotesOpen(true)} style={{ alignSelf: 'flex-start', minHeight: 32 }} />
          )}
        </View>

        {item.done && item.completedAt ? <T token="caption" color={c.inkSecondary}>Done {fullDate(localParts(new Date(item.completedAt)).date)}</T> : null}

        {sameWeek.length ? (
          <View>
            <SectionTitle title="Also coming up" />
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

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
/** Shifts run past midnight as a matter of course; anything else ending before it starts is a slip worth flagging. */
const isWork = (item: { category: string; employer?: string | null }) => item.category === 'work' || !!item.employer;

const styles = StyleSheet.create({
  body: { paddingHorizontal: SCREEN_GUTTER, paddingTop: space.xs, paddingBottom: space.xl, gap: space.xl },
  head: { gap: space.sm },
  eyebrowRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, minHeight: size.chip },
  time: { fontSize: 44, lineHeight: 48, letterSpacing: -1.4, paddingTop: space.xxs },
  pickerNote: { gap: space.xs, paddingBottom: space.xs },
  ask: { gap: space.xs, paddingVertical: space.sm },
  askRow: { flexDirection: 'row', gap: space.xs },
  askPill: { flex: 1, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.sm },
  around: { gap: space.xs },
  notes: { ...corner(radius.field), padding: space.sm, minHeight: 88, textAlignVertical: 'top' },
  scope: { alignSelf: 'stretch' },
  scopeRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: size.compact, borderBottomWidth: StyleSheet.hairlineWidth },
});
