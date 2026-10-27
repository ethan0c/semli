import { WEEKDAYS, assessment, conflictIds, dateLocale, formatTime, isLocalDate, localParts, monthDay, newCourses, planCommit, courseKey, diffDays, findCourse, toDrafts, weekOf, weekdayLong, weekdayOf, weekdayShort, type CommitPlan, type DatedDraft, type Draft, typicalTermEnd, spanMinutes, count, planCount } from '@dayli/core';
import type { Item } from '@dayli/schema';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { devAutoConfirmMs } from '@/lib/dev';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { AddedMoment } from '@/components/AddedMoment';
import { CategoryDot, SectionTitle, StatusPill, TextButton } from '@/components/Controls';
import { InlinePicker } from '@/components/Native';
import { Press } from '@/components/Press';
import { ReviewDisclosure, ReviewGlyph, ReviewPill, ReviewPillRow, ReviewRow } from '@/components/ReviewRow';
import { Button, Sheet } from '@/components/Sheet';
import { SourcePreview } from '@/components/SourcePreview';
import { COLUMN, useWebLayout } from '@/lib/layout';
import { ChartKey, keyOf, markKey, shapeFor } from '@/components/ChartMark';
import { TermLine, type TermMark } from '@/components/TermLine';
import { T } from '@/components/Text';
import { WeekChart, compactRange, type WeekBlock, type WeekDay } from '@/components/WeekChart';
import { track } from '@/lib/analytics';
import { feedback } from '@/lib/feedback';
import { enter, exit, layout } from '@/lib/motion';
import { requestNotifications, syncReminders } from '@/lib/notifications';
import { noteConfirmedImport } from '@/lib/store-review';
import { usePlusAccess } from '@/lib/plus-access';
import { purchaseErrorMessage } from '@/lib/revenuecat';
import { usePurchases } from '@/providers/PurchasesProvider';
import { firstOf, importLine } from '@/lib/milestones';
import { newId, nextCourseTint, useCourseList, useItemList, useStore } from '@/store';
import { sampleScheduleExtraction } from '@/store/sample';
import { SCREEN_GUTTER, useTheme, space } from '@/theme';

/*
 * Review: show the week (or the term), not the list. Only changes and things that need
 * input get rows, nothing blocks the confirm, and everything is undoable from the toast.
 */


type SeriesEnd = { mode: 'suggested' | 'pick'; date: string };

export default function ReviewScreen() {
  const { c } = useTheme();
  const { twoPane } = useWebLayout();
  // Development only: semli://review?dev=schedule|update opens the sample schedule for screenshots.
  const params = useLocalSearchParams<{ dev?: string }>();
  const devMode = __DEV__ && (params.dev === 'schedule' || params.dev === 'update') ? params.dev : null;
  const stored = useStore((s) => s.pending);
  const pending = useMemo(
    () => stored ?? (devMode ? {
      extraction: sampleScheduleExtraction(localParts(new Date()).date, devMode === 'update' ? 'update' : 'next'), source: 'Screenshot',
      // On the web the sample shows its source beside the results too.
      ...(Platform.OS === 'web' ? { input: { kind: 'text' as const, text: 'Campus Café schedule, next week:\nMon 4–10 pm\nWed 4–10 pm\nSat 9 am – 3 pm\nSun 11 am – 5 pm' } } : {}),
    } : null),
    [stored, devMode],
  );
  const setPending = useStore((s) => s.setPending);
  const applyPlan = useStore((s) => s.applyPlan);
  const showToast = useStore((s) => s.showToast);
  const allCourses = useCourseList();
  const storedCourses = useStore((s) => s.courses);
  const allItems = useItemList();
  // The onboarding sample goes when this import lands, so nothing matches against it: a real
  // PSYC 101 syllabus filed under the sample's PSYC 101 lost its course when the sample was removed.
  const sampleBatchId = useStore((s) => s.settings.sampleBatchId);
  const sampleIds = useStore((s) => s.batches.find((b) => b.id === s.settings.sampleBatchId)?.changes);
  const { courses, existing } = useMemo(() => {
    const ids = new Set(sampleIds?.map((ch) => ch.after?.id));
    return {
      courses: allCourses.filter((k) => !sampleBatchId || k.batchId !== sampleBatchId),
      existing: allItems.filter((it) => !ids.has(it.id)),
    };
  }, [allCourses, allItems, sampleBatchId, sampleIds]);
  const breaks = useStore((s) => s.settings.breaks);
  const today = localParts(new Date()).date;
  const leaving = useRef(false);
  const confirming = useRef(false);
  const { requirePlus } = usePlusAccess();
  const { isPlus } = usePurchases();
  const [checkingAccess, setCheckingAccess] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);
  // The first import after onboarding: how many were added, while the "Added" moment plays.
  const [moment, setMoment] = useState<number | null>(null);
  const afterMoment = useRef<(() => void) | null>(null);
  // Stable, so the moment's own timer isn't restarted by a re-render.
  const finishMoment = useCallback(() => {
    const next = afterMoment.current;
    afterMoment.current = null;
    next?.();
  }, []);

  // Undated drafts start excluded: they are counted as skipped, never block the confirm.
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    pending ? toDrafts(pending.extraction, today, { breaks }).map((d) => ({ ...d, include: isLocalDate(d.date) })) : [],
  );
  const [seriesEnd, setSeriesEnd] = useState<Record<string, SeriesEnd>>(() => suggestSeriesEnds(drafts));
  /** Existing shifts the user chose to keep although the new schedule drops them. */
  const [kept, setKept] = useState<Set<string>>(() => new Set());
  /** Draft keys with their editor pills shown. */
  const [editing, setEditing] = useState<Set<string>>(() => new Set());
  const [listOpen, setListOpen] = useState(false);
  /** `${key}:${field}` of the one open picker. */
  const [picker, setPicker] = useState<string | null>(null);

  useEffect(() => {
    // Missing transient review data can follow a cold link or a development reload.
    // Explicit close/confirm handlers own their navigation; do not navigate twice.
    if (!pending && !leaving.current) router.replace(useStore.getState().settings.onboarded ? '/plan' : '/onboarding');
  }, [pending]);

  const ex = pending?.extraction;
  /** Rows the person left out, by draft key. */
  const [leftOut, setLeftOut] = useState<Set<string>>(() => new Set());
  // A chosen term end trims the repeating class to the occurrences on or before it.
  const effective = useMemo(
    () => drafts.map((d) => {
      const end = d.seriesId ? seriesEnd[d.seriesId] : undefined;
      return leftOut.has(d.key) || (end && d.date && d.date > end.date) ? { ...d, include: false } : d;
    }),
    [drafts, seriesEnd, leftOut],
  );

  // Courses the import describes that we don't have yet: a syllabus's one, or each class of a
  // schedule. Their ids are minted on confirm.
  const added = useMemo(() => (ex ? newCourses(ex, effective, courses) : []), [ex, effective, courses]);
  const newCourse = added.length === 1 ? added[0]! : null;

  const buildPlan = useCallback(
    (ids: string[]): CommitPlan | null => {
      if (!ex) return null;
      // A syllabus's items belong to its course even when one lacks the code, and a stored course
      // found by title (no code yet) takes them, as `newCourses` already counts it as known.
      const own = ex.course;
      const p = planCommit(ex, effective, existing, (code) => {
        const key = courseKey(code);
        const mine = own && (key === null || key === courseKey(own.code)) ? own : null;
        const stored = findCourse(courses, code) ?? (mine ? findCourse(courses, mine.code, mine.title) : null);
        if (stored) return stored.id;
        const i = added.findIndex((k) => (key && courseKey(k.code) === key) || (mine && k.title === mine.title));
        return i >= 0 ? ids[i]! : null;
      });
      return { ...p, remove: p.remove.filter((id) => !kept.has(id)) };
    },
    [ex, effective, existing, courses, added, kept],
  );
  const plan = useMemo(() => buildPlan(added.map(() => 'new-course')), [buildPlan, added]);

  // The first comparison is explained once, here, where it is happening (see components/Firsts).
  const comparing = !!plan?.schedule?.diff && plan.schedule.diff.changed.length + plan.schedule.diff.removed.length + plan.schedule.diff.unchanged.length > 0;
  const [explainCompare] = useState(() => comparing && !useStore.getState().settings.firsts.reimport);
  useEffect(() => {
    if (!explainCompare) return;
    track('first_note', { kind: 'reimport', action: 'shown' });
    const { settings, setSettings } = useStore.getState();
    setSettings({ firsts: { ...settings.firsts, reimport: true } });
  }, [explainCompare]);

  if (moment !== null) return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AddedMoment count={moment} onDone={finishMoment} />
    </>
  );
  if (!pending || !ex || !plan) return null;

  // ---- What kind of review this is ------------------------------------------------
  const sched = plan.schedule;
  const diff = sched?.diff;
  const isSchedule = !!sched && !!diff;
  const isUpdate = !!diff && diff.changed.length + diff.removed.length + diff.unchanged.length > 0;
  const isSyllabus = ex.detected_type === 'syllabus';
  const source = sourceNoun(pending.source);
  const docNoun = isSyllabus ? 'syllabus' : source.replace(/^(a|your) /, '');

  const included = effective.filter((d): d is DatedDraft => d.include && isLocalDate(d.date));
  const undated = effective.filter((d) => !isLocalDate(d.date));
  const shifts = isSchedule ? included.filter((d) => d.category === 'work') : [];
  const untimed = shifts.filter((d) => !d.start || !d.end);
  const addedKeys = new Set(diff?.added.map((a) => a.key) ?? []);
  const changedByKey = new Map(diff?.changed.map((ch) => [ch.after.key, ch.before]) ?? []);
  const removed = (diff?.removed ?? []).map((item) => ({ item, kept: kept.has(item.id) }));
  const changes = addedKeys.size + changedByKey.size + removed.filter((r) => !r.kept).length;
  const total = plan.create.length + plan.update.length + plan.remove.length;

  const nonSeries = included.filter((d) => !d.seriesId);
  const exams = nonSeries.filter((d) => d.isDeadline && assessment(d.title));
  const series = groupSeries(effective);
  const firstDate = included.map((d) => d.date).sort()[0];
  const lastDate = included.map((d) => d.date).sort().at(-1);

  const thisWeekEnd = weekOf(today)[6]!;
  const nextWeek = shifts.length > 0 && shifts.every((d) => d.date > thisWeekEnd);

  // ---- Editing ----------------------------------------------------------------------
  const edit = (key: string, patch: Partial<Draft>) =>
    setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch, needsInput: false, include: patch.date !== undefined ? isLocalDate(patch.date) : d.include } : d)));
  const toggleEditing = (keys: string[]) => {
    if (keys.length === 0) return;
    feedback('select');
    setEditing((prev) => {
      const next = new Set(prev);
      const allOn = keys.every((k) => next.has(k));
      keys.forEach((k) => (allOn ? next.delete(k) : next.add(k)));
      return next;
    });
  };
  const toggleKept = (id: string) => {
    feedback('select');
    setKept((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /** The nearest other shift with both times, to copy from. */
  const donorFor = (d: DatedDraft): DatedDraft | null => {
    const timed = shifts.filter((s) => s.key !== d.key && s.start && s.end);
    if (timed.length === 0) return null;
    const before = timed.filter((s) => s.date <= d.date).at(-1);
    return before ?? timed[0]!;
  };

  // Questions the read left that the row's own pills don't already ask, and reads the model wasn't
  // sure of. They were worked out and never shown, so a wrong year went in silently (Oct 27, 2026).
  const HANDLED = new Set(['When does this happen?', 'What time does this start?', 'Until when does this repeat?']);
  const askOf = (d: Draft): string | null => {
    if (!d.needsInput || !d.include) return null;
    if (d.question && !HANDLED.has(d.question)) return d.question;
    return d.question ? null : 'Semli wasn’t sure it read this right. Check the date and time.';
  };
  const leaveOut = (keys: string[]) => {
    feedback('select');
    setLeftOut((prev) => new Set([...prev, ...keys]));
    setPicker(null);
    setEditing((prev) => new Set([...prev].filter((k) => !keys.includes(k))));
  };
  const addBack = (keys: string[]) => {
    feedback('select');
    setLeftOut((prev) => new Set([...prev].filter((k) => !keys.includes(k))));
  };
  const leaveOutButton = (keys: string[], label: string) => (
    <TextButton label={label} tone="muted" onPress={() => leaveOut(keys)} style={{ alignSelf: 'flex-start' }} />
  );

  /** A pill opens its picker under the row in one tap, and closes it on the next. */
  const togglePicker = (id: string) => setPicker((open) => (open === id ? null : id));
  const opened = (node: ReactNode) => <Animated.View entering={enter.fade} exiting={exit.fade} layout={layout}>{node}</Animated.View>;

  const timeEditor = (d: DatedDraft) => {
    const donor = !d.start || !d.end ? donorFor(d) : null;
    const field = (f: 'start' | 'end') => {
      const id = `${d.key}:${f}`;
      const v = d[f];
      return <ReviewPill key={f} label={v ? formatTime(v) : f === 'start' ? 'Start' : 'End'} muted={!v} open={picker === id} accessibilityLabel={`${f === 'start' ? 'Start' : 'End'} time, ${v ? formatTime(v) : 'not set'}`} onPress={() => togglePicker(id)} />;
    };
    const open = (['start', 'end'] as const).find((f) => picker === `${d.key}:${f}`);
    return (
      <>
        <ReviewPillRow>
          {field('start')}
          {field('end')}
          {donor ? <TextButton label={`Same as ${weekdayLong(donor.date)}`} onPress={() => edit(d.key, { start: donor.start, end: donor.end })} /> : null}
        </ReviewPillRow>
        {open ? opened(<InlinePicker mode="time" date={d.date} time={d[open]} onChange={(v) => edit(d.key, { [open]: v || null })} />) : null}
      </>
    );
  };

  /** The trailing control of a dated-draft row: its date pill, or the amber ask. */
  const dateTrailing = (d: Draft, exam: boolean) => {
    if (!isLocalDate(d.date)) return <AskPill label="Add a date" tone="amber" onPress={() => togglePicker(`${d.key}:date`)} />;
    if (d.kind === 'event' && !d.start && !exam) return <AskPill label="Add a time" tone="amber" onPress={() => togglePicker(`${d.key}:start`)} />;
    return <ReviewPill label={`${weekdayShort(d.date)}, ${monthDay(d.date)}`} open={picker === `${d.key}:date`} onPress={() => togglePicker(`${d.key}:date`)} />;
  };

  /** The picker a dated-draft row's pill opened, under the row. */
  const datePicker = (d: Draft) => {
    if (picker === `${d.key}:date`) return opened(<InlinePicker mode="date" date={d.date} time={d.start} onChange={(date) => edit(d.key, { date: date || null })} />);
    if (picker === `${d.key}:start` && isLocalDate(d.date)) return opened(<InlinePicker mode="time" date={d.date} time={d.start} onChange={(v) => edit(d.key, { start: v || null })} />);
    return null;
  };

  // ---- Confirm and close ----------------------------------------------------------
  const close = () => {
    leaving.current = true;
    setPending(null);
    if (router.canGoBack()) router.back();
    else router.replace(useStore.getState().settings.onboarded ? '/plan' : '/onboarding');
  };

  const confirm = async () => {
    if (confirming.current || leaving.current) return;
    confirming.current = true;
    setAccessError(null);
    if (isUpdate) {
      setCheckingAccess(true);
      const beforeItems = useStore.getState().items;
      try {
        if (!(await requirePlus('schedule_update')) || leaving.current) return;
        if (beforeItems !== useStore.getState().items) {
          setAccessError('Your calendar changed. Review the updated shifts before saving.');
          return;
        }
      } catch (error) {
        setAccessError(purchaseErrorMessage(error));
        return;
      } finally {
        confirming.current = false;
        setCheckingAccess(false);
      }
    }
    leaving.current = true;
    // A real import replaces the onboarding sample, unless it edits sample rows (then Today keeps offering Remove).
    const { settings: before, batches, undoBatch, setSettings: saveSettings } = useStore.getState();
    if (before.sampleBatchId) {
      const sampleIds = new Set(batches.find((b) => b.id === before.sampleBatchId)?.changes.map((ch) => ch.after?.id).filter(Boolean));
      if (!plan.update.some((u) => sampleIds.has(u.id)) && !plan.remove.some((r) => sampleIds.has(r))) {
        undoBatch(before.sampleBatchId, { force: true });
        saveSettings({ sampleBatchId: null });
        track('sample_removed', { how: 'import' });
      }
    }
    const label = plan.schedule
      ? `Updated ${plan.schedule.employer} schedule`
      : `Added ${count(plan.create.length, 'item')}`;
    const courseIds = added.map(() => newId());
    const id = applyPlan(buildPlan(courseIds) ?? plan, label, {
      source: pending.source,
      courses: added.map((k, i) => ({ id: courseIds[i]!, ...k, sourceId: null })),
    });
    feedback('success');
    // The rating prompt, when it is due; quiet after a Plus gate so it never lands on the celebration.
    void noteConfirmedImport({ prompt: !isUpdate });
    const parts = [
      plan.create.length ? `${plan.create.length} added` : null,
      plan.update.length ? `${plan.update.length} updated` : null,
      plan.remove.length ? `${plan.remove.length} removed` : null,
      plan.skipped ? `${plan.skipped} already there` : null,
    ].filter(Boolean);
    track('review_committed', { created: plan.create.length, updated: plan.update.length, removed: plan.remove.length, type: ex.detected_type });
    const { settings, setSettings } = useStore.getState();
    setPending(null);
    if (!settings.onboarded) {
      // Onboarding ends on its own showcase, so its import counts as the first without the moment.
      showToast(importLine(parts, ex.detected_type, firstOf(useStore.getState().settings.name)), id);
      setSettings({ onboardingImportDone: true, firsts: { ...settings.firsts, added: true } });
      if (router.canGoBack()) router.back();
      else router.replace('/onboarding');
      return;
    }
    // The toast with Undo and the reminders prompt wait until Plan, so neither lands on the moment.
    const goOn = () => {
      const { settings: now, setSettings: save } = useStore.getState();
      // The first read Plus pays for says so: otherwise a subscriber never sees what they bought.
      const plusNote = pending?.plus && !now.firsts.plusImport ? ' This import is included with Plus.' : '';
      if (plusNote) save({ firsts: { ...now.firsts, plusImport: true } });
      showToast(importLine(parts, ex.detected_type, firstOf(now.name)) + plusNote, id);
      if (!now.remindersAsked) {
        save({ remindersAsked: true });
        void requestNotifications().then((ok) => ok ? syncReminders() : undefined).catch(() => {});
      }
      router.dismissAll();
      router.replace('/plan');
    };
    // The first import a person adds after onboarding gets the one celebration before Plan.
    if (!settings.firsts.added && !isUpdate && plan.create.length > 0) {
      setSettings({ firsts: { ...settings.firsts, added: true } });
      afterMoment.current = goOn;
      setMoment(plan.create.length);
      return;
    }
    goOn();
  };

  // ---- Header copy ------------------------------------------------------------------
  const title = isSchedule
    ? `${sched.employer}${nextWeek ? ' · Next week' : ''}`
    : isSyllabus
      ? `${ex.course?.code ?? ex.course?.title ?? 'Course'} · Syllabus`
      : ex.detected_type === 'course_schedule' ? 'Class schedule' : 'Review';

  const intro = isUpdate && sched ? `${monthDay(sched.coversFrom)} to ${monthDay(sched.coversTo)} · Compared with what you have` : `From ${source} · Found`;

  const newHours = shifts.reduce((m, d) => m + spanMinutes(d.start, d.end), 0);
  const oldHours = diff ? [...diff.changed.map((ch) => ch.before), ...diff.unchanged.map((u) => u.before), ...diff.removed].reduce((m, i) => m + spanMinutes(i.start, i.end), 0) : 0;
  const repeating = included.filter((d) => d.seriesId);
  const seriesCount = repeating.length;
  // Repeating items are named by kind ("32 classes · 64 events"): a gym routine is not a class.
  const seriesKinds = seriesCount ? planCount(repeating) : '';
  const seriesBig = seriesKinds.includes(' · ') || seriesKinds.endsWith(' plans') ? count(seriesCount, 'plan') : seriesKinds;

  const big = isUpdate
    ? count(changes, 'change')
    : isSchedule
      ? count(shifts.length, 'shift')
      : nonSeries.length > 0 || seriesCount === 0
        ? count(nonSeries.length, 'date')
        : seriesBig;

  let line: string;
  if (isSchedule && shifts.length > 0) {
    const first = shifts[0]!.date;
    const last = shifts.at(-1)!.date;
    const span = first === last ? `${weekdayShort(first)} ${dayNum(first)}` : `${weekdayShort(first)} ${dayNum(first)} to ${weekdayShort(last)} ${dayNum(last)}`;
    line = isUpdate
      ? `${count(shifts.length, 'shift')} · ${hours(newHours)}${oldHours === newHours ? ', as before' : `, ${newHours > oldHours ? 'up' : 'down'} from ${hours(oldHours, false)}`}`
      : `${span} · ${hours(newHours)}`;
  } else if (firstDate && lastDate) {
    const span = firstDate === lastDate ? `${weekdayLong(firstDate)}, ${monthDay(firstDate)}` : `${monthDay(firstDate)} to ${monthDay(lastDate)}`;
    const due = nonSeries.length - exams.length;
    const todos = nonSeries.filter((d) => d.kind === 'task' && !exams.includes(d)).length;
    const events = nonSeries.filter((d) => d.kind === 'event').length;
    // `exams` holds quizzes too; the header names them apart.
    const quizzes = exams.filter((e) => assessment(e.title) === 'quiz').length;
    const tests = [exams.length - quizzes || !quizzes ? count(exams.length - quizzes, 'exam') : null, quizzes ? count(quizzes, 'quiz', 'quizzes') : null];
    const parts = isSyllabus
      ? [...tests, count(due, 'due date')].filter(Boolean)
      : [...(exams.length ? tests : []), todos ? count(todos, 'to-do') : null, events ? count(events, 'event') : null, ...(seriesKinds ? seriesKinds.split(' · ') : [])].filter(Boolean);
    // Only repeating items: the big number already counts them, so the line does not repeat it.
    line = parts.length && parts.join(' · ') !== big ? `${span} · ${parts.join(', ')}` : span;
  } else {
    line = undated.length ? 'Nothing has a date yet' : 'Nothing to add';
  }

  const note = newCourse
    ? `Adds the course ${[newCourse.code, newCourse.title].filter(Boolean).join(' · ')}. You can change its color on its page.`
    : added.length > 1
    ? `Adds ${added.length} courses to School: ${added.map((k) => k.code ?? k.title).join(', ')}.`
    : isUpdate ? 'Reminders move with the shifts.' : 'Nothing is saved until you confirm.';

  // ---- Chart -----------------------------------------------------------------------
  const weeks = isSchedule ? uniqueWeeks([...shifts.map((d) => d.date), ...removed.map((r) => r.item.date)]) : [];
  const dayFor = (date: string): WeekDay => {
    const mine = shifts.filter((d) => d.date === date);
    const gone = removed.filter((r) => r.item.date === date);
    const blocks: WeekBlock[] = [];
    let label: string | undefined;
    let labelTone: WeekDay['labelTone'];
    let unknown = false;
    for (const d of mine) {
      if (!d.start || !d.end) { unknown = true; continue; }
      const added = addedKeys.has(d.key);
      const before = changedByKey.get(d.key);
      if (before?.start && before.end) blocks.push({ id: `${d.key}-was`, start: before.start, end: before.end, tone: 'grey', outline: 'dashed' });
      blocks.push({ id: d.key, start: d.start, end: d.end, tone: isUpdate && added ? 'green' : 'ink' });
      if (!label) { label = compactRange(d.start, d.end); labelTone = isUpdate && added ? 'green' : before ? 'ink' : undefined; }
    }
    for (const r of gone) {
      if (!r.item.start || !r.item.end) continue;
      blocks.push({ id: r.item.id, start: r.item.start, end: r.item.end, tone: r.kept ? 'ink' : 'red', outline: r.kept ? undefined : 'solid' });
      if (!label) { label = compactRange(r.item.start, r.item.end); labelTone = r.kept ? undefined : 'red'; }
    }
    if (unknown) { label = 'time'; labelTone = 'amber'; }
    return { date, blocks, unknown, label: label ?? 'off', labelTone };
  };
  const chartCaption = 'Each bar is 6 am to midnight. Tap a day to change it.';

  const marks: TermMark[] = nonSeries.map((d) => {
    const test = exams.includes(d) ? assessment(d.title) : null;
    return { id: d.key, date: d.date, kind: shapeFor(test), label: test ? (d.title.length <= 10 ? d.title : test === 'exam' ? 'Exam' : 'Quiz') : undefined };
  });

  // ---- Rows ------------------------------------------------------------------------
  const shiftTitle = (d: DatedDraft) => `${weekdayLong(d.date)}'s shift`;
  const shiftWhen = (d: { date: string; start: string | null; end: string | null }) => `${weekdayShort(d.date)} ${dayNum(d.date)} · ${d.start && d.end ? longRange(d.start, d.end) : 'No time'}`;
  const overlapTitle = (d: DatedDraft): string | null => {
    if (!d.start || !d.end) return null;
    const probe: Pick<Item, 'id' | 'kind' | 'date' | 'start' | 'end' | 'done'> = { id: `draft:${d.key}`, kind: 'event', date: d.date, start: d.start, end: d.end, done: false };
    const hit = existing.find((i) => i.date === d.date && i.category !== 'work' && i.kind === 'event' && !i.done && conflictIds([probe, i]).has(i.id));
    return hit ? hit.title : null;
  };

  const shiftRows = () => {
    if (isUpdate) {
      const rows: { date: string; node: ReactNode }[] = [];
      for (const d of shifts) {
        const before = changedByKey.get(d.key);
        const added = addedKeys.has(d.key);
        const open = editing.has(d.key) || !d.start || !d.end;
        if (!added && !before && !editing.has(d.key)) continue;
        const overlap = overlapTitle(d);
        const sub = [before ? `Was ${before.start && before.end ? longRange(before.start, before.end) : 'untimed'}` : null, overlap ? `Overlaps ${overlap}` : null, !added && !before ? 'Same as before' : null].filter(Boolean).join(' · ');
        rows.push({
          date: d.date,
          node: (
            <ReviewRow key={d.key} glyph={<ReviewGlyph />} title={shiftWhen(d)} sub={sub || null} onPress={() => toggleEditing([d.key])}
              trailing={!d.start || !d.end ? <StatusPill label="Add a time" tone="amber" /> : before ? <StatusPill label="Moved" /> : added ? <StatusPill label="New" tone="green" /> : <StatusPill label="Same" />}
              below={open ? timeEditor(d) : null} />
          ),
        });
      }
      for (const r of removed) {
        rows.push({
          date: r.item.date,
          node: (
            <ReviewRow key={r.item.id} glyph={<ReviewGlyph color={r.kept ? c.inkPrimary : c.controlOutline} />} title={shiftWhen(r.item)} struck={!r.kept}
              sub={r.kept ? 'Stays as it is' : 'Not on the new schedule'}
              trailing={<>
                <TextButton label={r.kept ? 'Remove shift' : 'Keep shift'} onPress={() => toggleKept(r.item.id)} />
                <StatusPill label={r.kept ? 'Kept' : 'Removed'} tone={r.kept ? 'grey' : 'redText'} />
              </>} />
          ),
        });
      }
      return rows.sort((a, b) => a.date.localeCompare(b.date)).map((r) => r.node);
    }
    const visible = listOpen ? shifts : shifts.filter((d) => !d.start || !d.end || editing.has(d.key));
    const out = effective.filter((d): d is DatedDraft => d.category === 'work' && leftOut.has(d.key) && isLocalDate(d.date));
    return [
      ...visible.map((d) => {
        const needs = !d.start || !d.end;
        return (
          <ReviewRow key={d.key} glyph={<ReviewGlyph />} title={shiftTitle(d)} onPress={needs ? undefined : () => toggleEditing([d.key])} ask={askOf(d)}
            sub={needs ? `The ${docNoun} has no time for it` : `${weekdayShort(d.date)}, ${monthDay(d.date)} · ${longRange(d.start!, d.end!)}`}
            trailing={needs ? <StatusPill label="Add a time" tone="amber" /> : <StatusPill label={compactRange(d.start!, d.end!)} />}
            below={needs || editing.has(d.key) ? <>{timeEditor(d)}{leaveOutButton([d.key], 'Not my shift')}</> : null} />
        );
      }),
      ...out.map((d) => (
        <ReviewRow key={d.key} glyph={<ReviewGlyph color={c.controlOutline} />} title={shiftTitle(d)} struck sub="Left out"
          trailing={<TextButton label="Add back" onPress={() => addBack([d.key])} />} />
      )),
    ];
  };

  const seriesRow = (s: Series) => {
    const end = seriesEnd[s.id];
    const suggested = suggestedEnd(drafts, s.first) ?? { date: s.last.date, label: monthDay(s.last.date) };
    const when = s.first.start && s.first.end ? `${s.weekdays} ${longRange(s.first.start, s.first.end)}` : s.weekdays;
    const unknown = s.first.seriesEndUnknown;
    const keys = drafts.filter((d) => d.seriesId === s.id).map((d) => d.key);
    if (keys.every((k) => leftOut.has(k))) {
      return <ReviewRow key={s.id} glyph={<ReviewGlyph color={c.controlOutline} />} title={`${s.first.title} · ${when}`} struck sub="Left out"
        trailing={<TextButton label="Add back" onPress={() => addBack(keys)} />} />;
    }
    const untimed = s.first.kind === 'event' && !s.first.start;
    const open = editing.has(s.id) || untimed;
    // Times for the whole class at once: a series had no time editor, so an untimed class stayed untimed.
    const setTimes = (f: 'start' | 'end', v: string | null) =>
      setDrafts((ds) => ds.map((d) => (d.seriesId === s.id ? { ...d, [f]: v, needsInput: false } : d)));
    const timeField = (f: 'start' | 'end') => {
      const v = s.first[f];
      return <ReviewPill key={f} label={v ? formatTime(v) : f === 'start' ? 'Start' : 'End'} muted={!v} open={picker === `${s.id}:${f}`} onPress={() => togglePicker(`${s.id}:${f}`)} />;
    };
    const openTime = (['start', 'end'] as const).find((f) => picker === `${s.id}:${f}`);
    const editor = open ? (<>
      <ReviewPillRow>{timeField('start')}{timeField('end')}</ReviewPillRow>
      {openTime ? opened(<InlinePicker mode="time" date={s.first.date} time={s.first[openTime]} onChange={(v) => setTimes(openTime, v || null)} />) : null}
      {leaveOutButton(keys, 'Leave this class out')}
    </>) : null;
    return (
      <ReviewRow key={s.id} glyph={<ReviewGlyph />} title={`${s.first.title} · ${when}`} onPress={() => toggleEditing([s.id])} ask={askOf(s.first)}
        sub={untimed ? `The ${docNoun} has no time for it` : unknown ? `The ${docNoun} doesn't say when the term ends` : `Until ${monthDay(end?.date ?? s.last.date)}`}
        trailing={untimed ? <StatusPill label="Add a time" tone="amber" /> : unknown ? <StatusPill label="Until when?" tone="amber" /> : <StatusPill label={monthDay(end?.date ?? s.last.date)} />}
        below={!unknown ? editor : (<>
          {editor}
          <ReviewPillRow>
            <ReviewPill label={suggested.label} selected={end?.mode !== 'pick'} onPress={() => setSeriesEnd((prev) => ({ ...prev, [s.id]: { mode: 'suggested', date: suggested.date } }))} />
            {end?.mode === 'pick'
              ? <ReviewPill label={monthDay(end.date)} selected open={picker === `${s.id}:end`} onPress={() => togglePicker(`${s.id}:end`)} />
              : <ReviewPill label="Pick a date" onPress={() => { setSeriesEnd((prev) => ({ ...prev, [s.id]: { mode: 'pick', date: end?.date ?? suggested.date } })); setPicker(`${s.id}:end`); }} />}
          </ReviewPillRow>
          {end?.mode === 'pick' && picker === `${s.id}:end`
            ? opened(<InlinePicker mode="date" date={end.date} time={null} onChange={(date) => { if (isLocalDate(date)) setSeriesEnd((prev) => ({ ...prev, [s.id]: { mode: 'pick', date } })); }} />)
            : null}
        </>)} />
    );
  };

  const dateRow = (d: Draft) => {
    const exam = exams.includes(d as DatedDraft);
    const evidence = d.evidence.trim();
    const sub = (d.kind === 'event' || exam) && !d.start ? `Time not in the ${docNoun}` : evidence || d.courseCode || null;
    if (leftOut.has(d.key)) {
      return <ReviewRow key={d.key} glyph={<ReviewGlyph color={c.controlOutline} />} title={d.title} struck sub="Left out"
        trailing={<TextButton label="Add back" onPress={() => addBack([d.key])} />} />;
    }
    // Any picker open on the row also offers to leave it out: a wrong read no longer has to be imported to be deleted.
    const picking = !!picker?.startsWith(`${d.key}:`) && d.include;
    return <ReviewRow key={d.key} glyph={<ReviewGlyph kind={exam ? 'ring' : 'dot'} />} title={d.title} sub={sub} ask={askOf(d)} trailing={dateTrailing(d, exam)}
      below={picking ? <>{datePicker(d)}{leaveOutButton([d.key], 'Leave this out')}</> : datePicker(d)} />;
  };

  const undatedNoun = undated.length && undated.every((d) => d.icon === 'book') ? ['reading', 'readings'] : ['item', 'items'];
  const skippedLabel = undated.length ? ` · ${count(undated.length, undatedNoun[0], undatedNoun[1])} without a date ${undated.length === 1 ? 'is' : 'are'} skipped` : '';

  const dateRows = () => {
    const out = effective.filter((d) => !d.seriesId && leftOut.has(d.key));
    const visible = [...(isSyllabus && !listOpen ? exams : nonSeries), ...out].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
    return (
      <>
        {series.map(seriesRow)}
        {visible.map(dateRow)}
        {isSyllabus ? <ReviewDisclosure label={`All ${count(nonSeries.length, 'date')} as a list${skippedLabel}`} open={listOpen} onPress={() => { feedback('select'); setListOpen((v) => !v); }} /> : null}
        {!isSyllabus || listOpen ? undated.map(dateRow) : null}
      </>
    );
  };

  // ---- Footer ------------------------------------------------------------------------
  const cta = total === 0
    ? 'Close'
    : isUpdate
      ? nextWeek ? 'Update next week' : shifts.some((d) => d.date <= thisWeekEnd && d.date >= weekOf(today)[0]!) ? 'Update this week' : 'Update the schedule'
      : isSchedule
        ? `Add ${count(shifts.length, 'shift')}`
        : `Add ${plan.create.length + plan.update.length}${undated.length ? ` · Skip ${undated.length}` : ''}`;

  const footerNote = untimed.length
    ? `${untimed.map((d) => weekdayLong(d.date)).join(' and ')} will be added without a time. You can add times later in Plan.`
    : isUpdate && diff.unchanged.length
      ? `${count(diff.unchanged.length, 'shift')} ${diff.unchanged.length === 1 ? 'is the same as before and stays as it is' : 'are the same as before and stay as they are'}.`
      : isSyllabus ? 'With reminders on, you’ll hear about each deadline the evening before and on the morning it’s due.' : null;

  const sheet = (
    <Sheet
      title={title}
      onClose={close}
      footer={<>
        {isUpdate && !isPlus && total > 0 ? <T token="caption" color={c.inkSecondary} style={{ textAlign: 'center' }}>Preview your changes here. Updating an existing schedule is included with Semli Plus.</T> : null}
        {accessError ? <T token="callout" color={c.conflict} accessibilityRole="alert">{accessError}</T> : null}
        {footerNote ? <T token="caption" color={c.inkSecondary} style={{ textAlign: 'center' }}>{footerNote}</T> : null}
        <Button label={checkingAccess ? 'Checking Plus…' : isUpdate && !isPlus && total > 0 ? 'Update with Plus' : cta} disabled={checkingAccess} onPress={total === 0 ? close : () => void confirm()} />
      </>}>
      {__DEV__ && devAutoConfirmMs ? <DevAutoConfirm onConfirm={() => void confirm()} /> : null}
      <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <T token="callout" color={c.inkSecondary}>{intro}</T>
          <T token="displayXl" tabular>{big}</T>
          <T token="lead">{line}</T>
          {newCourse ? (
            // The dot the new course will wear in every list, shown where the course is born.
            <View style={styles.newCourse}>
              <View style={styles.newCourseDot}><CategoryDot color={c.tint[nextCourseTint(storedCourses)].ink} /></View>
              <T token="callout" color={c.inkSecondary} style={{ flex: 1 }}>{note}</T>
            </View>
          ) : <T token="callout" color={c.inkSecondary}>{note}</T>}
          {explainCompare ? <T token="callout" color={c.inkSecondary} style={{ paddingTop: space.xs }}>Semli matched these shifts to your existing schedule. Review the marked changes before saving.</T> : null}
          {total === 0 ? (
            <T token="callout" color={c.inkSecondary} style={{ paddingTop: space.xs }}>
              {included.length === 0 ? 'Nothing has a date yet. Add one to bring it in.' : 'Already in your plan. Nothing to add.'}
            </T>
          ) : null}
        </View>

        {isSchedule && weeks.length > 0 ? (
          <View style={styles.chart}>
            {weeks.map((week) => (
              <WeekChart key={week[0]} days={week.map(dayFor)} today={today} onSelect={(date) => toggleEditing(shifts.filter((d) => d.date === date).map((d) => d.key))} />
            ))}
            {isUpdate ? (
              <ChartKey entries={keyOf([
                shifts.some((d) => addedKeys.has(d.key)) && { glyph: 'block', color: c.added, label: 'New' },
                removed.some((r) => !r.kept) && { glyph: 'outline', color: c.conflict, label: 'Removed' },
                shifts.some((d) => changedByKey.has(d.key)) && { glyph: 'dashed', color: c.controlOutline, label: 'Previous time' },
                shifts.some((d) => !d.start || !d.end) && { glyph: 'outline', color: c.changed, label: 'Needs a time' },
              ])} />
            ) : null}
            <T token="caption" color={c.inkSecondary}>{chartCaption}</T>
          </View>
        ) : null}
        {!isSchedule && firstDate && lastDate && included.length >= 2 ? (
          <View style={styles.chart}>
            <TermLine from={firstDate} to={lastDate} marks={marks} today={today} scale="months" />
            <ChartKey entries={markKey(marks, c)} />
          </View>
        ) : null}

        <Animated.View layout={layout} style={styles.rows}>
          {isUpdate ? <SectionTitle title="What changes" /> : null}
          {isSchedule ? shiftRows() : dateRows()}
          {isSchedule && !isUpdate && shifts.length > 0 ? (
            <ReviewDisclosure label={`All ${count(shifts.length, 'shift')} as a list`} open={listOpen} onPress={() => { feedback('select'); setListOpen((v) => !v); }} />
          ) : null}
        </Animated.View>
      </ScrollView>
    </Sheet>
  );
  // A wide web window shows what was read in the pane, so each row can be checked against it.
  if (!twoPane || !pending?.input) return sheet;
  return (
    <View style={styles.panes}>
      <View style={{ width: COLUMN }}>{sheet}</View>
      <SourcePreview input={pending.input} source={pending.source} />
    </View>
  );
}

/** An amber ask ("Add a date") as a pressable status pill in the trailing slot of a row. */
function AskPill({ label, tone, onPress }: { label: string; tone: 'amber' | 'grey'; onPress: () => void }) {
  return (
    <Press accessibilityRole="button" accessibilityLabel={label} haptic="select" onPress={onPress}>
      <StatusPill label={label} tone={tone} />
    </Press>
  );
}

// ---- Helpers ----------------------------------------------------------------------------

type Dated = Draft & { date: string };
type Series = { id: string; first: Dated; last: Dated; weekdays: string; count: number };

/** Repeating items grouped by series, in date order, with their weekday list ("Tue, Thu"). */
function groupSeries(drafts: Draft[]): Series[] {
  const by = new Map<string, Draft[]>();
  for (const d of drafts) if (d.seriesId && d.date) by.set(d.seriesId, [...(by.get(d.seriesId) ?? []), d]);
  return [...by.entries()].map(([id, list]) => {
    const dated = list.filter((d): d is Dated => !!d.date).sort((a, b) => a.date.localeCompare(b.date));
    const included = dated.filter((d) => d.include);
    const days = [...new Set(dated.map((d) => weekdayOf(d.date)))].sort((a, b) => WEEKDAYS.indexOf(a) - WEEKDAYS.indexOf(b));
    return { id, first: dated[0]!, last: (included.at(-1) ?? dated.at(-1))!, weekdays: days.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(', '), count: included.length };
  });
}

/**
 * Where an open-ended class most likely stops, and how the pill says so: the final, or an exam in
 * the last three weeks of the guessed term, else the fifteen-week guess. A midterm is not an end
 * (Oct 27, 2026: with the final undated, classes stopped at the midterm). The label and the date
 * come from this one place, so the selected pill always names the date it applies.
 */
function suggestedEnd(drafts: Draft[], first: Draft): { date: string; label: string } | null {
  const guess = first.seriesUntil;
  if (!guess || !first.date) return null;
  const exams = drafts.filter((d) => !d.seriesId && d.isDeadline && isLocalDate(d.date) && d.date >= first.date! && assessment(d.title) === 'exam');
  const final = exams.filter((d) => /final/i.test(d.title)).at(-1)
    ?? exams.filter((d) => diffDays(d.date!, guess) <= 21).sort((a, b) => a.date!.localeCompare(b.date!)).at(-1);
  return final
    ? { date: final.date!, label: `${monthDay(final.date!)} · ${/final/i.test(final.title) ? 'The final' : 'The last exam'}` }
    : { date: guess, label: `${monthDay(guess)} · Typical ${typicalTermEnd(first.date).name} end` };
}

/** The default term end for each open-ended series. */
function suggestSeriesEnds(drafts: Draft[]): Record<string, SeriesEnd> {
  const out: Record<string, SeriesEnd> = {};
  for (const d of drafts) {
    if (!d.seriesId || !d.seriesEndUnknown || out[d.seriesId]) continue;
    const end = suggestedEnd(drafts, d);
    if (end) out[d.seriesId] = { mode: 'suggested', date: end.date };
  }
  return out;
}

function uniqueWeeks(dates: string[]): string[][] {
  const starts = [...new Set(dates.map((d) => weekOf(d)[0]!))].sort();
  return starts.map((s) => weekOf(s));
}

/** "36 hours", "7.5 hours", "1 hour"; without the unit when the sentence already has it. */
function hours(minutes: number, unit = true): string {
  const h = Math.round((minutes / 60) * 10) / 10;
  return unit ? `${count(h, 'hour')}` : String(h);
}

function dayNum(date: string): string {
  return String(Number(date.slice(-2)));
}

/** "4:00 – 10:00 pm", "9:00 am – 3:00 pm". */
function longRange(start: string, end: string): string {
  const a = formatTime(start);
  const b = formatTime(end);
  if (!dateLocale().hour12) return `${a} – ${b}`;
  return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -3)} – ${b}` : `${a} – ${b}`;
}

/** "a screenshot", "a photo", "a PDF", "your message". */
function sourceNoun(source: string): string {
  const s = source.toLowerCase();
  if (s === 'message') return 'your message';
  if (s === 'voice') return 'your voice note';
  if (s === 'screenshot') return 'a screenshot';
  if (s === 'photo') return 'a photo';
  if (s.endsWith('.pdf')) return 'a PDF';
  return source;
}

const styles = StyleSheet.create({
  newCourse: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xs },
  newCourseDot: { height: 20, justifyContent: 'center' },
  panes: { flex: 1, flexDirection: 'row' },
  list: { paddingHorizontal: SCREEN_GUTTER, paddingTop: space.xs, paddingBottom: space.md },
  hero: { gap: space.sm },
  chart: { paddingTop: space.xl, gap: space.xs },
  rows: { paddingTop: space.lg },
});

/** Development only: confirms the review after `devAutoConfirmMs` so a recording needs no tap. */
function DevAutoConfirm({ onConfirm }: { onConfirm: () => void }) {
  useEffect(() => {
    const t = setTimeout(onConfirm, devAutoConfirmMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
