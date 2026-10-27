import { describe, expect, it } from 'vitest';
import { renderHtml, renderText, wordCount } from './layout.mjs';
import { emails, transactional, templateVariables } from './templates.mjs';

const POSTAL = '1 Test Street';

describe('the account emails the site sends', () => {
  for (const [name, e] of Object.entries(transactional)) {
    const html = renderHtml(e, POSTAL);
    const text = renderText(e, POSTAL);
    it(`${name} uses only template variables, never contact fields or the unsubscribe link`, () => {
      // Resend leaves contact fields and the unsubscribe URL empty in an API send.
      const vars = [...(html + text).matchAll(/\{\{\{([A-Z_|a-z]+)\}\}\}/g)].map((m) => m[1]);
      expect(vars.every((v) => v in templateVariables)).toBe(true);
      expect(html).not.toContain('RESEND_UNSUBSCRIBE_URL');
    });
    it(`${name} has no em or en dashes and says why it came`, () => {
      expect(text).not.toMatch(/[–—]/);
      expect(text).toContain(e.reason);
    });
  }

  it('the welcome email asks for a reply and stays short', () => {
    expect(renderText(transactional.welcome, POSTAL)).toContain('reply and tell me');
    expect(wordCount(transactional.welcome)).toBeLessThanOrEqual(80);
  });

  it('the account-deleted email says Plus is not cancelled', () => {
    expect(renderText(transactional['account-deleted'], POSTAL)).toContain('does not cancel Semli Plus');
  });
});

describe('the broadcasts', () => {
  it('stay under 80 words and carry an unsubscribe link', () => {
    for (const e of Object.values(emails)) {
      expect(wordCount(e)).toBeLessThanOrEqual(80);
      expect(renderHtml(e, POSTAL)).toContain('{{{RESEND_UNSUBSCRIBE_URL}}}');
    }
  });
});
