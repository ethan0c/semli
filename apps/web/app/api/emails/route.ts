import { errorDiagnostic } from '@dayli/core';
import { templateFor, type OutboxRow } from '../../../lib/transactional-email';

/*
 * Sends what the database queued in `email_outbox` (supabase/migrations/20261023100000 and
 * 20261027100000) once it is due, each through its published Resend template (subject, sender and words live
 * there; see lib/transactional-email.ts). Vercel's cron calls it with CRON_SECRET; the app may also call it right after
 * deleting an account so the confirmation arrives in seconds. Calling it only sends what is
 * already queued, so an unauthenticated call can't do more than send those emails sooner.
 *
 * It also keeps Resend's "App users" group in step with accounts, so the semester broadcasts
 * reach them: a welcomed address joins it (and leaves Survey and Waitlist, so nobody gets a
 * broadcast twice), and a deleted account's contact is removed from Resend. That needs a
 * full-access key; with a send-only key the emails still go and `npm run email sync` catches up.
 */

export const maxDuration = 60;

const BATCH = 50;
/**
 * A welcome waits this long after it was queued, so it arrives once the person has had time to
 * try an import; the database calls this route every 10 minutes when a row is due
 * (supabase/migrations/20261027120000), so welcomes land 45 to 55 minutes after sign-up.
 * Account emails go at once.
 */
export const WELCOME_DELAY_MINUTES = 45;
const RESEND = 'https://api.resend.com';
const USERS_GROUP = 'App users';
const OTHER_GROUPS = ['Survey', 'Waitlist'];

function env() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resend = process.env.RESEND_API_KEY;
  return url && service && resend ? { url, service, resend } : null;
}

/** Resend allows two requests a second. */
function resendClient(key: string) {
  let last = 0;
  return async (method: string, path: string, body?: unknown, extra: Record<string, string> = {}): Promise<Response> => {
    const wait = 550 - (Date.now() - last);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    return fetch(RESEND + path, {
      method,
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json', ...extra },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };
}
type Resend = ReturnType<typeof resendClient>;

class ContactsError extends Error {
  constructor(readonly status: number) { super(`contacts ${status}`); }
}

async function check(res: Promise<Response>, allow: number[] = []): Promise<Response> {
  const r = await res;
  if (!r.ok && !allow.includes(r.status)) throw new ContactsError(r.status);
  return r;
}

/** Group ids by name, read once per run and only when a row needs them. */
function groups(resend: Resend) {
  let ids: Promise<Record<string, string>> | null = null;
  return () => (ids ??= check(resend('GET', '/segments')).then(async (r) => {
    const { data } = (await r.json()) as { data?: { id: string; name: string }[] };
    return Object.fromEntries((data ?? []).map((s) => [s.name.toLowerCase(), s.id]));
  }));
}

async function updateContacts(resend: Resend, groupIds: () => Promise<Record<string, string>>, row: OutboxRow): Promise<void> {
  const email = encodeURIComponent(row.email);
  if (row.kind === 'account_deleted') {
    await check(resend('DELETE', `/contacts/${email}`), [404]);
    return;
  }
  const ids = await groupIds();
  const users = ids[USERS_GROUP.toLowerCase()];
  if (!users) throw new ContactsError(404);
  // Look first: Resend's create also succeeds for an existing address and overwrites it,
  // which would re-subscribe someone who unsubscribed from the survey or waitlist emails.
  const found = await check(resend('GET', `/contacts/${email}`), [404]);
  if (found.status === 404) {
    const first = templateFor(row).variables.NAME;
    await check(resend('POST', '/contacts', { email: row.email, ...(first ? { first_name: first } : {}), properties: { source: 'app' }, segments: [{ id: users }] }));
    return;
  }
  // Already a contact, from the survey or the waitlist: move them to App users.
  await check(resend('POST', `/contacts/${email}/segments/${users}`), [409]);
  for (const name of OTHER_GROUPS) {
    const id = ids[name.toLowerCase()];
    if (id) await check(resend('DELETE', `/contacts/${email}/segments/${id}`), [404]);
  }
}

export async function flush(): Promise<{ sent: number; failed: number }> {
  const e = env();
  if (!e) return { sent: 0, failed: 0 };
  const headers = { apikey: e.service, authorization: `Bearer ${e.service}`, 'content-type': 'application/json' };
  const due = new Date(Date.now() - WELCOME_DELAY_MINUTES * 60_000).toISOString();
  const res = await fetch(`${e.url}/rest/v1/email_outbox?select=*&or=(kind.neq.welcome,created_at.lte.${encodeURIComponent(due)})&order=id&limit=${BATCH}`, { headers });
  if (!res.ok) throw new Error(`outbox read ${res.status}`);
  const rows = (await res.json()) as OutboxRow[];
  const resend = resendClient(e.resend);
  const groupIds = groups(resend);
  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    const out = await resend('POST', '/emails', { to: [row.email], template: templateFor(row) }, { 'idempotency-key': `outbox-${row.id}` });
    if (!out.ok) {
      failed++;
      console.error('[emails.send]', { code: 'resend_failed', status: out.status, kind: row.kind });
      continue;
    }
    // The email went; the row goes whatever happens to the contact, so nobody is welcomed twice.
    try {
      await updateContacts(resend, groupIds, row);
    } catch (error) {
      console.error('[emails.contacts]', { code: 'resend_contacts_failed', status: error instanceof ContactsError ? error.status : undefined, kind: row.kind });
    }
    await fetch(`${e.url}/rest/v1/email_outbox?id=eq.${row.id}`, { method: 'DELETE', headers });
    sent++;
  }
  return { sent, failed };
}

async function handle(): Promise<Response> {
  try {
    return Response.json({ ok: true, ...(await flush()) });
  } catch (error) {
    console.error('[emails.flush]', errorDiagnostic(error));
    return Response.json({ ok: false }, { status: 503 });
  }
}

/** Vercel cron. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return new Response(null, { status: 401 });
  return handle();
}

/** The app, right after an account is deleted. */
export async function POST() {
  return handle();
}
