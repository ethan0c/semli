/**
 * Emails that follow something the person did, as opposed to the broadcasts. The words live in
 * emails/emails.md (`Kind: account`), render through emails/layout.mjs, and are published to Resend as
 * templates of these names with `npm run email publish`; the site only says which one and whose
 * name goes in it. Publish before deploying a change that adds a kind.
 */

export type OutboxRow = { id: number; email: string; kind: 'account_deleted' | 'welcome'; name: string | null; created_at: string };
export type Template = { id: string; variables: Record<string, string> };

const TEMPLATE: Record<OutboxRow['kind'], string> = {
  welcome: 'welcome',
  account_deleted: 'account-deleted',
};

/** The Resend template and its variables. Without a name the template says "there". */
export function templateFor(row: OutboxRow): Template {
  const first = row.name?.trim().split(/\s+/)[0];
  return { id: TEMPLATE[row.kind], variables: first ? { NAME: first } : {} };
}
