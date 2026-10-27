import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// All native dependencies are mocked: exercise the shared entry-point policy directly.
import { usePlusAccess as createAccess } from './plus-access';

const mocks = vi.hoisted(() => ({
  refreshCustomerInfo: vi.fn(), presentPaywall: vi.fn(), track: vi.fn(), showToast: vi.fn(),
  customerInfo: null as { active?: boolean } | null,
  // A phone past its first thirty days, on the monthly allowance.
  usage: { month: '2026-10', imports: 0, firstImportAt: '2026-08-01T00:00:00Z', total: 9 },
}));
vi.mock('./analytics', () => ({ track: mocks.track }));
vi.mock('./revenuecat', () => ({
  hasSemliPro: (info: { active?: boolean } | null) => info?.active === true,
  purchaseErrorMessage: () => 'We couldn’t reach the store. Check your connection and try again.',
}));
vi.mock('../providers/PurchasesProvider', () => ({ usePurchases: () => mocks }));
vi.mock('../store', () => ({ useStore: { getState: () => ({ usage: mocks.usage, showToast: mocks.showToast }) } }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-19T12:00:00Z'));
  mocks.usage = { month: '2026-10', imports: 0, firstImportAt: '2026-08-01T00:00:00Z', total: 9 };
  mocks.customerInfo = null;
  mocks.refreshCustomerInfo.mockResolvedValue({ active: false });
  mocks.presentPaywall.mockResolvedValue(false);
});

afterEach(() => vi.useRealTimers());

describe('shared Plus access checks', () => {
  it('keeps the first three imports available without a store connection', async () => {
    for (const imports of [0, 1, 2]) {
      mocks.usage.imports = imports;
      expect(await createAccess().requireImportAccess()).toBe(true);
    }
    expect(mocks.refreshCustomerInfo).not.toHaveBeenCalled();
  });
  it('blocks an over-quota free user who dismisses the paywall', async () => {
    mocks.usage.imports = 3;
    expect(await createAccess().requireImportAccess()).toBe(false);
    expect(mocks.presentPaywall).toHaveBeenCalledOnce();
  });
  it('allows over-quota imports with an active entitlement or completed upgrade', async () => {
    mocks.usage.imports = 3;
    mocks.refreshCustomerInfo.mockResolvedValue({ active: true });
    expect(await createAccess().requireImportAccess()).toBe(true);
    expect(mocks.presentPaywall).not.toHaveBeenCalled();
    mocks.refreshCustomerInfo.mockResolvedValue({ active: false });
    mocks.presentPaywall.mockResolvedValue(true);
    expect(await createAccess().requireImportAccess()).toBe(true);
  });
  it('does not grant paid access when the store check fails, and says why', async () => {
    mocks.usage.imports = 3;
    mocks.refreshCustomerInfo.mockRejectedValue(new Error('Offline'));
    expect(await createAccess().requireImportAccess()).toBe(false);
    expect(mocks.presentPaywall).not.toHaveBeenCalled();
    expect(mocks.showToast).toHaveBeenCalledWith('We couldn’t reach the store. Check your connection and try again.');
  });
  it('hands the store failure to a caller with its own error line instead of a toast', async () => {
    mocks.refreshCustomerInfo.mockRejectedValue(new Error('Offline'));
    const onError = vi.fn();
    expect(await createAccess().requirePlus('canvas', { onError })).toBe(false);
    expect(onError).toHaveBeenCalledWith('We couldn’t reach the store. Check your connection and try again.');
    expect(mocks.showToast).not.toHaveBeenCalled();
  });
  it('falls back to the last customer info when the refresh fails', async () => {
    mocks.refreshCustomerInfo.mockRejectedValue(new Error('Offline'));
    mocks.customerInfo = { active: true };
    expect(await createAccess().requirePlus('urgent')).toBe(true);
    mocks.customerInfo = { active: false };
    expect(await createAccess().requirePlus('urgent')).toBe(false);
    expect(mocks.presentPaywall).toHaveBeenCalledOnce();
    expect(mocks.showToast).not.toHaveBeenCalled();
  });
  it('gates urgent items on the entitlement, not on free imports', async () => {
    expect(await createAccess().requirePlus('urgent')).toBe(false);
    expect(mocks.track).toHaveBeenCalledWith('paywall_shown', { reason: 'urgent' });
    mocks.presentPaywall.mockResolvedValue(true);
    expect(await createAccess().requirePlus('urgent')).toBe(true);
  });
  it('gates schedule updates even when free imports remain', async () => {
    expect(await createAccess().requirePlus('schedule_update')).toBe(false);
    expect(mocks.track).toHaveBeenCalledWith('paywall_shown', { reason: 'schedule_update' });
    mocks.refreshCustomerInfo.mockResolvedValue({ active: true });
    expect(await createAccess().requirePlus('schedule_update')).toBe(true);
  });
});
