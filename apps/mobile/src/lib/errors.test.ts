import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { friendlyError, reportError, withErrorLogging } from './errors';

const mocks = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock('@sentry/react-native', () => mocks);
beforeEach(() => { vi.spyOn(console, 'info').mockImplementation(() => {}); vi.stubEnv('EXPO_PUBLIC_SENTRY_DSN', ''); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); mocks.captureException.mockReset(); });

describe('error reporting boundary', () => {
  it('shows only the supplied product copy and logs the technical operation, code and status', () => {
    const error = { code: 'PGRST205', status: 404, message: 'relation plans does not exist', request: { password: 'secret' } };
    expect(friendlyError(error, 'We couldn’t back up your plan. Please try again.', 'cloud.backup')).toBe('We couldn’t back up your plan. Please try again.');
    expect(console.info).toHaveBeenCalledWith('[Semli error]', expect.objectContaining({ operation: 'cloud.backup', code: 'PGRST205', status: 404, message: 'relation plans does not exist' }));
    expect(JSON.stringify(vi.mocked(console.info).mock.calls)).not.toContain('secret');
  });
  it('does not report the same exception again when it reaches a screen', () => {
    const error = new Error('native scheduling failed');
    reportError('alarms.synchronize', error); friendlyError(error, 'Please try again.', 'alarms.settings');
    expect(console.info).toHaveBeenCalledTimes(1);
  });
  it('preserves failures for the caller so an action cannot report false success', async () => {
    const error = new Error('native rejected notification');
    await expect(withErrorLogging('reminders.send_test', () => Promise.reject(error))).rejects.toBe(error);
    expect(console.info).toHaveBeenCalledWith('[Semli error]', expect.objectContaining({ operation: 'reminders.send_test' }));
  });
  it('cannot break recovery when diagnostic serialization fails', () => {
    const error = Object.defineProperty({}, 'message', { get: () => { throw new Error('bad getter'); } });
    expect(friendlyError(error, 'Try again.', 'unexpected')).toBe('Try again.');
  });
  it('sends only a sanitized exception to configured Sentry', async () => {
    vi.stubEnv('EXPO_PUBLIC_SENTRY_DSN', 'configured');
    const original = Object.assign(new Error('password=private-value at https://school.test/secret'), { code: 'network_error', status: 503, request: { password: 'private-value' } });
    reportError('cloud.restore', original);
    await vi.dynamicImportSettled();
    const [safe, context] = mocks.captureException.mock.lastCall!;
    expect(safe).not.toBe(original); expect(safe.message).not.toMatch(/private-value|school.test/);
    expect(context).toMatchObject({ tags: { operation: 'cloud.restore', error_code: 'network_error' }, extra: { status: 503 } });
  });
});

describe('scrubUrl', () => {
  it('keeps only the origin of a calendar feed, and never a query', async () => {
    const { scrubUrl, scrubUrls } = await import('./errors');
    expect(scrubUrl('https://canvas.pomona.edu/feeds/calendars/user_abc123.ics')).toBe('https://canvas.pomona.edu');
    expect(scrubUrl('https://uga.view.usg.edu/d2l/le/calendar/feed/user/feed.ics?token=secret')).toBe('https://uga.view.usg.edu');
    expect(scrubUrl('https://www.semli.app/api/extract?x=1')).toBe('https://www.semli.app/api/extract');
    expect(scrubUrls('GET https://school.instructure.com/feeds/calendars/user_x.ics')).toBe('GET https://school.instructure.com');
  });
});
