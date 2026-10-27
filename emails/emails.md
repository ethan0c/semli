# Semli emails

Every word in Semli's emails lives here. Edit the text, then:

- `npm run email preview` opens every email side by side in the browser.
- `npm run email publish` updates the Resend template of the same name. The site sends `welcome` and `account-deleted` from those templates, so publish and the change is live.
- `npm run email send <name>` builds a broadcast from this file at the moment you send it.

How to write here:

- `## name` starts an email. The name is its Resend template, so don't rename one that already exists.
- `To:` is who gets it: `Survey`, `Waitlist`, `App users`, several joined with `+`, or `one person`. `Kind: account` marks an email the site sends about someone's account: no unsubscribe link, and it may run past 80 words.
- `When:` is the plan for sending it. `Subject:`, `Preview:` (the grey line inboxes show after the subject), `Sign-off:` and `Footer:` (one sentence on why they got it) set those parts.
- `### Heading` is the big heading. Put one word or phrase in `~tildes~` to make it the one purple accent.
- The first paragraph is the greeting. `{name}` is the person's first name, or "there" when we don't have it.
- `[words](https://…)` is a purple underlined link. `**words**` is medium weight.
- `Button: [label](https://…)` is the one black pill button. Paragraphs above it sit above it, the rest below.
- `> text` right after the button is the small grey note under it.
- In `feedback-thank-you`, `{about}` and `{reply}` are filled by the send command.

Our voice: plain words, short sentences, sentence case and never all caps, no em or en dashes. Under 80 words from the greeting to the sign-off for anything sent to a group, one action at most, the founder's voice signed Semli.

## survey-invite

To: Survey
When: Nov 3, 2026, once the Survey TestFlight link accepts testers
Subject: An update on that student planner survey
Preview: The app you helped shape is ready to try on iPhone.
Sign-off: Thanks again,
Footer: You shared your email in the student planning survey.

### Your Semli ~invite~.

Hi {name},

Earlier this year, you answered my survey about classes and work. I built Semli with your feedback, and it's ready to try.

Add a syllabus or screenshot of your shifts, check the dates Semli finds, and save them to one calendar.

Button: [Try Semli on iPhone](https://testflight.apple.com/join/vG3RD6EJ)

> Install Apple's free TestFlight app if prompted, then reopen this invite.

If a date's wrong or something's confusing, just reply here. I'd like to hear about it.

## public-beta-invite

To: Waitlist
When: When the public Beta group has room and TESTFLIGHT_URL is set on Vercel
Subject: Your Semli beta invite is here
Preview: Try it with your own classes and work schedule.
Sign-off: Thanks for giving it a try,
Footer: You joined the Semli beta waitlist.

### Your ~invite~ is here.

Hi {name},

You joined the waitlist, and the iPhone beta is ready. Thanks for waiting.

Add a syllabus, screenshot of your shifts, or class message. Check the dates Semli finds before saving them to your calendar.

Button: [Try Semli on iPhone](https://semli.app/beta?r=email-waitlist)

> Install Apple's free TestFlight app if prompted, then reopen this invite. Beta capped at 200 testers.

If something's wrong or confusing, just reply here. I read every reply.

## app-store-launch

To: Survey + Waitlist
When: Tue Nov 3, 2026, 10 am Eastern, once the listing is public (released early, Oct 26 plan)
Subject: Semli is on the App Store
Preview: Your classes, shifts, and deadlines in one plan.
Sign-off: Thanks,
Footer: You asked to hear when Semli launched.

### Semli is on the ~App Store~.

Hi {name},

Thanks for following along. Semli is now available for iPhone.

Bring your syllabi, work schedule and class messages into one plan. Calendar, to-dos and reminders are free, with five imports to start.

Button: [Get Semli on iPhone](https://apps.apple.com/us/app/semli-ai-student-planner/id6824600264)

If you tried the beta, thank you for helping me get here. I'd love to hear how Semli fits into your week. Just reply here.

## spring-schedule

To: Survey + Waitlist + App users
When: Tue Nov 17, 2026, 10 am Eastern: spring registration is open at most schools (Nov 2 to 23)
Subject: Registered for spring? Add your classes now
Preview: One screenshot of your schedule fills the whole term.
Sign-off: Good luck with registration,
Footer: You signed up for Semli updates.

### Spring, ~already planned~.

Hi {name},

If you've registered for spring, your new class times are already in your school's portal.

Take a screenshot of that schedule and add it in Semli. Your classes repeat through the term, and you check each one before it saves.

Button: [Get Semli on iPhone](https://apps.apple.com/us/app/semli-ai-student-planner/id6824600264)

> Already have Semli? Open the app and tap Add.

When your syllabi arrive in January, add them too, and the exams land on the same plan.

## semester-reminder

To: Survey + Waitlist + App users
When: Tue Jan 5, 2027, 10 am Eastern: the week before most spring terms start (Jan 11 to 20)
Subject: Got your new syllabus yet?
Preview: Start with one syllabus or a week of shifts.
Sign-off: Hope the semester starts well,
Footer: You signed up for Semli updates.

### New semester, ~one plan~.

Hi {name},

If you're getting ready for a new semester, put your class dates and work shifts in one place.

Add one syllabus or a week of shifts. Check the dates, save them, and add the rest as you get them.

Button: [Get Semli on iPhone](https://apps.apple.com/us/app/semli-ai-student-planner/id6824600264)

> Already have Semli? Open the app and tap Add.

If an import doesn't look right, reply and tell me what happened.

## welcome

Kind: account
When: The day an account first has a confirmed address (database trigger, daily cron at 15:00 UTC)
Subject: Welcome to Semli
Preview: Your plan now backs up to your account.
Sign-off: Thanks,
Footer: You're getting this because you made a Semli account.

### Welcome to ~Semli~.

Hi {name},

Thanks for making a Semli account. Your plan now backs up to it, so a new phone picks up where this one left off.

If you haven't yet, add one syllabus or a screenshot of your shifts. Check the dates Semli finds, then save them.

I read every reply. If a date came out wrong or something was confusing, reply and tell me. A sentence is plenty.

## account-deleted

Kind: account
When: Right after an account is deleted (database trigger; the app asks the site to send at once)
Subject: Your Semli account is deleted
Preview: What was removed, what stays on your phone, and what happens to Plus.
Sign-off: Thanks for using Semli,
Footer: This is an email about your Semli account.

### Your account is deleted.

Hi {name},

Your sign-in, your email address and the plan backup are gone from our servers, and this is the last email we send to this address about it.

The plan on your phone stays until you delete the app or clear it in You → Your data, and Semli keeps working there as a guest.

**Deleting your account does not cancel Semli Plus.** Subscriptions belong to your Apple ID: open Settings, tap your name, then Subscriptions, and choose Semli.

If you didn't delete your account, reply to this email or write to [hello@semli.app](mailto:hello@semli.app) today.

## feedback-thank-you

To: one person
When: Reply after reading their message: npm run email send feedback --to a@b.edu --name Ana --about "…" --reply "…"
Subject: Thanks for the Semli feedback
Preview: Thanks for taking the time to write.
Sign-off: Thanks again,
Footer: You're receiving this reply because you sent feedback about Semli.

### Thanks for ~letting me know~.

Hi {name},

Thanks for telling me about {about}.

{reply}

If there's anything else you'd like me to know, just reply here.

