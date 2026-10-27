/**
 * The one email layout. Every marketing email in docs/emails is rendered from here so the
 * brand lives in one place: paper #FAF9F6, ink #222320, secondary #686963, hairline #E5E4DE,
 * Geist if installed (system stack otherwise), ink pill for the one action, purple only on
 * the wordmark dot, the heading's accent word and links (underlined). One image, the wordmark
 * PNG (design/render-pngs.mjs) with the paper baked in; until the site serves it, the header is
 * the same wordmark set in type. No tinted cards, no uppercase.
 */

/** Served by the site from apps/web/public/email/wordmark.png; 252 x 79, shown at 84 px wide. */
export const WORDMARK_URL = 'https://www.semli.app/email/wordmark.png';

export const brand = {
  paper: '#FAF9F6',
  ink: '#222320',
  secondary: '#686963',
  line: '#E5E4DE',
  accent: '#7057BD',
  font: "'Geist',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
  wordmarkFont: "'Onest','Geist',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Inline markup: [label](url) is an accent link, *text* is medium weight, ~word~ is the one accent word in a heading. */
function inline(s) {
  return esc(s)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2" style="color:${brand.accent};text-decoration:underline;">$1</a>`)
    .replace(/\*([^*]+)\*/g, '<span style="font-weight:500;">$1</span>')
    .replace(/~([^~]+)~/g, `<span style="color:${brand.accent};">$1</span>`);
}

const p = (text, extra = '') => `<p style="margin:0 0 16px 0;font-size:16px;line-height:24px;color:${brand.ink};${extra}">${inline(text)}</p>`;

/**
 * @param {object} e
 * @param {string} e.subject
 * @param {string} e.preheader   one line, shows next to the subject in the inbox
 * @param {string} e.heading     28px Regular, sentence case
 * @param {string} e.greeting    'Hi {{{FIRST_NAME|there}}},' or a literal
 * @param {string[]} e.before    paragraphs above the action
 * @param {{label:string,url:string,note?:string}=} e.action
 * @param {string[]} e.after     paragraphs below the action
 * @param {string} e.signoff     'Thanks again,'
 * @param {string} e.reason      why they got it, one sentence
 * @param {boolean} e.unsubscribe  broadcast token in the footer
 * @param {string} postalAddress sender's postal address for the footer
 * @param {{wordmark?: string|null}} options  the wordmark image URL, once it is live
 */
export function renderHtml(e, postalAddress, { wordmark = null } = {}) {
  const header = wordmark
    ? `<img src="${wordmark}" width="84" height="26" alt="semli." style="display:block;width:84px;height:auto;border:0;outline:none;text-decoration:none;font-family:${brand.wordmarkFont};font-size:22px;font-weight:600;color:${brand.ink};">`
    : `semli<span style="color:${brand.accent};">.</span>`;
  const action = e.action
    ? `<tr><td style="padding:4px 0 20px 0;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td align="center" bgcolor="${brand.ink}" style="border-radius:999px;background-color:${brand.ink};mso-padding-alt:13px 24px;">
      <a href="${e.action.url}" style="display:inline-block;padding:13px 24px;border-radius:999px;font-family:${brand.font};font-size:16px;line-height:22px;font-weight:500;color:#FFFFFF;text-decoration:none;mso-padding-alt:0;">${esc(e.action.label)}</a>
    </td>
  </tr></table>${e.action.note ? `
  <p style="margin:12px 0 0 0;font-size:13px;line-height:20px;color:${brand.secondary};">${inline(e.action.note)}</p>` : ''}
</td></tr>`
    : '';

  const footerLinks = [`<a href="mailto:hello@semli.app" style="color:${brand.accent};text-decoration:underline;">Contact Semli</a>`];
  if (e.unsubscribe) footerLinks.push(`<a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:${brand.secondary};text-decoration:underline;">Unsubscribe</a>`);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${esc(e.subject)}</title>
  <style>
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${brand.paper};color:${brand.ink};font-family:${brand.font};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(e.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${brand.paper};">
    <tr><td align="center" style="padding:40px 20px;">
      <!--[if mso]><table role="presentation" width="480" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
        <tr><td style="padding:0 0 32px 0;font-family:${brand.wordmarkFont};font-size:22px;line-height:28px;font-weight:600;letter-spacing:-0.6px;color:${brand.ink};">${header}</td></tr>
        <tr><td style="padding:0 0 16px 0;"><h1 style="margin:0;font-family:${brand.font};font-size:28px;line-height:36px;font-weight:400;letter-spacing:-0.5px;color:${brand.ink};">${inline(e.heading)}</h1></td></tr>
        <tr><td>
          ${p(e.greeting)}
          ${e.before.map((t) => p(t)).join('\n          ')}
        </td></tr>
${action ? `        ${action}\n` : ''}        <tr><td>
          ${e.after.map((t) => p(t)).join('\n          ')}
          <p style="margin:8px 0 0 0;font-size:16px;line-height:24px;color:${brand.ink};">${inline(e.signoff)}<br>Semli</p>
        </td></tr>
        <tr><td style="padding:32px 0 0 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td height="1" style="height:1px;line-height:1px;font-size:1px;background-color:${brand.line};">&nbsp;</td></tr></table>
          <p style="margin:16px 0 0 0;font-size:12px;line-height:18px;color:${brand.secondary};">${inline(e.reason)}</p>
          <p style="margin:6px 0 0 0;font-size:12px;line-height:18px;color:${brand.secondary};">${esc(postalAddress)}</p>
          <p style="margin:6px 0 0 0;font-size:12px;line-height:18px;color:${brand.secondary};">${footerLinks.join(' &nbsp;&middot;&nbsp; ')}</p>
        </td></tr>
      </table>
      <!--[if mso]></td></tr></table><![endif]-->
    </td></tr>
  </table>
</body>
</html>
`;
}

const plain = (s) => s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)').replace(/\*([^*]+)\*/g, '$1').replace(/~([^~]+)~/g, '$1');

/** The plain-text part. First line is the subject so the file reads on its own. */
export function renderText(e, postalAddress) {
  const lines = [`Subject: ${e.subject}`, '', plain(e.greeting), '', ...e.before.flatMap((t) => [plain(t), ''])];
  if (e.action) {
    lines.push(`${e.action.label}: ${e.action.url}`, '');
    if (e.action.note) lines.push(plain(e.action.note), '');
  }
  lines.push(...e.after.flatMap((t) => [plain(t), '']));
  lines.push(plain(e.signoff), 'Semli', '', '--', plain(e.reason), postalAddress, 'Contact Semli: hello@semli.app');
  if (e.unsubscribe) lines.push('Unsubscribe: {{{RESEND_UNSUBSCRIBE_URL}}}');
  return lines.join('\n') + '\n';
}

/** Words in the body (greeting to signoff), to keep every email short. */
export function wordCount(e) {
  const parts = [e.greeting, ...e.before, ...(e.action ? [e.action.label, e.action.note ?? ''] : []), ...e.after, e.signoff];
  return plain(parts.join(' ')).split(/\s+/).filter(Boolean).length;
}
