import { WEEKDAYS, assessment, dateLocale, diffDays, formatTime, isLocalDate, monthDay, weekdayOf, weekdayShort, longMonthDay, clockTime, clockPeriod , count } from '@dayli/core';
import type { Item } from '@dayli/schema';
import { COURSE_TINTS, chart, type TintName } from '@dayli/tokens';
import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { CategoryDot, ListRow, SectionTitle, StatusPill, TextButton } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { ItemRow } from '@/components/ItemRow';
import { Press, PressRow } from '@/components/Press';
import { DateField } from '@/components/Native';
import { Sheet } from '@/components/Sheet';
import { ChartKey, markKey, shapeFor } from '@/components/ChartMark';
import { TermLine, type TermMark } from '@/components/TermLine';
import { T } from '@/components/Text';
import { Ticker } from '@/components/Ticker';
import { feedback } from '@/lib/feedback';
import { enter, exit, layout } from '@/lib/motion';
import { useNow } from '@/lib/now';
import { courseTint, useCourseList, useItemList, useStore } from '@/store';
import { SCREEN_GUTTER, radius, useTheme, screen, fade, iconSize, space } from '@/theme';
import { sourceName } from '@/lib/source-name';



/** "9:00 – 10:15 am", "11:30 am – 1:00 pm". */
function meetingTime(start: string, end: string | null): string {
  if (!end) return formatTime(start);
  if (!dateLocale().hour12) return `${formatTime(start)} – ${formatTime(end)}`;
  return clockPeriod(start) === clockPeriod(end) ? `${clockTime(start)} – ${clockTime(end)} ${clockPeriod(end)}` : `${formatTime(start)} – ${formatTime(end)}`;
}

/** A plain text row: body text, 28 high, no icon, no hairline. Highlights when it can be pressed. */
function Row({ children, trailing, onPress, accessibilityLabel }: { children: ReactNode; trailing?: ReactNode; onPress?: () => void; accessibilityLabel?: string }) {
  return (
    <PressRow onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={accessibilityLabel}
      bleed={8} round={radius.small} style={styles.row}>
      {children}
      {trailing}
    </PressRow>
  );
}

/**
 * One course: what's next, its term on a line, its class times and what's coming up. A pushed screen
 * on the phone (app/course/[id].tsx); on a wide web window, a pane beside School's list, where
 * `onClose` closes the pane.
 */
export function CourseDetail({ id, onClose }: { id?: string; onClose?: () => void }) {
  const { c } = useTheme();
  const now = useNow();
  const courses = useCourseList();
  const allCourses = useStore((s) => s.courses);
  const items = useItemList();
  const batches = useStore((s) => s.batches);
  const toggleDone = useStore((s) => s.toggleDone);
  const removeItem = useStore((s) => s.removeItem);
  const removeItems = useStore((s) => s.removeItems);
  const removeCourse = useStore((s) => s.removeCourse);
  const setCourseColor = useStore((s) => s.setCourseColor);
  const [editingEnd, setEditingEnd] = useState(false);

  const course = courses.find((k) => k.id === id);
  const all = useMemo(() => items.filter((it) => it.courseId === id), [items, id]);

  // The course's repeating class: the largest series among its events.
  const series = useMemo(() => {
    const groups = new Map<string, Item[]>();
    for (const it of all) if (it.kind === 'event' && it.seriesId) groups.set(it.seriesId, [...(groups.get(it.seriesId) ?? []), it]);
    return [...groups.values()].sort((a, b) => b.length - a.length)[0] ?? [];
  }, [all]);

  if (!course) {
    return (
      <Sheet title="Course unavailable" nav="push" inline={!!onClose} onClose={onClose}>
        <T token="callout" color={c.inkSecondary} style={{ padding: space.lg, paddingHorizontal: SCREEN_GUTTER }}>
          We couldn’t find this course. It may have been removed. Go back to return to School.
        </T>
      </Sheet>
    );
  }

  const name = course.code ?? course.title;
  const tintName = courseTint(allCourses, course.id) ?? 'sky';
  const tint = c.tint[tintName].ink;

  // The one big number: days until the next undone deadline.
  const deadlines = all.filter((it) => it.isDeadline);
  const next = deadlines.find((it) => !it.done && it.date >= now.date);
  const days = next ? diffDays(now.date, next.date) : 0;
  const big = !next ? 'Clear' : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days`;
  const when = next ? [days < 7 ? weekdayShort(next.date) : monthDay(next.date), next.start ? formatTime(next.start, true) : null].filter(Boolean).join(' ') : '';
  const eyebrow = [course.title !== name ? course.title : null, course.instructor, next ? (days > 1 ? 'next due in' : 'next due') : null].filter(Boolean).join(' · ');

  // Meets Mon, Wed · 9:00 – 10:15 am · until Dec 11
  const seriesDays = WEEKDAYS.filter((d) => series.some((it) => weekdayOf(it.date) === d)).map((d) => d.charAt(0).toUpperCase() + d.slice(1));
  const seriesStart = series.find((it) => it.start);
  const seriesEnd = series.reduce((max, it) => (it.date > max ? it.date : max), series[0]?.date ?? now.date);
  const seriesTitle = series[0]?.title ?? 'Lecture';
  const seriesLabel = /lecture/i.test(seriesTitle) ? 'Lectures' : seriesTitle;
  const seriesLeft = series.filter((it) => it.date >= now.date && !it.done);
  const nextLecture = seriesLeft[0];
  const meets = series.length
    ? ['Meets ' + seriesDays.join(', '), seriesStart?.start ? meetingTime(seriesStart.start, seriesStart.end) : null, `until ${monthDay(seriesEnd)}`].filter(Boolean).join(' · ')
    : null;
  const shorten = (date: string) => {
    if (!isLocalDate(date) || date >= seriesEnd) return;
    const ids = series.filter((it) => it.date > date).map((it) => it.id);
    if (ids.length) removeItems(ids, `Shortened ${seriesTitle}`);
    setEditingEnd(false);
  };

  // From a syllabus, October 12
  const batch = course.batchId ? batches.find((b) => b.id === course.batchId) : undefined;
  const sourceLine = batch ? `From ${sourceName(batch.source ?? batch.label, 'a syllabus')}, ${longMonthDay(batch.createdAt.slice(0, 10))}` : 'Added by hand';

  // This term: every deadline on one line from the first dated thing to the last.
  const from = all[0]?.date;
  const to = all[all.length - 1]?.date;
  const showTerm = all.length >= 2 && from && to && from !== to;
  const toGo = deadlines.filter((it) => !it.done).length;
  const marks: TermMark[] = deadlines.map((it) => {
    const test = assessment(it.title);
    return {
      id: it.id, date: it.date, kind: shapeFor(test),
      tone: it.done ? 'green' : 'ink',
      label: test ? (it.title.length <= 10 ? it.title : test === 'exam' ? 'Exam' : 'Quiz') : undefined,
    };
  });

  // Coming up: the next three things that are not the class itself, then the class as one row.
  const upcoming = all.filter((it) => !it.done && it.date >= now.date && !(it.seriesId && series.some((s) => s.id === it.id))).slice(0, 3);

  const remove = () => {
    feedback('remove');
    removeCourse(course.id);
    if (onClose) onClose();
    else router.back();
  };

  return (
    <Sheet
      title={name}
      nav="push"
      inline={!!onClose}
      onClose={onClose}
      footer={
        <>
          <TextButton label={`Remove ${name} · ${count(all.length, 'item')}`} tone="danger" haptic="tap" onPress={remove} />
          <T token="caption" color={c.inkSecondary} style={{ textAlign: 'center' }}>Removes this course and its lectures, exams and to-dos. Tap Undo in the confirmation message to restore them.</T>
        </>
      }>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Press accessibilityRole={next ? 'button' : undefined} disabled={!next} onPress={() => next && router.push(`/item/${next.id}`)}
          accessibilityLabel={next ? `${eyebrow} ${big.toLowerCase()}, ${next.title}, ${when}` : `${eyebrow}. Nothing due`}
          scale={1} dim={fade.pressed} style={styles.top}>
          {eyebrow ? <T token="callout" color={c.inkSecondary}>{eyebrow}</T> : null}
          {next ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <View style={{ flexShrink: 1 }}><Ticker value={big} token="displayXl" /></View>
              <Icon name="chevronRight" size={iconSize.nav} color={c.disclosureInk} />
            </View>
          ) : <Ticker value={big} token="displayXl" />}
          {next
            ? <T token="lead" style={styles.line}>{`${next.title} · ${when}`}</T>
            : <T token="callout" color={c.inkSecondary} style={{ paddingTop: space.snug }}>Nothing due</T>}
        </Press>

        <Animated.View layout={layout} style={styles.rows}>
          {meets ? (
            <Row trailing={editingEnd ? null : <TextButton label="Change" onPress={() => setEditingEnd(true)} accessibilityLabel="Change when the class stops meeting" />}>
              <T token="body" style={{ flex: 1 }}>{meets}</T>
            </Row>
          ) : null}
          {editingEnd ? (
            <Animated.View entering={enter.drop} exiting={exit.fade} style={styles.pickers}>
              <T token="callout" color={c.inkSecondary}>Last one</T>
              <DateField date={seriesEnd} time={null} onChange={shorten} />
              <TextButton label="Done" tone="muted" onPress={() => setEditingEnd(false)} />
            </Animated.View>
          ) : null}
          <Row onPress={batch ? () => router.push(`/import/${batch.id}`) : undefined} accessibilityLabel={batch ? `${sourceLine}, open the import` : sourceLine}
            trailing={batch ? <Icon name="chevronRight" size={iconSize.disclosure} color={c.disclosureInk} /> : null}>
            <T token="body" style={{ flex: 1 }}>{sourceLine}</T>
          </Row>
          {/* The course's dot in every list: six tints, the chosen one ringed in ink like a picked mark. */}
          <View style={styles.row} accessibilityRole="radiogroup" accessibilityLabel="Course color">
            <T token="body" style={{ flex: 1 }}>Color</T>
            <View style={styles.swatches}>
              {COURSE_TINTS.map((name) => (
                <Press key={name} haptic="select" accessibilityRole="radio" accessibilityLabel={TINT_LABELS[name]} accessibilityState={{ checked: name === tintName }}
                  hitSlop={6} onPress={() => setCourseColor(course.id, name)}
                  style={[styles.swatch, name === tintName ? { borderColor: c.inkPrimary } : null]}>
                  <View style={[styles.swatchDot, { backgroundColor: c.tint[name].ink }]} />
                </Press>
              ))}
            </View>
          </View>
        </Animated.View>

        {showTerm ? (
          <View style={styles.section}>
            <SectionTitle title="This term" detail={`${toGo} of ${deadlines.length} to go`} />
            <View accessible accessibilityRole="image" accessibilityLabel={`This term from ${longMonthDay(from)} to ${longMonthDay(to)}: ${deadlines.map((it) => `${it.title} ${monthDay(it.date)}${it.done ? ' done' : ''}`).join(', ') || 'no deadlines'}.`}>
              <TermLine from={from} to={to} marks={marks} today={now.date} scale="months" />
            </View>
            <ChartKey entries={markKey(marks, c)} style={{ paddingTop: space.sm }} />
          </View>
        ) : null}

        {upcoming.length || nextLecture ? (
          <Animated.View layout={layout} style={styles.section}>
            <SectionTitle title="Coming up" />
            {upcoming.map((it, i) => (
              <Animated.View key={it.id} layout={layout} entering={enter.fade} exiting={exit.fade}>
                <ItemRow item={it} today={now.date} last={i === upcoming.length - 1 && !nextLecture} onPress={() => router.push(`/item/${it.id}`)}
                  onToggle={() => { feedback(it.done ? 'uncomplete' : 'complete'); toggleDone(it.id); }} onDelete={() => removeItem(it.id)} />
              </Animated.View>
            ))}
            {nextLecture ? (
              <Animated.View layout={layout} entering={enter.fade} exiting={exit.fade}>
                <ListRow title={seriesLabel} sub={`Next one ${diffDays(now.date, nextLecture.date) < 7 ? weekdayShort(nextLecture.date) : monthDay(nextLecture.date)}${nextLecture.start ? ` ${formatTime(nextLecture.start, true)}` : ''}`}
                  leading={<View style={styles.dotWell}><CategoryDot color={tint} /></View>}
                  trailing={<StatusPill label={`${seriesLeft.length} left`} />} chevron={false} last
                  accessibilityLabel={`${seriesLabel}, ${seriesLeft.length} left, next one ${weekdayShort(nextLecture.date)}`}
                  onPress={() => router.push(`/item/${nextLecture.id}`)} />
              </Animated.View>
            ) : null}
          </Animated.View>
        ) : null}
      </ScrollView>
    </Sheet>
  );
}

const SWATCH = 22;
/** What VoiceOver calls each tint; `rose` is persisted but has looked like clay since Oct 2026. */
const TINT_LABELS: Record<TintName, string> = { lavender: 'Lavender', sky: 'Sky', rose: 'Clay', butter: 'Butter', mint: 'Mint', apricot: 'Apricot' };

const styles = StyleSheet.create({
  body: { paddingHorizontal: SCREEN_GUTTER, paddingTop: space.xs, paddingBottom: space.xl },
  top: { gap: space.hair },
  line: { paddingTop: space.snug },
  rows: { paddingTop: space.md, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 28, paddingHorizontal: space.xxs },
  pickers: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap', paddingHorizontal: space.xxs },
  swatches: { flexDirection: 'row', gap: space.xxs },
  swatch: { width: SWATCH + (chart.focusGap + chart.now) * 2, height: SWATCH + (chart.focusGap + chart.now) * 2, borderRadius: 999, borderWidth: chart.now, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  swatchDot: { width: SWATCH, height: SWATCH, borderRadius: SWATCH / 2 },
  section: screen.section,
  dotWell: { width: 22, alignItems: 'center' },
});
