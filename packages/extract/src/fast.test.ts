import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { extract, MODEL, QUICK_MODEL } from './index';

const context = { today: '2026-10-27', timezone: 'UTC', courses: [], employers: [] };
const text = { input: { kind: 'text' as const, text: 'Quiz Friday' }, context };
const pdf = { input: { kind: 'pdf' as const, data: 'JVBERi0x' }, context };
const parsed = { stop_reason: 'end_turn', parsed_output: { detected_type: 'general', items: [] }, usage: {} };

function fakeClient(fast: () => Promise<unknown>, standard: (p: { model: string }) => Promise<unknown> = () => Promise.resolve(parsed)) {
  const std = vi.fn(standard);
  const beta = vi.fn(fast as (params: Record<string, unknown>) => Promise<unknown>);
  return { client: { messages: { parse: std }, beta: { messages: { parse: beta } } } as unknown as Anthropic, standard: std, beta };
}

describe('who reads what', () => {
  it('reads messages and screenshots on the quick model, documents on Opus', async () => {
    const { client, standard } = fakeClient(() => Promise.resolve(parsed));
    await extract(text, client);
    await extract(pdf, client);
    expect(standard.mock.calls.map((c) => c[0].model)).toEqual([QUICK_MODEL, MODEL]);
  });
  it('has Opus read again when the quick model declines', async () => {
    const { client, standard } = fakeClient(() => Promise.resolve(parsed), (p) => Promise.resolve(p.model === QUICK_MODEL ? { ...parsed, stop_reason: 'refusal', parsed_output: null } : parsed));
    expect((await extract(text, client)).ok).toBe(true);
    expect(standard.mock.calls.map((c) => c[0].model)).toEqual([QUICK_MODEL, MODEL]);
  });
  it('never asks the quick model for fast mode', async () => {
    const { client, beta } = fakeClient(() => Promise.resolve(parsed));
    await extract(text, client, { fast: true });
    expect(beta).not.toHaveBeenCalled();
  });
});

describe('fast mode on documents', () => {
  it('asks for fast speed when it is on', async () => {
    const { client, beta, standard } = fakeClient(() => Promise.resolve(parsed));
    expect((await extract(pdf, client, { fast: true })).ok).toBe(true);
    expect(beta.mock.calls[0]![0]).toMatchObject({ model: MODEL, speed: 'fast', betas: ['fast-mode-2026-02-01'] });
    expect(standard).not.toHaveBeenCalled();
  });
  it('falls back to standard speed when fast mode is rate limited', async () => {
    const { client, standard } = fakeClient(() => Promise.reject(new Anthropic.RateLimitError(429, undefined, 'rate limited', new Headers())));
    expect((await extract(pdf, client, { fast: true })).ok).toBe(true);
    expect(standard).toHaveBeenCalledOnce();
  });
  it('passes other failures on', async () => {
    const { client } = fakeClient(() => Promise.reject(new Anthropic.BadRequestError(400, undefined, 'bad', new Headers())));
    await expect(extract(pdf, client, { fast: true })).rejects.toBeInstanceOf(Anthropic.BadRequestError);
  });
});

describe('readers set on the server', () => {
  it('uses the models the server names', async () => {
    const { client, standard } = fakeClient(() => Promise.resolve(parsed));
    const readers = { quick: 'claude-sonnet-5-5', document: 'claude-opus-5' };
    await extract(text, client, { readers });
    await extract(pdf, client, { readers });
    expect(standard.mock.calls.map((c) => c[0].model)).toEqual(['claude-sonnet-5-5', 'claude-opus-5']);
  });
});

describe('streaming', () => {
  const answer = { detected_type: 'general', employer: null, course: null, covers_from: null, covers_to: null, items: [
    { kind: 'task', title: 'Quiz 1', category: 'school', date: '2026-10-30', start: null, end: null, is_deadline: true, repeat_weekdays: [], repeat_until: null, course_code: null, evidence: 'Quiz Friday', confidence: 0.9, question: null },
    { kind: 'task', title: 'Essay', category: 'school', date: '2026-11-02', start: null, end: null, is_deadline: true, repeat_weekdays: [], repeat_until: null, course_code: null, evidence: 'Essay Monday', confidence: 0.9, question: null },
  ] };
  /** A fake stream that writes the answer in small pieces, then finishes. */
  const fakeStream = (final: object) => {
    const listeners: ((d: string, s: string) => void)[] = [];
    return {
      on(_event: 'text', listener: (d: string, s: string) => void) { listeners.push(listener); return this; },
      async finalMessage() {
        const text = JSON.stringify(answer);
        for (let i = 0; i < text.length; i += 9) listeners.forEach((l) => l(text.slice(i, i + 9), text.slice(0, i + 9)));
        return final;
      },
    };
  };
  it('hands over items as they are written and returns the validated answer', async () => {
    const seen: string[] = [];
    const client = { messages: { stream: vi.fn(() => fakeStream({ stop_reason: 'end_turn', parsed_output: answer, usage: {} })) } } as unknown as Anthropic;
    const r = await extract(text, client, { onItem: (it) => seen.push(it.title) });
    expect(seen).toEqual(['Quiz 1', 'Essay']);
    expect(r.ok && r.extraction.items).toHaveLength(2);
  });
  it('tells the app to clear its rows when Opus starts again after the quick reader', async () => {
    const events: string[] = [];
    const stream = vi.fn((p: { model: string }) => fakeStream(p.model === QUICK_MODEL ? { stop_reason: 'refusal', parsed_output: null, usage: {} } : { stop_reason: 'end_turn', parsed_output: answer, usage: {} }));
    const client = { messages: { stream } } as unknown as Anthropic;
    const r = await extract(text, client, { onItem: (it) => events.push(it.title), onReset: () => events.push('reset') });
    expect(r.ok).toBe(true);
    expect(events).toEqual(['Quiz 1', 'Essay', 'reset', 'Quiz 1', 'Essay']);
  });
});
