import { afterEach, describe, expect, it, vi } from 'vitest';
import { IMPORT_MESSAGES, type ExtractRequest } from '@dayli/schema';
import { requestExtraction } from './api';

const expoFetch = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));
vi.mock('expo/fetch', () => expoFetch);

const request: ExtractRequest = {
  input: { kind: 'text', text: 'Exam tomorrow at 9' },
  context: { today: '2026-10-19', timezone: 'America/New_York', courses: [], employers: [] },
};

afterEach(() => vi.unstubAllGlobals());

describe('friendly import failures', () => {
  it('offers a next step when the connection fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect(await requestExtraction('https://semli.test', request)).toEqual({ ok: false, error: IMPORT_MESSAGES.connection });
  });

  it.each([
    [400, IMPORT_MESSAGES.request],
    [413, IMPORT_MESSAGES.tooLarge],
    [415, IMPORT_MESSAGES.unsupported],
    [429, IMPORT_MESSAGES.busy],
    [502, IMPORT_MESSAGES.unavailable],
    [504, IMPORT_MESSAGES.timeout],
  ])('explains an unreadable HTTP %i response without showing server details', async (status, error) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Proxy error</html>', { status })));
    expect(await requestExtraction('https://semli.test', request)).toEqual({ ok: false, error });
  });

  it('handles an unexpected response shape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ message: 'Internal error' })));
    expect(await requestExtraction('https://semli.test', request)).toEqual({ ok: false, error: IMPORT_MESSAGES.unavailable });
  });

  it('keeps a helpful error returned by Semli', async () => {
    const body = { ok: false, error: IMPORT_MESSAGES.request };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(body, { status: 400 })));
    expect(await requestExtraction('https://semli.test', request)).toEqual(body);
  });

  it('blocks raw server details even when the response has a valid error shape', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ok: false, error: 'SQL error: private database connection' }, { status: 502 })));
    expect(await requestExtraction('https://semli.test', request)).toEqual({ ok: false, error: IMPORT_MESSAGES.unavailable });
  });

  it('preserves the known actionable unreadable-file message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ok: false, error: IMPORT_MESSAGES.unreadable }, { status: 422 })));
    expect(await requestExtraction('https://semli.test', request)).toEqual({ ok: false, error: IMPORT_MESSAGES.unreadable });
  });
});

describe('rows as they are read', () => {
  const item = (title: string) => ({ kind: 'task', title, category: 'school', date: '2026-10-30', start: null, end: null, is_deadline: true, repeat_weekdays: [], repeat_until: null, course_code: null, evidence: title, confidence: 0.9, question: null });
  const extraction = { detected_type: 'general', employer: null, course: null, covers_from: null, covers_to: null, items: [item('Quiz'), item('Essay')] };
  /** A streamed response, its lines split across chunks the way a network delivers them. */
  const stream = (lines: object[], cut = 7) => {
    const text = lines.map((l) => JSON.stringify(l) + '\n').join('');
    const bytes = new TextEncoder().encode(text);
    return new Response(new ReadableStream({ start(c) { for (let i = 0; i < bytes.length; i += cut) c.enqueue(bytes.slice(i, i + cut)); c.close(); } }), { headers: { 'content-type': 'application/x-ndjson' } });
  };
  it('hands over rows as they arrive and returns the final response', async () => {
    expoFetch.fetch.mockResolvedValue(stream([{ type: 'item', item: item('Quiz') }, { type: 'item', item: item('Essay') }, { type: 'done', status: 200, response: { ok: true, extraction } }]));
    const seen: string[] = [];
    const res = await requestExtraction('https://semli.test', request, {}, { onItem: (it) => seen.push(it.title) });
    expect(seen).toEqual(['Quiz', 'Essay']);
    expect(res).toEqual({ ok: true, extraction });
    expect(expoFetch.fetch.mock.calls[0]![1].headers.accept).toBe('application/x-ndjson');
  });
  it('clears rows on a reset and reports a failed read readably', async () => {
    expoFetch.fetch.mockResolvedValue(stream([{ type: 'item', item: item('Quiz') }, { type: 'reset' }, { type: 'done', status: 422, response: { ok: false, error: IMPORT_MESSAGES.unreadable } }]));
    const events: string[] = [];
    const res = await requestExtraction('https://semli.test', request, {}, { onItem: (it) => events.push(it.title), onReset: () => events.push('reset') });
    expect(events).toEqual(['Quiz', 'reset']);
    expect(res).toEqual({ ok: false, error: IMPORT_MESSAGES.unreadable });
  });
  it('treats a stream that stops early as a connection problem', async () => {
    expoFetch.fetch.mockResolvedValue(stream([{ type: 'item', item: item('Quiz') }]));
    expect(await requestExtraction('https://semli.test', request, {}, { onItem: () => {} })).toEqual({ ok: false, error: IMPORT_MESSAGES.connection });
  });
  it('reads a server that answers the old way', async () => {
    expoFetch.fetch.mockResolvedValue(new Response(JSON.stringify({ ok: true, extraction }), { headers: { 'content-type': 'application/json' } }));
    expect(await requestExtraction('https://semli.test', request, {}, { onItem: () => {} })).toEqual({ ok: true, extraction });
  });
});

describe('apiBase', () => {
  it('calls www directly, so the sign-in header is never lost to a redirect', async () => {
    const { apiBase } = await import('./api');
    expect(apiBase('https://semli.app')).toBe('https://www.semli.app');
    expect(apiBase('https://semli.app/')).toBe('https://www.semli.app');
    expect(apiBase('https://www.semli.app')).toBe('https://www.semli.app');
    expect(apiBase('http://localhost:3000/')).toBe('http://localhost:3000');
    expect(apiBase('https://semli.application.dev')).toBe('https://semli.application.dev');
  });
  it('ignores a saved non-Semli address in a release build', async () => {
    const { apiBase, DEFAULT_API_URL } = await import('./api');
    expect(apiBase('http://192.168.1.20:3000', false)).toBe(DEFAULT_API_URL.replace(/\/+$/, ''));
    expect(apiBase('https://semli.app', false)).toBe('https://www.semli.app');
  });
  it('sends imports to www even when settings hold the old address', async () => {
    const fetch = vi.fn().mockRejectedValue(new TypeError('stop')); vi.stubGlobal('fetch', fetch);
    await requestExtraction('https://semli.app', request);
    expect(fetch.mock.calls[0]![0]).toBe('https://www.semli.app/api/extract');
  });
});
