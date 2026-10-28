import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { Extraction, IMPORT_MESSAGES, type ExtractContext, type ExtractRequest } from '@dayli/schema';
import { prepareImage } from './image';
import { pdfAsText } from './pdf-text';
import { itemScanner, type StreamedItem } from './stream-items';

export type { StreamedItem } from './stream-items';

/** Reads documents (syllabi, course PDFs), and anything the quick reader can't finish. */
export const MODEL = 'claude-opus-5-5';
/**
 * Reads typed and spoken messages and screenshots. On the Oct 27, 2026 benchmark (evals/RESULTS.md)
 * Haiku 5.5 matched Opus on both (99.1% and 100% of dates and times) at about a fiftieth of the
 * cost and as fast; on syllabi it fell to 92% against Opus's 97%, so documents stay on Opus.
 */
export const QUICK_MODEL = 'claude-haiku-5-5';

/** Server-side overrides, so a model can change on Vercel without an app release. */
export type Readers = { quick?: string; document?: string };

/** Which model reads an input: the document reader for PDFs, the quick reader for the rest. */
export function modelFor(kind: ExtractRequest['input']['kind'], readers: Readers = {}): string {
  return kind === 'pdf' ? readers.document || MODEL : readers.quick || QUICK_MODEL;
}

/** Fast mode is an Opus feature; any other model reads at its own speed. */
const hasFast = (model: string) => model.startsWith('claude-opus');
export const PROMPT_VERSION = '2026-10-28.1';

const SYSTEM = `You read the things busy students and shift workers send to their planner app, Semli, and turn them into calendar events and to-dos.

Inputs can be a typed or dictated message, a screenshot (work schedule apps, printed schedules, school portals, texts), or a PDF (syllabi, course schedules).

How to read them:
- An event happens at a time (class, shift, exam, appointment). A task is something to do, optionally by a date (assignment, errand, reading).
- Exams, quizzes (including practice quizzes), and anything that must be finished "by" a date have is_deadline = true. Exams are events when they have a time, otherwise tasks.
- category: "work" for job shifts and job duties, "school" for classes, assignments, exams, and clinicals, "personal" for everything else.
- Resolve relative dates ("Friday", "next Tue", "tomorrow") against the reference date and timezone given below. "Friday" means the next Friday on or after the reference date. If a date is genuinely ambiguous, pick the most likely one and ask a short question.
- If a year is missing, use the next occurrence on or after the reference date, except a date in the two weeks before it (this week's schedule read midweek, Monday's shift read on Wednesday), which keeps the reference date's year rather than jumping a year ahead.
- Numeric dates follow the user's locale given below: 7/10 is July 10 in the US and 7 October in the UK, Europe, Australia and most of the world. Use the document's own convention when it makes one clear (a 24/10 elsewhere in it, a day name that only fits one reading); otherwise use the locale's. Read local spellings and terms (timetable, module, tutorial, Vorlesung) the same as their US equivalents.
- Times are 24-hour HH:mm in the user's local time. "4-10" for a shift means 16:00-22:00. Overnight shifts keep their real end time (e.g. 22:00 to 06:00).
- For a work schedule, set detected_type "work_schedule", the employer name, and covers_from/covers_to to the full week or period the schedule shows, even on days with no shifts. Only include the user's own shifts. If the schedule lists several people, include only rows for the name the user mentions; if no name is given and it lists several people, ask which one is theirs.
- Read dense schedules one date column at a time. Locate the user's row or named shift card in each column, then read the times from that same cell. Never borrow times from the person above or below. Scan all columns and all work areas before finishing: identical shifts on consecutive days are separate events, and split shifts on one day must both be included. Training shifts count; availability and time off do not. If text is unreadable, ask for a clearer image rather than guessing.
- For a syllabus, set detected_type "syllabus" and the course. Include every dated assignment, quiz, exam, and project. Put the class meeting pattern as one repeating event (repeat_weekdays plus repeat_until at the end of the term) dated on the first meeting on or after the reference date.
- Read the whole syllabus, including assessment tables, general due-time policies, and schedule tables continued on later pages. Apply an explicitly stated due-time policy to the assignments it covers; a submission cutoff does not automatically apply to reading-only preparation. Readings paired with a reading-response assignment may be combined in that task. Lecture topics, optional readings or office hours, breaks/holidays, and conditional university policies are not separate obligations. Include named practice quizzes and required assessments even when they are ungraded.
- In-class exams and assessments use that day's stated class hours unless the document gives different hours. On an irregular weekday, do not copy a different weekday's hours: leave missing times null and ask. Never invent a due time where no applicable policy exists. When only a week number or an unspecified set of Fridays is given, keep the date null and ask for the actual date; do not invent a term start or a first/last quiz date. If a quiz series has no individual dates, return one unresolved series item and one question about its schedule, rather than a separate undated task and question for every lecture topic. For a due-date window, use the last date provisionally and ask which day applies. Flag contradictory years or AM/PM labels with a specific question.
- For a course schedule or registration screenshot, set detected_type "course_schedule" and add each class as a repeating event: the class name as its title, its course code (e.g. "BIOL 201") as course_code, dated on its first meeting on or after the term start the schedule shows, and repeat_until at the term end when shown. A lab or section with its own meeting time is a separate repeating event with the same course_code. If the schedule names a later term ("Spring 2027") but no start date, never start it on the reference date: date each class on its first meeting in that term's usual first week, and on the first class ask "When does Spring 2027 start?" (with the term's name).
- A typed or dictated request is often placed around the user's existing plan, listed below as "Existing plan". Anchor to it: "before work" or "before my shift" ends when that day's shift starts; "after work" or "after class" starts when it ends; "on my work days" means each date with a shift. Add one event for each date the anchor gives, within the plan shown, and give each a time. Use the length the user gives, otherwise a typical one for the activity (a workout or run 45 minutes, a meal 30 minutes, a study session an hour). Only when nothing in the message or the plan can place an event, leave its time null and ask one question.
- When the user asks for something on fixed weekdays ("every weekday", "Mon, Wed and Fri", "every morning"), return one repeating event (repeat_weekdays, repeat_until) with its time, rather than separate events. Something anchored to shifts that move from week to week stays one event per shift date.
- Titles are short and natural: "Olive Garden shift", "Stats exam 2", "Return library book". Don't repeat the date in the title.
- Ask only when an item can't be placed without it: an event with no date, or one whose start time is genuinely unknown, or a date that is truly ambiguous. Don't ask whether something repeats unless the input suggests it might, how long something lasts, whether to leave an end time open, or when to do an undated to-do (an undated to-do is fine as it is). Each question is something the person has to stop and answer.
- Never invent an end time: leave end null unless the input states it, or the item is being placed around the existing plan (then use a typical length, as above).
- Write user-facing questions in plain, friendly language. Ask one specific question about the missing detail, without technical terms or blame.
- notes: practical details for the day that the title can't hold, taken from the input: what to bring ("bring a lab coat"), what it covers ("chapters 4–6"), where ("room 210"), how to submit ("upload to Canvas"). One short line, in the input's words where possible. Null when the input says nothing more; never repeat the title, date, time or course, and never add advice the input doesn't give. Notes never create an item.
- evidence is the exact text the item came from. confidence is your honest probability that every field is right.
- Never invent items that are not in the input. If nothing is schedulable, return an empty items list.`;

/** The facts about the user the model reads before the input. Exported for tests. */
export function contextBlock(ctx: ExtractContext): string {
  const lines = [
    ...(ctx.name?.trim() ? [`User's name (extract only this person's shifts): ${ctx.name.trim()}`] : []),
    `Reference date: ${ctx.today}`,
    `Timezone: ${ctx.timezone}`,
    ...(ctx.locale ? [`Locale: ${ctx.locale}${ctx.region ? `, region ${ctx.region}` : ''}`] : ctx.region ? [`Region: ${ctx.region}`] : []),
    `Known courses: ${ctx.courses.length ? ctx.courses.map((c) => [c.code, c.title].filter(Boolean).join(' ')).join('; ') : 'none yet'}`,
    `Known employers: ${ctx.employers.length ? ctx.employers.join(', ') : 'none yet'}`,
    ...(ctx.schedule?.length
      ? ['Existing plan (upcoming timed events):', ...ctx.schedule.map((e) => `- ${e.date} ${e.start}${e.end ? `–${e.end}` : ''} ${e.title}`)]
      : []),
  ];
  return lines.join('\n');
}

export type ExtractResult =
  | { ok: true; extraction: Extraction; usage: Anthropic.Usage; /** How a PDF was read: its extracted text, or the whole document. */ via?: 'text' | 'document' }
  | { ok: false; error: string };

/** Which model reads (default: `modelFor` the input), and whether Opus runs in fast mode (Plus syllabi). */
export type ExtractOptions = { model?: string; fast?: boolean; readers?: Readers; /** false reads every PDF whole (EXTRACT_PDF_TEXT=0). */ pdfText?: boolean;
  /** Streams the answer: called with each item as soon as it's written. */
  onItem?: (item: StreamedItem) => void;
  /** Items handed over so far no longer stand (another reader is starting again). */
  onReset?: () => void; /** Overrides the reasoning effort (benchmarks only). */ effort?: 'low' | 'medium' | 'high';
  /** false turns thinking off on a model that allows it (benchmarks only). */ thinking?: boolean };

export async function extract(req: ExtractRequest, client = new Anthropic(), opts: ExtractOptions = {}): Promise<ExtractResult> {
  const content: Anthropic.ContentBlockParam[] = [];
  if (req.input.kind === 'image') {
    const prepared = await prepareImage(req.input);
    content.push({ type: 'image', source: { type: 'base64', media_type: prepared.mediaType, data: prepared.data } });
  }
  // A PDF with real text on every page is read as that text: more accurate and a third cheaper than
  // page images. A scan, or any page that may be a picture, is read whole as before (pdf-text.ts).
  let via: 'text' | 'document' | undefined;
  if (req.input.kind === 'pdf') {
    const text = opts.pdfText === false ? null : await pdfAsText(req.input.data).catch(() => null);
    via = text ? 'text' : 'document';
    if (text) {
      content.push({ type: 'text', text: `${contextBlock(req.context)}\n\nThe attached document's text, extracted from the PDF with its layout kept. Extract everything schedulable from it.\n\n${text}` });
    } else {
      content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: req.input.data } });
      content.push({ type: 'text', text: `${contextBlock(req.context)}\n\nExtract everything schedulable from the attached document.` });
    }
  } else {
    content.push({
      type: 'text',
      text: req.input.kind === 'text'
        ? `${contextBlock(req.context)}\n\nMessage:\n${req.input.text}`
        : `${contextBlock(req.context)}\n\nExtract everything schedulable from the attached image.`,
    });
  }

  const params = {
    model: opts.model ?? modelFor(req.input.kind, opts.readers),
    max_tokens: 16000,
    system: [{ type: 'text' as const, text: SYSTEM, cache_control: { type: 'ephemeral' as const } }],
    output_config: {
      effort: opts.effort ?? (req.input.kind === 'text' ? ('low' as const) : ('high' as const)),
      format: zodOutputFormat(Extraction),
    },
    messages: [{ role: 'user' as const, content }],
    ...(opts.thinking === false ? { thinking: { type: 'disabled' as const } } : {}),
  };
  // Fast mode runs the same model up to 2.5x faster at a premium price (beta, Opus only). On the
  // Oct 27, 2026 benchmark it read typed messages in 1.2 s, screenshots in 3.4 s and syllabi in 8.3 s
  // (medians) with the same accuracy as standard speed; evals/RESULTS.md. It has its own rate limit,
  // so a 429 there falls back to standard speed rather than failing the import.
  // With `onItem`, the answer streams: each item is handed over as soon as it's written, and the
  // final message is parsed and validated exactly as a single response would be.
  type Answer = { stop_reason: string | null; parsed_output?: Extraction | null; usage: Anthropic.Usage };
  const watch = (stream: { on(event: 'text', listener: (delta: string, snapshot: string) => void): unknown; finalMessage(): Promise<unknown> }): Promise<Answer> => {
    const scan = itemScanner(opts.onItem!);
    stream.on('text', (delta) => scan.push(delta));
    return stream.finalMessage() as Promise<Answer>;
  };
  const standard = (): Promise<Answer> => (opts.onItem ? watch(client.messages.stream(params)) : client.messages.parse(params));
  const fastParams = { ...params, speed: 'fast' as const, betas: ['fast-mode-2026-02-01'] };
  // Fast mode exists only for Opus; on any other model the flag is ignored.
  const response: Answer = opts.fast && hasFast(params.model)
    ? await (opts.onItem ? watch(client.beta.messages.stream(fastParams)) : (client.beta.messages.parse(fastParams) as Promise<Answer>)).catch((err: unknown) => {
      if (err instanceof Anthropic.RateLimitError) { opts.onReset?.(); return standard(); }
      throw err;
    })
    : await standard();

  // The quick reader handing back nothing usable is never the person's problem: Opus reads it again.
  const usable = response.stop_reason !== 'refusal' && response.stop_reason !== 'max_tokens' && !!response.parsed_output;
  const documentReader = opts.readers?.document || MODEL;
  if (!usable && params.model !== documentReader && !opts.model) {
    opts.onReset?.();
    return extract(req, client, { ...opts, model: documentReader });
  }
  if (response.stop_reason === 'refusal') {
    return { ok: false, error: IMPORT_MESSAGES.unreadable };
  }
  if (response.stop_reason === 'max_tokens') {
    return { ok: false, error: IMPORT_MESSAGES.tooMuch };
  }
  if (!response.parsed_output) {
    return { ok: false, error: IMPORT_MESSAGES.incomplete };
  }
  return { ok: true, extraction: response.parsed_output, usage: response.usage, ...(via ? { via } : {}) };
}
