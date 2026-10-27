/** A thin Resend client on fetch. Two requests a second is Resend's default limit. */

const BASE = 'https://api.resend.com';
let last = 0;

export class ResendError extends Error {
  constructor(status, body) {
    super(`Resend ${status}: ${body?.message ?? JSON.stringify(body)}`);
    this.status = status;
    this.name = body?.name;
  }
}

export function client(apiKey) {
  async function call(method, path, body, form) {
    const wait = 600 - (Date.now() - last);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    const res = await fetch(BASE + path, {
      method,
      headers: { authorization: `Bearer ${apiKey}`, ...(form ? {} : { 'content-type': 'application/json' }) },
      body: form ?? (body ? JSON.stringify(body) : undefined),
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : null;
    if (!res.ok) throw new ResendError(res.status, json);
    return json;
  }

  async function all(path) {
    const out = [];
    let after;
    for (;;) {
      const sep = path.includes('?') ? '&' : '?';
      const page = await call('GET', `${path}${sep}limit=100${after ? `&after=${after}` : ''}`);
      out.push(...(page.data ?? []));
      if (!page.has_more || !page.data?.length) return out;
      after = page.data[page.data.length - 1].id;
    }
  }

  return {
    segments: () => all('/segments'),
    createSegment: (name) => call('POST', '/segments', { name }),
    renameSegment: (id, name) => call('PATCH', `/segments/${id}`, { name }),
    contacts: (segmentId) => all(segmentId ? `/contacts?segment_id=${segmentId}` : '/contacts'),
    contact: (email) => call('GET', `/contacts/${encodeURIComponent(email)}`).catch((err) => { if (err.status === 404) return null; throw err; }),
    // Resend's create overwrites an existing contact, unsubscribed flag included: call it only after contact() returns null.
    createContact: (c) => call('POST', '/contacts', c),
    updateContact: (email, c) => call('PATCH', `/contacts/${encodeURIComponent(email)}`, c),
    addToSegment: (email, segmentId) => call('POST', `/contacts/${encodeURIComponent(email)}/segments/${segmentId}`),
    removeFromSegment: (email, segmentId) => call('DELETE', `/contacts/${encodeURIComponent(email)}/segments/${segmentId}`),
    deleteContact: (email) => call('DELETE', `/contacts/${encodeURIComponent(email)}`),
    properties: () => all('/contact-properties'),
    createProperty: (key) => call('POST', '/contact-properties', { key, type: 'string' }),
    broadcasts: () => all('/broadcasts'),
    createBroadcast: (b) => call('POST', '/broadcasts', b),
    sendEmail: (e) => call('POST', '/emails', e),
  };
}
