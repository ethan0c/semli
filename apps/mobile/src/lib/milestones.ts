import type { Extraction } from '@dayli/schema';

/**
 * The lines Semli says at the moments that matter: a plan landing, an import going in, the day's
 * list finished. They name what happened and, where it fits, the person. A name on every toast
 * would grate, so it appears only at these milestones; everyday confirmations stay short.
 */

/** The first word of a saved name, or null. */
export function firstOf(name: string | null | undefined): string | null {
  return name?.trim().split(/\s+/)[0] || null;
}

const with_ = (first: string | null) => (first ? `, ${first}` : '');

/** "Your shifts are in, Ethan. 5 added · 1 updated." */
export function importLine(parts: (string | null)[], kind: Extraction['detected_type'], first: string | null): string {
  const lead = kind === 'work_schedule' ? 'Your shifts are in'
    : kind === 'syllabus' ? 'Your syllabus dates are in'
      : kind === 'course_schedule' ? 'Your classes are in'
        : 'Your plan is updated';
  const said = parts.filter(Boolean);
  return `${lead}${with_(first)}.${said.length ? ` ${said.join(' · ')}.` : ''}`;
}

/** The end of onboarding. */
export function readyLine(sample: boolean, first: string | null): string {
  return sample ? `Your sample week is ready${with_(first)}. Add your own plans any time.` : `Your plan is ready${with_(first)}.`;
}

/** The last open to-do due today, ticked off. */
export function allDoneLine(first: string | null): string {
  return `That’s everything due today${with_(first)}. Nice work.`;
}
