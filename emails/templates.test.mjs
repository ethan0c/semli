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

describe('emails.md', () => {
  it('fills {name} everywhere, so no placeholder reaches an inbox', () => {
    const all = [...Object.values(emails), ...Object.values(transactional)];
    for (const e of all) expect(JSON.stringify(e)).not.toContain('{name}');
    expect(emails['semester-reminder'].greeting).toBe('Hi {{{FIRST_NAME|there}}},');
    expect(transactional.welcome.greeting).toBe('Hi {{{NAME}}},');
  });

  it('turns **bold** into the layout medium weight and keeps links purple and underlined', () => {
    const html = renderHtml(transactional['account-deleted'], POSTAL);
    expect(html).toContain('<span style="font-weight:500;">Deleting your account does not cancel Semli Plus.</span>');
    expect(html).toMatch(/<a href="mailto:hello@semli.app" style="color:#7057BD;text-decoration:underline;">hello@semli.app<\/a>/);
  });

  it('reads the button, its note and who each broadcast goes to', () => {
    expect(emails['spring-schedule'].segment).toEqual(['survey', 'waitlist', 'users']);
    expect(emails['spring-schedule'].action).toEqual({ label: 'Get Semli on iPhone', url: 'https://www.semli.app/beta?r=email-spring', note: expect.stringContaining('Already have Semli?') });
  });

  it('fills the feedback reply', async () => {
    const { feedbackThankYou } = await import('./templates.mjs');
    const e = feedbackThankYou({ name: 'Ana', about: 'the overlap warning', reply: 'Fixed in the next build.' });
    expect(e.greeting).toBe('Hi Ana,');
    expect(e.before).toContain('Thanks for telling me about the overlap warning.');
    expect(feedbackThankYou({ about: 'x', reply: 'y' }).greeting).toBe('Hi there,');
  });

  it('uses the header icon only when given one, and the typeset wordmark otherwise', () => {
    expect(renderHtml(transactional.welcome, POSTAL)).not.toContain('<img');
    expect(renderHtml(transactional.welcome, POSTAL)).toContain('semli<span');
    expect(renderHtml(transactional.welcome, POSTAL, { mark: 'https://x.test/i.png' })).toContain('<img src="https://x.test/i.png" width="40" height="40"');
  });
});

describe('app links', () => {
  it('every App Store button goes through the tagged click link, with its own tag', () => {
    const store = Object.entries(emails).filter(([, e]) => e.action && /apps\.apple\.com|semli\.app\/beta/.test(e.action.url) && !/testflight/.test(e.action.url));
    const tags = new Set();
    for (const [name, e] of store) {
      expect(e.action.url, name).not.toContain('apps.apple.com');
      const tag = new URL(e.action.url).searchParams.get('r');
      expect(tag, name).toMatch(/^email-[\w-]+$/);
      expect(tags.has(tag), `${name} reuses ${tag}`).toBe(false);
      tags.add(tag);
    }
  });
});

describe('the footer address', () => {
  it('is small and broken up so mail apps do not turn it into a map link', () => {
    const html = renderHtml(transactional.welcome, '441 Country Club Road, York, PA 17403-3651, USA');
    expect(html).toContain('font-size:11px;line-height:16px;color:#686963;text-decoration:none;">4&zwnj;4&zwnj;1 Country Club Road,&zwnj; York,&zwnj; PA 1&zwnj;7&zwnj;4&zwnj;0&zwnj;3-3&zwnj;6&zwnj;5&zwnj;1,&zwnj; USA</p>');
    expect(html.replace(/&zwnj;/g, '')).toContain('441 Country Club Road, York, PA 17403-3651, USA');
  });
});
