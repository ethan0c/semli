import { movableOverlap } from '@dayli/core';
import { router } from 'expo-router';
import { useMemo } from 'react';

import { accountOf, useSession } from '@/lib/supabase';
import { ACCOUNTS_ENABLED } from '@/lib/auth';
import { useNow } from '@/lib/now';
import { useItemList, useScheduleList, useStore } from '@/store';

export type CanDo = {
  id: string;
  title: string;
  /** What it does, in a line; shown until it is tried. */
  sub: string;
  done: boolean;
  plus?: boolean;
  go: () => void;
};

/**
 * The things people miss after setup, each tappable and ticked once their own plan shows it
 * happened. Ordered from the everyday to the edge cases. Nothing here is a tutorial: every row
 * opens the real screen.
 */
export function useCanDo(): CanDo[] {
  const items = useItemList();
  const schedules = useScheduleList();
  const batches = useStore((s) => s.batches);
  const settings = useStore((s) => s.settings);
  const now = useNow();
  const signedIn = useSession((s) => !!accountOf(s.session));
  return useMemo(() => {
    const sources = new Set(batches.map((b) => b.source?.toLowerCase() ?? ''));
    const overlap = movableOverlap(items, now);
    const nextDeadline = items.filter((i) => i.isDeadline && !i.done && i.date >= now.date).sort((a, b) => a.date.localeCompare(b.date))[0];
    const add = (source?: 'image' | 'file') => router.navigate(source ? { pathname: '/add', params: { source, at: String(Date.now()) } } : '/add');
    const list: CanDo[] = [
      { id: 'text', title: 'Add plans by typing', sub: 'Type dates and times, then review the results before saving.', done: sources.has('message'), go: () => add() },
      { id: 'screenshot', title: 'Add a work schedule from a screenshot', sub: 'Import shifts from a photo or screenshot.', done: schedules.length > 0 || sources.has('screenshot') || sources.has('photo'), go: () => add('image') },
      { id: 'syllabus', title: 'Import a syllabus', sub: 'Add courses, exams and due dates from a PDF.', done: [...sources].some((s) => s.endsWith('.pdf')), go: () => add('file') },
      { id: 'reimport', title: 'Update your work schedule', sub: 'Upload a new schedule and review changes to existing shifts.', done: settings.firsts.reimport, plus: true, go: () => add('image') },
      { id: 'canvas', title: 'Connect your class calendar', sub: 'Import from Canvas or Brightspace, including eLC. The first import is free; Plus keeps it in sync.', done: !!settings.canvas.feedUrl, go: () => router.push('/settings/canvas') },
      { id: 'overlap', title: 'Find another time for an event', sub: 'Review a suggested time that avoids overlapping events.', done: settings.firsts.overlap, plus: true, go: () => router.push(overlap ? `/item/${overlap.flexible.id}` : '/plan') },
      { id: 'urgent', title: 'Set an alarm for an urgent item', sub: 'Add a time and allow alarms to receive a ringing alert.', done: items.some((i) => i.urgent), plus: true, go: () => router.push(nextDeadline ? `/item/${nextDeadline.id}` : '/plan') },
      { id: 'hours', title: 'See the day by the hour', sub: 'Show scheduled events and gaps on a timeline.', done: settings.todayView === 'hours' || settings.firsts.hours, go: () => { useStore.getState().setSettings({ todayView: 'hours' }); router.navigate('/'); } },
      { id: 'briefing', title: 'Turn on the daily summary', sub: 'Receive a notification with today’s schedule and upcoming deadlines.', done: settings.reminders.enabled && settings.reminders.briefing, go: () => router.push('/settings/reminders') },
      { id: 'undo', title: 'Undo any import', sub: 'Reverse an import from Recent changes in Your data.', done: batches.some((b) => b.undone), go: () => router.push('/settings/data') },
      { id: 'calendar', title: 'Export events to your calendar', sub: 'Add events to Apple or Google Calendar from an export file.', done: false, go: () => router.push('/settings/data') },
    ];
    if (ACCOUNTS_ENABLED && !signedIn) list.push({ id: 'account', title: 'Back up your plan', sub: 'Create a free account to save your plan for a new phone.', done: false, go: () => router.push('/auth') });
    return list;
  }, [items, schedules, batches, settings, now, signedIn]);
}
