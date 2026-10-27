import { SITE_URL, SUPPORT_EMAIL } from './site';

/**
 * Emails that follow something the person did, as opposed to the broadcasts in /emails. Plain,
 * short, one job each. Every one names what happened, what it means, and what to do if it was
 * not them.
 */

export type OutboxRow = { id: number; email: string; kind: 'account_deleted' | 'welcome'; name: string | null; created_at: string };
export type Email = { subject: string; text: string; html: string };

const escape = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);

function html(paragraphs: string[]): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px 0;font-size:16px;line-height:24px;color:#222320;">${escape(p).replace(/\n/g, '<br>')}</p>`).join('');
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#FAF9F6;font-family:-apple-system,Helvetica,Arial,sans-serif;"><div style="max-width:520px;margin:0 auto;">${body}</div></body></html>`;
}

const firstName = (name: string | null) => name?.trim().split(/\s+/)[0] || null;

export function render(row: OutboxRow): Email {
  return row.kind === 'welcome' ? welcome(row) : accountDeleted(row);
}

/** From the founder, a day at most after the account exists. Its one job is a reply. */
function welcome(row: OutboxRow): Email {
  const paragraphs = [
    `Hi ${firstName(row.name) ?? 'there'},`,
    'Thanks for making a Semli account. Your plan now backs up to it, so a new phone picks up where this one left off.',
    "If you haven't yet, add one syllabus or a screenshot of your shifts. Check the dates Semli finds, then save them.",
    'I read every reply. If a date came out wrong or something was confusing, reply and tell me. A sentence is plenty.',
    'Thanks,\nSemli',
    `You're getting this because you made a Semli account. ${SITE_URL.replace('https://', '')}`,
  ];
  return { subject: 'Welcome to Semli', text: paragraphs.join('\n\n'), html: html(paragraphs) };
}

function accountDeleted(row: OutboxRow): Email {
  const name = firstName(row.name);
  const hi = name ? `Hi ${name},` : 'Hi,';
  const paragraphs = [
    hi,
    'Your Semli account is deleted. Your sign-in, your email address and the plan backup are gone from our servers, and this is the last email we send to this address about it.',
    'The plan on your phone stays until you delete the app or clear it in You → Your data, and Semli keeps working there as a guest.',
    'Deleting your account does not cancel Semli Plus. Subscriptions belong to your Apple ID: open Settings, tap your name, then Subscriptions, and choose Semli.',
    `If you didn't delete your account, reply to this email or write to ${SUPPORT_EMAIL} today.`,
    `Semli · ${SITE_URL.replace('https://', '')}`,
  ];
  return { subject: 'Your Semli account is deleted', text: paragraphs.join('\n\n'), html: html(paragraphs) };
}
