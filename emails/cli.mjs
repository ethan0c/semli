#!/usr/bin/env node
/**
 * Semli email. One place to see every email, who it goes to, and where it stands. The words
 * live in emails/emails.md; this file builds, publishes and sends them.
 *
 *   npm run email                 this help
 *   npm run email build           render docs/emails/*.html and *.txt from emails.md
 *   npm run email preview         build, then open a gallery of every email in the browser
 *   npm run email status          segments with counts, every broadcast, and the plan at a glance
 *   npm run email publish         every email as a published Resend template of the same name
 *                                 (welcome and account-deleted are sent from those by the site)
 *   npm run email sync [--dry-run] [--survey-ref <tag,…>]
 *                                 Supabase accounts -> App users, then the waitlist -> Survey /
 *                                 Waitlist (skipping anyone with an account). Contacts in App users
 *                                 whose account is gone are deleted from Resend.
 *                                 --dry-run shows the counts and rows by ref tag, writes nothing.
 *                                 --survey-ref says which ref tags are survey rows (default survey;
 *                                 'none' means rows with no tag).
 *   npm run email add waitlist a@b.edu [more…]  put addresses in a group by hand
 *   npm run email send <name> [--at "2027-01-05T13:00:00Z"] [--yes]
 *                                 draft a broadcast in Resend; --yes sends (or schedules with --at).
 *                                 A broadcast to App users syncs accounts first.
 *   npm run email send all [--yes]   one draft per email that has a date; --yes schedules them
 *   npm run email send feedback --to a@b.edu --name Ana --about "…" --reply "…"
 *
 * Reads RESEND_API_KEY and EMAIL_POSTAL_ADDRESS from the repo-root .env. The key needs full
 * access (the send-only key Supabase uses cannot list segments or create broadcasts).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderHtml as renderLayout, renderText, wordCount, MARK_URL } from './layout.mjs';
import { emails, transactional, templateVariables, segments, feedbackThankYou, USERS_REASON } from './templates.mjs';

const targets = (e) => (Array.isArray(e.segment) ? e.segment : [e.segment]);
const groupNames = (e) => targets(e).map((k) => segments[k] ?? k).join(' + ');
import { client, ResendError } from './resend.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'docs', 'emails');
const FROM = 'Semli <hello@semli.app>';
const REPLY_TO = 'hello@semli.app';
const MAX_WORDS = 80;

function env() {
  const vars = {};
  try {
    for (const line of readFileSync(join(root, '.env'), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (m) vars[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  } catch {}
  return { ...vars, ...process.env };
}

const E = env();
const POSTAL = E.EMAIL_POSTAL_ADDRESS || '[SENDER_POSTAL_ADDRESS]';
const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const has = (name) => args.includes(`--${name}`);
const warn = (s) => console.log(`  ! ${s}`);
const pad = (s, n) => String(s ?? '').padEnd(n);

function table(rows) {
  const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => String(r[i] ?? '').length)));
  for (const r of rows) console.log('  ' + r.map((c, i) => pad(c, widths[i])).join('  '));
}

// ---------- the header icon ----------

/** The icon once the site serves it; the typeset wordmark until then, so no email shows a broken image. */
let mark = null;
async function checkMark() {
  try {
    const res = await fetch(MARK_URL, { method: 'HEAD' });
    mark = res.ok && (res.headers.get('content-type') ?? '').startsWith('image/') ? MARK_URL : null;
  } catch {
    mark = null;
  }
  if (!mark) warn(`${MARK_URL} isn't live yet (deploy the site), so the header uses the typeset wordmark. Publish again after the deploy.`);
}
const renderHtml = (e, postal) => renderLayout(e, postal, { mark });

// ---------- build / preview ----------

function build({ quiet } = {}) {
  mkdirSync(out, { recursive: true });
  for (const [name, e] of [...Object.entries(emails), ...Object.entries(transactional)]) {
    writeFileSync(join(out, `${name}.html`), renderHtml(e, POSTAL));
    writeFileSync(join(out, `${name}.txt`), renderText(e, POSTAL));
    const words = wordCount(e);
    const over = words > MAX_WORDS && e.kind !== 'account';
    if (!quiet) console.log(`  ${pad(name, 20)} ${pad(words + ' words', 10)} ${over ? `over ${MAX_WORDS}, trim it` : e.kind === 'account' ? 'sent by the site' : ''}`);
  }
  const fb = feedbackThankYou({ name: '[FIRST_NAME]', about: '[FEEDBACK_SUMMARY]', reply: '[PERSONAL_REPLY]' });
  writeFileSync(join(out, 'feedback-thank-you.html'), renderHtml(fb, POSTAL));
  writeFileSync(join(out, 'feedback-thank-you.txt'), renderText(fb, POSTAL));
  if (!quiet) console.log(`  ${pad('feedback-thank-you', 20)} ${pad(wordCount(fb) + ' words', 10)} one-to-one, filled by \`send feedback\``);
  if (POSTAL.startsWith('[')) warn('EMAIL_POSTAL_ADDRESS is not set in .env; the footer shows a placeholder.');
}

function preview() {
  build();
  const fb = feedbackThankYou({ name: 'Ana', about: 'the overlap warning hiding the class name', reply: 'I can see how that would be confusing. Could you tell me which screen you were on when it happened?' });
  const all = [...Object.entries(emails), ...Object.entries(transactional).map(([n, e]) => [n, { ...e, segment: 'one-to-one' }]), ['feedback-thank-you', { ...fb, segment: 'one-to-one', plan: 'Reply after reading their message' }]];
  const cards = all.map(([name, e]) => `
    <section>
      <header><strong>${name}</strong><span>${groupNames(e)} · ${wordCount(e)} words</span><em>${e.subject}</em><small>${e.preheader}</small></header>
      <iframe title="${name}" srcdoc="${renderHtml(e, POSTAL).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></iframe>
      <p>${e.plan}</p>
    </section>`).join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Semli emails</title>
<style>
  body{margin:0;background:#F0EFEB;color:#222320;font:14px/20px -apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif}
  h1{font-weight:400;font-size:24px;margin:28px 24px 4px}
  .lead{margin:0 24px 20px;color:#686963}
  main{display:grid;grid-template-columns:repeat(auto-fill,minmax(360px,1fr));gap:20px;padding:0 24px 40px}
  section{background:#FFF;border:1px solid #E5E4DE;border-radius:16px;overflow:hidden;display:flex;flex-direction:column}
  header{padding:14px 16px 10px;border-bottom:1px solid #E5E4DE;display:grid;gap:2px}
  header span,header small{color:#686963}
  header em{font-style:normal;font-weight:500}
  iframe{border:0;width:100%;height:640px;background:#FAF9F6}
  section p{margin:0;padding:10px 16px 14px;color:#686963;border-top:1px solid #E5E4DE}
</style></head><body>
<h1>Semli emails</h1><p class="lead">Rendered from emails/emails.md through the one layout. Postal address: ${POSTAL}.</p>
<main>${cards}</main></body></html>`;
  const file = join(out, 'preview.html');
  writeFileSync(file, html);
  console.log(`  ${file}`);
  if (process.platform === 'darwin') spawnSync('open', [file]);
}

// ---------- Resend ----------

function resend() {
  if (!E.RESEND_API_KEY) throw new Error('RESEND_API_KEY is missing from the repo-root .env');
  return client(E.RESEND_API_KEY);
}

/** Finds or creates the named groups. Only the ones a command needs, to stay inside the plan's cap. */
async function ensureSegments(api, keys = Object.keys(segments)) {
  const existing = await api.segments();
  const byName = Object.fromEntries(existing.map((s) => [s.name.toLowerCase(), s]));
  const ids = {};
  for (const key of keys) {
    const name = segments[key];
    let s = byName[name.toLowerCase()];
    if (!s) {
      try {
        s = await api.createSegment(name);
      } catch (err) {
        const extra = existing.filter((x) => !Object.values(segments).some((n) => n.toLowerCase() === x.name.toLowerCase()));
        if (err.status === 400 && extra.length) throw new Error(`Resend's plan cap is full. Rename or delete ${extra.map((x) => x.name).join(', ')} in Resend, then retry.`);
        throw err;
      }
      console.log(`  created segment ${name}`);
    }
    ids[key] = s.id;
  }
  return ids;
}

async function ensureProperties(api) {
  const keys = new Set((await api.properties()).map((p) => p.key));
  for (const key of ['ref', 'source']) if (!keys.has(key)) { await api.createProperty(key); console.log(`  created contact property ${key}`); }
}

/**
 * Create or update one contact and put it in its segments. Looks first: Resend's create also
 * succeeds for an existing address and would overwrite it, re-subscribing anyone who opted out.
 */
async function upsert(api, { email, first_name, properties }, segmentIds) {
  const existing = await api.contact(email);
  if (!existing) {
    await api.createContact({ email, ...(first_name ? { first_name } : {}), properties, segments: segmentIds.map((id) => ({ id })) });
    return 'added';
  }
  await api.updateContact(email, { properties, ...(first_name && !existing.first_name ? { first_name } : {}) });
  for (const id of segmentIds) await api.addToSegment(email, id).catch((e) => { if (e.status !== 409) throw e; });
  return 'updated';
}

/** Runs one read-only query against the linked Supabase project through its CLI. */
function dbRows(sql, expect) {
  let text;
  try {
    text = execFileSync('npx', ['--no-install', 'supabase', 'db', 'query', '--linked', '--output-format', 'json', sql], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (err) {
    throw new Error(`supabase db query failed; run \`npx supabase login\` and \`npx supabase link\` first.\n${err.stderr ?? err.message}`);
  }
  const start = text.search(/[\[{]/);
  if (start < 0) throw new Error(`no JSON in supabase output: ${text.slice(0, 200)}`);
  const json = JSON.parse(text.slice(start));
  const rows = Array.isArray(json) ? json : json.rows ?? json.result ?? json.data ?? [];
  if (!Array.isArray(rows) || (rows.length && !rows[0][expect])) throw new Error(`unexpected query output: ${text.slice(0, 200)}`);
  return rows;
}

const waitlistRows = () => dbRows('select email, ref, created_at from public.waitlist order by created_at', 'email');

/** Every account with a confirmed address, the same rule the welcome trigger uses. */
const accountRows = () =>
  dbRows(
    "select lower(email) as email, nullif(trim(coalesce(raw_user_meta_data ->> 'name', raw_user_meta_data ->> 'full_name', '')), '') as name " +
      "from auth.users where email is not null and email <> '' and not coalesce(is_anonymous, false) and email_confirmed_at is not null order by created_at",
    'email',
  );

const ignore404 = (err) => { if (err.status !== 404) throw err; };

/** App users mirrors Supabase: add every account, move it out of Survey and Waitlist, delete contacts whose account is gone. */
async function syncUsers(api, ids, rows = accountRows()) {
  const counts = { added: 0, updated: 0, removed: 0 };
  const accounts = new Set(rows.map((r) => r.email));
  for (const r of rows) {
    const first_name = r.name?.split(/\s+/)[0];
    const result = await upsert(api, { email: r.email, ...(first_name ? { first_name } : {}), properties: { source: 'app' } }, [ids.users]);
    counts[result]++;
    if (result === 'updated') for (const key of ['survey', 'waitlist']) if (ids[key]) await api.removeFromSegment(r.email, ids[key]).catch(ignore404);
  }
  for (const c of await api.contacts(ids.users)) {
    if (accounts.has(c.email.toLowerCase())) continue;
    await api.deleteContact(c.email).catch(ignore404);
    counts.removed++;
  }
  console.log(`  App users: ${counts.added} added, ${counts.updated} already there, ${counts.removed} removed (account deleted)`);
  return accounts;
}

async function sync() {
  const accounts = accountRows();
  const isAccount = new Set(accounts.map((r) => r.email));
  const rows = waitlistRows().filter((r) => !isAccount.has(r.email.toLowerCase()));
  const surveyTags = (flag('survey-ref') ?? 'survey').split(',').map((t) => t.trim().toLowerCase());
  const isSurvey = (r) => surveyTags.includes((r.ref ?? 'none').toLowerCase());
  const survey = rows.filter(isSurvey).length;
  console.log(`  ${accounts.length} accounts; ${rows.length} waitlist rows without one: ${survey} survey (ref ${surveyTags.join(' or ')}), ${rows.length - survey} site`);
  if (has('dry-run')) {
    const by = {};
    for (const r of rows) {
      const k = `${r.ref ?? 'none'}|${String(r.created_at).slice(0, 10)}`;
      by[k] = (by[k] ?? 0) + 1;
    }
    console.log('');
    table([['ref', 'joined', 'rows', 'goes to'], ...Object.entries(by).map(([k, n]) => {
      const [ref, day] = k.split('|');
      return [ref, day, n, surveyTags.includes(ref.toLowerCase()) ? 'Survey' : 'Waitlist'];
    })]);
    return console.log('\n  Dry run; nothing written to Resend.');
  }
  const api = resend();
  const ids = await ensureSegments(api, ['survey', 'waitlist', 'users']);
  await ensureProperties(api);
  await syncUsers(api, ids, accounts);
  const counts = { added: 0, updated: 0 };
  for (const r of rows) {
    const source = isSurvey(r) ? 'survey' : 'waitlist';
    const result = await upsert(api, { email: r.email, properties: { ref: r.ref ?? '', source } }, [ids[source]]);
    counts[result]++;
  }
  console.log(`  Survey and Waitlist: ${counts.added} added, ${counts.updated} already there (segments and properties refreshed)`);
  console.log('  Unsubscribes stay as they are in Resend; sync never re-subscribes anyone (it looks before it writes).');
}

async function add(group, addresses) {
  if (!segments[group]) throw new Error(`unknown group ${group}; one of ${Object.keys(segments).join(', ')}`);
  if (!addresses.length) throw new Error('give at least one email address');
  const api = resend();
  const ids = await ensureSegments(api, [group]);
  for (const email of addresses) {
    const result = await upsert(api, { email: email.toLowerCase(), properties: {} }, [ids[group]]);
    console.log(`  ${result} ${email} -> ${segments[group]}`);
  }
}

async function status() {
  const api = resend();
  let segs, broadcasts;
  try {
    segs = await api.segments();
    broadcasts = await api.broadcasts();
  } catch (err) {
    if (err.name === 'restricted_api_key') {
      warn('The RESEND_API_KEY in .env is send-only. Create a full-access key in Resend (API Keys, "Full access") and put it in .env.');
      warn('Supabase keeps using its own key for sign-in codes; nothing there changes.');
      return;
    }
    throw err;
  }
  const byName = Object.fromEntries(segs.map((s) => [s.name.toLowerCase(), s]));
  const count = {};
  for (const [key, name] of Object.entries(segments)) {
    const s = byName[name.toLowerCase()];
    if (!s) { count[key] = 'missing (run sync)'; continue; }
    const contacts = await api.contacts(s.id);
    const unsub = contacts.filter((c) => c.unsubscribed).length;
    count[key] = `${contacts.length - unsub}${unsub ? ` (+${unsub} unsubscribed)` : ''}`;
  }

  console.log('\nGroups');
  table([['group', 'contacts'], ...Object.entries(segments).map(([k, n]) => [n, count[k]])]);

  console.log('\nEmails');
  const rows = [['email', 'to', 'words', 'last broadcast', 'plan']];
  for (const [name, e] of Object.entries(emails)) {
    const mine = broadcasts.filter((b) => b.name === name || b.name.startsWith(`${name} to `)).sort((a, b) => (b.created_at > a.created_at ? 1 : -1));
    const b = mine[0];
    const state = b ? `${b.status}${b.sent_at ? ' ' + b.sent_at.slice(0, 10) : b.scheduled_at ? ' for ' + b.scheduled_at.slice(0, 10) : ''}` : 'not drafted';
    rows.push([name, groupNames(e), wordCount(e), state, e.plan]);
  }
  for (const [name, e] of Object.entries(transactional)) rows.push([name, 'one person', wordCount(e), 'sent by the site', e.plan]);
  rows.push(['feedback-thank-you', 'one person', wordCount(feedbackThankYou({ name: 'x', about: 'x', reply: 'x' })), 'sent as needed', 'Reply after reading their message']);
  table(rows);

  const other = broadcasts.filter((b) => !emails[b.name.split(' to ')[0]]);
  if (other.length) {
    console.log('\nOther broadcasts in Resend');
    table([['name', 'status', 'created'], ...other.map((b) => [b.name, b.status, b.created_at.slice(0, 10)])]);
  }
  const published = new Map((await api.templates()).map((t) => [t.alias ?? t.name, t]));
  console.log('\nTemplates in Resend');
  table([['template', 'state'], ...templateList().map(([name]) => {
    const t = published.get(name);
    return [name, t ? `${t.status ?? 'saved'}${t.published_at ? ' ' + String(t.published_at).slice(0, 10) : ''}` : 'missing (run publish)'];
  })]);
  console.log('');
  if (POSTAL.startsWith('[')) warn('EMAIL_POSTAL_ADDRESS is not set in .env; broadcasts will carry a placeholder footer.');
}

async function send(name) {
  if (name === 'feedback') return sendFeedback();
  const names = name === 'all' ? Object.keys(emails) : [name];
  if (!names.every((n) => emails[n])) throw new Error(`unknown email ${name}; one of ${Object.keys(emails).join(', ')}, all, feedback`);
  if (POSTAL.startsWith('[')) throw new Error('Set EMAIL_POSTAL_ADDRESS in .env before drafting a broadcast; the footer needs a real address.');
  const api = resend();
  const ids = await ensureSegments(api, [...new Set(names.flatMap((n) => targets(emails[n])))]);
  if (ids.users) await syncUsers(api, ids);
  const at = flag('at');
  const yes = has('yes');
  if (name === 'all' && yes && !at) throw new Error('`send all --yes` needs --at; it schedules every email for the same time. Send them one by one for different dates.');
  for (const n of names) {
    for (const key of targets(emails[n])) {
      const e = key === 'users' ? { ...emails[n], reason: USERS_REASON } : emails[n];
      const body = {
        name: targets(e).length > 1 ? `${n} to ${segments[key]}` : n,
        from: FROM,
        reply_to: REPLY_TO,
        subject: e.subject,
        segment_id: ids[key],
        html: renderHtml(e, POSTAL),
        text: renderText(e, POSTAL).replace(/^Subject: .*\n\n/, ''),
        send: yes,
        ...(yes && at ? { scheduled_at: at } : {}),
      };
      const b = await api.createBroadcast(body);
      const what = yes ? (at ? `scheduled for ${at}` : 'sending now') : 'drafted';
      console.log(`  ${pad(n, 20)} -> ${pad(segments[key], 9)} ${what}   https://resend.com/broadcasts/${b.id}`);
    }
  }
  if (!yes) console.log('  Drafts only. Open each in Resend to proof it, then rerun with --yes (and --at to schedule).');
}

async function sendFeedback() {
  const to = flag('to'); const about = flag('about'); const reply = flag('reply'); const name = flag('name');
  if (!to || !about || !reply) throw new Error('send feedback needs --to, --about and --reply (and --name if you know it)');
  const e = feedbackThankYou({ name, about, reply });
  const api = resend();
  const r = await api.sendEmail({ from: FROM, to: [to], reply_to: REPLY_TO, subject: e.subject, html: renderHtml(e, POSTAL), text: renderText(e, POSTAL).replace(/^Subject: .*\n\n/, '') });
  console.log(`  sent to ${to}  ${r.id}`);
}

// ---------- templates ----------

/** Every email, as Resend templates see it: broadcasts, the site's account emails, and the feedback reply. */
function templateList() {
  const fb = feedbackThankYou({ name: '{{{NAME}}}', about: '{{{ABOUT}}}', reply: '{{{REPLY}}}' });
  return [...Object.entries(emails), ...Object.entries(transactional), ['feedback-thank-you', fb]];
}

// Templates reject the broadcast fallback syntax, so the greeting uses the NAME variable instead.
const asTemplate = (s) => s.replaceAll('{{{FIRST_NAME|there}}}', '{{{NAME}}}');

/** Builds each email, then creates or updates the template of the same name and publishes it. */
async function publish() {
  if (POSTAL.startsWith('[')) throw new Error('Set EMAIL_POSTAL_ADDRESS in .env before publishing; the footer needs a real address.');
  const api = resend();
  for (const [name, e] of templateList()) {
    const html = asTemplate(renderHtml(e, POSTAL));
    const text = asTemplate(renderText(e, POSTAL).replace(/^Subject: .*\n\n/, ''));
    const variables = Object.entries(templateVariables)
      .filter(([key]) => (html + text).includes(`{{{${key}}}}`))
      .map(([key, fallback_value]) => ({ key, type: 'string', fallback_value }));
    const body = { name, from: FROM, reply_to: REPLY_TO, subject: e.subject, html, text, variables };
    const existing = await api.template(name);
    const id = existing ? existing.id : (await api.createTemplate({ ...body, alias: name })).id;
    if (existing) await api.updateTemplate(id, body);
    await api.publishTemplate(id);
    console.log(`  ${pad(name, 20)} ${existing ? 'updated' : 'created'}, published   https://resend.com/templates/${id}`);
  }
  console.log('  Edit emails/emails.md and publish again; an edit made in Resend is overwritten by the next publish.');
}

// ---------- main ----------

const [cmd, ...rest] = args;
const NEEDS_MARK = new Set(['build', 'preview', 'publish', 'send']);
const run = {
  build: () => build(),
  preview: () => preview(),
  status,
  publish,
  sync,
  add: () => add(rest[0], rest.slice(1).filter((a) => !a.startsWith('--'))),
  send: () => send(rest[0]),
}[cmd];

if (!run) {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].split('\n').slice(2).map((l) => l.replace(/^ \* ?/, '')).join('\n'));
} else {
  Promise.resolve().then(() => (NEEDS_MARK.has(cmd) ? checkMark() : null)).then(run).catch((err) => { console.error(`\n  ${err.message}\n`); process.exit(1); });
}
