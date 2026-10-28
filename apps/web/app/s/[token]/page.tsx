import { formatRange, formatTime, monthDay, weekdayLong, weekdayShort } from '@dayli/core';
import type { Metadata } from 'next';
import Link from 'next/link';
import { cache } from 'react';

import { hourLabel, loadSharedSchedule, nowIn, sharedDays, todayIn, updatedLine, weekGrid, type GridDay, type SharedDay } from '@/lib/shared-schedule';
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

/** One day of the grid: its date above, then its blocks, the now line and due dots, in that order. */
function DayColumn({ day }: { day: GridDay }) {
  return (
    <div className={`${styles.col} ${day.inRange ? '' : styles.outside}`} aria-hidden>
      <span className={`${styles.dayName} ${day.today ? styles.today : ''}`}>{weekdayShort(day.date)}</span>
      <span className={`${styles.dayNum} ${day.today ? styles.todayNum : ''}`}>{Number(day.date.slice(8))}</span>
      <div className={styles.track}>
        {day.blocks.map((b, i) => (
          <i key={i} className={`${styles.block} ${b.kind === 'work' ? styles.work : styles.school}`} style={{ top: `${b.top}%`, height: `${b.height}%` }} />
        ))}
        {day.now !== null ? <i className={styles.now} style={{ top: `${day.now}%` }} /> : null}
        {day.dues.map((at, i) => <i key={i} className={styles.due} style={{ top: `${at}%` }} />)}
      </div>
    </div>
  );
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
  const grid = weekGrid(shared.entries, from, to, nowIn(shared.options.timezone));
  const has = (kind: 'work' | 'school') => grid.weeks.some((w) => w.some((d) => d.blocks.some((b) => b.kind === kind)));
  const hasDue = grid.weeks.some((w) => w.some((d) => d.dues.length));
  const ends = shared.expiresAt ? ` · Until ${monthDay(todayIn(shared.options.timezone, shared.expiresAt))}` : '';
  return (
    <main className={`page ${styles.page}`}>
      <header className={styles.head}>
        <h1 className={styles.title}>{shared.title}</h1>
        <p className={styles.meta}>{range(from, to)} · Read-only{ends} · {updatedLine(shared.updatedAt)}</p>
      </header>
      {days.length ? (
        // The two weeks at a glance, for "when is she free?"; the list below has every plan in words.
        <figure className={styles.grid} aria-label="The next two weeks at a glance. Every plan is listed below.">
          {grid.weeks.map((week) => (
            <div key={week[0]!.date} className={styles.week}>
              <div className={styles.axis} aria-hidden>
                <span>{hourLabel(grid.range[0])}</span>
                <span>{hourLabel(grid.range[1])}</span>
              </div>
              {week.map((day) => <DayColumn key={day.date} day={day} />)}
            </div>
          ))}
          <figcaption className={styles.key}>
            {has('work') ? <span><i className={`${styles.swatch} ${styles.work}`} />Work</span> : null}
            {has('school') ? <span><i className={`${styles.swatch} ${styles.school}`} />School</span> : null}
            {hasDue ? <span><i className={styles.keyDot} />Due</span> : null}
            <span><i className={styles.keyNow} />Now</span>
          </figcaption>
        </figure>
      ) : null}
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
