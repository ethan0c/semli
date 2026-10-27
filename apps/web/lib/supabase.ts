/**
 * The site talks to Supabase over REST with the publishable key; there is no client SDK here.
 * Without the keys (local development) callers decide what to do: imports go unlimited, the
 * waitlist says it is unavailable.
 */
export interface SupabaseEnv {
  url: string;
  key: string;
}

export function supabaseEnv(): SupabaseEnv | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_KEY;
  return url && key ? { url: url.replace(/\/$/, ''), key } : null;
}

/**
 * The service role, for the counters only the server may touch (refunds, per-network limits, link
 * clicks). Null without the key, and each caller says what that means for it.
 */
export function serviceEnv(): SupabaseEnv | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url: url.replace(/\/$/, ''), key } : null;
}

/** Calls a Postgres function; a user token runs it as that user, otherwise as `anon`. */
export async function rpc(base: SupabaseEnv, name: string, body: object, token?: string): Promise<unknown> {
  const res = await fetch(`${base.url}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: base.key, authorization: `Bearer ${token ?? base.key}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`rpc ${name} ${res.status}`);
  return res.status === 204 ? null : res.json();
}
