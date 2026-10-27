import type { Metadata } from 'next';
import Link from 'next/link';
import { Prose } from '@/components/Prose';
import { pageMetadata } from '@/lib/seo';
import { LEGAL_EFFECTIVE, LEGAL_UPDATED, SUPPORT_EMAIL } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  path: '/privacy',
  title: 'Privacy policy',
  description: 'What Semli collects, what it does with your schedules and syllabi, and what it never does.',
});

export default function PrivacyPage() {
  return (
    <main className="page">
      <Prose
        title="Privacy policy"
        lede="Your schedule is personal. Here’s what Semli processes to build your plan, where that information lives, and how to remove it."
        meta={
          <>
            <span>Effective {LEGAL_EFFECTIVE}</span>
            <span>Updated {LEGAL_UPDATED}</span>
          </>
        }
      >
        <section>
          <h2>1. Who we are</h2>
          <p>
            Semli (&ldquo;we&rdquo;, &ldquo;us&rdquo;) makes the Semli iPhone app and this website, including its schedule preview (together, the
            &ldquo;Service&rdquo;). This policy explains what information the Service handles and why. If you have a question it doesn&apos;t
            answer, email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
          </p>
        </section>

        <section>
          <h2>2. What we handle</h2>
          <h3>2.1 Content you send to be read</h3>
          <p>
            When you ask Semli to read something, you send it one of: a typed message, a screenshot or photo, or a PDF. Semli reads the
            dates, times, courses, employers, and tasks in it. Along with the content, the app sends today&apos;s date, your time zone, and
            the names of courses and employers you already have, so the result lines up with your existing plan. With a typed or dictated
            message, it also sends the titles and times of your timed events for the next three weeks, so a request like &ldquo;cardio before
            work&rdquo; can be placed around your shifts. Screenshots and PDFs don&apos;t include them. When a PDF turns out to be a
            syllabus or course schedule, Semli keeps what it read (the dates, times and course, not the file) under a fingerprint of the
            file for about a semester, so a classmate who imports the identical syllabus gets it at once. It isn&apos;t linked to your
            account, and work schedules are never kept.
          </p>
          <h3>2.2 Your plan</h3>
          <p>
            The events, tasks, courses, and work schedules Semli creates, plus your name if you enter one. This is stored on your device.
            If you create an account, a copy of your plan is saved to your account so a new phone can restore it; it is deleted when you
            delete the account. If you connect Canvas or Brightspace, the feed link you paste stays on your phone and isn&apos;t part of your account&apos;s
            copy, and your phone reads the feed from your school directly. These systems don&apos;t let web pages read their feeds, so in
            Semli on the web our server fetches the feed for you and passes it straight back without saving it. An import you haven&apos;t
            finished reviewing is kept on your device until you add it or discard it.
          </p>
          <h3>2.3 Your account, if you make one</h3>
          <p>
            An account is optional. If you sign up, our authentication provider stores your email address and any name you provide.
            Apple or Google sign-in supplies the account details you choose to share; Apple can provide a private relay email address.
            Passwords are stored hashed by our authentication provider. Each account, and each guest, gets an identifier so your plan,
            your subscription, and your free monthly imports stay attached to you.
          </p>
          <p>
            If you make an account, we send a welcome email from the founder, emails about your account, and a few emails a year
            about Semli, such as a reminder before a new semester. Every one of those update emails has an unsubscribe link.
          </p>
          <p>
            If you join the beta waitlist, we store your email address and any referral tag attached to your signup so we can send
            your invitation and track referrals. The website preview uses a hash of your IP address to count daily previews.
          </p>
          <h3>2.4 Purchases</h3>
          <p>
            If you subscribe to Plus, we receive a record of the purchase from Apple: which plan, when it started, and whether it is
            active or in a trial. We use it to unlock Plus on your devices. We never see your payment details.
          </p>
          <h3>2.5 How the app is used, and when it breaks</h3>
          <p>
            The app records how its features are used, such as finishing onboarding, starting an import, or opening the Plus page, along
            with a random identifier for your device. These records never include the titles, notes, or contents of your plan or of
            anything you import, and we use them only to understand which parts of Semli work and which don&apos;t.
          </p>
          <p>
            When the app crashes or an action fails, it sends a diagnostic report: the type of error, where in the code it happened, the
            app version, and your device model and iOS version. The app also measures things like how long it takes to start. Before a
            report leaves your phone, the app removes email addresses, links, codes, and anything that looks like a password or key.
          </p>
          <p>Neither kind of record is used for advertising or shared with advertisers or data brokers.</p>
          <h3>2.6 Things we don&apos;t collect</h3>
          <ul>
            <li>No account is required. We receive your email only if you provide it, such as by creating an account, joining the waitlist, or contacting us.</li>
            <li>No location, contacts, or health data.</li>
            <li>No phone number.</li>
            <li>No advertising identifiers, no tracking across other companies&apos; apps or websites, and no analytics on this website.</li>
            <li>No payment card details. App Store purchases are handled by Apple.</li>
          </ul>
          <h3>2.7 Permissions on iPhone</h3>
          <p>
            Photo access lets Semli show recent screenshots for you to choose from. You can limit access using your iPhone’s permission
            controls. Camera access lets you photograph a printed schedule. Only the image you choose to import is sent for reading.
          </p>
        </section>

        <section>
          <h2>3. How reading works, and who sees it</h2>
          <p>
            To read your content, the app sends it to our server, which passes it to the AI model provider Semli uses.
            The model returns a structured list of dates and items, and our server passes it back to you.
          </p>
          <ul>
            <li>
              <strong>We don&apos;t store it.</strong> Our server does not save the content you send or the result. It handles the request and
              forgets it. Logs record errors, not your content.
            </li>
            <li>
              <strong>It is not used for training.</strong> We use our AI provider&apos;s commercial service, whose terms do not allow your content
              to be used to train its models. The provider may keep requests for a limited time to monitor for abuse, then deletes them.
            </li>
            <li>
              <strong>The try-it box on this site works the same way.</strong> What you paste is read and shown back to you. It is not
              stored.
            </li>
          </ul>
        </section>

        <section>
          <h2>4. Why we handle it</h2>
          <ul>
            <li>To read your documents and build your plan. That is the product.</li>
            <li>To keep the Service working, find and fix crashes, and stop abuse.</li>
            <li>To understand which features people use, so we know what to improve.</li>
            <li>To process your Plus purchase and know which plan you&apos;re on.</li>
            <li>To answer you when you write to us.</li>
            <li>To email you about your account and, unless you unsubscribe, occasional Semli updates.</li>
          </ul>
          <p>We don&apos;t sell your information, and we don&apos;t share it with advertisers.</p>
        </section>

        <section>
          <h2>5. Who we share with</h2>
          <p>Only the services needed to run Semli:</p>
          <ul>
            <li>
              <strong>An AI model provider</strong> reads the content you send, as described in section 3.
            </li>
            <li>
              <strong>A hosting provider</strong> runs the website and the server that forwards your content.
            </li>
            <li>
              <strong>A database and authentication provider</strong> hosts accounts and plan backups, and counts free imports.
            </li>
            <li>
              <strong>An email delivery provider</strong> sends account emails and updates to the addresses on our list.
            </li>
            <li>
              <strong>A subscription management provider</strong> keeps track of Plus so it works across your devices.
            </li>
            <li>
              <strong>A product analytics provider</strong> receives the usage records described in section 2.5.
            </li>
            <li>
              <strong>An error monitoring provider</strong> receives the diagnostic reports described in section 2.5.
            </li>
            <li>
              <strong>Apple</strong> handles App Store purchases and, if you choose it, Sign in with Apple.
            </li>
            <li>
              <strong>Google</strong> handles sign-in if you choose Continue with Google.
            </li>
          </ul>
          <p>Each provider handles your information only to perform its service for Semli.</p>
          <p>We will also disclose information if the law requires it, or to protect the safety of people using the Service.</p>
        </section>

        <section>
          <h2>6. Where your data lives, and for how long</h2>
          <p>
            Your plan is stored on your device. If you create an account, our database provider also stores a backup so you can restore it on a new
            phone. Deleting the app does not delete your account or its cloud backup.
          </p>
          <p>
            Delete your account in Account settings to remove the account and its plan backup, and to take your address off our email list. Your local plan remains until you clear it
            separately. You can export a copy first. For the full steps, see <Link href="/delete-account">Delete your data</Link>.
          </p>
          <p>Usage records and diagnostic reports are kept for no longer than one year, then deleted.</p>
          <p>If you want a beta signup removed or need help with data you cannot delete in the app, email us.</p>
        </section>

        <section>
          <h2>7. Your choices</h2>
          <ul>
            <li>
              <strong>Review before it&apos;s added.</strong> You review AI imports before they become part of your plan. Connecting Canvas or Brightspace adds the assignments in your calendar feed, and with Plus, later feed updates are applied automatically.
            </li>
            <li>
              <strong>Undo.</strong> Open You → Your data → Recent changes to undo an import (for 180 days) or an edit (for 30 days). This history stays on your device.
            </li>
            <li>
              <strong>Delete.</strong> See <Link href="/delete-account">Delete your data</Link>.
            </li>
            <li>
              <strong>Ask us.</strong> Email <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> to ask what we hold about you, to correct
              it, or to have it deleted. If you live somewhere with privacy laws that give you specific rights (such as the EU, the UK, or
              California), those rights apply and we will honor them.
            </li>
          </ul>
        </section>

        <section>
          <h2>8. Children</h2>
          <p>
            Semli is for people 13 and older. We don&apos;t knowingly collect information from children under 13. If you think a child has
            used Semli, email us and we&apos;ll remove what we can.
          </p>
        </section>

        <section>
          <h2>9. Changes</h2>
          <p>
            We&apos;ll update this policy when the Service changes, and we&apos;ll note the date at the top. If a change matters, we&apos;ll tell
            you in the app or by email before it takes effect.
          </p>
        </section>

        <section>
          <h2>10. Contact</h2>
          <p>
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
          </p>
        </section>
      </Prose>
    </main>
  );
}
