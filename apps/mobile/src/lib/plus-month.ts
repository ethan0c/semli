import { count } from '@dayli/core';
import type { Item } from '@dayli/schema';

import { freeImportAllowance, type ImportUsage } from './plans';

/**
 * What Plus has done lately, in one line for the Plus page, so a subscriber sees it working
 * rather than only an absence of limits: imports this month, how many of them the free plan
 * wouldn't have covered, and the alarms Plus has ready. Null before it has done anything.
 */
export function plusMonthLine(usage: ImportUsage, items: Pick<Item, 'urgent' | 'done' | 'date'>[], today: string, at = new Date()): string | null {
  const month = at.toISOString().slice(0, 7);
  const imports = usage.month === month ? usage.imports : 0;
  const { allowed, used } = freeImportAllowance(usage, at);
  const pastFree = Math.min(imports, Math.max(0, used - allowed));
  const alarms = items.filter((it) => it.urgent && !it.done && it.date >= today).length;
  const parts = [
    imports ? `${count(imports, 'import')} this month${pastFree ? `, ${pastFree} past the free limit` : ''}` : null,
    alarms ? `${count(alarms, 'urgent alarm')} ready` : null,
  ].filter(Boolean);
  return parts.length ? `${parts.join(' · ')}.` : null;
}
