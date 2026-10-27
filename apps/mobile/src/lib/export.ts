import type { Course, Item, ScheduleVersion } from '@dayli/schema';
import { File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';
import { reportError } from './errors';

/** Everything that is yours, as one JSON file you can AirDrop or save. Nothing reads it back in yet: moving phones goes through an account. */
export function buildBackup(data: { items: Item[]; courses: Course[]; schedules: ScheduleVersion[]; exportedAt: string }): string {
  return JSON.stringify({ app: 'Semli', version: 1, ...data }, null, 2);
}

const pad = (n: number) => String(n).padStart(2, '0');
const stamp = (date: string, time: string | null) => {
  const [y, m, d] = date.split('-');
  if (!time) return `;VALUE=DATE:${y}${m}${d}`;
  const [hh, mm] = time.split(':');
  return `:${y}${m}${d}T${hh}${mm}00`;
};
const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/** Every event, and every to-do with a date, as an .ics file Apple or Google Calendar will take. */
export function buildIcs(items: Item[], courses: Course[]): string {
  const now = new Date();
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}00Z`;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Semli//Semli//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Semli'];
  for (const it of items) {
    const course = it.courseId ? courses.find((k) => k.id === it.courseId) : null;
    const where = it.employer ?? course?.code ?? course?.title ?? null;
    const title = it.kind === 'task' && it.isDeadline ? `Due: ${it.title}` : it.title;
    lines.push('BEGIN:VEVENT', `UID:${it.id}@semli.app`, `DTSTAMP:${dtstamp}`, `SUMMARY:${escape(title)}`);
    if (it.start) {
      lines.push(`DTSTART${stamp(it.date, it.start)}`);
      if (it.end) lines.push(`DTEND${stamp(it.end < it.start ? nextDay(it.date) : it.date, it.end)}`);
    } else {
      lines.push(`DTSTART${stamp(it.date, null)}`);
    }
    if (where) lines.push(`LOCATION:${escape(where)}`);
    if (it.notes) lines.push(`DESCRIPTION:${escape(it.notes)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}

function nextDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d! + 1));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Writes the text to the cache and opens the system share sheet; on the web, downloads it. False when sharing is unavailable. */
export async function shareText(name: string, text: string, mimeType: string): Promise<boolean> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
    const link = Object.assign(document.createElement('a'), { href: url, download: name });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  }
  // Older development builds may not contain ExpoSharing yet. Loading it only on
  // export keeps every other screen usable until the native build is updated.
  let sharing: typeof import('expo-sharing');
  try {
    sharing = await import('expo-sharing');
  } catch (error) {
    reportError('export.load_sharing', error);
    return false;
  }
  if (!(await sharing.isAvailableAsync())) return false;
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.write(text);
  await sharing.shareAsync(file.uri, { mimeType, dialogTitle: name, UTI: mimeType === 'text/calendar' ? 'public.calendar-event' : 'public.json' });
  return true;
}
