import { addDays, conflictIds, countdownLine, countdownParts, deadlineReason, deadlineWindow, diffDays, findConflicts, featuredCommitment, overdueTasks, pendingDates, spreadWork, startTodaySuggestions, toMinutes, todayItems, tomorrowSummary, weekdayLong, weekendNudge, monthDay, type CountdownState, planCount, hoursMinutes, andList , count } from '@dayli/core';
import type { Item } from '@dayli/schema';
import { palettes } from '@dayli/tokens';
import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { GroupLabel, IconButton, ListRow, SectionTitle, TextButton } from '@/components/Controls';
import { DayBar } from '@/components/DayBar';
import { DisclosureChevron } from '@/components/DisclosureChevron';
import { Icon } from '@/components/Icon';
import { HourView } from '@/components/HourView';
import { TodayFirst } from '@/components/Firsts';
import { ItemDetail } from '@/components/ItemDetail';
import { ItemRow } from '@/components/ItemRow';
import { PhotoHeader } from '@/components/PhotoHeader';
import { Press, PressRow } from '@/components/Press';
import { DARK_FADE, SkyHeader } from '@/components/SkyHeader';
import { T } from '@/components/Text';
import { Ticker } from '@/components/Ticker';
import { TabHeader } from '@/components/TabHeader';
import { TodayStart } from '@/components/TodayStart';
import { steadyScreen } from '@/components/SteadyScreen';
import { profile, track } from '@/lib/analytics';
import { useDevToday } from '@/lib/dev';
import { feedback } from '@/lib/feedback';
import { momentFor } from '@/lib/moments';
import { enter, exit, layout } from '@/lib/motion';
import { COLUMN, useWebLayout } from '@/lib/layout';
import { useScreenShortcuts } from '@/lib/shortcuts';
import { useNow } from '@/lib/now';
import { skySlot, skyTextLight } from '@/lib/sky';
import { useSettling } from '@/lib/use-settling';
import { useCourseList, useScheduleList, useItemList, useStore } from '@/store';
import { ACCOUNTS_ENABLED } from '@/lib/auth';
import { accountOf, useSession } from '@/lib/supabase';
import { SAMPLE_SOURCE } from '@/store/sample';
import { SCREEN_GUTTER, NAV_INSET, radius, useTheme, useTopInset, screen, space, size, ForceAppearance } from '@/theme';

function TodayScreen() {
  const { c, dark } = useTheme();
  const topInset = useTopInset();
  const now = useNow();
  // The sky is the phone's greeting; a laptop opens on plain paper (docs/headers.md).
  const { sidebar, twoPane } = useWebLayout();
  // A wide web window opens an item in the pane in place of the hours; the X or Esc brings them back.
  const [openId, setOpenId] = useState<string | null>(null);
  const openItem = (id: string) => (twoPane ? setOpenId(id) : router.push(`/item/${id}`));
  useScreenShortcuts({ Escape: () => setOpenId(null) }, !!openId);
  const items = useItemList();
  const schedules = useScheduleList();
  const courses = useCourseList();
  const breaks = useStore((s) => s.settings.breaks);
  const workDates = useStore((s) => s.taskWorkDates);
  const dismissals = useStore((s) => s.suggestionDismissals);
  const toggleDone = useStore((s) => s.toggleDone);
  const removeItem = useStore((s) => s.removeItem);
  const todayView = useStore((s) => s.settings.todayView);
  const setSettings = useStore((s) => s.setSettings);
  // The onboarding sample, while it's here, and the guest's one-time offer to back up a real plan.
  const sampleBatchId = useStore((s) => s.settings.sampleBatchId);
  const undoBatch = useStore((s) => s.undoBatch);
  const signedIn = useSession((s) => !!accountOf(s.session));
  const offerSave = useStore((s) => ACCOUNTS_ENABLED && s.settings.onboarded && !s.settings.savePlanDismissed)
    && !signedIn && items.some((i) => i.batchId !== sampleBatchId);
  const planTasks = useStore((s) => s.planTasks);
  const unplanTask = useStore((s) => s.unplanTask);
  const dismissSuggestion = useStore((s) => s.dismissSuggestion);
  const [overdueExpanded, setOverdueExpanded] = useState(false);
  // Open by default: seeing the green tick land is the reward for checking something off.
  const [completedExpanded, setCompletedExpanded] = useState(true);

  const todays = useMemo(() => todayItems(items, now.date, workDates), [items, now.date, workDates]);
  const overdue = useMemo(() => overdueTasks(items, now.date, workDates), [items, now.date, workDates]);
  const dismissed = useMemo(() => dismissals.date === now.date ? dismissals.ids : [], [dismissals, now.date]);
  // Friday afternoon: work due by Monday and a free evening. "Not this weekend" is Friday's own dismissal.
  const weekend = useMemo(() => dismissed.includes('weekend') ? null : weekendNudge(items, now, workDates), [items, now, workDates, dismissed]);
  const suggestions = useMemo(() => startTodaySuggestions(items, now, workDates, dismissed)
    .filter((s) => !weekend?.items.some((i) => i.id === s.item.id)), [items, now, workDates, dismissed, weekend]);
  const tomorrow = useMemo(() => tomorrowSummary(items, now, workDates), [items, now, workDates]);
  const upcoming = useMemo(() => items.filter((item) => !item.done && item.isDeadline && item.date > now.date && diffDays(now.date, item.date) <= 14
    && !suggestions.some((suggestion) => suggestion.item.id === item.id)).slice(0, 5), [items, now.date, suggestions]);
  const weekAhead = useMemo(() => items.filter((item) => item.date >= addDays(now.date, -1) && diffDays(now.date, item.date) <= 7), [items, now.date]);
  const conflictSet = useMemo(() => conflictIds(weekAhead), [weekAhead]);
  const conflictsToday = useMemo(() => findConflicts(weekAhead).filter((k) => items.find((i) => i.id === k.a)?.date === now.date).length, [weekAhead, items, now.date]);
  // Only jobs still on the calendar ask for next week: after "Remove upcoming shifts" the old
  // schedules stay as history, and the row kept asking for a job the student had left.
  const activeSchedules = useMemo(() => schedules.filter((sc) => items.some((i) => i.category === 'work' && i.date >= now.date
    && i.employer?.trim().toLowerCase() === sc.employer.trim().toLowerCase())), [schedules, items, now.date]);
  const nextWeekPending = activeSchedules.length > 0 && pendingDates(activeSchedules, addDays(now.date, 1), addDays(now.date, 7)).length > 0;
  // Nothing in the next two weeks but a plan further on (next term imported in October): say when
  // it picks up, rather than a bare "Nothing scheduled" that reads as if the import was lost.
  const resumes = useMemo(() => {
    const ahead = items.filter((i) => !i.done && i.date > now.date).sort((a, b) => a.date.localeCompare(b.date));
    const first = ahead[0];
    if (!first || diffDays(now.date, first.date) <= 14) return null;
    const classes = ahead.filter((i) => i.kind === 'event' && i.category === 'school' && i.seriesId);
    const start = classes[0];
    if (start && diffDays(first.date, start.date) <= 7) {
      const courses = new Set(classes.filter((i) => diffDays(start.date, i.date) < 7).map((i) => i.courseId ?? i.title)).size;
      return { date: start.date, title: 'Classes start', sub: `${weekdayLong(start.date)}, ${monthDay(start.date)} · ${count(courses, 'class', 'classes')}` };
    }
    return { date: first.date, title: 'Next in your plan', sub: `${first.title} · ${weekdayLong(first.date)}, ${monthDay(first.date)}` };
  }, [items, now.date]);
  const isSample = items.some((item) => item.sourceId === SAMPLE_SOURCE);
  const devToday = useDevToday();
  const moment = useMemo(() => (__DEV__ && devToday.noMoment ? null : momentFor(items, breaks ?? [], now.date)), [items, breaks, now.date, devToday.noMoment]);
  // A dark sky under a light page (night): the header and the day bar take the dark palette, the
  // sky stays dark behind them down to the end of the bar, and the status bar turns light until
  // the page scrolls past the sky.
  const skyDark = !moment && !sidebar && !dark && skyTextLight(skySlot(now.time, dark), dark);
  const [headerEnd, setHeaderEnd] = useState(0);
  const [barEnd, setBarEnd] = useState(0);
  const [pastSky, setPastSky] = useState(false);
  useFocusEffect(useCallback(() => {
    if (!skyDark || pastSky) return;
    setStatusBarStyle('light', true);
    return () => setStatusBarStyle('dark', true);
  }, [skyDark, pastSky]));
  // A moment that can spread its deadlines shows the start days first; nothing changes until "Sounds good".
  const spreadAction = moment?.action && 'spread' in moment.action ? moment.action : null;
  const spread = useMemo(() => spreadAction ? spreadWork(items, spreadAction.spread, now, workDates, spreadAction.until) : [], [spreadAction, items, now, workDates]);
  // Closed until opened; a `spread` capture opens it until the person chooses.
  const [spreadChoice, setSpreadOpen] = useState<boolean | null>(null);
  const spreadOpen = spreadChoice ?? (__DEV__ && devToday.spreadOpen);
  const spreadTasks = useStore((s) => s.spreadTasks);
  const showToast = useStore((s) => s.showToast);
  const featuredState = useMemo(() => featuredCommitment(items, now), [items, now]);
  const featured = featuredState?.item;
  const ongoing = featuredState?.ongoing ?? false;
  const timedToday = todays.filter((item) => item.kind === 'event' && item.start).length;
  // A row just checked off stays in place long enough to see the tick land, then moves to Completed.
  const [settling, settle] = useSettling();
  const completed = todays.filter((item) => item.done && !settling.includes(item.id));
  const openItems = todays.filter((item) => !item.done || settling.includes(item.id));
  const tightDeadlines = useMemo(() => new Map(items
    .filter((item) => !item.done && item.isDeadline && item.start && item.date > now.date && diffDays(now.date, item.date) <= 7)
    .map((item) => [item.id, deadlineWindow(items, item, now)] as const)
    .filter(([, w]) => !w.hasUnknownTimes && w.unbookedHours < 4)), [items, now]);

  // The one big number: minutes until the next commitment, or until the current one ends.
  const nowMin = toMinutes(now.time);
  let state: CountdownState | null = null;
  let big: string | null = null;
  if (featured?.start) {
    if (ongoing && featured.end) {
      state = 'ends';
      big = hoursMinutes(toMinutes(featured.end) - nowMin + (toMinutes(featured.end) < toMinutes(featured.start) ? 1440 : 0));
    } else if (!ongoing) {
      const dayGap = diffDays(now.date, featured.date);
      state = 'next';
      big = hoursMinutes(toMinutes(featured.start) - nowMin + dayGap * 1440);
    } else {
      state = 'now';
    }
  }
  const featuredWhere = featured ? [featured.employer ?? courses.find((k) => k.id === featured.courseId)?.code, featured.category === 'school' ? 'Coursework' : featured.category === 'work' ? 'Work' : 'Personal'].filter(Boolean).join(' · ') : '';

  function workOnToday(ids: string[]) {
    planTasks(ids, now.date);
    feedback('select');
  }

  function complete(item: Item) {
    if (item.done) { feedback('uncomplete'); toggleDone(item.id); return; }
    feedback(openItems.filter((i) => !i.done).length === 1 ? 'success' : 'complete');
    toggleDone(item.id);
    settle(item.id);
  }

  function confirmSpread() {
    const days = new Set(spread.map((step) => step.date)).size;
    const id = spreadTasks(spread.map((step) => ({ id: step.item.id, date: step.date })), `Spread ${count(spread.length, 'task')}`);
    feedback('success');
    setSpreadOpen(false);
    showToast(`${count(spread.length, 'task')} across ${count(days, 'day')}.`, id);
  }

  function markAllDone(items: Item[]) {
    feedback('complete');
    const open = items.filter((item) => !item.done);
    for (const item of open) toggleDone(item.id);
    useStore.getState().showDoneToast(open);
  }

  if (items.length === 0 && courses.length === 0 && schedules.length === 0) return (
    <ScrollView style={{ backgroundColor: c.canvas }} contentContainerStyle={{ paddingBottom: NAV_INSET }} contentInsetAdjustmentBehavior="never">
      <TodayStart date={now.date} />
    </ScrollView>
  );

  // The number first, then the sentence that finishes it.
  const line = featured && state ? countdownLine(featured, state) : featured?.title ?? null;
  const parts = featured && state ? countdownParts(featured, state) : featured ? { text: featured.title, time: null } : null;
  const hours = todayView === 'hours' && !twoPane;
  const viewToggle = (
    <Animated.View key={hours ? 'list' : 'chart'} entering={enter.fade} exiting={exit.fade}>
      <IconButton icon={hours ? 'list' : 'chart'} tone="glass" size={44} haptic="select"
        label={hours ? 'Show the list' : 'Show the day by the hour'}
        onPress={() => { const view = hours ? 'list' : 'hours'; setSettings({ todayView: view }); track('today_view_changed', { view, timed: timedToday, source: 'toggle' }); profile({ today_view: view, today_view_source: 'toggle' }); }} />
    </Animated.View>
  );
  const todayDetail = `${planCount(todays)}${conflictsToday ? ` · ${count(conflictsToday, 'overlap')}` : ''}`;

  // Over a light sky every line is ink: grey measures 3.2 to 3.9:1 on even the brightest of them.
  // Over a dark one the header is in the dark palette, whose grey holds 9:1 there.
  const onSky = !moment && !sidebar;
  const skyGrey = skyDark ? palettes.dark.inkSecondary : onSky ? c.inkPrimary : c.inkSecondary;
  const force = skyDark ? 'dark' : null;
  // Where the dark sky has to reach: the end of the day bar, or of the header when the hours replace the bar.
  const darkBottom = (hours ? headerEnd : barEnd) || DARK_BOTTOM;
  const list = (
    <ScrollView style={{ backgroundColor: c.canvas }} contentContainerStyle={{ paddingBottom: NAV_INSET }} contentInsetAdjustmentBehavior="never" keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16} onScroll={skyDark ? (e) => { const past = e.nativeEvent.contentOffset.y > darkBottom - topInset; if (past !== pastSky) setPastSky(past); } : undefined}>
      {/* On a moment day the photo runs from the top edge, the moment takes the big number, and the day's header steps down to display size. */}
      {moment ? (
        <View style={styles.moment}>
          <PhotoHeader source={moment.image} height={330} to={c.canvas} fadeFrom={0.28} solidAt={MOMENT_TEXT_TOP - 6} />
          <T token="callout" color={c.inkSecondary}>{moment.lead}</T>
          <Ticker value={moment.big} token="displayXl" />
          <View style={styles.momentLine}>
            <T token="body">{moment.line}</T>
            {moment.action && 'href' in moment.action ? <TextButton label={moment.action.label} onPress={() => router.push((moment.action as { href: string }).href as '/plan')} /> : null}
            {spreadAction && spread.length && !spreadOpen ? <TextButton label={spreadAction.label} onPress={() => setSpreadOpen(true)} /> : null}
          </View>
          {spreadOpen && spread.length ? (
            <Animated.View entering={enter.drop} exiting={exit.fade} style={styles.spread}>
              {spread.map(({ item, date }) => (
                <View key={item.id} style={styles.spreadRow}>
                  <T token="body" numberOfLines={1} style={{ flex: 1 }}>{item.title}</T>
                  <T token="callout" color={c.inkSecondary}>{date === now.date ? 'Start today' : date === addDays(now.date, 1) ? 'Start tomorrow' : `Start ${weekdayLong(date)}`}</T>
                </View>
              ))}
              <View style={[styles.actions, { paddingTop: space.sm }]}>
                <Press accessibilityRole="button" haptic="tap" onPress={confirmSpread} style={[styles.pill, { backgroundColor: c.controlFill }]}>
                  <T token="headline" color={c.controlInk}>Sounds good</T>
                </Press>
                <TextButton label="Not now" tone="muted" onPress={() => setSpreadOpen(false)} />
              </View>
            </Animated.View>
          ) : null}
        </View>
      ) : sidebar ? null : <SkyHeader time={now.time} darkBottom={darkBottom} />}

      <ForceAppearance.Provider value={force}>
      <View onLayout={(e) => setHeaderEnd(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}>
      <TabHeader date={now.date} title={featured ? 'Now' : 'Clear'} inset={!moment} onPhoto={onSky && !skyDark}
        value={moment ? (big ? <Ticker value={big} token="display" /> : <T token="display" accessibilityRole="header">{featured ? 'Now' : 'Clear'}</T>)
          : big ? <Ticker value={big} token="displayXl" /> : undefined}
        trailing={moment || twoPane ? undefined : <View style={styles.toggleSpace} />}
        onPress={featured ? () => openItem(featured.id) : undefined}
        accessibilityLabel={featured ? [big, line].filter(Boolean).join(' ') : undefined}
        details={featured ? <>
          <T token={moment ? 'body' : 'lead'} numberOfLines={2}>{parts?.text}</T>
          {/* The time leads the grey line, so a long title wraps alone and never strands "· 2:45 pm". */}
          {!moment && (parts?.time || featuredWhere) ? <T token="callout" color={skyGrey} numberOfLines={1}>{[parts?.time, featuredWhere].filter(Boolean).join(' · ')}</T>
            : moment && parts?.time ? <T token="callout" color={c.inkSecondary}>{parts.time}</T> : null}
        </> : <T token="callout" color={skyGrey}>{todays.length ? 'Nothing timed left today.' : 'Nothing scheduled today.'}</T>} />
      </View>
      </ForceAppearance.Provider>
      {/* Room for a dark sky to fade into the page before anything in the page's own ink. */}
      {skyDark && hours ? <View style={{ height: DARK_FADE }} /> : null}

      <Animated.View layout={layout} onLayout={(e) => setBarEnd(e.nativeEvent.layout.y + e.nativeEvent.layout.height)}>
        {hours ? (
          <Animated.View key="hours" entering={enter.fade} exiting={exit.fade} style={styles.hours}>
            <SectionTitle title="Today" detail={todayDetail} />
            <View style={{ paddingTop: space.xxs }}>
              <HourView items={todays} now={now} conflicts={conflictSet} onPress={(it) => openItem(it.id)} />
            </View>
          </Animated.View>
        ) : (
          <Animated.View key="list" entering={enter.fade} exiting={exit.fade} style={styles.bar}>
            <ForceAppearance.Provider value={force}>
              <DayBar items={todays} now={now} conflicts={conflictSet} />
            </ForceAppearance.Provider>
          </Animated.View>
        )}
      </Animated.View>
      {skyDark && !hours ? <View style={{ height: DARK_FADE }} /> : null}

      {/* One thing explained at the moment it first matters, in place of a tour (see components/Firsts). */}
      <TodayFirst items={items} now={now} timedToday={timedToday} style={styles.section} />

      {sampleBatchId ? (
        <Animated.View layout={layout} entering={enter.fade} exiting={exit.fade} style={[styles.section, styles.sampleLine]}>
          <T token="callout" color={c.inkSecondary} style={{ flex: 1 }}>This is a sample week.</T>
          <TextButton label="Remove" tone="muted" accessibilityLabel="Remove the sample week" onPress={() => {
            undoBatch(sampleBatchId, { force: true });
            setSettings({ sampleBatchId: null });
            track('sample_removed', { how: 'today' });
          }} />
        </Animated.View>
      ) : null}

      <Animated.View layout={layout} style={styles.section}>
        <SectionTitle title="On your list" onPress={() => router.push('/plan')} detail={conflictsToday ? `${count(conflictsToday, 'overlap')}` : undefined} />
        {openItems.map((item, i) => {
          const planned = item.date !== now.date && workDates[item.id] === now.date;
          return (
            <Animated.View key={item.id} layout={layout} entering={enter.fade} exiting={exit.sink}>
              <ItemRow item={item} today={now.date} planned={planned} conflict={conflictSet.has(item.id)} last={i === openItems.length - 1 && !completed.length}
                onPress={() => openItem(item.id)} onToggle={() => complete(item)} onDelete={() => removeItem(item.id)} />
              {planned ? <View style={styles.inlineAction}><TextButton label="Remove from today" tone="muted" onPress={() => unplanTask(item.id)} accessibilityLabel={`Remove ${item.title} from today's work plan`} /></View> : null}
            </Animated.View>
          );
        })}
        {openItems.length === 0 && completed.length ? (
          <Animated.View entering={enter.fade} style={{ paddingVertical: space.sm, gap: space.hair }}>
            <T token="headline" color={c.inkPrimary}>No tasks left today.</T>
            <T token="callout" color={c.inkSecondary}>{`${count(completed.length, 'task')} completed.`}</T>
          </Animated.View>
        ) : openItems.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="list" size={24} color={c.inkTertiary} />
            <T token="callout" color={c.inkSecondary}>Nothing on your list today.</T>
          </View>
        ) : null}
        {completed.length ? (
          <>
            <PressRow accessibilityRole="button" accessibilityState={{ expanded: completedExpanded }} onPress={() => setCompletedExpanded((o) => !o)} bleed={8} round={radius.small} style={styles.disclosure}>
              <Ticker value={`Completed · ${completed.length}`} token="caption" color={c.inkSecondary} />
              <DisclosureChevron expanded={completedExpanded} />
            </PressRow>
            {completedExpanded ? (
              <Animated.View entering={enter.drop} exiting={exit.fade}>
                {completed.map((item, i) => (
                  <Animated.View key={item.id} layout={layout} entering={enter.drop} exiting={exit.fade}>
                    <ItemRow item={item} today={now.date} last={i === completed.length - 1} onPress={() => openItem(item.id)} onToggle={() => { feedback('uncomplete'); toggleDone(item.id); }} onDelete={() => removeItem(item.id)} />
                  </Animated.View>
                ))}
              </Animated.View>
            ) : null}
          </>
        ) : null}
      </Animated.View>

      {overdue.length ? (
        <View style={styles.section}>
          <PressRow accessibilityRole="button" accessibilityLabel={`Still open, ${overdue.length} tasks`} accessibilityState={{ expanded: overdueExpanded }} onPress={() => setOverdueExpanded((o) => !o)} bleed={8} round={radius.small} style={styles.disclosure}>
            <View style={{ paddingBottom: space.hair }}><Ticker value={`Still open · ${overdue.length}`} token="overline" color={c.inkSecondary} /></View>
            <DisclosureChevron expanded={overdueExpanded} />
          </PressRow>
          {overdueExpanded ? (
            <Animated.View entering={enter.drop} exiting={exit.fade}>
              {overdue.map((item, i) => (
                <Animated.View key={item.id} layout={layout} entering={enter.fade} exiting={exit.fade}>
                  <ItemRow item={item} today={now.date} last={i === overdue.length - 1} onPress={() => openItem(item.id)} onToggle={() => { feedback('complete'); toggleDone(item.id); }} onDelete={() => removeItem(item.id)} />
                  <View style={styles.inlineAction}><TextButton label="Work on it today" onPress={() => workOnToday([item.id])} accessibilityLabel={`Work on ${item.title} today without changing its date`} /></View>
                </Animated.View>
              ))}
              {overdue.length > 1 ? (
                <View style={styles.actions}>
                  <TextButton label="Bring all into today" onPress={() => workOnToday(overdue.map((item) => item.id))} />
                  <TextButton label="Mark all done" tone="muted" onPress={() => markAllDone(overdue)} accessibilityLabel={`Mark all ${overdue.length} open tasks done`} />
                </View>
              ) : null}
            </Animated.View>
          ) : null}
        </View>
      ) : null}

      {weekend ? (
        <Animated.View layout={layout} entering={enter.fade} exiting={exit.fade} style={styles.section}>
          <GroupLabel>Free your weekend</GroupLabel>
          <T token="body">{`${andList(weekend.items.map((i) => i.title))} ${weekend.items.length === 1 ? 'is' : 'are'} due ${weekend.by === 'monday' ? 'by Monday' : 'this weekend'}. You have ${weekend.freeHours} free hours tonight.`}</T>
          <View style={[styles.inlineAction, { flexDirection: 'row', gap: space.lg }]}>
            <TextButton label={`Work on ${weekend.items.length === 1 ? 'it' : 'them'} tonight`} onPress={() => workOnToday(weekend.items.map((i) => i.id))} />
            <TextButton label="Not this weekend" tone="muted" onPress={() => { dismissSuggestion('weekend', now.date); feedback('select'); }} />
          </View>
        </Animated.View>
      ) : null}

      {suggestions.length ? (
        <View style={styles.section}>
          <GroupLabel>Start today</GroupLabel>
          {suggestions.map(({ item, reason }, i) => (
            <View key={item.id}>
              <ListRow leading={<Icon name={item.icon} size={20} color={c.inkPrimary} />} title={item.kind === 'event' ? `Prepare for ${item.title}` : item.title} sub={reason} last={i === suggestions.length - 1} onPress={() => openItem(item.id)} />
              <View style={[styles.inlineAction, { flexDirection: 'row', gap: space.lg }]}>
                {item.kind === 'task' ? <TextButton label="Work on it today" onPress={() => workOnToday([item.id])} /> : null}
                <TextButton label="Not today" tone="muted" onPress={() => { dismissSuggestion(item.id, now.date); feedback('select'); }} />
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {upcoming.length || nextWeekPending || tomorrow || resumes ? (
        <View style={styles.section}>
          <SectionTitle title="Coming up" onPress={() => router.push('/plan')} />
          {resumes && !upcoming.length && !tomorrow ? (
            <ListRow title={resumes.title} sub={resumes.sub} last={!nextWeekPending}
              onPress={() => { useStore.getState().setSelectedPlanDate(resumes.date); router.push('/plan'); }} />
          ) : null}
          {tomorrow ? <ListRow title="Tomorrow" sub={tomorrow} onPress={() => router.push('/plan')} /> : null}
          {upcoming.map((item, i) => (
            <Animated.View key={item.id} layout={layout} entering={enter.fade} exiting={exit.fade}>
              <ItemRow item={item} today={now.date} last={i === upcoming.length - 1 && !nextWeekPending} onPress={() => openItem(item.id)}
                onToggle={() => { feedback('complete'); toggleDone(item.id); }} onDelete={() => removeItem(item.id)} />
            </Animated.View>
          ))}
          {upcoming.filter((item) => tightDeadlines.has(item.id)).slice(0, 1).map((item) => (
            <T key={item.id} token="caption" color={c.inkSecondary} style={{ paddingTop: space.snug }}>{deadlineReason(items, item, now, tightDeadlines.get(item.id))}</T>
          ))}
          {nextWeekPending ? <ListRow title="Next week's shifts" sub="Not added yet" last onPress={() => router.navigate({ pathname: '/add', params: { source: 'image', at: String(Date.now()) } })} /> : null}
        </View>
      ) : null}

      {offerSave ? <SavePlanRow onDismiss={() => setSettings({ savePlanDismissed: true })} /> : null}

      {isSample ? (
        <View style={styles.section}>
          <ListRow title="This is a sample week" sub="Clear it any time in Your data" last onPress={() => router.push('/settings/data')} />
        </View>
      ) : null}
    </ScrollView>
  );
  // The view toggle floats over the page instead of scrolling with it, so it never rides up into
  // the status bar; the header keeps its place free, so the big number never runs under it.
  if (!twoPane) return (
    <View style={styles.root}>
      {list}
      {/* Dark like the header while it sits on a dark sky; the page's own look once the sky has scrolled away. */}
      <ForceAppearance.Provider value={skyDark && !pastSky ? 'dark' : null}>
        <View style={[styles.floatToggle, { top: topInset + 20 }]}>{viewToggle}</View>
      </ForceAppearance.Provider>
    </View>
  );
  // A wide web window shows the day by the hour beside the list, so there's nothing to toggle.
  return (
    <View style={styles.panes}>
      <View style={{ width: COLUMN }}>{list}</View>
      {openId ? (
        <View style={[styles.hourPane, { borderLeftColor: c.line }]}>
          <ItemDetail key={openId} id={openId} onClose={() => setOpenId(null)} onOpen={setOpenId} />
        </View>
      ) : (
        <ScrollView style={[styles.hourPane, { borderLeftColor: c.line }]} contentContainerStyle={styles.hourBody}>
          <SectionTitle title="Hours" detail={todayDetail} />
          <HourView items={todays} now={now} conflicts={conflictSet} onPress={(it) => openItem(it.id)} />
        </ScrollView>
      )}
    </View>
  );
}

/** Where the moment's first line starts; its photo has fully faded into the page above this. */
const MOMENT_TEXT_TOP = 206;

/** Once, for a guest with a real plan: an account backs it up. Dismissed for good with "Not now". */
function SavePlanRow({ onDismiss }: { onDismiss: () => void }) {
  const { c } = useTheme();
  useEffect(() => { track('save_plan_card_shown', {}); }, []);
  return (
    <Animated.View layout={layout} entering={enter.fade} exiting={exit.fade} style={styles.section}>
      <ListRow leading={<Icon name="lock" size={20} color={c.inkPrimary} />} title="Save your plan" sub="Back it up with a free account" last
        onPress={() => { track('save_plan_card_tapped', {}); router.push('/auth/signup'); }} />
      <View style={styles.inlineAction}>
        <TextButton label="Not now" tone="muted" onPress={() => { track('save_plan_card_dismissed', {}); onDismiss(); }} />
      </View>
    </Animated.View>
  );
}

/** Where the dark sky reaches before Today has measured its header and day bar. */
const DARK_BOTTOM = 310;

const styles = StyleSheet.create({
  bar: { paddingHorizontal: SCREEN_GUTTER, paddingTop: space.xl },
  panes: { flex: 1, flexDirection: 'row' },
  hourPane: { flex: 1, borderLeftWidth: StyleSheet.hairlineWidth },
  hourBody: { paddingHorizontal: SCREEN_GUTTER, paddingTop: space.xl, paddingBottom: space.xxxl, gap: space.xs },
  hours: { paddingHorizontal: SCREEN_GUTTER, paddingTop: space.md },
  section: { paddingHorizontal: SCREEN_GUTTER, ...screen.section },
  disclosure: { minHeight: size.target, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  inlineAction: { paddingLeft: space.xxl },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.lg },
  sampleLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  spread: { paddingTop: space.sm, gap: space.xs },
  empty: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  spreadRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  pill: { minHeight: size.target, paddingHorizontal: space.lg, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  moment: { position: 'relative', paddingHorizontal: SCREEN_GUTTER, paddingTop: MOMENT_TEXT_TOP, paddingBottom: space.md, gap: space.hair },
  root: { flex: 1 },
  floatToggle: { position: 'absolute', right: SCREEN_GUTTER },
  toggleSpace: { width: 44, height: 44 },
  momentLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs, paddingTop: space.snug },
});

export default steadyScreen(TodayScreen);
