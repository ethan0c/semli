import { afterEach, describe, expect, it, vi } from 'vitest';
import { IMPORT_MESSAGES } from '@dayli/schema';
import { checkImportAccess } from './import-access';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('checkImportAccess', () => {
  it('asks the app to sign in again when its session went missing, instead of the website preview limit', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://db.test'); vi.stubEnv('SUPABASE_KEY', 'anon');
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const res = await checkImportAccess(new Request('https://www.semli.app/api/extract', { method: 'POST', headers: { 'x-revenuecat-app-user-id': '$RCAnonymousID:abc' } }));
    expect(res).toEqual({ ok: false, status: 401, error: IMPORT_MESSAGES.session });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('guest network limit', () => {
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
  const req = () => new Request('https://www.semli.app/api/extract', { method: 'POST', headers: { authorization: 'Bearer t', 'x-real-ip': '10.0.0.1' } });
  const setup = (opts: { anonymous: boolean; guestAllowed?: boolean | 'error'; claim?: boolean; service?: boolean }) => {
    vi.stubEnv('SUPABASE_URL', 'https://db.test'); vi.stubEnv('SUPABASE_KEY', 'anon');
    if (opts.service !== false) vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service');
    const fetch = vi.fn(async (url: string) => {
      if (url.includes('/auth/v1/user')) return ok({ id: 'u1', is_anonymous: opts.anonymous });
      if (url.includes('claim_guest_import')) return opts.guestAllowed === 'error' ? new Response(null, { status: 404 }) : ok(opts.guestAllowed ?? true);
      if (url.includes('claim_import')) return ok(opts.claim ?? true);
      return ok(null);
    });
    vi.stubGlobal('fetch', fetch);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    return (name: string) => fetch.mock.calls.some(([u]) => String(u).includes(name));
  };

  it('never counts a signed-in student', async () => {
    const called = setup({ anonymous: false });
    expect((await checkImportAccess(req())).ok).toBe(true);
    expect(called('claim_guest_import')).toBe(false);
  });

  it('lets a guest import under the limit, and stops them with "sign in" past it, before their own allowance', async () => {
    setup({ anonymous: true, guestAllowed: true });
    expect((await checkImportAccess(req())).ok).toBe(true);
    const called = setup({ anonymous: true, guestAllowed: false });
    expect(await checkImportAccess(req())).toEqual({ ok: false, status: 429, error: IMPORT_MESSAGES.guestLimit });
    expect(called('rpc/claim_import')).toBe(false);
  });

  it('gives the network claim back when the guest has no imports of their own left', async () => {
    const called = setup({ anonymous: true, guestAllowed: true, claim: false });
    expect((await checkImportAccess(req())).ok).toBe(false);
    expect(called('refund_guest_import')).toBe(true);
  });

  it('lets imports through when the service key is missing or the database cannot answer', async () => {
    setup({ anonymous: true, service: false });
    expect((await checkImportAccess(req())).ok).toBe(true);
    setup({ anonymous: true, guestAllowed: 'error' });
    expect((await checkImportAccess(req())).ok).toBe(true);
  });
});
