/**
 * Site-wide facts used by metadata, the footer, pricing, and the legal pages.
 * Prices mirror docs/pricing-and-positioning.md; change them in both places.
 */

/** The address Vercel serves (the apex 308s here); canonicals, sitemap and structured data must match it. */
export const SITE_URL = 'https://www.semli.app';
/** The planner on the web: the Expo app's web build, signed in. */
export const APP_URL = 'https://app.semli.app';
/** Flip once the web planner is deployed (docs/web.md); until then the header links nowhere new. */
export const WEB_APP_LIVE = false;
export const SITE_NAME = 'Semli';
/** The App Store record (not live yet); the listing name is "Semli: AI Student Planner". */
export const APP_STORE_ID = '6824600264';
export const APP_STORE_URL = 'https://apps.apple.com/us/app/semli-ai-student-planner/id6824600264';

/**
 * The listing with an App Store Connect campaign, so App Analytics → Campaigns counts installs
 * per tag. `providerToken` is the account's `pt` (App Store Connect → App Analytics → Campaigns →
 * Generate campaign link); without it, or without a tag, this is the plain listing. Apple keeps
 * campaign names to 40 characters.
 */
export function appStoreLink(campaign: string | null, providerToken: string | null | undefined): string {
  const pt = providerToken?.trim();
  if (!campaign || !pt || !/^\d+$/.test(pt)) return APP_STORE_URL;
  return `${APP_STORE_URL}?pt=${pt}&ct=${encodeURIComponent(campaign.slice(0, 40))}&mt=8`;
}
/** Flip when the App Store listing goes live; until then app links lead to the beta waitlist. */
export const APP_STORE_LIVE = true;
export const SUPPORT_EMAIL = 'hello@semli.app';

/** Search terms the site is written to answer; used in metadata and the landing pages. */
export const KEYWORDS = ['student planner', 'daily planner for college students', 'syllabus to calendar', 'assignment tracker', 'work and school schedule planner', 'college schedule app', 'class schedule planner'];

export const TAGLINE = 'The daily planner for college students.';
export const DESCRIPTION =
  'Turn syllabi, work schedules, and messages into one plan for your classes, shifts, and deadlines. See what matters today with Semli.';

/**
 * Semli Plus. Semester uses the store's six-month term. Student pricing is on the honor system:
 * nothing is verified; the toggle just says we trust you.
 */
export type PlanId = 'monthly' | 'semester' | 'yearly';
export interface Plan {
  id: PlanId;
  name: string;
  months: number;
  student: number;
  regular: number;
  billed: string;
  tag?: string;
}
export const PLUS_PLANS: readonly Plan[] = [
  { id: 'monthly', name: 'Monthly', months: 1, student: 4.99, regular: 7.99, billed: 'monthly' },
  { id: 'semester', name: '6 months', months: 6, student: 14.99, regular: 24.99, billed: 'every 6 months' },
  { id: 'yearly', name: 'Yearly', months: 12, student: 24.99, regular: 44.99, billed: 'yearly', tag: 'Best value' },
];
export const plan = (id: PlanId) => PLUS_PLANS.find((p) => p.id === id)!;
export const money = (n: number) => `$${n.toFixed(2)}`;
/** The free allowance; must match apps/mobile/src/lib/plans.ts: 5 imports in the first 30 days, then 3 a month. */
export const FREE_IMPORTS_TO_START = 5;
export const START_WINDOW_DAYS = 30;
export const FREE_IMPORTS_PER_MONTH = 3;
export const TRIAL_DAYS = 7;

/** Legal pages show these; bump when the text changes. */
export const LEGAL_EFFECTIVE = 'October 27, 2026';
export const LEGAL_UPDATED = 'October 27, 2026';

export function absoluteUrl(path: string) {
  return path === '/' ? SITE_URL : `${SITE_URL}${path}`;
}
