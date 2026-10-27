import { redirect } from 'next/navigation';
import { APP_STORE_LIVE, APP_STORE_URL } from '../../lib/site';
import { cleanRef, logBetaClick } from '../../lib/waitlist';

/**
 * semli.app/beta is the one link on flyers, bios and creator posts. It counts the click (with
 * the `?r=` tag that names who sent it) and goes to the App Store listing once it is live (released
 * Oct 27, 2026); before that, to TestFlight when TESTFLIGHT_URL is set, or to the waitlist. The tag survives the hop so a signup still credits its source.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const ref = cleanRef(url.searchParams.get('r'));
  await logBetaClick(ref);
  if (APP_STORE_LIVE) redirect(APP_STORE_URL);
  const testflight = process.env.TESTFLIGHT_URL;
  redirect(testflight || `/${ref ? `?r=${encodeURIComponent(ref)}` : ''}#beta`);
}
