import { anchorRule, describeRule, formatTime, isLocalDate, localParts, monthDay, weekdayShort } from '@dayli/core';
import type { Category } from '@dayli/schema';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { CategoryDot, Chip, FieldRow, GroupLabel, PickerPill } from '@/components/Controls';
import { InlinePicker, NativeToggle } from '@/components/Native';
import { RepeatEditor } from '@/components/RepeatEditor';
import { RingingAlarmInfo } from '@/components/RingingAlarmInfo';
import { Press } from '@/components/Press';
import { Segmented } from '@/components/Segmented';
import { Button, Sheet } from '@/components/Sheet';
import { T } from '@/components/Text';
import { track } from '@/lib/analytics';
import { feedback } from '@/lib/feedback';
import { enter, exit, layout } from '@/lib/motion';
import { usePlusAccess } from '@/lib/plus-access';
import { buildManualItem, defaultManualTimes, type ManualDraft } from '@/lib/manual-item';
import { courseTint, useCourseList, useStore } from '@/store';
import { SCREEN_GUTTER, corner, radius, textStyle, useTheme, space } from '@/theme';

const categories: { key: Category; label: string }[] = [
  { key: 'personal', label: 'Personal' }, { key: 'school', label: 'School' }, { key: 'work', label: 'Work' },
];

type Field = 'title' | 'employer' | 'notes';
type Picker = 'date' | 'start' | 'end' | 'time' | 'repeat';

/** New to-do or event by hand: a pill title, hairline rows with pills and toggles, one primary button. */
export default function CreateScreen() {
  const { c } = useTheme();
  const params = useLocalSearchParams<{ kind?: string; date?: string }>();
  const courses = useCourseList();
  const breaks = useStore((s) => s.settings.breaks ?? []);
  const [draft, setDraft] = useState<ManualDraft>(() => ({
    kind: params.kind === 'event' ? 'event' : 'task', title: '', category: 'personal',
    date: params.date && isLocalDate(params.date) ? params.date : localParts(new Date()).date,
    ...defaultManualTimes(new Date()), allDay: false, hasDueTime: false, isDeadline: false, urgent: false,
    courseId: null, employer: '', notes: '', repeat: null,
  }));
  const [error, setError] = useState<string | null>(null);
  const [focus, setFocus] = useState<Field | null>(null);
  const [picker, setPicker] = useState<Picker | null>(null);
  const saving = useRef(false);
  const patch = (values: Partial<ManualDraft>) => { setDraft((previous) => ({ ...previous, ...values })); setError(null); };
  const { requirePlus } = usePlusAccess();
  // Urgent items ring like an alarm, which is part of Plus. Turning it off is always allowed.
  const setUrgent = async (urgent: boolean) => {
    if (urgent && !(await requirePlus('urgent'))) return;
    feedback('select');
    patch({ urgent });
  };
  const event = draft.kind === 'event';

  const save = () => {
    if (saving.current) return;
    const result = buildManualItem(draft);
    if (!result.ok) { setError(result.error); feedback('error'); return; }
    saving.current = true;
    const store = useStore.getState();
    const id = store.addItem(result.item);
    const added = useStore.getState().items[id]?.batchId ?? null;
    const series = result.repeat ? store.startSeries(id, result.repeat, localParts(new Date()).date) : null;
    // One Undo on the toast takes back the first one and the rest of its series together.
    if (series?.batchId && added) store.joinBatch(series.batchId, added);
    track('manual_item_created', {
      item_kind: result.item.kind,
      category: result.item.category,
      has_time: !!result.item.start,
      urgent: !!result.item.urgent,
      repeats: !!result.repeat,
    });
    const noun = result.item.kind === 'event' ? 'event' : 'to-do';
    store.showToast(
      series && result.repeat ? `Added ${series.created + 1} ${noun}s through ${monthDay(result.repeat.until)}.` : `Added ${result.item.title}.`,
      added ?? undefined,
    );
    feedback('success');
    router.back();
  };

  /** A one-line field is a pill: grey at rest, white with an ink ring while focused. */
  const pillField = (name: Field) => [
    styles.pillField,
    textStyle('body', c.inkPrimary),
    focus === name ? { backgroundColor: c.surface, borderColor: c.inkPrimary } : { backgroundColor: c.row, borderColor: 'transparent' },
  ];

  /** A pill opens its picker under the row in one tap, and closes it on the next. */
  const toggle = (which: Picker) => setPicker((open) => (open === which ? null : which));
  const timeControl = (which: 'start' | 'end' | 'time') => {
    const key = which === 'end' ? 'end' : 'start';
    return <PickerPill label={formatTime(draft[key])} open={picker === which} accessibilityLabel={`${which === 'end' ? 'Ends' : which === 'start' ? 'Starts' : 'Time'}, ${formatTime(draft[key])}`} onPress={() => toggle(which)} />;
  };
  const inlinePicker = (which: Picker) => {
    if (picker !== which) return null;
    const key = which === 'end' ? 'end' : 'start';
    return (
      <Animated.View entering={enter.fade} exiting={exit.fade} layout={layout}>
        {which === 'date'
          ? <InlinePicker mode="date" date={draft.date} time={draft.start} onChange={(date) => isLocalDate(date) && patch({ date, repeat: draft.repeat ? anchorRule(draft.repeat, date) : null })} />
          : <InlinePicker mode="time" date={draft.date} time={draft[key]} onChange={(value) => patch({ [key]: value })} />}
      </Animated.View>
    );
  };

  return (
    <Sheet dialog title={event ? 'New event' : 'New to-do'} footer={<>
      {error ? <T token="callout" color={c.conflict} accessibilityRole="alert">{error}</T> : null}
      <Button label={event ? 'Add event' : 'Add to-do'} onPress={save} />
    </>}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <TextInput accessibilityLabel={event ? 'Event title' : 'To-do title'} value={draft.title} onChangeText={(title) => patch({ title })}
          placeholder={event ? 'What’s happening?' : 'What do you need to do?'} placeholderTextColor={c.inkSecondary}
          onFocus={() => setFocus('title')} onBlur={() => setFocus((f) => (f === 'title' ? null : f))}
          maxLength={500} returnKeyType="done" style={pillField('title')} />

        <View style={styles.rows}>
          <FieldRow label="Date">
            <PickerPill label={`${weekdayShort(draft.date)}, ${monthDay(draft.date)}`} open={picker === 'date'} accessibilityLabel={`Date, ${weekdayShort(draft.date)} ${monthDay(draft.date)}`} onPress={() => toggle('date')} />
          </FieldRow>
          {inlinePicker('date')}
          {event ? (
            <>
              <FieldRow label="All day"><NativeToggle label="All day" value={draft.allDay} onChange={(allDay) => patch({ allDay })} /></FieldRow>
              {!draft.allDay ? (
                <>
                  <FieldRow label="Starts">{timeControl('start')}</FieldRow>
                  {inlinePicker('start')}
                  <FieldRow label="Ends">{timeControl('end')}</FieldRow>
                  {inlinePicker('end')}
                  {draft.end < draft.start ? <T token="caption" color={c.inkSecondary} style={styles.rowNote}>Ends the next day.</T> : null}
                </>
              ) : null}
            </>
          ) : (
            <>
              <FieldRow label="Deadline"><NativeToggle label="Deadline" value={draft.isDeadline} onChange={(isDeadline) => patch({ isDeadline })} /></FieldRow>
              <FieldRow label="Set a time"><NativeToggle label="Set a time" value={draft.hasDueTime} onChange={(hasDueTime) => patch({ hasDueTime })} /></FieldRow>
              {draft.hasDueTime ? <FieldRow label="Time">{timeControl('time')}</FieldRow> : null}
              {draft.hasDueTime ? inlinePicker('time') : null}
            </>
          )}
          <FieldRow label="Repeat" last>
            <PickerPill label={draft.repeat ? describeRule(draft.repeat) : 'Never'} open={picker === 'repeat'} accessibilityLabel={`Repeat, ${draft.repeat ? describeRule(draft.repeat) : 'never'}`} onPress={() => toggle('repeat')} />
          </FieldRow>
          {picker === 'repeat' ? (
            <Animated.View entering={enter.fade} exiting={exit.fade} layout={layout} style={styles.repeat}>
              <RepeatEditor rule={draft.repeat} from={draft.date} today={localParts(new Date()).date} noun={event ? 'event' : 'to-do'} breaks={breaks}
                times={{ start: event ? (draft.allDay ? null : draft.start) : draft.hasDueTime ? draft.start : null, end: event && !draft.allDay ? draft.end : null }}
                onChange={(repeat) => patch({ repeat })} />
            </Animated.View>
          ) : null}
        </View>

        <View>
          <FieldRow label="Urgent" last><NativeToggle label="Urgent" value={!!draft.urgent} onChange={(urgent) => void setUrgent(urgent)} /></FieldRow>
          {draft.urgent ? <RingingAlarmInfo timed={event ? !draft.allDay : draft.hasDueTime} draft /> : <T token="caption" color={c.inkSecondary}>Make this stand out in your plan.</T>}
        </View>

        <View style={styles.section}>
          <GroupLabel>Category</GroupLabel>
          <Segmented options={categories} value={draft.category} onChange={(category) => patch({ category, courseId: null })} label="Category" />
          {draft.category === 'school' && courses.length > 0 ? (
            <View style={styles.chips} accessibilityRole="radiogroup" accessibilityLabel="Course">
              <Chip label="No course" on={draft.courseId === null} onPress={() => patch({ courseId: null })} />
              {courses.map((course) => {
                const on = draft.courseId === course.id;
                const tint = c.tint[courseTint(courses, course.id) ?? 'sky'];
                return (
                  <Press key={course.id} accessibilityRole="radio" accessibilityState={{ selected: on }} haptic="select" onPress={() => patch({ courseId: course.id })}
                    style={[styles.courseChip, { backgroundColor: on ? c.inkPrimary : c.row }]}>
                    <CategoryDot color={on ? tint.fill : tint.ink} />
                    <T token="subhead" color={on ? c.onPrimary : c.inkPrimary}>{course.code ?? course.title}</T>
                  </Press>
                );
              })}
            </View>
          ) : null}
          {draft.category === 'work' ? (
            <TextInput accessibilityLabel="Employer" value={draft.employer} onChangeText={(employer) => patch({ employer })}
              placeholder="Employer (optional)" placeholderTextColor={c.inkSecondary}
              onFocus={() => setFocus('employer')} onBlur={() => setFocus((f) => (f === 'employer' ? null : f))}
              returnKeyType="done" style={pillField('employer')} />
          ) : null}
        </View>

        <TextInput accessibilityLabel="Notes" value={draft.notes} onChangeText={(notes) => patch({ notes })} placeholder="Notes (optional)" placeholderTextColor={c.inkSecondary}
          onFocus={() => setFocus('notes')} onBlur={() => setFocus((f) => (f === 'notes' ? null : f))}
          multiline style={[styles.notes, textStyle('body', c.inkPrimary), focus === 'notes' ? { backgroundColor: c.surface, borderColor: c.inkPrimary } : { backgroundColor: c.row, borderColor: 'transparent' }]} />
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: SCREEN_GUTTER, paddingTop: space.sm, paddingBottom: space.xl, gap: space.xl },
  pillField: { height: 52, borderRadius: 999, paddingHorizontal: space.lg, paddingVertical: 0, borderWidth: 1.5 },
  rows: { marginTop: -space.hair },
  rowNote: { paddingTop: space.xs },
  repeat: { paddingTop: space.sm },
  section: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  courseChip: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.sm, height: 40, borderRadius: 999 },
  notes: { minHeight: 96, paddingVertical: space.sm, paddingHorizontal: space.md, ...corner(radius.field), borderWidth: 1.5, textAlignVertical: 'top' },
});
