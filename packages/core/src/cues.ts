import { formatRange, formatTime, monthDay } from './dates';
import { dateLocale } from './locale';

/**
 * Cues: the days and times a person mentions while they talk or type, found by rule so they can
 * be shown the instant they are said. This is a hint for the composer, never a result: nothing
 * here resolves to a date, picks a category, or decides task versus event. The model does that
 * on send, and the review sheet shows it.
 */

export type CueKind = 'weekday' | 'relative' | 'date' | 'time' | 'range';
export type Cue = { kind: CueKind; text: string; start: number; end: number };
/** One thing the person said, with the cues in it and a short label built from the clearest ones. */
export type HeardClause = { text: string; cues: Cue[]; label: string };

const WEEKDAYS: [RegExp, string][] = [
  [/\b(?:next|this)?\s*(monday|mon)\b/i, 'Mon'], [/\b(?:next|this)?\s*(tuesday|tues|tue)\b/i, 'Tue'], [/\b(?:next|this)?\s*(wednesday|wed)\b/i, 'Wed'],
  [/\b(?:next|this)?\s*(thursday|thurs|thur|thu)\b/i, 'Thu'], [/\b(?:next|this)?\s*(friday|fri)\b/i, 'Fri'], [/\b(?:next|this)?\s*(saturday|sat)\b/i, 'Sat'],
  [/\b(?:next|this)?\s*(sunday|sun)\b/i, 'Sun'],
];
const RELATIVE: [RegExp, string][] = [
  [/\btonight\b/i, 'Tonight'], [/\btomorrow\b/i, 'Tomorrow'], [/\btoday\b/i, 'Today'],
  [/\bthis weekend\b/i, 'This weekend'], [/\bnext week\b/i, 'Next week'],
];
const MONTH = '(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';
const DATE = new RegExp(`\\b${MONTH}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b|\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH}|\\bthe\\s+(\\d{1,2})(?:st|nd|rd|th)\\b|\\b(\\d{1,2})/(\\d{1,2})\\b`, 'gi');
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, noon: 12, midnight: 0 };
const HOUR = '(\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|noon|midnight)';
const MIN = '(?::(\\d{2}))?';
const AMPM = '(?:\\s*(a\\.?m\\.?|p\\.?m\\.?))?';
const TO = '\\s*(?:to|till|until|through|thru|-|–|—)\\s*';
const RANGE = new RegExp(`\\b${HOUR}${MIN}${AMPM}${TO}${HOUR}${MIN}${AMPM}\\b`, 'gi');
const AT = new RegExp(`\\b(?:at|by|from|around|about)\\s+${HOUR}${MIN}${AMPM}\\b|\\b${HOUR}${MIN}\\s*(a\\.?m\\.?|p\\.?m\\.?)\\b|\\b(noon|midnight)\\b`, 'gi');
/** Numbers that are never clock times: a course code, a chapter, a room, a count. */
const NOT_TIME = /\b(?:chapter|ch\.?|room|rm\.?|unit|week|page|pg\.?|problem|set|part|question|q)\s*$|\b[A-Z]{2,5}\s*$/;

function hour(raw: string): number | null {
  const lower = raw.toLowerCase();
  if (lower in WORDS) return WORDS[lower]!;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= 23 ? n : null;
}
const isPm = (s: string | undefined) => !!s && s.toLowerCase().startsWith('p');
const isAm = (s: string | undefined) => !!s && s.toLowerCase().startsWith('a');

/** A spoken hour without am or pm: 7 to 11 is morning, 1 to 6 is afternoon, 12 is noon. */
function guess(h: number, suffix: string | undefined): number {
  if (h > 12) return h;
  if (isAm(suffix)) return h === 12 ? 0 : h;
  if (isPm(suffix)) return h === 12 ? 12 : h + 12;
  if (h === 0) return 0;
  if (h >= 7 && h <= 11) return h;
  return h === 12 ? 12 : h + 12;
}
const hhmm = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

function cuesIn(text: string): Cue[] {
  const out: Cue[] = [];
  const taken = (s: number, e: number) => out.some((c) => s < c.end && e > c.start);
  const push = (kind: CueKind, m: RegExpExecArray, label?: string) => {
    const start = m.index;
    const end = start + m[0].length;
    if (!taken(start, end)) out.push({ kind, text: label ?? m[0].trim(), start, end });
  };
  for (const m of text.matchAll(RANGE)) {
    const [, h1, m1, s1, h2, m2, s2] = m;
    const a = hour(h1!);
    const b = hour(h2!);
    if (a === null || b === null) continue;
    if (NOT_TIME.test(text.slice(0, m.index))) continue;
    let sh: number;
    let eh: number;
    if (s1 || s2) {
      sh = guess(a, s1);
      eh = guess(b, s2);
      // "4 to 10 pm": the start takes the latest hour that still comes before the end.
      if (!s1 && a <= 12 && a + 12 < eh) sh = a + 12;
      // "7 am to 3": the end falls after the start.
      if (!s2 && b <= 12 && eh <= sh) eh = b === 12 ? 12 : b + 12;
    } else {
      // "7 to 3" and "9 to 5": a shift reads morning to afternoon; "4 to 10" is an evening.
      sh = a > 12 ? a : a >= 7 && a <= 11 ? a : a === 12 ? 12 : a + 12;
      eh = b > 12 ? b : b;
      if (eh <= sh && b <= 12) eh = b === 12 ? 12 : b + 12;
    }
    if (eh <= sh) eh = Math.min(sh + 1, 23);
    if (eh > 23) eh = 23;
    push('range', m, formatRange(hhmm(sh, Number(m1 ?? 0)), hhmm(eh, Number(m2 ?? 0))));
  }
  for (const m of text.matchAll(AT)) {
    const raw = m[1] ?? m[4] ?? m[7];
    const mins = m[2] ?? m[5];
    const suffix = m[3] ?? m[6];
    if (!raw) continue;
    const h = hour(raw);
    if (h === null) continue;
    if (!suffix && raw.toLowerCase() !== 'noon' && raw.toLowerCase() !== 'midnight' && NOT_TIME.test(text.slice(0, m.index))) continue;
    push('time', m, formatTime(hhmm(guess(h, suffix), Number(mins ?? 0)), true));
  }
  for (const m of text.matchAll(DATE)) {
    const month = (m[1] ?? m[4] ?? '').toLowerCase().slice(0, 3);
    // 10/24 is October in the US; 24/10 is October where the day comes first.
    const [first, second] = [Number(m[6]), Number(m[7])];
    const numeric = !!m[6];
    const day = numeric ? (dateLocale().dayFirst ? first : second) : Number(m[2] ?? m[3] ?? m[5]);
    const mm = numeric ? (dateLocale().dayFirst ? second : first) : MONTHS.indexOf(month) + 1;
    if (!day || day > 31) continue;
    if (numeric && (mm < 1 || mm > 12)) continue;
    push('date', m, mm >= 1 && mm <= 12 ? monthDay(`2000-${String(mm).padStart(2, '0')}-${String(day).padStart(2, '0')}`) : `The ${day}${day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th'}`);
  }
  for (const [re, label] of WEEKDAYS) {
    const m = new RegExp(re.source, 'gi');
    for (const hit of text.matchAll(m)) push('weekday', hit, /^next/i.test(hit[0].trim()) ? `Next ${label}` : label);
  }
  for (const [re, label] of RELATIVE) {
    for (const hit of text.matchAll(new RegExp(re.source, 'gi'))) push('relative', hit, label);
  }
  return out.sort((a, b) => a.start - b.start);
}

const SPLIT = /\s*(?:[,;.!?\n]+|\b(?:and then|and also|then|also|plus)\b|\band\b(?!\s+(?:a\s+)?half))\s*/i;

/** The clauses a person has said so far that mention a day or a time, in order, with a label each. */
export function heardClauses(text: string): HeardClause[] {
  const out: HeardClause[] = [];
  for (const raw of text.split(SPLIT)) {
    const clause = raw.trim();
    if (clause.length < 3) continue;
    const cues = cuesIn(clause);
    if (!cues.length) continue;
    const day = cues.find((c) => c.kind === 'weekday' || c.kind === 'relative' || c.kind === 'date');
    const time = cues.find((c) => c.kind === 'range' || c.kind === 'time');
    out.push({ text: clause, cues, label: [day?.text, time?.text].filter(Boolean).join(' · ') });
  }
  return out;
}

/**
 * What a new result means for the words so far. Apple can end a stop with an empty result, and
 * on older iOS a pause restarts the transcript from nothing; neither may wipe what was said.
 * A result that shares no opening word with the last one and is much shorter is a new segment:
 * the last one is kept and the new one added after it.
 */
export function nextTranscript(committed: string, last: string, current: string): { committed: string; last: string } | null {
  if (!current.trim()) return null;
  const first = (s: string) => s.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? '';
  const restarted = !!last && first(current) !== first(last) && current.length < last.length / 2;
  return restarted ? { committed: `${committed} ${last}`.trim(), last: current } : { committed, last: current };
}
