import { MIN_IOS_VERSION } from '../../../lib/site';

/** The iPhone app asks this on launch; see `MIN_IOS_VERSION`. A change here goes out with a deploy. */
export function GET() {
  return Response.json({ minIosVersion: MIN_IOS_VERSION });
}
