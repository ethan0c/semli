import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { isCanvasFeed } from '../../../lib/canvas-feed';
import { POST } from './route';

const FEED = 'https://school.instructure.com/feeds/calendars/user_abc.ics';
const request = (body: object, headers: Record<string, string> = { authorization: 'Bearer t' }) =>
  new Request('https://www.semli.app/api/canvas-feed', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

describe('isCanvasFeed', () => {
  it('takes a Canvas feed on a school domain and nothing else', () => {
    expect(isCanvasFeed(FEED)).toBe(true);
    expect(isCanvasFeed('https://canvas.uni.edu/feeds/calendars/user_abc.ics?x=1')).toBe(true);
    expect(isCanvasFeed('http://school.instructure.com/feeds/calendars/user_abc.ics')).toBe(false);
    expect(isCanvasFeed('https://169.254.169.254/feeds/calendars/a.ics')).toBe(false);
    expect(isCanvasFeed('https://localhost/feeds/calendars/a.ics')).toBe(false);
    expect(isCanvasFeed('https://school.instructure.com:8443/feeds/calendars/a.ics')).toBe(false);
    expect(isCanvasFeed('https://school.instructure.com/api/v1/users/self')).toBe(false);
  });
});

describe('POST /api/canvas-feed', () => {
  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('SUPABASE_KEY', 'publishable');
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it('hands back the calendar for someone signed in', async () => {
    const fetchMock = vi.fn(async (url: string) => url.includes('/auth/v1/user') ? new Response('{"id":"u1"}') : new Response('BEGIN:VCALENDAR\r\nEND:VCALENDAR'));
    vi.stubGlobal('fetch', fetchMock);
    const res = await POST(request({ url: FEED }));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('BEGIN:VCALENDAR');
    expect(fetchMock.mock.calls.find(([u]) => u === FEED)![1]).toMatchObject({ redirect: 'manual' });
  });

  it('refuses without a session, and never fetches a link that isn’t a Canvas feed', async () => {
    const fetchMock = vi.fn(async () => new Response('{"id":"u1"}'));
    vi.stubGlobal('fetch', fetchMock);
    const signedOut = await POST(request({ url: FEED }, {}));
    expect(signedOut.status).toBe(401);
    expect(await signedOut.json()).toEqual({ ok: false, reason: 'session' });
    expect((await POST(request({ url: 'https://169.254.169.254/feeds/calendars/a.ics' }))).status).toBe(400);
    expect(fetchMock.mock.calls.every(([u]) => String(u).includes('/auth/v1/user'))).toBe(true);
  });

  it('tells an expired session apart from Canvas, and a down Supabase from both', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"msg":"JWT expired"}', { status: 401 })));
    const expired = await POST(request({ url: FEED }));
    expect(expired.status).toBe(401);
    expect(await expired.json()).toEqual({ ok: false, reason: 'session' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 503 })));
    expect((await POST(request({ url: FEED }))).status).toBe(502);
  });

  it('passes on Canvas turning the link down, so the app can say so', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url.includes('/auth/v1/user') ? new Response('{}') : new Response('', { status: 404 })));
    expect((await POST(request({ url: FEED }))).status).toBe(404);
  });
});
