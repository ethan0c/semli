import type { Item, SeriesRule } from '@dayli/schema';

import type { Batch, StoredCourse } from './index';

/** The fields a person can see or change. Two copies that agree on these are the same item. */
const FIELDS = ['kind', 'title', 'category', 'date', 'start', 'end', 'isDeadline', 'done', 'courseId', 'employer', 'seriesId', 'urgent', 'notes', 'timeFlexibility'] as const;

export function sameItem(a: Item, b: Item): boolean {
  return FIELDS.every((f) => (a[f as keyof Item] ?? null) === (b[f as keyof Item] ?? null));
}

export interface UndoResult {
  items: Record<string, Item>;
  series: Record<string, SeriesRule>;
  courses: StoredCourse[];
  /** Items put back the way they were. */
  reverted: number;
  /** Items changed or deleted since the batch, left as they are now. */
  kept: number;
}

/**
 * What undoing a batch comes to, given the plan as it is now. Before Oct 27, 2026 undo put every
 * saved copy back as it was, so undoing a September import also deleted the items ticked done or
 * given notes since, and undoing an older edit wrote over newer ones. Now a change is reversed only
 * while its item still matches what the batch left; anything changed since stays as it is.
 */
export function planUndo(
  batch: Batch,
  items: Record<string, Item>,
  series: Record<string, SeriesRule>,
  courses: StoredCourse[],
  /** The sample plan goes entirely, ticked or not: it was never the person's. */
  opts?: { force?: boolean },
): UndoResult {
  const next = { ...items };
  // By item, not by change: one batch can touch an item twice (tagged, then rebuilt).
  const reverted = new Set<string>();
  const kept = new Set<string>();
  for (const ch of [...batch.changes].reverse()) {
    const id = (ch.after ?? ch.before)!.id;
    const now = next[id];
    if (ch.op === 'delete') {
      if (now && !opts?.force) kept.add(id);
      else { next[id] = ch.before!; reverted.add(id); }
    } else if (!now) {
      // Deleted since: nothing to take back, and bringing it back would undo that delete too.
      if (ch.op === 'update') kept.add(id);
    } else if (!opts?.force && !sameItem(now, ch.after!)) {
      kept.add(id);
    } else if (ch.op === 'create') {
      delete next[id];
      reverted.add(id);
    } else {
      next[id] = ch.before!;
      reverted.add(id);
    }
  }

  const nextSeries = { ...series };
  for (const [sid, rule] of Object.entries(batch.seriesBefore ?? {})) {
    if (rule) nextSeries[sid] = rule;
    else delete nextSeries[sid];
  }

  // The batch's courses go, unless something outside it still files under them (a later syllabus,
  // a to-do added by hand); those stay, so no item points at a course that isn't there.
  const inUse = new Set(Object.values(next).map((it) => it.courseId).filter(Boolean));
  const nextCourses = [
    ...courses.filter((k) => k.batchId !== batch.id || inUse.has(k.id)),
    ...(batch.removedCourses ?? []).filter((k) => !courses.some((c) => c.id === k.id)),
  ];
  return { items: next, series: nextSeries, courses: nextCourses, reverted: reverted.size, kept: [...kept].filter((id) => !reverted.has(id)).length };
}

/** The confirm line before an undo from Settings or an import's page, where a tap may be months later. */
export function undoQuestion(batch: Batch, items: Record<string, Item>, series: Record<string, SeriesRule>, courses: StoredCourse[]): string {
  const { reverted, kept } = planUndo(batch, items, series, courses);
  const n = (k: number) => (k === 1 ? '1 item' : `${k} items`);
  const back = reverted ? `This will undo changes to ${n(reverted)}.` : 'There’s nothing left to undo.';
  const stay = kept ? ` Your later changes to ${n(kept)} will be kept.` : '';
  return `Undo “${batch.label}”? ${back}${stay}`;
}

/** Edits stay undoable this long: a mistake is noticed in days, not months. */
export const EDIT_DAYS = 30;
/** Imports stay this long, a term: "Added from" links to them, and a syllabus can be undone all semester. */
export const IMPORT_DAYS = 180;
/** At most this many, oldest first out, whatever their age. */
export const MAX_BATCHES = 300;

/**
 * The undo history worth saving. Every change rewrote all of it, and each entry holds whole copies
 * of what it touched: a semester came to about 600 KB, twice the plan itself, and on the web it
 * shares the browser's 5 MB with the plan (Oct 27, 2026). What drops off can't be undone any more;
 * the plan itself is untouched. The sample week stays while it's loaded, so it can still be removed.
 */
export function trimBatches(batches: Batch[], now: number, keepId?: string | null): Batch[] {
  const day = 86_400_000;
  const kept = batches.filter((b) => {
    if (b.id === keepId) return true;
    const age = now - Date.parse(b.createdAt);
    return !(age > (b.source ? IMPORT_DAYS : EDIT_DAYS) * day);
  });
  return kept.length > MAX_BATCHES ? kept.filter((b, i) => i < MAX_BATCHES || b.id === keepId) : kept;
}
