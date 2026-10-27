import { createHash } from 'node:crypto';
import { IMPORT_MESSAGES } from '@dayli/schema';
import { rpc, serviceEnv, supabaseEnv } from './supabase';

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
/**
 * Free imports from guests (not signed in) per network per day (Oct 27, 2026). A guest is free to
 * make, so this is what stops a script minting guests to spend the AI budget. A dorm or campus
 * network shares it; past it, a guest sees "sign in to keep going", and signing in lifts it.
 * Signed-in and Plus users never count against it.
 */
export const GUEST_IMPORTS_PER_IP_PER_DAY = 20;
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
  const ip = request.headers.get('x-real-ip') || request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  return networkOf(ip);
}

/**
 * The network an address belongs to, for the per-network limits. An IPv6 address counts by its
 * /64, the block one home or phone is given; otherwise one connection holds billions of addresses
 * and each would start a fresh count (Oct 27, 2026). IPv4 addresses count as they are.
 */
export function networkOf(ip: string): string {
  if (!ip.includes(':')) return ip;
  const [head, tail = ''] = ip.toLowerCase().split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const full = ip.includes('::') ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right] : left;
  return `${full.slice(0, 4).map((h) => h.replace(/^0+(?=.)/, '')).join(':')}::/64`;
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
    // Server-only (Oct 27, 2026). Without the service key the preview is off, never unlimited.
    const service = serviceEnv();
    if (!service) return { ok: false, status: 429, error: IMPORT_MESSAGES.demoLimit };
    const allowed = await rpc(service, 'claim_demo', { p_ip_hash: ipHash, p_limit: DEMO_PREVIEWS_PER_DAY });
    return allowed === true ? { ok: true, refund: free } : { ok: false, status: 429, error: IMPORT_MESSAGES.demoLimit };
  }

  const user = await fetch(`${base.url}/auth/v1/user`, { headers: { apikey: base.key, authorization: `Bearer ${token}` } });
  if (!user.ok) return { ok: false, status: 401, error: IMPORT_MESSAGES.session };
  const who = (await user.json().catch(() => null)) as { id?: string; is_anonymous?: boolean } | null;
  const userId = who?.id ?? null;

  if (await hasPlus(purchaserFor(userId, request.headers.get('x-revenuecat-app-user-id')))) return { ok: true, refund: free, plus: true };

  // A guest's import also counts against its network's daily allowance, before its own.
  const guest = who?.is_anonymous ? await claimGuest(request) : null;
  if (guest && !guest.ok) return { ok: false, status: 429, error: IMPORT_MESSAGES.guestLimit };

  const allowed = await rpc(base, 'claim_import', { p_limit: FREE_IMPORTS_PER_MONTH, p_start_limit: FREE_IMPORTS_TO_START, p_start_days: START_WINDOW_DAYS }, token);
  if (allowed !== true) {
    await guest?.refund();
    return { ok: false, status: 402, error: IMPORT_MESSAGES.quota };
  }
  return {
    ok: true,
    refund: async () => {
      await Promise.all([refundImport(userId), guest?.refund()]);
    },
  };
}

/**
 * Gives back one import for a read that failed or found nothing. Only the server can (the database
 * caps it at five a month per person); before Oct 27, 2026 any account could call the refund itself
 * and never run out. Without the service key nothing is refunded, which costs the person one import.
 */
async function refundImport(userId: string | null): Promise<void> {
  const service = serviceEnv();
  if (!service || !userId) {
    console.warn('[import.refund_unconfigured]', { code: service ? 'no_user' : 'no_service_key' });
    return;
  }
  await rpc(service, 'refund_import_for', { p_user: userId }).then(() => {}, (error) => {
    console.error('[import.refund]', error instanceof Error ? error.message : 'unknown');
  });
}

/**
 * Claims one of a network's guest imports for today. Runs as the service role, so nobody can spend
 * another network's allowance. Without the service key, or if the database can't answer, the
 * import goes ahead: a missing setting must never stop real students importing.
 */
async function claimGuest(request: Request): Promise<{ ok: boolean; refund: () => Promise<void> }> {
  const open = { ok: true, refund: free };
  const service = serviceEnv();
  if (!service) {
    console.warn('[import.guest_limit_unconfigured]', { code: 'no_service_key' });
    return open;
  }
  const ipHash = createHash('sha256').update(`semli-guest:${clientIp(request)}`).digest('hex');
  try {
    const allowed = await rpc(service, 'claim_guest_import', { p_ip_hash: ipHash, p_limit: GUEST_IMPORTS_PER_IP_PER_DAY });
    if (allowed !== true) {
      console.info('[import.guest_limit]', { code: 'guest_network_limit' });
      return { ok: false, refund: free };
    }
    return { ok: true, refund: () => rpc(service, 'refund_guest_import', { p_ip_hash: ipHash }).then(() => {}, () => {}) };
  } catch (error) {
    console.error('[import.guest_limit_check]', error instanceof Error ? error.message : 'unknown');
    return open;
  }
}
