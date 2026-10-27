/**
 * A Canvas or Brightspace (D2L) calendar feed link on a real domain: never an IP address,
 * localhost or another port. Brightspace's is /d2l/le/calendar/feed/…/feed.ics?token=… (UGA's eLC).
 */
export function isCanvasFeed(url: string): boolean {
  const canvas = /^https:\/\/[^\s/]+\/feeds\/calendars\/[^\s/]+\.ics(\?\S*)?$/i.test(url);
  const brightspace = /^https:\/\/[^\s/]+\/d2l\/le\/calendar\/feed\/[^\s?]+\.ics\?\S*token=\S+$/i.test(url);
  if (!canvas && !brightspace) return false;
  const { hostname, port } = new URL(url);
  if (port) return false;
  return /^([a-z0-9-]+\.)+[a-z]{2,}$/i.test(hostname) && !/^\d+(\.\d+){3}$/.test(hostname);
}
