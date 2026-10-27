import type { Metadata } from 'next';
import { LandingPage } from '@/components/LandingPage';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  path: '/assignment-tracker',
  title: 'Assignment tracker',
  description: 'Bring assignment dates from syllabi, screenshots, and messages into one plan. Review the details, see what’s coming up, and set reminders with Semli.',
  shareTitle: 'Keep assignment dates in one place',
  ownCard: true,
});

export default function AssignmentTrackerPage() {
  return (
    <LandingPage
      path="/assignment-tracker"
      name="Assignment tracker"
      title="Keep assignment dates in one place."
      lede="Due dates arrive in syllabi, Canvas, Brightspace, emails, and group chats. Bring them into Semli, check the details, and see what’s due alongside the rest of your week."
      steps={[
        { title: 'Send what you have', body: 'Upload a syllabus or screenshot, or paste a message such as “paper due Friday.” Review the dates before adding them.' },
        { title: 'See what’s coming up', body: 'Check today’s priorities and upcoming deadlines. Completed tasks stay out of the way.' },
        { title: 'Choose your reminders', body: 'Get a heads-up the day before or the morning an assignment is due. Adjust reminder times and quiet hours in settings.' },
      ]}
      detail={
        <>
          <h2>One list, every class</h2>
          <p>
            Each assignment keeps its course, so you can look at one class on the School tab or everything at once on Today.
            See how exams and quizzes fit around shifts, labs, and the time you have to prepare.
          </p>
          <h2>Assignments posted outside Canvas</h2>
          <p>
            An assignment in an email matters just as much as one in Canvas. Send a screenshot or paste the message so you can
            keep those dates together, even when your classes use different systems.
          </p>
          <h2>Check the details before you add them</h2>
          <p>
            Review the assignments Semli finds, correct a date or time if needed, and choose what to add.
            You can edit an assignment later or undo the import.
          </p>
        </>
      }
      faqs={[
        { q: 'Is the assignment tracker free?', a: 'Yes. The calendar, to-dos, reminders, and repeating classes are free with no time limit. Reading syllabi and screenshots uses AI imports; the free plan starts with five, then three a month.' },
        { q: 'Does it sync with Canvas or Brightspace?', a: 'Yes. Paste your Canvas calendar feed link, or your Brightspace calendar’s Subscribe link (eLC at UGA), once to import your assignments. With Plus, Semli checks for updates when you open the app, so a moved due date moves in Semli too. Screenshots of the Canvas to-do list and syllabus PDFs work as well.' },
        { q: 'Can I add an assignment by hand?', a: 'Yes, and it never counts as an import. Tap the plus button and type it.' },
        { q: 'What happens when a due date changes?', a: 'You can edit the assignment directly. If it came from a connected Canvas or Brightspace feed, Plus checks for updates when you open the app and moves the due date to match.' },
      ]}
      related={[
        { href: '/syllabus-to-calendar', label: 'Syllabus to calendar' },
        { href: '/work-and-school-schedule-planner', label: 'Work and school schedule planner' },
      ]}
    />
  );
}
