import type { Metadata } from 'next';
import Link from 'next/link';
import { Prose } from '@/components/Prose';
import { pageMetadata } from '@/lib/seo';
import { LEGAL_EFFECTIVE, LEGAL_UPDATED, SUPPORT_EMAIL, TRIAL_DAYS } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  path: '/terms',
  title: 'Terms of service',
  description: 'The terms that govern your use of the Semli app and website.',
});

export default function TermsPage() {
  return (
    <main className="page">
      <Prose
        title="Terms of service"
        lede="Plain terms for a planner. The short version: use Semli for your own schedule, pay for Plus if you want it, and we'll do our best to read your dates right, with no promise of perfection."
        meta={
          <>
            <span>Effective {LEGAL_EFFECTIVE}</span>
            <span>Updated {LEGAL_UPDATED}</span>
          </>
        }
      >
        <section>
          <h2>1. Agreement</h2>
          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) are between you and Semli (&ldquo;Semli&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). They cover the Semli
            iPhone app, this website and its schedule preview, and the services behind them (together, the &ldquo;Service&rdquo;). By using the
            Service you agree to these Terms. If you don&apos;t agree, don&apos;t use the Service.
          </p>
          <p>
            We may change these Terms. If a change matters, we&apos;ll tell you in the app or by email before it takes effect. Using the
            Service after that means you accept the change.
          </p>
        </section>

        <section>
          <h2>2. What Semli does</h2>
          <p>Semli is a daily planner. You can:</p>
          <ul>
            <li>Keep a calendar and a list of tasks, and see what matters today.</li>
            <li>Send Semli a message, a screenshot, or a document (such as a syllabus or a work schedule) and have it read the dates, times, and tasks out of it.</li>
            <li>Review what it found, fix anything, and confirm it. Nothing is added until you confirm.</li>
            <li>Compare a new work schedule with the old one and see what changed.</li>
            <li>Get reminders for the things you&apos;ve added.</li>
          </ul>
          <p>
            Reading your documents is done by an AI model. It is good, not perfect. It can miss a date, misread a time, or get a day
            wrong. The review step exists so you can catch that. You are responsible for checking what Semli adds before you rely on it.
          </p>
        </section>

        <section>
          <h2>3. Who can use Semli</h2>
          <p>
            You must be at least 13 years old. If you are under 18, you need a parent or guardian&apos;s permission. You may use the
            Service only for your own schedule, or for someone who has asked you to manage theirs.
          </p>
        </section>

        <section>
          <h2>4. Your content</h2>
          <p>
            Everything you send to Semli stays yours: your messages, screenshots, documents, and the calendar that comes out of them. You
            give us permission to process that content only as needed to run the Service for you, as described in our{' '}
            <Link href="/privacy">Privacy Policy</Link>.
          </p>
          <p>
            Only send content you have the right to share. Don&apos;t upload other people&apos;s private information, and don&apos;t use Semli
            to store anything unlawful.
          </p>
        </section>

        <section>
          <h2>5. Accounts</h2>
          <p>
            You can use Semli as a guest or create an optional account for plan backup. If you create an account,
            you are responsible for keeping your sign-in private and for what happens under your account. Tell us at{' '}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> if you think someone else is using it.
          </p>
        </section>

        <section>
          <h2>6. Free plan and Semli Plus</h2>
          <h3>6.1 Free</h3>
          <p>
            The free plan has no time limit and needs no payment details. It includes a limited number of AI imports per month. We may
            change what the free plan includes, and we&apos;ll give notice before any material reduction.
          </p>
          <h3>6.2 Plus</h3>
          <p>
            Semli Plus is a paid subscription. The current prices and plans (monthly, semester, yearly) are shown on our{' '}
            <Link href="/pricing">pricing page</Link> and in the app. Prices are in US dollars and may differ by region.
          </p>
          <p>
            Student pricing is on the honor system. We don&apos;t verify enrollment; we trust you to pick the right price and to switch to
            the regular price when you are no longer a student.
          </p>
          <h3>6.3 Where you buy it</h3>
          <ul>
            <li>
              <strong>On iPhone:</strong> Plus is sold through Apple&apos;s App Store as an in-app purchase. Apple handles the payment under the{' '}
              <a href="https://www.apple.com/legal/internet-services/itunes/us/terms.html" target="_blank" rel="noopener noreferrer">
                Apple Media Services Terms
              </a>
              . Manage or cancel in your iPhone&apos;s Settings, under your name, then Subscriptions.
            </li>
            <li>
              <strong>On the web:</strong> This website offers a schedule preview. Web purchases of Plus are not currently available.
            </li>
          </ul>
          <h3>6.4 Trials and renewals</h3>
          <p>
            Eligible new subscribers can start with a {TRIAL_DAYS}-day free trial. Your eligibility and renewal price are shown before you subscribe. If you don&apos;t cancel before the trial ends, the
            plan starts and you are charged. Subscriptions renew automatically at the end of each period until you cancel. Cancelling
            stops the next charge; you keep Plus until the current period ends.
          </p>
          <h3>6.5 Refunds</h3>
          <p>
            App Store purchases follow Apple&apos;s refund rules; request a refund through Apple. If you need help understanding a charge,
            contact us at <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
          <h3>6.6 Price changes</h3>
          <p>We may change Plus prices. We&apos;ll tell you at least 30 days before a change affects an existing subscription.</p>
        </section>

        <section>
          <h2>7. Acceptable use</h2>
          <p>Don&apos;t:</p>
          <ul>
            <li>Break, overload, or probe the Service, or try to get around import limits.</li>
            <li>Use automated tools to send content to Semli in bulk, or resell access to the Service.</li>
            <li>Reverse engineer the app, except where the law allows it.</li>
            <li>Use the Service to harass anyone, or to process content you have no right to process.</li>
          </ul>
          <p>We may suspend or end access that breaks these rules.</p>
        </section>

        <section>
          <h2>8. Our rights</h2>
          <p>
            The Semli app, website, name, wordmark, and design are ours. These Terms give you a personal, non-transferable license to use
            the app on devices you own. Nothing here transfers any of our intellectual property to you.
          </p>
        </section>

        <section>
          <h2>9. Third-party services</h2>
          <p>
            Semli uses third-party services to work, including an AI provider to read your content, hosting providers, Apple&apos;s App
            Store, a database provider for accounts and backups, a subscription management provider, and analytics and error monitoring providers. Those services have their own terms. We are not responsible for them, and we don&apos;t control
            schools, employers, or scheduling systems whose documents you send us.
          </p>
        </section>

        <section>
          <h2>10. No warranty</h2>
          <p>
            The Service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;. We don&apos;t promise it will be error-free, uninterrupted, or
            that every date it reads will be right. To the fullest extent the law allows, we disclaim all warranties, express or implied.
          </p>
        </section>

        <section>
          <h2>11. Limitation of liability</h2>
          <p>
            Semli is a planning tool, not a guarantee. To the fullest extent the law allows, we are not liable for a missed deadline, a
            missed shift, a missed exam, or any indirect, incidental, special, or consequential damages arising from the Service. Our total
            liability for any claim is limited to the amount you paid us in the 12 months before the claim, or $50 if you paid nothing.
          </p>
        </section>

        <section>
          <h2>12. Ending things</h2>
          <p>
            You can stop using Semli at any time. See <Link href="/delete-account">Delete your data</Link> for how to remove what&apos;s
            stored. We may suspend or end your access if you break these Terms. Sections 4, 8, 10, 11, and 13 survive.
          </p>
        </section>

        <section>
          <h2>13. Disputes</h2>
          <p>
            These Terms are governed by the laws of the United States and the state where Semli is based, without regard to conflict-of-law
            rules. If something goes wrong, write to us first; most problems can be sorted out by email. Any claim that can&apos;t be resolved
            that way will be brought in the courts of that state.
          </p>
        </section>

        <section>
          <h2>14. Contact</h2>
          <p>
            Questions about these Terms: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
        </section>
      </Prose>
    </main>
  );
}
