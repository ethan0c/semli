import { addDays, diffDays, typicalTermEnd } from '@dayli/core';
import type { Item } from '@dayli/schema';

/** Finals week isn't the end of a term on the page: ask a week after the last class. */
const AFTER_LAST_CLASS = 7;
/** Past this the term is long gone and the question would be stale; the courses wait in School. */
const STALE_AFTER = 90;
/** How far back from the last class the term's first class can be, to name the term. */
const TERM_LENGTH = 150;

export type TermOver = {
  /** The last class meeting; also the key that keeps the question to once a term. */
  lastClass: string;
  /** "fall semester", "autumn term", from the term the classes started in. */
  name: string;
  /** Courses with nothing left from today on, which the row offers to remove. */
  oldCourses: string[];
};

/**
 * Whether Today asks about the next term: every class in the plan has met for the last time, at
 * least a week ago, and nothing from a new term has arrived (phase-2.md, "Semester-over prompt").
 */
export function termOver(items: Item[], today: string): TermOver | null {
  const classes = items.filter((i) => i.kind === 'event' && i.category === 'school' && i.seriesId && i.courseId);
  if (!classes.length) return null;
  const lastClass = classes.reduce((last, i) => (i.date > last ? i.date : last), classes[0]!.date);
  const since = diffDays(lastClass, today);
  if (since < AFTER_LAST_CLASS || since > STALE_AFTER) return null;
  const firstClass = classes.filter((i) => i.date >= addDays(lastClass, -TERM_LENGTH)).reduce((first, i) => (i.date < first ? i.date : first), lastClass);
  const ahead = new Set(items.filter((i) => i.date >= today && i.courseId).map((i) => i.courseId));
  const oldCourses = [...new Set(classes.map((i) => i.courseId!))].filter((id) => !ahead.has(id));
  return { lastClass, name: typicalTermEnd(firstClass).name, oldCourses };
}
