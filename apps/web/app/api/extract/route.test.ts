import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { IMPORT_MESSAGES } from '@dayli/schema';
import { extract } from '@dayli/extract';
import { POST } from './route';

vi.mock('@dayli/extract', () => ({ extract: vi.fn(), MODEL: 'claude-opus-5-5', PROMPT_VERSION: 'test' }));

const request = () => new Request('https://semli.test/api/extract', {
  method: 'POST',
  body: JSON.stringify({
    input: { kind: 'text', text: 'Exam tomorrow at 9' },
    context: { today: '2026-10-19', timezone: 'America/New_York', courses: [], employers: [] },
  }),
});

beforeEach(() => vi.clearAllMocks());

describe('import API errors', () => {
  it.each(['not json', '{}'])('gives a readable response to incomplete input: %s', async (body) => {
    const res = await POST(new Request('https://semli.test/api/extract', { method: 'POST', body }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: IMPORT_MESSAGES.request });
    expect(extract).not.toHaveBeenCalled();
  });

  it.each([
    [Anthropic.AuthenticationError, 500, IMPORT_MESSAGES.unavailable],
    [Anthropic.RateLimitError, 429, IMPORT_MESSAGES.busy],
    [Anthropic.APIConnectionError, 502, IMPORT_MESSAGES.unavailable],
  ])('keeps provider details out of the response for %s', async (ErrorType, status, error) => {
    vi.mocked(extract).mockRejectedValue(Object.setPrototypeOf(new Error('Provider details'), ErrorType.prototype));
    const res = await POST(request());
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ ok: false, error });
  });

  it('keeps missing API credentials out of the response', async () => {
    vi.mocked(extract).mockRejectedValue(new Error('Set ANTHROPIC_API_KEY authentication method'));
    const res = await POST(request());
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: IMPORT_MESSAGES.unavailable });
  });
});

describe('import limits', () => {
  const env = { SUPABASE_URL: 'https://db.test', SUPABASE_KEY: 'sb_publishable_test', REVENUECAT_SECRET_KEY: 'sk_test' };
  const withAuth = (headers: Record<string, string>) => new Request('https://semli.test/api/extract', {
    method: 'POST',
    headers,
    body: JSON.stringify({ input: { kind: 'text', text: 'Exam tomorrow at 9' }, context: { today: '2026-10-19', timezone: 'America/New_York', courses: [], employers: [] } }),
  });
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

  beforeEach(() => {
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    vi.mocked(extract).mockResolvedValue({ ok: true, extraction: { detected_type: 'general', employer: null, course: null, covers_from: null, covers_to: null, items: [] } });
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it('lets Plus through without counting', async () => {
    const fetchMock = vi.fn(async (url: string) => url.includes('/auth/v1/user') ? ok({ id: 'u1' })
      : url.includes('revenuecat') ? ok({ subscriber: { entitlements: { semli_plus: { expires_date: '2999-01-01T00:00:00Z' } } } })
      : ok(false));
    vi.stubGlobal('fetch', fetchMock);
    const res = await POST(withAuth({ authorization: 'Bearer t', 'x-revenuecat-app-user-id': 'u1' }));
    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('claim_import'))).toBe(false);
  });

  it('never lends another account’s Plus to a signed-in user', async () => {
    const fetchMock = vi.fn(async (url: string) => url.includes('/auth/v1/user') ? ok({ id: 'u1' })
      : url.includes('revenuecat') ? ok({ subscriber: { entitlements: { semli_plus: { expires_date: '2999-01-01T00:00:00Z' } } } })
      : ok(false));
    vi.stubGlobal('fetch', fetchMock);
    const res = await POST(withAuth({ authorization: 'Bearer t', 'x-revenuecat-app-user-id': 'someone-who-pays' }));
    expect(res.status).toBe(402);
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('revenuecat'))).toBe(false);
  });

  it('accepts a guest’s purchase under RevenueCat’s anonymous id', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('/auth/v1/user') ? ok({ id: 'anon-1' })
      : url.includes('revenuecat') ? ok({ subscriber: { entitlements: { semli_plus: { expires_date: null } } } })
      : ok(false)));
    const res = await POST(withAuth({ authorization: 'Bearer t', 'x-revenuecat-app-user-id': '$RCAnonymousID:abc123' }));
    expect(res.status).toBe(200);
  });

  it('stops a free user past the monthly imports before reading', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('/auth/v1/user') ? ok({ id: 'u1' }) : url.includes('revenuecat') ? ok({ subscriber: { entitlements: {} } }) : ok(false)));
    const res = await POST(withAuth({ authorization: 'Bearer t' }));
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({ ok: false, error: IMPORT_MESSAGES.quota });
    expect(extract).not.toHaveBeenCalled();
  });

  it('gives the import back when the read fails', async () => {
    const fetchMock = vi.fn(async (url: string) => url.includes('/auth/v1/user') ? ok({ id: 'u1' }) : url.includes('claim_import') ? ok(true) : ok(null));
    vi.stubGlobal('fetch', fetchMock);
    vi.mocked(extract).mockRejectedValue(new Error('boom'));
    await POST(withAuth({ authorization: 'Bearer t' }));
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('refund_import'))).toBe(true);
  });

  it('rejects a session the database does not know', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 401 })));
    const res = await POST(withAuth({ authorization: 'Bearer forged' }));
    expect(res.status).toBe(401);
    expect(extract).not.toHaveBeenCalled();
  });

  it('limits the website demo per visitor', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok(false)));
    const res = await POST(withAuth({ 'x-forwarded-for': '1.2.3.4' }));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ ok: false, error: IMPORT_MESSAGES.demoLimit });
  });
});
