import { redirect } from 'next/navigation';
import { APP_STORE_LIVE, appStoreLink } from '../../lib/site';
import { cleanRef, logBetaClick } from '../../lib/waitlist';

/**
 * semli.app/beta is the one link on flyers, bios, creator posts and emails. It counts the click
 * (with the `?r=` tag that names who sent it) and goes to the App Store listing once it is live
 * (released Oct 27, 2026), carrying the same tag as an App Store campaign when
 * APP_STORE_PROVIDER_TOKEN is set, so installs are counted per tag too. Before the release, to
 * TestFlight when TESTFLIGHT_URL is set, or to the waitlist. The tag survives the hop so a signup
 * still credits its source.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const ref = cleanRef(url.searchParams.get('r'));
  await logBetaClick(ref);
  if (APP_STORE_LIVE) redirect(appStoreLink(ref, process.env.APP_STORE_PROVIDER_TOKEN));
  const testflight = process.env.TESTFLIGHT_URL;
  redirect(testflight || `/${ref ? `?r=${encodeURIComponent(ref)}` : ''}#beta`);
}
