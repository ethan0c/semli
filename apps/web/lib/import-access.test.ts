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
