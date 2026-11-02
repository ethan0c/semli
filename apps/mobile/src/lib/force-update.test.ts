import { describe, expect, it, vi } from 'vitest';

vi.mock('./errors', () => ({ reportError: vi.fn() }));
vi.mock('./api', () => ({ apiBase: () => 'https://www.semli.app' }));

import { isOlderThan, minimumVersion } from './force-update';

const answer = (body: string, status = 200) => vi.fn(async () => new Response(body, { status })) as unknown as typeof fetch;

describe('isOlderThan', () => {
  it('compares each part as a number', () => {
    expect(isOlderThan('1.1.3', '1.2.0')).toBe(true);
    expect(isOlderThan('1.9.0', '1.10.0')).toBe(true);
    expect(isOlderThan('1.10.0', '1.9.0')).toBe(false);
  });
  it('treats the same version as new enough, however it is written', () => {
    expect(isOlderThan('1.1.3', '1.1.3')).toBe(false);
    expect(isOlderThan('1.2', '1.2.0')).toBe(false);
    expect(isOlderThan('1.2.0', '1.2')).toBe(false);
  });
  it('never blocks on a value it cannot read', () => {
    expect(isOlderThan('1.1.3', 'latest')).toBe(false);
    expect(isOlderThan('1.1.3-beta', '9.0.0')).toBe(false);
    expect(isOlderThan('1.1.3', '')).toBe(false);
  });
});

describe('minimumVersion', () => {
  it('reads the version the server names', async () => {
    const load = answer('{"minIosVersion":"1.2.0"}');
    expect(await minimumVersion(load)).toBe('1.2.0');
    expect(load).toHaveBeenCalledWith('https://www.semli.app/api/app-version', expect.anything());
  });
  it('is null when no minimum is set', async () => {
    expect(await minimumVersion(answer('{"minIosVersion":null}'))).toBeNull();
  });
  it('is null for a failed request, a server error or an unreadable answer', async () => {
    const offline = vi.fn(async () => { throw new TypeError('Network request failed'); }) as unknown as typeof fetch;
    expect(await minimumVersion(offline)).toBeNull();
    expect(await minimumVersion(answer('oops', 500))).toBeNull();
    expect(await minimumVersion(answer('<html>'))).toBeNull();
    expect(await minimumVersion(answer('{"minIosVersion":3}'))).toBeNull();
  });
});
