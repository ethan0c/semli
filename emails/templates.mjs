/**
 * Every marketing email, as data. `npm run email build` renders them through layout.mjs into
 * docs/emails; `npm run email send <name>` turns one into a Resend broadcast to its segment.
 *
 * Rules: under 80 words between the greeting and the sign-off, one action at most, no
 * re-explaining the product in every email, sentence case, the founder's voice signed Semli.
 * One ~accent word~ per heading, the only purple besides the wordmark dot and links.
 */

export const SURVEY_TESTFLIGHT = 'https://testflight.apple.com/join/vG3RD6EJ';
/** Logs the click in Supabase and forwards to the public Beta TestFlight link. */
export const BETA_LINK = 'https://semli.app/beta?r=email-waitlist';
export const APP_STORE_URL = 'https://apps.apple.com/us/app/semli-ai-student-planner/id6824600264';

/**
 * Groups in Resend. The free plan allows three segments, so there are exactly three:
 *
 *   Survey     the spring 2026 survey respondents
 *   Waitlist   people who signed up on semli.app
 *   App users  everyone with a Semli account (a confirmed, non-guest address in Supabase auth).
 *              The site adds each one after their welcome email; `npm run email sync` and every
 *              broadcast to the group reconcile it with Supabase. Was Testers until Oct 27, 2026.
 *
 * The three never overlap: an address with an account leaves Survey and Waitlist, so a
 * broadcast to several groups reaches each person once.
 */
export const segments = {
  survey: 'Survey',
  waitlist: 'Waitlist',
  users: 'App users',
};

/** Everyone who signed up for anything but has no account yet: one broadcast per segment. */
export const EVERYONE = ['survey', 'waitlist'];

/** The footer's reason for the App users copy of a broadcast. */
export const USERS_REASON = "You're getting this because you have a Semli account.";

const HI = 'Hi {{{FIRST_NAME|there}}},';

export const emails = {
  'survey-invite': {
    segment: 'survey',
    plan: 'Nov 3, 2026, once the Survey TestFlight link accepts testers',
    subject: 'An update on that student planner survey',
    preheader: 'The app you helped shape is ready to try on iPhone.',
    heading: 'Your Semli ~invite~.',
    greeting: HI,
    before: [
      "Earlier this year, you answered my survey about classes and work. I built Semli with your feedback, and it's ready to try.",
      'Add a syllabus or screenshot of your shifts, check the dates Semli finds, and save them to one calendar.',
    ],
    action: { label: 'Try Semli on iPhone', url: SURVEY_TESTFLIGHT, note: "Install Apple's free TestFlight app if prompted, then reopen this invite." },
    after: ["If a date's wrong or something's confusing, just reply here. I'd like to hear about it."],
    signoff: 'Thanks again,',
    reason: 'You shared your email in the student planning survey.',
    unsubscribe: true,
  },

  'public-beta-invite': {
    segment: 'waitlist',
    plan: 'When the public Beta group has room and TESTFLIGHT_URL is set on Vercel',
    subject: 'Your Semli beta invite is here',
    preheader: 'Try it with your own classes and work schedule.',
    heading: 'Your ~invite~ is here.',
    greeting: HI,
    before: [
      'You joined the waitlist, and the iPhone beta is ready. Thanks for waiting.',
      'Add a syllabus, screenshot of your shifts, or class message. Check the dates Semli finds before saving them to your calendar.',
    ],
    action: { label: 'Try Semli on iPhone', url: BETA_LINK, note: "Install Apple's free TestFlight app if prompted, then reopen this invite. Beta capped at 200 testers." },
    after: ["If something's wrong or confusing, just reply here. I read every reply."],
    signoff: 'Thanks for giving it a try,',
    reason: 'You joined the Semli beta waitlist.',
    unsubscribe: true,
  },

  'app-store-launch': {
    segment: EVERYONE,
    plan: 'Tue Nov 3, 2026, 10 am Eastern, once the listing is public (released early, Oct 26 plan)',
    subject: 'Semli is on the App Store',
    preheader: 'Your classes, shifts, and deadlines in one plan.',
    heading: 'Semli is on the ~App Store~.',
    greeting: HI,
    before: [
      'Thanks for following along. Semli is now available for iPhone.',
      'Bring your syllabi, work schedule and class messages into one plan. Calendar, to-dos and reminders are free, with five imports to start.',
    ],
    action: { label: 'Get Semli on iPhone', url: APP_STORE_URL },
    after: ["If you tried the beta, thank you for helping me get here. I'd love to hear how Semli fits into your week. Just reply here."],
    signoff: 'Thanks,',
    reason: 'You asked to hear when Semli launched.',
    unsubscribe: true,
  },

  'spring-schedule': {
    segment: [...EVERYONE, 'users'],
    plan: 'Tue Nov 17, 2026, 10 am Eastern: spring registration is open at most schools (Nov 2 to 23)',
    subject: 'Registered for spring? Add your classes now',
    preheader: 'One screenshot of your schedule fills the whole term.',
    heading: 'Spring, ~already planned~.',
    greeting: HI,
    before: [
      "If you've registered for spring, your new class times are already in your school's portal.",
      'Take a screenshot of that schedule and add it in Semli. Your classes repeat through the term, and you check each one before it saves.',
    ],
    action: { label: 'Get Semli on iPhone', url: APP_STORE_URL, note: 'Already have Semli? Open the app and tap Add.' },
    after: ['When your syllabi arrive in January, add them too, and the exams land on the same plan.'],
    signoff: 'Good luck with registration,',
    reason: 'You signed up for Semli updates.',
    unsubscribe: true,
  },

  'semester-reminder': {
    segment: [...EVERYONE, 'users'],
    plan: 'Tue Jan 5, 2027, 10 am Eastern: the week before most spring terms start (Jan 11 to 20)',
    subject: 'Got your new syllabus yet?',
    preheader: 'Start with one syllabus or a week of shifts.',
    heading: 'New semester, ~one plan~.',
    greeting: HI,
    before: [
      "If you're getting ready for a new semester, put your class dates and work shifts in one place.",
      'Add one syllabus or a week of shifts. Check the dates, save them, and add the rest as you get them.',
    ],
    action: { label: 'Get Semli on iPhone', url: APP_STORE_URL, note: 'Already have Semli? Open the app and tap Add.' },
    after: ["If an import doesn't look right, reply and tell me what happened."],
    signoff: 'Hope the semester starts well,',
    reason: 'You signed up for Semli updates.',
    unsubscribe: true,
  },
};

/**
 * Emails the site sends after something the person did, through the Resend templates of the
 * same name (`npm run email publish`; apps/web/app/api/emails sends `template: { id }`). Not
 * broadcasts, so no unsubscribe link and no contact fields: Resend leaves both empty in an API
 * send. {{{NAME}}} is the template variable the site fills with the first name ("there" if none).
 * Account emails may run past the 80-word limit; they have to say what happened in full.
 */
const HI_NAME = 'Hi {{{NAME}}},';

export const transactional = {
  welcome: {
    kind: 'account',
    plan: 'The day an account first has a confirmed address (database trigger, daily cron at 15:00 UTC)',
    subject: 'Welcome to Semli',
    preheader: 'Your plan now backs up to your account.',
    heading: 'Welcome to ~Semli~.',
    greeting: HI_NAME,
    before: [
      'Thanks for making a Semli account. Your plan now backs up to it, so a new phone picks up where this one left off.',
      "If you haven't yet, add one syllabus or a screenshot of your shifts. Check the dates Semli finds, then save them.",
    ],
    after: ['I read every reply. If a date came out wrong or something was confusing, reply and tell me. A sentence is plenty.'],
    signoff: 'Thanks,',
    reason: "You're getting this because you made a Semli account.",
    unsubscribe: false,
  },

  'account-deleted': {
    kind: 'account',
    plan: 'Right after an account is deleted (database trigger; the app asks the site to send at once)',
    subject: 'Your Semli account is deleted',
    preheader: 'What was removed, what stays on your phone, and what happens to Plus.',
    heading: 'Your account is deleted.',
    greeting: HI_NAME,
    before: [
      'Your sign-in, your email address and the plan backup are gone from our servers, and this is the last email we send to this address about it.',
      'The plan on your phone stays until you delete the app or clear it in You → Your data, and Semli keeps working there as a guest.',
      '*Deleting your account does not cancel Semli Plus.* Subscriptions belong to your Apple ID: open Settings, tap your name, then Subscriptions, and choose Semli.',
    ],
    after: ["If you didn't delete your account, reply to this email or write to hello@semli.app today."],
    signoff: 'Thanks for using Semli,',
    reason: 'This is an email about your Semli account.',
    unsubscribe: false,
  },
};

/** Template variables, with the words used when the sender leaves one out. */
export const templateVariables = {
  NAME: 'there',
  ABOUT: 'your message',
  REPLY: 'Thanks for writing.',
};

/**
 * The one-to-one reply. Not a broadcast: `email send feedback --to a@b.edu --name Ana
 * --about "the overlap warning" --reply "..."` fills it and sends it through the Emails API.
 */
export function feedbackThankYou({ name, about, reply }) {
  return {
    subject: 'Thanks for the Semli feedback',
    preheader: 'Thanks for taking the time to write.',
    heading: 'Thanks for ~letting me know~.',
    greeting: `Hi ${name || 'there'},`,
    before: [`Thanks for telling me about ${about}.`, reply],
    after: ["If there's anything else you'd like me to know, just reply here."],
    signoff: 'Thanks again,',
    reason: "You're receiving this reply because you sent feedback about Semli.",
    unsubscribe: false,
  };
}
