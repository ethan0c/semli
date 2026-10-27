import { WEEKDAYS, addDays, assessment, diffDays, formatTime, monthDay, weekdayOf, weekdayShort } from '@dayli/core';
import type { Item } from '@dayli/schema';
import { router } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { CategoryDot, GroupLabel, ListRow, SectionTitle, StatusPill, TextButton, itemStatus } from '@/components/Controls';
import { CourseDetail } from '@/components/CourseDetail';
import { ItemRow } from '@/components/ItemRow';
import { Icon } from '@/components/Icon';
import { T } from '@/components/Text';
import { TabHeader } from '@/components/TabHeader';
import { ChartKey, markKey, shapeFor } from '@/components/ChartMark';
import { TermLine, type TermMark } from '@/components/TermLine';
import { steadyScreen } from '@/components/SteadyScreen';
import { feedback } from '@/lib/feedback';
import { enter, exit, layout } from '@/lib/motion';
import { COLUMN, useWebLayout } from '@/lib/layout';
import { useNow } from '@/lib/now';
import { useScreenShortcuts } from '@/lib/shortcuts';
import { courseTint, useCourseList, useItemList, useStore, type StoredCourse } from '@/store';
import { SCREEN_GUTTER, NAV_INSET, useTheme, screen, space } from '@/theme';

/** Four weeks from today, the span of the deadline map. */
const MAP_DAYS = 28;

/** "Mon, Wed 9 am" from a course's repeating events, or null when it has none. */
function meetingPattern(events: Item[]): string | null {
  const series = new Map<string, Item[]>();
  for (const it of events) if (it.seriesId) series.set(it.seriesId, [...(series.get(it.seriesId) ?? []), it]);
  const main = [...series.values()].sort((a, b) => b.length - a.length)[0];
  if (!main) return null;
  const days = WEEKDAYS.filter((d) => main.some((it) => weekdayOf(it.date) === d)).map((d) => d.charAt(0).toUpperCase() + d.slice(1));
  const start = main.find((it) => it.start)?.start;
  return [days.join(', '), start ? formatTime(start, true) : null].filter(Boolean).join(' ');
}

/** The four week labels over the map: the month shows only when it changes. */
function weekLabels(today: string): string[] {
  let month = '';
  return [0, 7, 14, 21].map((n) => {
    const date = addDays(today, n);
    const label = date.slice(5, 7) === month ? String(Number(date.slice(-2))) : monthDay(date);
    month = date.slice(5, 7);
    return label;
  });
}

function SchoolScreen() {
  const { c } = useTheme();
  const now = useNow();
  // A wide web window opens a course beside the list instead of on its own screen.
  const { twoPane } = useWebLayout();
  const [openId, setOpenId] = useState<string | null>(null);
  useScreenShortcuts({ Escape: () => setOpenId(null) }, !!openId);
  const withPane = (list: ReactNode) => !twoPane ? list : (
    <View style={styles.panes}>
      <View style={{ width: COLUMN }}>{list}</View>
      <View style={[styles.pane, { borderLeftColor: c.line }]}>
        {openId ? <CourseDetail key={openId} id={openId} onClose={() => setOpenId(null)} /> : (
          <View style={styles.paneEmpty}><T token="callout" color={c.inkSecondary}>Choose a course to see it here.</T></View>
        )}
      </View>
    </View>
  );
  const courses = useCourseList();
  // Tints count from the full stored list, as every row does, so a course keeps one colour everywhere.
  const allCourses = useStore((s) => s.courses);
  const items = useItemList();

  const byCourse = useMemo(() => {
    const m = new Map<string, Item[]>();
    for (const it of items) if (it.courseId) m.set(it.courseId, [...(m.get(it.courseId) ?? []), it]);
    return m;
  }, [items]);
  const courseIds = useMemo(() => new Set(courses.map((k) => k.id)), [courses]);
  // Undone deadlines from today on, soonest first (items are already sorted by date and time).
  const deadlines = useMemo(() => items.filter((i) => i.courseId && courseIds.has(i.courseId) && i.isDeadline && !i.done && i.date >= now.date), [items, courseIds, now.date]);
  const next = deadlines[0];
  const inMap = deadlines.filter((i) => diffDays(now.date, i.date) < MAP_DAYS);
  const marksFor = (courseId: string): TermMark[] => inMap.filter((i) => i.courseId === courseId).map((i) => ({
    id: i.id, date: i.date, kind: shapeFor(assessment(i.title)),
  }));
  const mapEnd = addDays(now.date, MAP_DAYS - 1);
  // A tapped mark's id, 'all' for the whole list, or nothing. A picked item that gets done or deleted drops out.
  const [focus, setFocus] = useState<string | 'all' | null>(null);
  const picked = focus && focus !== 'all' ? inMap.find((i) => i.id === focus) : undefined;
  const shown = focus === 'all' ? inMap : picked ? [picked] : [];
  const toggleDone = useStore((s) => s.toggleDone);
  const removeItem = useStore((s) => s.removeItem);
  const labels = weekLabels(now.date);

  const capture = (source: 'file' | 'image') => router.navigate({ pathname: '/add', params: { source, at: String(Date.now()) } });
  const tintOf = (course: StoredCourse) => c.tint[courseTint(allCourses, course.id) ?? 'sky'].ink;

  const days = next ? diffDays(now.date, next.date) : 0;
  const big = !next ? 'Clear' : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days} days`;
  const when = next ? [days < 7 ? weekdayShort(next.date) : monthDay(next.date), next.start ? formatTime(next.start, true) : null].filter(Boolean).join(' ') : '';
  const nextCourse = next ? courses.find((k) => k.id === next.courseId) : undefined;
  // "3 days" then "until Stats exam 2 · Fri 9 am"; on the day itself, "Today" then "Stats exam 2 is due · 9 am".
  const dueLine = next ? (days > 1 ? `until ${next.title} · ${when}` : `${next.title} is due${next.start ? ` · ${formatTime(next.start, true)}` : ''}`) : '';
  const dueWhere = nextCourse ? `${nextCourse.code ?? nextCourse.title}${days > 1 ? ' · Next deadline' : ''}` : days > 1 ? 'Next deadline' : null;

  const keepUpToDate = (
    <View style={styles.section}>
      <GroupLabel>Keep it up to date</GroupLabel>
      <ListRow leading={<Icon name="file" size={20} color={c.inkPrimary} />} title="A syllabus" sub="Adds the course, its exams and due dates" onPress={() => capture('file')} />
      <ListRow leading={<Icon name="image" size={20} color={c.inkPrimary} />} title="A screenshot from class" sub="Import dates from a class announcement" onPress={() => capture('image')} last />
    </View>
  );

  if (courses.length === 0) {
    return withPane(
      <ScrollView style={{ backgroundColor: c.canvas }} contentContainerStyle={{ paddingBottom: NAV_INSET }} contentInsetAdjustmentBehavior="never">
        <TabHeader date={now.date} title="School" size="title"
          details={<T token="callout" color={c.inkSecondary}>Import a syllabus to add courses, exams and due dates.</T>} />
        {keepUpToDate}
      </ScrollView>,
    );
  }

  return withPane(
    <ScrollView style={{ backgroundColor: c.canvas }} contentContainerStyle={{ paddingBottom: NAV_INSET }} contentInsetAdjustmentBehavior="never">
      <TabHeader date={now.date} title={big}
        onPress={next ? () => router.push(`/item/${next.id}`) : undefined}
        accessibilityLabel={next ? `${big} ${dueLine}` : undefined}
        details={next ? (
          <>
            <T token="lead">{dueLine}</T>
            {dueWhere ? <T token="callout" color={c.inkSecondary}>{dueWhere}</T> : null}
          </>
        ) : (
          <T token="callout" color={c.inkSecondary}>No upcoming deadlines.</T>
        )} />

      <View style={styles.section}>
        <View style={styles.mapHead}>
          <T token="title" accessibilityRole="header" style={{ flexShrink: 1 }}>Next four weeks</T>
          {inMap.length ? (
            <TextButton label={focus === 'all' ? 'Hide' : `${inMap.length} due`} accessibilityLabel={focus === 'all' ? 'Hide the list' : `Show what's due, ${inMap.length}`}
              onPress={() => setFocus(focus === 'all' ? null : 'all')} />
          ) : <T token="caption" color={c.inkSecondary}>Nothing due</T>}
        </View>
        <View style={styles.map} accessible accessibilityRole="image" accessibilityLabel={`Deadline map, one strip per course over the next four weeks. ${courses.map((k) => {
          const due = inMap.filter((i) => i.courseId === k.id);
          return `${k.code ?? k.title}: ${due.length ? due.map((i) => `${i.title} ${monthDay(i.date)}`).join(', ') : 'nothing due'}.`;
        }).join(' ')}`}>
          <View style={styles.mapRow}>
            <View style={{ width: 56 }} />
            <View style={{ flex: 1, flexDirection: 'row' }}>
              {labels.map((l, i) => <T key={i} token="axis" color={c.inkSecondary} tabular style={styles.weekLabel}>{l}</T>)}
            </View>
          </View>
          {courses.map((course) => {
            const marks = marksFor(course.id);
            return (
              <View key={course.id} style={[styles.mapRow, { height: 28 }]}>
                <View style={styles.mapLabel}>
                  <CategoryDot color={tintOf(course)} />
                  <T token="subhead" numberOfLines={1} style={{ fontSize: 12, lineHeight: 16, flexShrink: 1 }}>{course.code ?? course.title}</T>
                </View>
                <View style={styles.track}>
                  <TermLine from={now.date} to={mapEnd} marks={marks} today={now.date} scale="none" labels={false}
                    selected={picked?.id} onPick={(id) => { if (id && id !== picked?.id) feedback('select'); setFocus(id && id !== picked?.id ? id : null); }} />
                </View>
              </View>
            );
          })}
          <ChartKey entries={markKey(courses.flatMap((k) => marksFor(k.id)), c)} style={{ paddingLeft: 66, paddingTop: space.xxs }} />
        </View>
        {/* What a tapped mark is, or everything due when "N due" is open. */}
        {shown.map((it, i) => (
          <Animated.View key={it.id} layout={layout} entering={enter.fade} exiting={exit.fade}>
            <ItemRow item={it} today={now.date} last={i === shown.length - 1}
              onPress={() => router.push(`/item/${it.id}`)}
              onToggle={() => { feedback(it.done ? 'uncomplete' : 'complete'); toggleDone(it.id); }}
              onDelete={() => removeItem(it.id)} />
          </Animated.View>
        ))}
      </View>

      <View style={[styles.section, { paddingTop: space.xl }]}>
        <SectionTitle title="Your courses" />
        {courses.map((course, i) => {
          const all = byCourse.get(course.id) ?? [];
          const nextDue = all.find((it) => it.isDeadline && !it.done && it.date >= now.date);
          const pattern = meetingPattern(all.filter((it) => it.kind === 'event' && it.seriesId));
          const status = nextDue ? itemStatus(nextDue, now.date, false, true) : { label: 'Nothing due', tone: 'grey' as const };
          // A next-term course says when its classes begin (items are sorted by date).
          const first = all.find((it) => it.kind === 'event');
          const starts = first && first.date > now.date ? `Starts ${monthDay(first.date)}` : null;
          const sub = [course.title, pattern ?? course.instructor, starts].filter(Boolean).join(' · ');
          return (
            <ListRow key={course.id} title={course.code ?? course.title} sub={sub} last={i === courses.length - 1}
              leading={<View style={styles.dotWell}><CategoryDot color={tintOf(course)} /></View>}
              trailing={<StatusPill label={status.label} tone={status.tone} />}
              chevron
              accessibilityLabel={`${course.code ?? course.title}, ${course.title}, ${nextDue ? `${nextDue.title} ${status.label}` : 'nothing due'}`}
              onPress={() => (twoPane ? setOpenId(course.id) : router.push(`/course/${course.id}`))} />
          );
        })}
      </View>

      {keepUpToDate}
    </ScrollView>,
  );
}

const styles = StyleSheet.create({
  panes: { flex: 1, flexDirection: 'row' },
  pane: { flex: 1, borderLeftWidth: StyleSheet.hairlineWidth },
  paneEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SCREEN_GUTTER },
  section: { paddingHorizontal: SCREEN_GUTTER, ...screen.section },
  mapHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  map: { paddingTop: space.sm, paddingBottom: space.snug, gap: space.sm },
  mapRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  mapLabel: { width: 56, flexDirection: 'row', alignItems: 'center', gap: space.snug },
  weekLabel: { flex: 1 },
  track: { flex: 1, justifyContent: 'center' },
  dotWell: { width: 22, alignItems: 'center' },
});

export default steadyScreen(SchoolScreen);
