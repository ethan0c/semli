import type { Metadata } from 'next';
import { Prose } from '@/components/Prose';
import { LEGAL_UPDATED, SUPPORT_EMAIL } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Delete your data',
  description: 'How to remove everything Semli has stored, and what that covers.',
  robots: { index: false, follow: true },
};

export default function DeleteAccountPage() {
  return (
    <main className="page">
      <Prose
        title="Delete your data"
        lede="You can delete your account and cloud backup, clear the plan on your phone, or do both. Here’s where to find each option."
        meta={<span>Updated {LEGAL_UPDATED}</span>}
      >
        <section>
          <h2>Delete your account and cloud backup</h2>
          <ol>
            <li>Open Semli and tap You.</li>
            <li>Open Account settings.</li>
            <li>Tap Delete account, then confirm with Delete my account.</li>
          </ol>
          <p>
            This deletes your sign-in account and its plan backup. Your plan stays on this phone.
            To remove both copies, delete your account first, then clear the local plan using the steps below.
          </p>
        </section>

        <section>
          <h2>Clear the plan on your phone</h2>
          <ol>
            <li>Open Semli and tap the You tab.</li>
            <li>Open Your data.</li>
            <li>Tap Clear everything, then Clear to confirm.</li>
          </ol>
          <p>
            This removes the events, tasks, courses, work schedules, and import history stored in the app. It cannot be undone.
            You can use Export my plan first if you want a copy. Clearing the plan does not delete your account.
          </p>
        </section>

        <section>
          <h2>Uploads and waitlist signups</h2>
          <p>
            Semli’s servers do not save the original messages or files you send to be read. Account information and plan backups
            are separate from uploads. See the <a href="/privacy">Privacy Policy</a> for details.
          </p>
          <p>
            If you joined the waitlist before launch, email us to remove your signup. You can also contact us if you no longer have access
            to the app and need help deleting an account.
          </p>
        </section>

        <section>
          <h2>Plus subscriptions</h2>
          <p>
            Deleting your account or clearing your plan does not cancel Plus. On your iPhone, open Settings, tap your name,
            then Subscriptions, and choose Semli to cancel.
          </p>
        </section>

        <section>
          <h2>Need a hand?</h2>
          <p>
            Email <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Delete my data')}`}>{SUPPORT_EMAIL}</a> and we&apos;ll
            confirm what, if anything, we hold about you and remove it.
          </p>
        </section>
      </Prose>
    </main>
  );
}
