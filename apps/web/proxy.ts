import { NextResponse, type NextRequest } from 'next/server';

/**
 * semli.app serves the API itself and sends everything else to www.semli.app.
 *
 * The App Store build (1.1.2, Oct 23, 2026) calls https://semli.app/api/…. A redirect to www drops
 * the Authorization header (the fetch standard), so every import from a fresh download arrived
 * signed out and said "close and reopen Semli" until the OTA update took over on the second
 * launch. Answering /api/* on the bare domain fixes those installs without a new build; pages
 * still move to www, so search engines see one site.
 */
export function proxy(request: NextRequest) {
  const host = request.headers.get('host')?.toLowerCase();
  const { pathname, search } = request.nextUrl;
  if (host === 'semli.app' && !pathname.startsWith('/api/')) {
    return NextResponse.redirect(`https://www.semli.app${pathname}${search}`, 308);
  }
  return NextResponse.next();
}

export const config = {
  // Everything but Next's own build files, which are only ever requested from the page's own host.
  matcher: ['/((?!_next/static|_next/image).*)'],
};
