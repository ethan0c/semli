import { rpc, serviceEnv } from './supabase';

/*
 * The click counter behind semli.app/get. The waitlist form and its endpoint were removed at launch
 * (Oct 27, 2026); the rows already collected stay in `waitlist` for the launch email.
 */

/** A referral tag from `?r=`: short, printable, nothing else. */
export function cleanRef(ref: unknown): string | null {
  if (typeof ref !== 'string') return null;
  const r = ref.trim().slice(0, 64);
  return /^[\w.-]+$/.test(r) ? r : null;
}

/** A click on semli.app/get (or the old /beta). Never blocks the redirect; a lost row is fine. */
export async function logBetaClick(ref: string | null): Promise<void> {
  // Server-only since Oct 27, 2026, so nobody can pad the per-channel counts from outside.
  const base = serviceEnv();
  if (!base) return;
  try {
    await rpc(base, 'log_beta_click', { p_ref: ref });
  } catch (error) {
    console.error('[waitlist.click]', { code: 'rpc_failed', message: error instanceof Error ? error.message : String(error) });
  }
}
