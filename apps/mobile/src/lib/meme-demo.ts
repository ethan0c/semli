import { addDays } from '@dayli/core';
import type { Item } from '@dayli/schema';

export const MEME_VERSIONS = ['cooked', 'comeback', 'busy'] as const;
export type MemeVersion = (typeof MEME_VERSIONS)[number];
export type MemeDemo = { version: MemeVersion; today: string; selectedDate: string; items: Item[] };

/** Screenshot props only. These items never enter the saved planner or its sync/reminder hooks. */
export function memeDemo(version: MemeVersion, today: string): MemeDemo {
  const items: Item[] = [];
  const add = (title: string, start: string, end: string | null, options: Partial<Item> = {}) => {
    items.push({
      id: `meme-${version}-${items.length}`, title, kind: 'event', category: 'personal', icon: 'calendar',
      date: today, start, end, isDeadline: false, done: false, completedAt: null,
      courseId: null, employer: null, sourceId: 'sample', batchId: null,
      seriesId: null, notes: null, createdAt: `${today}T00:00:00.000Z`, ...options,
    });
  };

  if (version === 'cooked') {
    const urgent = { urgent: true };
    add('meeting with john pork', '08:00', '09:00', urgent);
    add('conflict resolution with tim cheese', '08:00', '09:00', urgent);
    add('explain my screen time', '09:00', '09:30', urgent);
    add('check if they viewed my story', '09:15', '10:00', urgent);
    add('pretend i didn’t check', '09:20', '09:45', urgent);
    add('group project meeting (just me)', '10:00', '11:00', urgent);
    add('lunch (cancelled)', '12:00', '12:15', urgent);
    add('delete tiktok (again)', '14:00', '15:00', urgent);
    add('essay due · 0/2000 words', '23:59', null, { ...urgent, kind: 'task', category: 'school', icon: 'pen', isDeadline: true });
  } else if (version === 'comeback') {
    const deadlines = [
      'start the essay', 'finish the essay', 'submit the essay', 'read the syllabus',
      'watch lecture 1', 'watch lecture 2', 'watch lecture 3', 'watch lecture 4',
      'discussion post', 'reply to two classmates', 'lab report', 'pre-lab worksheet',
      'problem set 1', 'problem set 2', 'reading quiz', 'group project slides',
      'email professor back', 'book office hours', 'revise for the midterm', 'take the midterm',
      'catch up on the reading', 'submit timesheet', 'academic comeback',
    ];
    deadlines.forEach((title, i) => add(title, `${String(8 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`, null, {
      date: addDays(today, 1), kind: 'task', category: 'school', icon: 'book', isDeadline: true, urgent: true,
    }));
  } else {
    add('think about starting assignment', '08:00', '09:00');
    add('recover from thinking about it', '09:00', '10:00');
    add('make a playlist for the assignment', '10:00', '11:00');
    add('find the right font', '11:00', '12:00');
    add('lunch break from doing nothing', '12:00', '13:00');
    add('open the document', '13:00', '13:05');
    add('reward myself for opening it', '13:05', '14:00');
    add('reorganize desk', '14:00', '15:00');
    add('take a quick break', '15:00', '18:00');
    add('lock in tomorrow', '18:00', '23:59');
  }

  return { version, today, selectedDate: today, items };
}

export function memeVersion(command: string | null): MemeVersion | null {
  return MEME_VERSIONS.find((version) => command === `meme-${version}`) ?? null;
}
