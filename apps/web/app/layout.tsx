import type { Metadata, Viewport } from 'next';
import { EB_Garamond, Geist } from 'next/font/google';
import { NoSave } from '@/components/NoSave';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { HOME_TITLE, pageMetadata } from '@/lib/seo';
import { APP_STORE_ID, APP_STORE_URL, DESCRIPTION, KEYWORDS, PLUS_PLANS, SITE_URL, SUPPORT_EMAIL } from '@/lib/site';
import { sitePalettes, TOKENS_CSS } from './tokens';
import './globals.css';

/** Geist everywhere, the same as the app (CLAUDE.md). */
const sans = Geist({ subsets: ['latin'], weight: ['300', '400', '500', '600'], variable: '--font-sans', display: 'swap' });
/** The marketing face: a serif for the few headlines that speak for the brand (site hero and closing; paywall and welcome in the app). */
const serif = EB_Garamond({ subsets: ['latin'], weight: 'variable', style: ['normal', 'italic'], variable: '--font-serif', display: 'swap' });

export const metadata: Metadata = {
  ...pageMetadata({ path: '/' }),
  /** Home's cards are the fallback, but the canonical stays per page so the 404 never points at home. */
  alternates: undefined,
  metadataBase: new URL(SITE_URL),
  title: { default: HOME_TITLE, template: '%s · Semli' },
  keywords: KEYWORDS,
  applicationName: 'Semli',
  robots: { index: true, follow: true },
  /** Safari's Smart App Banner, once there is a listing to open. */
  itunes: { appId: APP_STORE_ID },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: sitePalettes.light.canvas },
    { media: '(prefers-color-scheme: dark)', color: sitePalettes.dark.canvas },
  ],
};

/** Structured data for search engines: who we are, what the app is, and that the site is searchable by name. */
const JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#org`,
      name: 'Semli',
      url: SITE_URL,
      logo: { '@type': 'ImageObject', url: `${SITE_URL}/icon.png`, width: 512, height: 512 },
      email: SUPPORT_EMAIL,
      description: DESCRIPTION,
      sameAs: [APP_STORE_URL],
    },
    /** alternateName gives Google the site name for the result header; it was guessing "semli.app". */
    { '@type': 'WebSite', '@id': `${SITE_URL}/#site`, url: SITE_URL, name: 'Semli', alternateName: ['Semli planner', 'semli.app'], publisher: { '@id': `${SITE_URL}/#org` } },
    {
      '@type': 'SoftwareApplication',
      '@id': `${SITE_URL}/#app`,
      name: 'Semli',
      alternateName: 'Semli: AI Student Planner',
      /** Search folds "semli" into an unrelated family planner; say plainly which app this is. */
      disambiguatingDescription: 'Semli is a daily planner for college students who juggle classes, shifts and deadlines. It is not a family or care-coordination planner.',
      publisher: { '@id': `${SITE_URL}/#org` },
      applicationCategory: 'ProductivityApplication',
      operatingSystem: 'iOS',
      description: DESCRIPTION,
      url: SITE_URL,
      downloadUrl: APP_STORE_URL,
      offers: [
        { '@type': 'Offer', price: '0', priceCurrency: 'USD', description: 'Free plan' },
        ...PLUS_PLANS.map((p) => ({ '@type': 'Offer', price: p.student.toFixed(2), priceCurrency: 'USD', description: `Semli Plus, ${p.name.toLowerCase()}, student price` })),
      ],
    },
  ],
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`} data-scroll-behavior="smooth">
      <head>
        {/* Colors, type, motion and radius from @dayli/tokens; globals.css only consumes them. */}
        <style id="semli-tokens" dangerouslySetInnerHTML={{ __html: TOKENS_CSS }} />
      </head>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
        <div className="wrap">
          <SiteHeader />
          {children}
          <SiteFooter />
        </div>
        <NoSave />
      </body>
    </html>
  );
}
