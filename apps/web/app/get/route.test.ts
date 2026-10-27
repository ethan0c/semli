import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { APP_STORE_URL, appStoreLink } from '../../lib/site';
import { GET } from './route';

vi.mock('next/navigation', () => ({ redirect: vi.fn((to: string) => { throw new Error(`REDIRECT ${to}`); }) }));

const target = async (url: string) => {
  try {
    await GET(new Request(url));
  } catch (e) {
    return (e as Error).message.replace('REDIRECT ', '');
  }
  throw new Error('did not redirect');
};

describe('/get', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubEnv('SUPABASE_URL', 'https://db.test');
    vi.stubEnv('SUPABASE_KEY', 'sb_publishable_test');
    vi.stubGlobal('fetch', fetchMock.mockResolvedValue(new Response(null, { status: 204 })));
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

  it('goes to the App Store listing and counts the click', async () => {
    expect(await target('https://semli.app/get?r=jess')).toBe(APP_STORE_URL);
    expect(fetchMock).toHaveBeenCalledWith('https://db.test/rest/v1/rpc/log_beta_click', expect.objectContaining({ body: JSON.stringify({ p_ref: 'jess' }) }));
  });

  it('carries the tag to the App Store as a campaign once the provider token is set', async () => {
    vi.stubEnv('APP_STORE_PROVIDER_TOKEN', '123456');
    expect(await target('https://semli.app/get?r=email-semester')).toBe(`${APP_STORE_URL}?pt=123456&ct=email-semester&mt=8`);
    expect(await target('https://semli.app/get')).toBe(APP_STORE_URL);
  });

  it('ignores a provider token that is not a number', async () => {
    vi.stubEnv('APP_STORE_PROVIDER_TOKEN', 'abc');
    expect(await target('https://semli.app/get?r=jess')).toBe(APP_STORE_URL);
  });

  it('keeps campaign names inside Apple\'s 40 characters', () => {
    expect(appStoreLink('x'.repeat(64), '1')).toBe(`${APP_STORE_URL}?pt=1&ct=${'x'.repeat(40)}&mt=8`);
  });

  it('still redirects when the click cannot be counted', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await target('https://semli.app/get')).toBe(APP_STORE_URL);
  });
});

describe('/beta', () => {
  it('is the same link as /get, for what was posted and printed before launch', async () => {
    const beta = await import('../beta/route');
    expect(beta.GET).toBe(GET);
  });
});
