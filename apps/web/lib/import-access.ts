import { createHash } from 'node:crypto';
import { IMPORT_MESSAGES } from '@dayli/schema';
import { rpc, supabaseEnv } from './supabase';

/*
 * Who may spend an import. The app sends its Supabase session (guests have an anonymous
 * one) and its RevenueCat id: Plus is unlimited, everyone else gets the free monthly
 * imports, counted in the database. The website demo has no session: a few previews a
 * day per hashed IP. Without Supabase configured (local development) nothing is limited.
 */

/** Must match apps/mobile/src/lib/plans.ts; the database takes all three so the two sides cannot drift. */
export const FREE_IMPORTS_PER_MONTH = 3;
export const FREE_IMPORTS_TO_START = 5;
export const START_WINDOW_DAYS = 30;
export const DEMO_PREVIEWS_PER_DAY = 5;
const PLUS_ENTITLEMENT = 'semli_plus';

export type Access =
  | { ok: true; refund: () => Promise<void>; /** A Plus subscriber: their syllabi read in fast mode. */ plus?: boolean }
  | { ok: false; status: 401 | 402 | 429; error: string };

const free = async () => {};

/** RevenueCat is the source of truth for Plus; the secret key never leaves the server. */
async function hasPlus(appUserId: string | null): Promise<boolean> {
  const secret = process.env.REVENUECAT_SECRET_KEY;
  if (!secret || !appUserId) return false;
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: { authorization: `Bearer ${secret}` },
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { subscriber?: { entitlements?: Record<string, { expires_date: string | null }> } };
  const ent = data.subscriber?.entitlements?.[PLUS_ENTITLEMENT];
  return !!ent && (ent.expires_date === null || Date.parse(ent.expires_date) > Date.now());
}

/**
 * Whose Plus to check. A signed-in account is its own RevenueCat customer (the app logs in with
 * the Supabase id), so any other id is ignored: it would let a request borrow a paying account's
 * Plus. A guest has only RevenueCat's own random anonymous id, which can't be guessed.
 */
export function purchaserFor(userId: string | null, header: string | null): string | null {
  if (!header) return null;
  if (header === userId || header.startsWith('$RCAnonymousID:')) return header;
  return null;
}

/** The platform's own header first: a client can prepend anything to x-forwarded-for. */
function clientIp(request: Request): string {
  return request.headers.get('x-real-ip') || request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

export async function checkImportAccess(request: Request): Promise<Access> {
  const base = supabaseEnv();
  if (!base) return { ok: true, refund: free };

  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || null;
  // The app always sends its RevenueCat id and a session; one arriving without a session lost it on
  // the way (a redirect drops Authorization). Ask it to sign in again rather than counting it
  // against the website's preview limit, whose message tells an app user to get the app.
  if (!token && request.headers.get('x-revenuecat-app-user-id')) return { ok: false, status: 401, error: IMPORT_MESSAGES.session };
  if (!token) {
    const ipHash = createHash('sha256').update(`semli-demo:${clientIp(request)}`).digest('hex');
    const allowed = await rpc(base, 'claim_demo', { p_ip_hash: ipHash, p_limit: DEMO_PREVIEWS_PER_DAY });
    return allowed === true ? { ok: true, refund: free } : { ok: false, status: 429, error: IMPORT_MESSAGES.demoLimit };
  }

  const user = await fetch(`${base.url}/auth/v1/user`, { headers: { apikey: base.key, authorization: `Bearer ${token}` } });
  if (!user.ok) return { ok: false, status: 401, error: IMPORT_MESSAGES.session };
  const userId = ((await user.json().catch(() => null)) as { id?: string } | null)?.id ?? null;

  if (await hasPlus(purchaserFor(userId, request.headers.get('x-revenuecat-app-user-id')))) return { ok: true, refund: free, plus: true };

  const allowed = await rpc(base, 'claim_import', { p_limit: FREE_IMPORTS_PER_MONTH, p_start_limit: FREE_IMPORTS_TO_START, p_start_days: START_WINDOW_DAYS }, token);
  if (allowed !== true) return { ok: false, status: 402, error: IMPORT_MESSAGES.quota };
  return { ok: true, refund: () => rpc(base, 'refund_import', {}, token).then(() => {}, () => {}) };
}
