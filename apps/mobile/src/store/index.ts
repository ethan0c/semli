import { count, inferRule, localParts, rebuildSeries } from '@dayli/core';
import type { CommitPlan, TermSystem } from '@dayli/core';
import type { Snapshot } from '@/lib/cloud-snapshot';
import type { ImportUsage } from '@/lib/plans';
import type { AppLanguage } from '@/lib/language';
import type { Course, Extraction, ExtractRequest, Item, ScheduleVersion, SeriesRule } from '@dayli/schema';
import { COURSE_TINTS, type TintName } from '@dayli/tokens';
import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULT_API_URL } from '@/lib/api';
import { track } from '@/lib/analytics';
import { realRecords } from '@/lib/planner-preview';
import { allDoneLine, firstOf } from '@/lib/milestones';
import { DEFAULT_REMINDERS, type ReminderPrefs } from '@/lib/reminder-plan';
import { plannerLoadFailed, plannerStorage } from '@/lib/storage';

export interface Change {
  op: 'create' | 'update' | 'delete';
  before: Item | null;
  after: Item | null;
}

/** One undoable unit: an import, a manual edit, or a delete. */
export interface Batch {
  id: string;
  createdAt: string;
  label: string;
  changes: Change[];
  undone: boolean;
  /** Where it came from, for the import screen: "Screenshot", "syllabus.pdf", "Message". */
  source?: string | null;
  /** Courses and schedules this batch removed, so Undo can put them back. */
  removedCourses?: StoredCourse[];
  removedSchedules?: (ScheduleVersion & { batchId?: string })[];
  /** Work days this batch set, with what each task had before (null: none), so Undo can put them back. */
  workDatesBefore?: Record<string, string | null>;
}

export interface Pending {
  extraction: Extraction;
  /** Human label for where this came from, e.g. "Screenshot" or "syllabus.pdf". */
  source: string;
  /** The web only: what was read, so review can show it beside the results on a wide window. */
  input?: ExtractRequest['input'];
  /** Plus paid for this read: the free allowance was used up. Review says so, the first time. */
  plus?: boolean;
}

export type PlanId = 'monthly' | 'semester' | 'yearly';
export type Appearance = 'system' | 'light' | 'dark';
export type CardStyle = 'flat' | 'raised';
export type TodayView = 'list' | 'hours';
export type StoredCourse = Course & { batchId?: string; color?: TintName };

interface Settings {
  name: string;
  apiUrl: string;
  seeded: boolean;
  onboarded: boolean;
  /** Honor system: we never verify student status. */
  isStudent: boolean;
  /** Legacy beta preference only. Never use this to grant paid access; check RevenueCat semli_plus. */
  planIntent: PlanId | null;
  /** Legacy onboarding answer, kept so old backups load; nothing reads it. */
  weekKinds: string[];
  /** "What's on your plate?" from onboarding: drives student pricing, Today's view and the first import offered. */
  plate: Plate[];
  /** "Where do your deadlines live?" from onboarding: picks the first import path. */
  deadlineSource: DeadlineSource | null;
  /** The onboarding sample's batch, while it is in the plan; Today offers to remove it. */
  sampleBatchId: string | null;
  /** The guest's one-time "Save your plan" row on Today was dismissed. */
  savePlanDismissed: boolean;
  appearance: Appearance;
  /** This device's app language; null follows its preferred languages. Not synced to the account. */
  language: AppLanguage | null;
  /** Kept for stored settings; the app no longer draws cards. */
  cardStyle: CardStyle;
  /** The top-right toggle on Today: the list, or the day by the hour. */
  todayView: TodayView;
  /** UI sounds; they also follow the ring/silent switch. */
  sounds: boolean;
  haptics: boolean;
  /** Field of study when isStudent; drives the sample week and onboarding copy. */
  major: string | null;
  reminders: ReminderPrefs;
  /** The in-context permission ask after the first confirmed import happened. */
  remindersAsked: boolean;
  /** Semester breaks, for the moment header on Today. */
  breaks?: { label: string; start: string; end: string }[];
  /** Set by the review sheet when the first import is confirmed during onboarding. */
  onboardingImportDone: boolean;
  /** Active free trial, for the day-5 reminder. */
  trial: { endsAt: string; label: string } | null;
  /** Where the person studies, for the term calendar and numeric dates; null follows the phone. */
  region: string | null;
  /** Semesters or quarters, asked only where both are common (US, Canada). */
  termSystem: TermSystem;
  /** Where assignments live, asked in onboarding. Only Canvas syncs today; the rest is demand data. */
  lms: Lms | null;
  /** Account backup status, for You → Account. Nothing here is synced. */
  cloud: { backedUpAt: string | null; error: string | null };
  /** Canvas calendar feed sync. The link is the only credential; it stays on this phone. */
  canvas: CanvasSettings;
  /**
   * Things Semli explains once, the first time they happen in a person's own plan, instead of
   * in a tour. True once the note was seen; a guest's Clear everything resets them.
   */
  firsts: Record<FirstKind, boolean>;
}

/** What Semli explains once: an overlap it can move, a close deadline, Canvas left unconnected, a schedule compared with the last one, Plan's chart legend. */
export type FirstKind = 'overlap' | 'urgent' | 'canvas' | 'reimport' | 'hours' | 'week' | 'added' | 'plusImport';

export type Lms = 'canvas' | 'blackboard' | 'brightspace' | 'moodle' | 'classroom' | 'other';
export type Plate = 'classes' | 'job' | 'clubs';
export type DeadlineSource = 'canvas' | 'syllabus' | 'screenshots' | 'nowhere';

export interface CanvasSettings {
  feedUrl: string | null;
  lastSyncedAt: string | null;
  /** The last failure, shown on the Canvas screen; cleared by the next good sync. */
  lastError: string | null;
}

/** AI imports used this calendar month (free tier allows a few). */
type Usage = ImportUsage;

interface State {
  hydrated: boolean;
  items: Record<string, Item>;
  courses: StoredCourse[];
  usage: Usage;
  schedules: (ScheduleVersion & { batchId?: string })[];
  batches: Batch[];
  pending: Pending | null;
  /** Undo reverts `batchId`, or marks `doneIds` not done again (a completion is no batch). */
  toast: { message: string; batchId?: string; doneIds?: string[] } | null;
  settings: Settings;
  /** User-chosen work dates. Item.date remains the source's event/due date. */
  taskWorkDates: Record<string, string>;
  /** How each repeating series repeats, by seriesId. Inferred from the occurrences for series made before rules were stored. */
  series: Record<string, SeriesRule>;
  suggestionDismissals: { date: string; ids: string[] };
  captureDraft: string;
  selectedPlanDate: string | null;
  /** Signed in while this phone and the account both had a plan: the account's, until the person keeps one. Not persisted. */
  planChoice: { remote: Snapshot; remoteAt: string | null } | null;

  setHydrated: () => void;
  setPending: (p: Pending | null) => void;
  showToast: (message: string, batchId?: string) => void;
  /** "Done: Essay." with Undo, for completions that are easy to make by accident: a swipe, Mark all done. */
  showDoneToast: (items: Pick<Item, 'id' | 'title'>[]) => void;
  /** The done toast's Undo: these items open again. */
  undoDone: (ids: string[]) => void;
  hideToast: () => void;
  setSettings: (patch: Partial<Settings>) => void;
  recordImport: () => void;
  planTasks: (ids: string[], date: string) => void;
  unplanTask: (id: string) => void;
  /** Gives several tasks their own start days as one undoable change. */
  spreadTasks: (steps: { id: string; date: string }[], label: string) => string;
  dismissSuggestion: (id: string, date: string) => void;
  setCaptureDraft: (text: string) => void;
  setSelectedPlanDate: (date: string) => void;

  toggleDone: (id: string) => void;
  /** A change the person made. Touching the date or time marks the item edited, so a sync or a series rebuild leaves it alone; `silent` is for the app's own corrections. */
  updateItem: (id: string, patch: Partial<Item>, opts?: { silent?: boolean }) => void;
  /** The rule a series repeats by, stored or read off its occurrences. */
  seriesRule: (seriesId: string) => SeriesRule | null;
  /**
   * Change how a series repeats from `from` onward, as one undoable batch: occurrences move to
   * the rule's times, appear on its new dates and leave dates it no longer covers. The past, done
   * ones and hand-moved ones stay. Returns what changed, for the toast.
   */
  applySeries: (seriesId: string, rule: SeriesRule, from: string, today: string, label: string) => { created: number; updated: number; removed: number; kept: number; batchId: string | null };
  /** Make a one-off repeat: it becomes the first occurrence of a new series under `rule`. */
  startSeries: (id: string, rule: SeriesRule, today: string) => { seriesId: string; created: number; batchId: string | null };
  /**
   * Gives several items the same times as one undoable change: every upcoming "Morning cardio" an
   * import made, say, whether or not they share a series. A series among them takes the times into
   * its rule; one-offs count as hand-edited, as a single edit would.
   */
  retimeItems: (ids: string[], times: { start: string | null; end: string | null }, label: string) => string | null;
  removeItem: (id: string) => void;
  /** Delete several at once as one undoable batch: a week of lectures, the rest of a series. */
  removeItems: (ids: string[], label: string) => void;
  /** Drop a course: the course and every item in it, one Undo. */
  removeCourse: (courseId: string) => void;
  /** The person's own colour for a course's dot. */
  setCourseColor: (courseId: string, color: TintName) => void;
  /** Quit a job: upcoming shifts only, or everything including past shifts and the schedules. */
  removeEmployer: (employer: string, scope: 'upcoming' | 'all', today: string) => void;
  addItem: (item: Omit<Item, 'id' | 'createdAt' | 'batchId'>) => string;
  applyPlan: (plan: CommitPlan, label: string, extra?: { source?: string; course?: Course; courses?: Course[] }) => string;
  undoBatch: (id: string) => void;

  /**
   * `plan` erases what the person added (items, classes, shifts, breaks) and keeps their setup
   * answers. `everything` also resets those answers, so the next screen is the welcome; it keeps
   * only this device's preferences and the trial, which belong to the phone, not the person.
   */
  clearAll: (scope: 'plan' | 'everything') => void;
}

const DEFAULT_SETTINGS: Settings = { name: '', apiUrl: DEFAULT_API_URL, seeded: false, onboarded: false, isStudent: true, planIntent: null, weekKinds: [], plate: [], deadlineSource: null, sampleBatchId: null, savePlanDismissed: false, appearance: 'system', language: null, cardStyle: 'raised', todayView: 'list', sounds: true, haptics: true, major: null, reminders: DEFAULT_REMINDERS, remindersAsked: false, onboardingImportDone: false, trial: null, region: null, termSystem: 'semester', lms: null, cloud: { backedUpAt: null, error: null }, canvas: { feedUrl: null, lastSyncedAt: null, lastError: null }, firsts: { overlap: false, urgent: false, canvas: false, reimport: false, hours: false, week: false, added: false, plusImport: false } };

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const nowIso = () => new Date().toISOString();

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      hydrated: false,
      items: {},
      courses: [],
      schedules: [],
      batches: [],
      pending: null,
      toast: null,
      taskWorkDates: {},
      series: {},
      suggestionDismissals: { date: '', ids: [] },
      captureDraft: '',
      selectedPlanDate: null,
      planChoice: null,
      settings: DEFAULT_SETTINGS,
      usage: { month: '', imports: 0 },

      setHydrated: () => set({ hydrated: true }),
      setPending: (pending) => set({ pending }),
      showToast: (message, batchId) => set({ toast: { message, batchId } }),
      showDoneToast: (done) => {
        if (!done.length) return;
        set({ toast: { message: done.length === 1 ? `Done: ${done[0]!.title}.` : `Marked ${done.length} done.`, doneIds: done.map((it) => it.id) } });
      },
      undoDone: (ids) => {
        const items = { ...get().items };
        for (const id of ids) if (items[id]?.done) items[id] = { ...items[id]!, done: false, completedAt: null };
        set({ items, toast: null });
      },
      hideToast: () => set({ toast: null }),
      setSettings: (patch) => set({ settings: { ...get().settings, ...patch } }),
      setCaptureDraft: (captureDraft) => set({ captureDraft }),
      setSelectedPlanDate: (selectedPlanDate) => set({ selectedPlanDate }),
      planTasks: (ids, date) => {
        const taskWorkDates = { ...get().taskWorkDates };
        for (const id of ids) {
          const item = get().items[id];
          if (item?.kind === 'task' && !item.done) taskWorkDates[id] = date;
        }
        set({ taskWorkDates });
      },
      unplanTask: (id) => {
        const taskWorkDates = { ...get().taskWorkDates };
        delete taskWorkDates[id];
        set({ taskWorkDates });
      },
      spreadTasks: (steps, label) => {
        const b: Batch = { ...batch(label, []), workDatesBefore: {} };
        const taskWorkDates = { ...get().taskWorkDates };
        for (const { id, date } of steps) {
          b.workDatesBefore![id] = taskWorkDates[id] ?? null;
          taskWorkDates[id] = date;
        }
        set({ taskWorkDates, batches: [b, ...get().batches] });
        return b.id;
      },
      dismissSuggestion: (id, date) => {
        const previous = get().suggestionDismissals;
        set({ suggestionDismissals: { date, ids: [...new Set([...(previous.date === date ? previous.ids : []), id])] } });
      },
      recordImport: () => {
        const month = nowIso().slice(0, 7);
        const u = get().usage;
        set({ usage: { month, imports: u.month === month ? u.imports + 1 : 1, firstImportAt: u.firstImportAt ?? new Date().toISOString(), total: (u.total ?? u.imports) + 1 } });
      },

      toggleDone: (id) => {
        const it = get().items[id];
        if (!it) return;
        const done = !it.done;
        set({ items: { ...get().items, [id]: { ...it, done, completedAt: done ? nowIso() : null } } });
        track('item_completion_changed', { item_kind: it.kind, category: it.category, completed: done });
        // Ticking off the last to-do due today is worth saying, once, by name.
        const today = localParts(new Date()).date;
        if (done && it.kind === 'task' && it.date === today
          && !realRecords(Object.values(get().items)).some((x) => x.kind === 'task' && x.date === today && !x.done)) {
          set({ toast: { message: allDoneLine(firstOf(get().settings.name)) } });
        }
      },

      updateItem: (id, patch, opts) => {
        const before = get().items[id];
        if (!before) return;
        const moved = !opts?.silent && ('date' in patch || 'start' in patch || 'end' in patch);
        const after = { ...before, ...patch, ...(moved ? { editedAt: nowIso() } : {}) };
        set({
          items: { ...get().items, [id]: after },
          batches: [batch('Edited ' + before.title, [{ op: 'update', before, after }]), ...get().batches],
        });
        if (moved) track('item_edited', { field: 'date' in patch ? 'date' : 'time', scope: 'one', repeats: !!before.seriesId });
      },

      retimeItems: (ids, times, label) => {
        const items = { ...get().items };
        const series = { ...get().series };
        const changes: Change[] = [];
        for (const id of ids) {
          const before = items[id];
          if (!before || (before.start === times.start && before.end === times.end)) continue;
          // Series occurrences keep following their rule, so they aren't marked as moved by hand.
          const after = { ...before, start: times.start, end: times.end, ...(before.seriesId ? {} : { editedAt: nowIso() }) };
          items[id] = after;
          changes.push({ op: 'update', before, after });
          const sid = before.seriesId;
          if (sid) {
            const rule = series[sid] ?? inferRule(Object.values(get().items).filter((it) => it.seriesId === sid));
            series[sid] = { ...rule, start: times.start, end: times.end };
          }
        }
        if (!changes.length) return null;
        const b = batch(label, changes);
        set({ items, series, batches: [b, ...get().batches], toast: { message: `${label}.`, batchId: b.id } });
        track('item_edited', { field: 'time', scope: 'similar', updated: changes.length });
        return b.id;
      },

      seriesRule: (seriesId) => {
        const stored = get().series[seriesId];
        if (stored) return stored;
        const occurrences = Object.values(get().items).filter((it) => it.seriesId === seriesId);
        if (!occurrences.length) return null;
        const rule = inferRule(occurrences);
        set({ series: { ...get().series, [seriesId]: rule } });
        return rule;
      },

      applySeries: (seriesId, rule, from, today, label) => {
        const all = Object.values(get().items).filter((it) => it.seriesId === seriesId);
        const r = rebuildSeries(all, rule, from, today, get().settings.breaks ?? []);
        // New occurrences copy the one being edited (or the nearest upcoming one): same class, course, kind.
        const template = all.find((it) => it.date === from) ?? all.filter((it) => it.date >= from).sort((a, b) => a.date.localeCompare(b.date))[0] ?? all[0]!;
        const items = { ...get().items };
        const changes: Change[] = [];
        for (const u of r.update) {
          const before = items[u.id]!;
          const after = { ...before, ...u.patch };
          items[u.id] = after;
          changes.push({ op: 'update', before, after });
        }
        for (const date of r.create) {
          const it: Item = {
            ...template, id: newId(), createdAt: nowIso(), date, start: rule.start, end: rule.end, done: false, completedAt: null,
            editedAt: null, feed: null, notes: null, urgent: undefined, batchId: null,
          };
          items[it.id] = it;
          changes.push({ op: 'create', before: null, after: it });
        }
        for (const id of r.remove) {
          const before = items[id]!;
          delete items[id];
          changes.push({ op: 'delete', before, after: null });
        }
        const b = batch(label, changes);
        set({ items, series: { ...get().series, [seriesId]: rule }, batches: changes.length ? [b, ...get().batches] : get().batches,
          toast: changes.length ? { message: `${label}.`, batchId: b.id } : get().toast });
        track('item_edited', { field: 'repeat', scope: 'series', created: r.create.length, updated: r.update.length, removed: r.remove.length });
        return { created: r.create.length, updated: r.update.length, removed: r.remove.length, kept: r.kept, batchId: changes.length ? b.id : null };
      },

      startSeries: (id, rule, today) => {
        const it = get().items[id];
        if (!it) return { seriesId: '', created: 0, batchId: null };
        const seriesId = it.seriesId ?? `series-${id}`;
        if (!it.seriesId) set({ items: { ...get().items, [id]: { ...it, seriesId } } });
        const r = get().applySeries(seriesId, rule, it.date, today, `${it.title} repeats`);
        return { seriesId, created: r.created, batchId: r.batchId };
      },

      removeItem: (id) => {
        const before = get().items[id];
        if (!before) return;
        const items = { ...get().items };
        delete items[id];
        const b = batch('Deleted ' + before.title, [{ op: 'delete', before, after: null }]);
        // One occurrence of a series gone by hand: the rule skips that date, so a rebuild never brings it back.
        const rule = before.seriesId ? get().series[before.seriesId] : undefined;
        const series = rule && !rule.skipped.includes(before.date) ? { ...get().series, [before.seriesId!]: { ...rule, skipped: [...rule.skipped, before.date] } } : get().series;
        set({ items, series, batches: [b, ...get().batches], toast: { message: `Deleted ${before.title}.`, batchId: b.id } });
        track('item_deleted', { deletion_scope: 'single', item_count: 1 });
      },

      removeItems: (ids, label) => {
        const items = { ...get().items };
        const changes: Change[] = [];
        for (const id of ids) {
          const before = items[id];
          if (!before) continue;
          delete items[id];
          changes.push({ op: 'delete', before, after: null });
        }
        if (changes.length === 0) return;
        const b = batch(label, changes);
        set({ items, batches: [b, ...get().batches], toast: { message: `${label}.`, batchId: b.id } });
        track('item_deleted', { deletion_scope: 'multiple', item_count: changes.length });
      },

      setCourseColor: (courseId, color) => {
        set({ courses: get().courses.map((k) => (k.id === courseId ? { ...k, color } : k)) });
      },

      removeCourse: (courseId) => {
        const course = get().courses.find((k) => k.id === courseId);
        if (!course) return;
        const items = { ...get().items };
        const changes: Change[] = [];
        for (const it of Object.values(items)) {
          if (it.courseId !== courseId) continue;
          delete items[it.id];
          changes.push({ op: 'delete', before: it, after: null });
        }
        const name = course.code ?? course.title;
        const b: Batch = { ...batch(`Removed ${name} · ${count(changes.length, 'plan')}`, changes), removedCourses: [course] };
        set({ items, courses: get().courses.filter((k) => k.id !== courseId), batches: [b, ...get().batches], toast: { message: `${b.label}.`, batchId: b.id } });
        if (changes.length) track('item_deleted', { deletion_scope: 'course', item_count: changes.length });
      },

      removeEmployer: (employer, scope, today) => {
        const key = employer.trim().toLowerCase();
        const items = { ...get().items };
        const changes: Change[] = [];
        for (const it of Object.values(items)) {
          if ((it.employer ?? '').trim().toLowerCase() !== key) continue;
          if (scope === 'upcoming' && it.date < today) continue;
          delete items[it.id];
          changes.push({ op: 'delete', before: it, after: null });
        }
        const gone = get().schedules.filter((sch) => sch.employer.trim().toLowerCase() === key && (scope === 'all' || sch.coversTo >= today));
        const b: Batch = { ...batch(`Removed ${employer} · ${count(changes.length, 'shift')}`, changes), removedSchedules: gone };
        set({ items, schedules: get().schedules.filter((sch) => !gone.includes(sch)), batches: [b, ...get().batches], toast: { message: `${b.label}.`, batchId: b.id } });
        if (changes.length) track('item_deleted', { deletion_scope: 'employer', item_count: changes.length });
      },

      addItem: (fields) => {
        const b = batch('Added ' + fields.title, []);
        const item: Item = { ...fields, id: newId(), createdAt: nowIso(), batchId: b.id };
        b.changes.push({ op: 'create', before: null, after: item });
        set({ items: { ...get().items, [item.id]: item }, batches: [b, ...get().batches] });
        return item.id;
      },

      applyPlan: (plan, label, extra) => {
        const b = batch(label, []);
        const items = { ...get().items };
        const source = extra?.source ?? null;
        for (const c of plan.create) {
          const it: Item = { ...c, id: newId(), createdAt: nowIso(), batchId: b.id, sourceId: source };
          items[it.id] = it;
          b.changes.push({ op: 'create', before: null, after: it });
        }
        for (const u of plan.update) {
          const before = items[u.id];
          if (!before) continue;
          const after: Item = { ...before, ...u.patch, batchId: b.id };
          items[u.id] = after;
          b.changes.push({ op: 'update', before, after });
        }
        for (const id of plan.remove) {
          const before = items[id];
          if (!before) continue;
          delete items[id];
          b.changes.push({ op: 'delete', before, after: null });
        }
        const schedules = plan.schedule
          ? [
              ...get().schedules,
              {
                id: newId(),
                employer: plan.schedule.employer,
                coversFrom: plan.schedule.coversFrom,
                coversTo: plan.schedule.coversTo,
                sourceId: source,
                createdAt: nowIso(),
                batchId: b.id,
              },
            ]
          : get().schedules;
        const courses = [...get().courses];
        for (const k of [...(extra?.course ? [extra.course] : []), ...(extra?.courses ?? [])]) {
          courses.push({ ...k, batchId: b.id, color: nextCourseTint(courses) });
        }
        b.source = source;
        // A series arriving without a rule (an import) gets one read off its occurrences.
        const series = { ...get().series };
        for (const ch of b.changes) {
          const sid = ch.op === 'create' && ch.after?.seriesId;
          if (sid && !series[sid]) series[sid] = inferRule(Object.values(items).filter((it) => it.seriesId === sid));
        }
        set({ items, schedules, courses, series, batches: [b, ...get().batches], pending: null });
        return b.id;
      },

      undoBatch: (id) => {
        const b = get().batches.find((x) => x.id === id);
        if (!b || b.undone) return;
        const items = { ...get().items };
        for (const ch of [...b.changes].reverse()) {
          if (ch.op === 'create' && ch.after) delete items[ch.after.id];
          else if (ch.before) items[ch.before.id] = ch.before;
        }
        const taskWorkDates = { ...get().taskWorkDates };
        for (const [task, before] of Object.entries(b.workDatesBefore ?? {})) {
          if (before) taskWorkDates[task] = before;
          else delete taskWorkDates[task];
        }
        set({
          items,
          taskWorkDates,
          schedules: [...get().schedules.filter((s) => s.batchId !== id), ...(b.removedSchedules ?? [])],
          courses: [...get().courses.filter((c) => c.batchId !== id), ...(b.removedCourses ?? [])],
          batches: get().batches.map((x) => (x.id === id ? { ...x, undone: true } : x)),
          toast: null,
        });
      },

      clearAll: (scope) => {
        const { settings: s } = get();
        set({
          items: {}, courses: [], schedules: [], batches: [], pending: null, toast: null, taskWorkDates: {}, suggestionDismissals: { date: '', ids: [] }, captureDraft: '', selectedPlanDate: null, planChoice: null,
          settings: scope === 'plan'
            ? { ...s, breaks: [] }
            : { ...DEFAULT_SETTINGS, apiUrl: s.apiUrl, appearance: s.appearance, language: s.language, cardStyle: s.cardStyle, todayView: s.todayView, sounds: s.sounds, haptics: s.haptics, trial: s.trial },
        });
      },
    }),
    {
      name: 'semli',
      storage: createJSONStorage(() => plannerStorage),
      partialize: (s) => ({ items: s.items, courses: s.courses, schedules: s.schedules, batches: s.batches, settings: s.settings, usage: s.usage, taskWorkDates: s.taskWorkDates, series: s.series, suggestionDismissals: s.suggestionDismissals }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        // Nested records gain fields over time; a stored one must not drop the new defaults.
        return { ...current, ...p, settings: { ...current.settings, ...(p.settings ?? {}), firsts: { ...current.settings.firsts, ...(p.settings?.firsts ?? {}) } } };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) plannerLoadFailed(error);
        else state?.setHydrated();
      },
    },
  ),
);

function batch(label: string, changes: Change[]): Batch {
  return { id: newId(), createdAt: nowIso(), label, changes, undone: false };
}

/** A course's tint; older records without one take the next tint in order. */
/**
 * Lavender is the brand accent, which the design rules keep to five places, so a new course takes
 * it only after every other tint (Oct 23, 2026). Older courses keep the colour they have:
 * `COURSE_TINTS` order still decides a record saved without one.
 */
const NEW_COURSE_TINTS: TintName[] = [...COURSE_TINTS.filter((t) => t !== 'lavender'), 'lavender'];

/** The least-used tint, first in `NEW_COURSE_TINTS` order on a tie, so a removed course's colour is reused before any repeats. */
export function nextCourseTint(courses: StoredCourse[]): TintName {
  const uses = (tint: TintName) => courses.filter((k, i) => (k.color ?? COURSE_TINTS[i % COURSE_TINTS.length]) === tint).length;
  return NEW_COURSE_TINTS.reduce((best, tint) => (uses(tint) < uses(best) ? tint : best));
}

export function courseTint(courses: StoredCourse[], courseId: string | null | undefined): TintName | null {
  if (!courseId) return null;
  const i = courses.findIndex((k) => k.id === courseId);
  if (i < 0) return null;
  return courses[i]!.color ?? COURSE_TINTS[i % COURSE_TINTS.length]!;
}

/** All items as a stable sorted array. */
export function useItemList(): Item[] {
  const items = useStore((s) => s.items);
  return useMemo(
    () => realRecords(Object.values(items)).sort((a, b) => a.date.localeCompare(b.date) || (a.start ?? '').localeCompare(b.start ?? '')),
    [items],
  );
}

/** Samples are presentation content, never course matches or schedule history. */
export function useCourseList(): StoredCourse[] {
  const courses = useStore((s) => s.courses);
  return useMemo(() => realRecords(courses), [courses]);
}

export function useScheduleList() {
  const schedules = useStore((s) => s.schedules);
  return useMemo(() => realRecords(schedules), [schedules]);
}
