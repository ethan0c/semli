import { formatRange, monthDay, suggestReschedule, weekdayShort } from '@dayli/core';
import type { Item } from '@dayli/schema';
import { useState } from 'react';

import { track } from '@/lib/analytics';
import { feedback } from '@/lib/feedback';
import { useNow } from '@/lib/now';
import { realRecords } from '@/lib/planner-preview';
import { hasSemliPro, purchaseErrorMessage } from '@/lib/revenuecat';
import { usePurchases } from '@/providers/PurchasesProvider';
import { useStore } from '@/store';

/**
 * The Plus suggestion for a flexible event that overlaps another, and the confirmed move to it.
 * The item page and Plan's day share it, so both recheck access and the slot before moving.
 */
export function useReschedule(item: Item | null, items: Item[]) {
  const now = useNow();
  const { isPlus, loading, refreshCustomerInfo, presentPaywall } = usePurchases();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const suggestion = item && isPlus ? suggestReschedule(item, items, now) : null;
  const label = suggestion ? `${suggestion.date === now.date ? 'Today' : `${weekdayShort(suggestion.date)}, ${monthDay(suggestion.date)}`} · ${formatRange(suggestion.start, suggestion.end)}` : '';

  async function openPlus() {
    setNotice(null);
    track('paywall_shown', { reason: 'rescheduling' });
    try { await presentPaywall(); }
    catch (error) { setNotice(purchaseErrorMessage(error)); }
  }

  async function apply() {
    if (!item || !suggestion || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      // Recheck paid access and availability before changing the selected occurrence.
      const info = await refreshCustomerInfo();
      if (!hasSemliPro(info)) {
        await openPlus();
        return;
      }
      const store = useStore.getState();
      const latest = store.items[item.id];
      // The same clock the suggestion was made with, so only a real change to the plan can disagree with it.
      const slot = latest && suggestReschedule(latest, realRecords(Object.values(store.items)), now);
      if (!latest || latest.date !== item.date || latest.start !== item.start || latest.end !== item.end
        || !slot || slot.start !== suggestion.start || slot.end !== suggestion.end || slot.date !== suggestion.date) {
        setNotice('Your calendar changed. Review the updated time before moving it.');
        return;
      }
      store.updateItem(item.id, slot);
      const batchId = useStore.getState().batches[0]?.id;
      store.showToast(`Moved ${latest.title} to ${formatRange(slot.start, slot.end)} with Plus.`, batchId);
      feedback('success');
    } catch (error) {
      setNotice(purchaseErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return { isPlus, loading, suggestion, label, busy, notice, apply, openPlus };
}
