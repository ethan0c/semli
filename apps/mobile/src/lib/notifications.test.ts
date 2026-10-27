import { beforeEach, describe, expect, it, vi } from 'vitest';
// vi.mock calls below are hoisted above these imports.
import { notificationPermission, trialRenews } from './notifications';

const mocks = vi.hoisted(() => ({ platform: { OS: 'ios' }, getPermissionsAsync: vi.fn() }));
vi.mock('react-native', () => ({ Platform: mocks.platform, AppState: { addEventListener: () => ({ remove: () => undefined }) } }));
vi.mock('expo-notifications', () => ({ getPermissionsAsync: mocks.getPermissionsAsync, useLastNotificationResponse: () => null }));
vi.mock('expo-router', () => ({ router: {} }));
vi.mock('react-native-purchases', () => ({ default: {} }));
vi.mock('@/lib/revenuecat', () => ({ PLUS_ENTITLEMENT: 'semli_plus', purchasesUnavailableReason: null }));
vi.mock('@/store', () => ({ useStore: { getState: () => ({}) } }));

const info = (entitlement: object | undefined) => ({ entitlements: { active: entitlement ? { semli_plus: entitlement } : {} } }) as never;

beforeEach(() => { vi.resetAllMocks(); mocks.platform.OS = 'ios'; });

describe('the trial-ends reminder', () => {
  it('is only for a free trial that will turn into a charge', () => {
    expect(trialRenews(info({ periodType: 'TRIAL', willRenew: true }))).toBe(true);
    // A returning subscriber pays today even when the product has an intro offer.
    expect(trialRenews(info({ periodType: 'NORMAL', willRenew: true }))).toBe(false);
    // Cancelled during the trial: nothing will be charged, so nothing to warn about.
    expect(trialRenews(info({ periodType: 'TRIAL', willRenew: false }))).toBe(false);
    expect(trialRenews(info(undefined))).toBe(false);
    expect(trialRenews(null)).toBe(false);
  });
});

describe('notification permission before asking', () => {
  it('tells a fresh question apart from an earlier "Don’t Allow"', async () => {
    mocks.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: true });
    expect(await notificationPermission()).toBe('ask');
    mocks.getPermissionsAsync.mockResolvedValue({ granted: false, canAskAgain: false });
    expect(await notificationPermission()).toBe('blocked');
    mocks.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true });
    expect(await notificationPermission()).toBe('granted');
  });
});
