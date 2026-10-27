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
