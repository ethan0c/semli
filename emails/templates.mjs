/**
 * Reads emails/emails.md, where every word of every email lives, into the shapes layout.mjs
 * renders. Edit emails.md, not this file. `npm run email build` renders docs/emails,
 * `npm run email publish` updates the Resend templates, `npm run email send <name>` broadcasts.
 */
import { readFileSync } from 'node:fs';

/**
 * Groups in Resend. The free plan allows three segments, so there are exactly three:
 *
 *   Survey     the spring 2026 survey respondents
 *   Waitlist   people who signed up on semli.app
 *   App users  everyone with a Semli account (a confirmed, non-guest address in Supabase auth).
 *              The site adds each one after their welcome email; `npm run email sync` and every
 *              broadcast to the group reconcile it with Supabase. Was Testers until Oct 27, 2026.
 *
 * The three never overlap: an address with an account leaves Survey and Waitlist, so a
 * broadcast to several groups reaches each person once.
 */
export const segments = {
  survey: 'Survey',
  waitlist: 'Waitlist',
  users: 'App users',
};

/** Everyone who signed up for anything but has no account yet: one broadcast per segment. */
export const EVERYONE = ['survey', 'waitlist'];

/** The footer's reason for the App users copy of a broadcast. */
export const USERS_REASON = "You're getting this because you have a Semli account.";

/**
 * Template variables, with the words used when the sender leaves one out. Resend reserves
 * FIRST_NAME for contacts and rejects the broadcast fallback syntax in templates, so templates
 * say {{{NAME}}}; broadcasts fill the name from the contact instead.
 */
export const templateVariables = {
  NAME: 'there',
  ABOUT: 'your message',
  REPLY: 'Thanks for writing.',
};

const BROADCAST_NAME = '{{{FIRST_NAME|there}}}';
const TEMPLATE_NAME = '{{{NAME}}}';

const FIELDS = { to: 'To', when: 'When', subject: 'Subject', preview: 'Preview', signoff: 'Sign-off', footer: 'Footer', kind: 'Kind', button: 'Button' };
const FIELD_LINE = new RegExp(`^(${Object.values(FIELDS).join('|')}):\\s*(.+)$`);

/** emails.md writes **bold**; layout.mjs reads *medium*. Links and ~accent~ pass straight through. */
const inline = (s) => s.replace(/\*\*([^*]+)\*\*/g, '*$1*');

/** One raw email per `## name`, in the order written, with the guide at the top skipped. */
export function parse(text) {
  const out = {};
  let cur = null;
  let para = [];
  const flush = () => {
    if (cur && para.length) cur.blocks.push({ type: 'p', text: para.join(' ') });
    para = [];
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const name = line.match(/^## (\S+)$/);
    if (name) {
      flush();
      cur = out[name[1]] = { fields: {}, heading: null, blocks: [] };
      continue;
    }
    if (!cur) continue;
    const field = line.match(FIELD_LINE);
    if (field) {
      flush();
      const key = Object.keys(FIELDS).find((k) => FIELDS[k] === field[1]);
      if (key === 'button') cur.blocks.push({ type: 'button', text: field[2] });
      else cur.fields[key] = field[2];
    } else if (line.startsWith('### ')) {
      flush();
      cur.heading = line.slice(4);
    } else if (line.startsWith('> ')) {
      flush();
      cur.blocks.push({ type: 'note', text: line.slice(2) });
    } else if (!line) {
      flush();
    } else {
      para.push(line);
    }
  }
  flush();
  return out;
}

const groupKey = Object.fromEntries(Object.entries(segments).map(([k, v]) => [v.toLowerCase(), k]));

/** The shape layout.mjs renders. `name` is what {name} becomes. */
function shape(key, raw, name) {
  const f = raw.fields;
  for (const need of ['subject', 'preview', 'signoff', 'footer', 'when']) if (!f[need]) throw new Error(`emails.md: ${key} has no ${FIELDS[need]}:`);
  if (!raw.heading) throw new Error(`emails.md: ${key} has no ### heading`);
  const [greeting, ...rest] = raw.blocks;
  if (greeting?.type !== 'p') throw new Error(`emails.md: ${key} must start with the greeting paragraph`);
  const fill = (s) => inline(s.replaceAll('{name}', name));
  const e = { plan: f.when, subject: f.subject, preheader: f.preview, heading: inline(raw.heading), greeting: fill(greeting.text), before: [], after: [], signoff: f.signoff, reason: f.footer };
  let side = e.before;
  for (const b of rest) {
    if (b.type === 'button') {
      const m = b.text.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (!m) throw new Error(`emails.md: ${key} Button: must look like [label](https://…)`);
      if (e.action) throw new Error(`emails.md: ${key} has two buttons; one action at most`);
      e.action = { label: m[1], url: m[2] };
      side = e.after;
    } else if (b.type === 'note') {
      if (!e.action || side.length) throw new Error(`emails.md: ${key} has a > note that isn't right after the button`);
      e.action.note = inline(b.text);
    } else {
      side.push(fill(b.text));
    }
  }
  return e;
}

function load() {
  const raw = parse(readFileSync(new URL('./emails.md', import.meta.url), 'utf8'));
  const emails = {};
  const transactional = {};
  let feedback = null;
  for (const [key, r] of Object.entries(raw)) {
    const to = (r.fields.to ?? '').toLowerCase();
    if (r.fields.kind === 'account') {
      transactional[key] = { kind: 'account', ...shape(key, r, TEMPLATE_NAME), unsubscribe: false };
    } else if (to === 'one person') {
      feedback = r;
    } else {
      const keys = to.split('+').map((g) => g.trim()).map((g) => {
        if (!groupKey[g]) throw new Error(`emails.md: ${key} To: names an unknown group "${g}"; use ${Object.values(segments).join(', ')} or one person`);
        return groupKey[g];
      });
      emails[key] = { segment: keys.length === 1 ? keys[0] : keys, ...shape(key, r, BROADCAST_NAME), unsubscribe: true };
    }
  }
  return { emails, transactional, feedback };
}

const loaded = load();

/** Broadcasts to a Resend group, by name. */
export const emails = loaded.emails;

/**
 * Emails the site sends after something the person did, through the Resend templates of the
 * same name (`npm run email publish`; apps/web/app/api/emails sends `template: { id }`). No
 * unsubscribe link and no contact fields: Resend leaves both empty in an API send.
 */
export const transactional = loaded.transactional;

/**
 * The one-to-one reply. Not a broadcast: `email send feedback --to a@b.edu --name Ana
 * --about "the overlap warning" --reply "..."` fills it and sends it through the Emails API.
 */
export function feedbackThankYou({ name, about, reply }) {
  if (!loaded.feedback) throw new Error('emails.md has no email with To: one person');
  const filled = structuredClone(loaded.feedback);
  for (const b of filled.blocks) b.text = b.text.replaceAll('{about}', about).replaceAll('{reply}', reply);
  return { ...shape('feedback-thank-you', filled, name || 'there'), unsubscribe: false };
}
