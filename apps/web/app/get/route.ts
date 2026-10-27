import { redirect } from 'next/navigation';
import { appStoreLink } from '../../lib/site';
import { cleanRef, logBetaClick } from '../../lib/waitlist';

/**
 * semli.app/get is the one link on postcards, bios, creator posts and emails. It counts the click
 * (with the `?r=` tag that names who sent it: `ig`, `tiktok`, `uga-e`) and opens the App Store
 * listing, carrying the tag as an App Store campaign when APP_STORE_PROVIDER_TOKEN is set, so
 * installs are counted per tag too. The clicks table is still called `beta_clicks`; semli.app/beta,
 * the pre-launch link, sends people here forever, so anything already printed or posted works.
 */
export async function GET(request: Request) {
  const ref = cleanRef(new URL(request.url).searchParams.get('r'));
  await logBetaClick(ref);
  redirect(appStoreLink(ref, process.env.APP_STORE_PROVIDER_TOKEN));
}
