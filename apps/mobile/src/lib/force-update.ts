import { apiBase } from './api';
import { reportError } from './errors';

/** How long the check may take. It runs behind the open app, so nobody waits on it. */
const TIMEOUT_MS = 5000;

/** Plain dotted numbers, or null: a value that can't be read must never lock anyone out. */
function parts(version: string): number[] | null {
  return /^\d+(\.\d+)*$/.test(version.trim()) ? version.trim().split('.').map(Number) : null;
}

/** "1.1.3" is older than "1.2" and not older than "1.1.3.0". False when either can't be read. */
export function isOlderThan(version: string, minimum: string): boolean {
  const have = parts(version);
  const need = parts(minimum);
  if (!have || !need) return false;
  for (let i = 0; i < Math.max(have.length, need.length); i++) {
    const gap = (have[i] ?? 0) - (need[i] ?? 0);
    if (gap) return gap < 0;
  }
  return false;
}

/**
 * The oldest version the server still accepts, or null. Null also covers every failure: an offline
 * phone or a bad deploy opens the app as usual. Being offline is expected, so only an answer from
 * the server that can't be read is reported.
 */
export async function minimumVersion(load: typeof fetch = fetch): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await load(`${apiBase(undefined)}/api/app-version`, { signal: controller.signal });
    if (!res.ok) return null;
    const body = (await res.json()) as { minIosVersion?: unknown };
    return typeof body.minIosVersion === 'string' ? body.minIosVersion : null;
  } catch (error) {
    if (error instanceof SyntaxError) reportError('updates.minimum_version', error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
