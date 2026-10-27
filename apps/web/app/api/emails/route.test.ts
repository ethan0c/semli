import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { templateFor } from '../../../lib/transactional-email';
import { GET, POST } from './route';

const row = { id: 7, email: 'ama@school.edu', kind: 'account_deleted' as const, name: 'Ama Owusu', created_at: '2026-10-23T10:00:00Z' };
const ok = (body: unknown, status = 200) => new Response(body === null ? null : JSON.stringify(body), { status });

describe('the template each row is sent with', () => {
  it('names the published template and passes the first name', () => {
    expect(templateFor(row)).toEqual({ id: 'account-deleted', variables: { NAME: 'Ama' } });
    expect(templateFor({ ...row, kind: 'welcome' })).toEqual({ id: 'welcome', variables: { NAME: 'Ama' } });
  });
  it('leaves the name out so the template says "there"', () => {
    expect(templateFor({ ...row, name: null }).variables).toEqual({});
    expect(templateFor({ ...row, name: '   ' }).variables).toEqual({});
  });
});

describe('the outbox sender', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'https://db.test/');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service');
    vi.stubEnv('RESEND_API_KEY', 're_test');
    vi.stubEnv('CRON_SECRET', 'cron');
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it('sends each queued row once and deletes it', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
      url.includes('email_outbox?select') ? ok([row]) : url.includes('resend.com') ? ok({ id: 'e1' }) : init?.method === 'DELETE' ? ok(null, 204) : ok(null, 404));
    const res = await POST();
    expect(await res.json()).toEqual({ ok: true, sent: 1, failed: 0 });
    const send = fetchMock.mock.calls.find(([u]) => String(u).includes('resend.com'))!;
    expect(JSON.parse(String((send[1] as RequestInit).body))).toEqual({ to: ['ama@school.edu'], template: { id: 'account-deleted', variables: { NAME: 'Ama' } } });
    expect((send[1] as RequestInit).headers).toMatchObject({ 'idempotency-key': 'outbox-7' });
    expect(fetchMock.mock.calls.some(([u, i]) => String(u).includes('id=eq.7') && (i as RequestInit).method === 'DELETE')).toBe(true);
  });

  it('asks only for account emails and welcomes queued at least 45 minutes ago', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-27T12:00:00Z'));
    fetchMock.mockImplementation(async () => ok([]));
    await POST();
    const read = String(fetchMock.mock.calls[0][0]);
    expect(decodeURIComponent(read)).toContain('or=(kind.neq.welcome,created_at.lte.2026-10-27T11:15:00.000Z)');
    vi.useRealTimers();
  });

  it('keeps a row whose send failed, to retry next run', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockImplementation(async (url: string) => url.includes('email_outbox?select') ? ok([row]) : ok({ message: 'nope' }, 500));
    expect(await (await POST()).json()).toEqual({ ok: true, sent: 0, failed: 1 });
    expect(fetchMock.mock.calls.some(([, i]) => (i as RequestInit | undefined)?.method === 'DELETE')).toBe(false);
  });

  const groups = { data: [{ id: 'g-users', name: 'App users' }, { id: 'g-survey', name: 'Survey' }, { id: 'g-wait', name: 'Waitlist' }] };
  const calls = (method: string) => fetchMock.mock.calls.filter(([, i]) => ((i as RequestInit | undefined)?.method ?? 'GET') === method).map(([u]) => String(u));

  function resendWith(contact: (url: string, method: string) => Response, segments = () => ok(groups)) {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      if (url.includes('email_outbox?select')) return ok([{ ...row, kind: 'welcome' }]);
      if (url.includes('email_outbox')) return ok(null, 204);
      if (url.endsWith('/emails')) return ok({ id: 'e1' });
      if (url.endsWith('/segments')) return segments();
      return contact(url, method);
    });
  }

  it('puts a welcomed address in App users', async () => {
    resendWith((url, method) => (method === 'GET' ? ok({ message: 'Contact not found' }, 404) : ok({ id: 'c1' }, 201)));
    expect(await (await POST()).json()).toEqual({ ok: true, sent: 1, failed: 0 });
    const create = fetchMock.mock.calls.find(([u, i]) => String(u).endsWith('/contacts') && (i as RequestInit).method === 'POST')!;
    expect(JSON.parse(String((create[1] as RequestInit).body))).toEqual({ email: 'ama@school.edu', first_name: 'Ama', properties: { source: 'app' }, segments: [{ id: 'g-users' }] });
    expect(calls('DELETE').filter((u) => u.includes('resend.com'))).toEqual([]);
  });

  it('moves an existing contact to App users without overwriting it, so an unsubscribe holds and nobody gets a broadcast twice', async () => {
    resendWith(() => ok({ id: 'c1', unsubscribed: true }, 200));
    await POST();
    expect(calls('POST').some((u) => u.endsWith('/contacts'))).toBe(false);
    expect(calls('POST')).toContain('https://api.resend.com/contacts/ama%40school.edu/segments/g-users');
    expect(calls('DELETE')).toEqual(expect.arrayContaining([
      'https://api.resend.com/contacts/ama%40school.edu/segments/g-survey',
      'https://api.resend.com/contacts/ama%40school.edu/segments/g-wait',
    ]));
  });

  it('removes a deleted account from Resend', async () => {
    fetchMock.mockImplementation(async (url: string, init?: RequestInit) =>
      url.includes('email_outbox?select') ? ok([row]) : url.includes('email_outbox') ? ok(null, 204) : init?.method === 'DELETE' ? ok({ message: 'Contact not found' }, 404) : ok({ id: 'e1' }));
    expect(await (await POST()).json()).toEqual({ ok: true, sent: 1, failed: 0 });
    expect(calls('DELETE')).toContain('https://api.resend.com/contacts/ama%40school.edu');
  });

  it('still clears the row when the contact update fails, so the welcome is never sent twice', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const restricted = () => ok({ name: 'restricted_api_key' }, 401);
    resendWith(restricted, restricted);
    expect(await (await POST()).json()).toEqual({ ok: true, sent: 1, failed: 0 });
    expect(calls('DELETE').some((u) => u.includes('id=eq.7'))).toBe(true);
    expect(log).toHaveBeenCalledWith('[emails.contacts]', { code: 'resend_contacts_failed', status: 401, kind: 'welcome' });
    expect(JSON.stringify(log.mock.calls)).not.toContain('ama@school.edu');
  });

  it('lets only the cron secret through GET', async () => {
    fetchMock.mockImplementation(async () => ok([]));
    expect((await GET(new Request('https://semli.test/api/emails'))).status).toBe(401);
    expect((await GET(new Request('https://semli.test/api/emails', { headers: { authorization: 'Bearer cron' } }))).status).toBe(200);
  });
});
