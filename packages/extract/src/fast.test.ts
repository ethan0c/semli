import Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import { extract } from './index';

const req = { input: { kind: 'text' as const, text: 'Quiz Friday' }, context: { today: '2026-10-27', timezone: 'UTC', courses: [], employers: [] } };
const parsed = { stop_reason: 'end_turn', parsed_output: { detected_type: 'general', items: [] }, usage: {} };

function fakeClient(fast: () => Promise<unknown>) {
  const standard = vi.fn().mockResolvedValue(parsed);
  const beta = vi.fn(fast);
  return { client: { messages: { parse: standard }, beta: { messages: { parse: beta } } } as unknown as Anthropic, standard, beta };
}

describe('fast mode', () => {
  it('asks for fast speed when it is on', async () => {
    const { client, beta, standard } = fakeClient(() => Promise.resolve(parsed));
    expect((await extract(req, client, { fast: true })).ok).toBe(true);
    expect(beta.mock.calls[0]![0]).toMatchObject({ speed: 'fast', betas: ['fast-mode-2026-02-01'] });
    expect(standard).not.toHaveBeenCalled();
  });
  it('falls back to standard speed when fast mode is rate limited', async () => {
    const { client, standard } = fakeClient(() => Promise.reject(new Anthropic.RateLimitError(429, undefined, 'rate limited', new Headers())));
    expect((await extract(req, client, { fast: true })).ok).toBe(true);
    expect(standard).toHaveBeenCalledOnce();
  });
  it('passes other failures on', async () => {
    const { client } = fakeClient(() => Promise.reject(new Anthropic.BadRequestError(400, undefined, 'bad', new Headers())));
    await expect(extract(req, client, { fast: true })).rejects.toBeInstanceOf(Anthropic.BadRequestError);
  });
});
