import { formatRange, formatTime, monthDay, weekdayLong } from '@dayli/core';
import type { Metadata } from 'next';
import Link from 'next/link';
import { cache } from 'react';

import { loadSharedSchedule, sharedDays, todayIn, updatedLine, type SharedDay } from '@/lib/shared-schedule';
import { TAGLINE } from '@/lib/site';
import styles from './share.module.css';

/*
 * A schedule someone shared from Semli: read-only, the coming two weeks, and only what the owner's
 * phone sent (school and work, titles or "Busy"). Never indexed; the link is the only way in.
 */

// Every request reads the link's latest schedule, and the message preview needs it in the first byte,
// so the page waits for it rather than streaming a placeholder.
export const instant = false;

const load = cache(loadSharedSchedule);
type Props = { params: Promise<{ token: string }> };

const range = (from: string, to: string) => `${monthDay(from)} – ${monthDay(to)}`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const shared = await load((await params).token).catch(() => null);
  const robots = { index: false, follow: false };
  if (!shared) return { title: 'Shared schedule', robots };
  const { from, to } = sharedDays(shared.entries, todayIn(shared.options.timezone));
  // The message preview a parent sees before tapping: whose, which dates, read-only.
  const description = `${range(from, to)} · Read-only schedule from Semli`;
  return { title: shared.title, description, robots, openGraph: { title: shared.title, description, siteName: 'Semli' } };
}

function when(entry: SharedDay['entries'][number]): string {
  if (entry.carried && entry.end) return `Until ${formatTime(entry.end, true)}`;
  if (!entry.start) return entry.kind === 'event' ? 'All day' : entry.isDeadline ? 'Due' : 'Any time';
  if (!entry.end || entry.kind === 'task') return entry.isDeadline ? `Due ${formatTime(entry.start, true)}` : formatTime(entry.start, true);
  return `${formatRange(entry.start, entry.end)}${entry.end <= entry.start ? ' · overnight' : ''}`;
}

export default async function SharedSchedulePage({ params }: Props) {
  const shared = await load((await params).token).catch(() => undefined);
  if (shared === undefined) {
    return (
      <main className={`page ${styles.page}`}>
        <h1 className={styles.title}>This schedule didn’t load.</h1>
        <p className={styles.meta}>Try again in a minute.</p>
      </main>
    );
  }
  if (!shared) {
    return (
      <main className={`page ${styles.page}`}>
        <h1 className={styles.title}>This link has stopped working.</h1>
        <p className={styles.meta}>The person who shared it turned it off. Ask them to send a new one.</p>
      </main>
    );
  }
  const { from, to, days } = sharedDays(shared.entries, todayIn(shared.options.timezone));
  return (
    <main className={`page ${styles.page}`}>
      <header className={styles.head}>
        <h1 className={styles.title}>{shared.title}</h1>
        <p className={styles.meta}>{range(from, to)} · Read-only · {updatedLine(shared.updatedAt)}</p>
      </header>
      {days.length ? days.map((day) => (
        <section key={day.date} className={styles.day} aria-label={`${weekdayLong(day.date)}, ${monthDay(day.date)}`}>
          <h2 className={styles.date}>{weekdayLong(day.date)}, {monthDay(day.date)}</h2>
          <ul className={styles.list}>
            {day.entries.map((entry, i) => (
              <li key={i} className={styles.row}>
                <span className={styles.what}>{entry.title}</span>
                <span className={styles.when}>{when(entry)}</span>
              </li>
            ))}
          </ul>
        </section>
      )) : <p className={styles.meta}>Nothing planned in the next two weeks.</p>}
      <footer className={styles.foot}>
        <p>Shared from Semli, {TAGLINE.charAt(0).toLowerCase() + TAGLINE.slice(1)}</p>
        <Link className="btn" href="/get?ref=share">Get Semli</Link>
      </footer>
    </main>
  );
}
