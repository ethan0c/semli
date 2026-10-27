import { track } from './analytics';
import { reportError } from './errors';
import { hasSemliPro, purchaseErrorMessage } from './revenuecat';
import { hasFreeImports } from './plans';
import { setPlusStatus } from './plus-status';
import { usePurchases } from '../providers/PurchasesProvider';
import { useStore } from '../store';

type PlusReason = 'quota' | 'schedule_update' | 'canvas' | 'urgent';

/**
 * Every paid entry point checks the store entitlement; trial preferences grant no access.
 * The check never rejects (Oct 27, 2026): callers awaited it without a catch, so an offline
 * store check failed silently or surfaced as the caller's own error. A failed refresh falls
 * back to the last customer info this session saw; with none, Plus stays off and the store
 * failure is shown, through `onError` when the caller has a place for it, else as a toast.
 */
export function usePlusAccess() {
  const { customerInfo, refreshCustomerInfo, presentPaywall } = usePurchases();

  async function requirePlus(reason: PlusReason, options: { onError?: (message: string) => void } = {}): Promise<boolean> {
    let info = customerInfo ?? null;
    try {
      info = await refreshCustomerInfo();
    } catch (failure) {
      if (!info) {
        const message = purchaseErrorMessage(failure, 'plus.refresh');
        if (message) {
          if (options.onError) options.onError(message);
          else useStore.getState().showToast(message);
        }
        return false;
      }
      reportError('plus.refresh', failure);
    }
    if (hasSemliPro(info)) {
      // Code outside React (alarms) reads this; the provider's effect sets it a render later,
      // after a caller that goes straight on to enable ringing alarms has already asked.
      setPlusStatus('active');
      return true;
    }
    track('paywall_shown', { reason });
    return presentPaywall();
  }

  async function requireImportAccess(options: { onError?: (message: string) => void } = {}): Promise<boolean> {
    if (hasFreeImports(useStore.getState().usage)) return true;
    return requirePlus('quota', options);
  }

  return { requirePlus, requireImportAccess };
}
