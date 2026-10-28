# Semli emails

Edit Semli's email copy here, then use one of these commands:

- `npm run email preview` opens all the emails side by side in your browser.
- `npm run email publish` updates the matching templates in Resend. Publishing changes to `welcome` and `account-deleted` makes them live for the next account email.
- `npm run email send <name>` uses the latest copy in this file to build a broadcast.

How this file works:

- `## name` starts an email. It also names the Resend template, so keep existing names as they are.
- `To:` names the recipients: `Survey`, `Waitlist`, `App users`, or `one person`. Join groups with `+` to include more than one. Use `Kind: account` for account emails. These have no unsubscribe link and can be longer than 80 words.
- `When:` says when to send it. `Subject:` sets the subject line. `Preview:` is the grey text shown beside it in the inbox. `Sign-off:` is the closing line, and `Footer:` explains why the person got the email.
- `### Heading` sets the main heading. Wrap one word or phrase in `~tildes~` to turn it purple.
- Start with a greeting. `{name}` becomes the person's first name, or "there" if we don't have it.
- Use `[words](https://…)` for a purple underlined link and `**words**` for medium weight text.
- `Button: [label](https://…)` adds a black pill button. Paragraphs appear above or below it in the same order as this file. Use only one button per email.
- Put `> text` immediately after the button to add a small grey note beneath it.
- Link to the app with `https://www.semli.app/get?r=email-<name>`, never the App Store directly. The site counts the click under that tag and passes it on to the App Store as a campaign, so App Store Connect counts installs per email too.
- The send command fills in `{about}` and `{reply}` in `feedback-thank-you`.

Write like the founder talking to one person, and sign off as Semli. Use everyday words, short sentences, and sentence case. Skip all caps and em or en dashes. Keep group emails under 80 words from greeting to sign-off, with one main thing to do. Say what the person can do next without promising that a backup, import, or reminder has already worked.

## survey-invite

To: Survey
When: Sent Wed Oct 28, 2026, 10 am Eastern: the launch, for the survey respondents (they gave their emails on the survey form, so they get their own email)
Subject: An update on that student planner survey
Preview: Your survey feedback helped me build Semli. You can try it now.
Sign-off: Thanks again,
Footer: You shared your email in the student planning survey.

### Thanks for helping me build ~Semli~.

Hi {name},

A while back, you answered my survey about balancing classes and work. I used your feedback to build Semli, and it's ready to try.

Start with a syllabus or screenshot of your shifts. Check the dates Semli finds, then add them to your plan.

Button: [Get Semli on iPhone](https://www.semli.app/get?r=email-survey)

If something looks wrong or feels confusing, just reply and let me know.

## public-beta-invite

To: Waitlist
When: Retired Oct 27, 2026: there is no beta; app-store-launch went to the Waitlist group instead
Subject: You're invited to try Semli
Preview: Add your own syllabus or work schedule and see how it goes.
Sign-off: Thanks for giving it a try,
Footer: You joined the Semli waitlist.

### Your Semli ~invite~ is here.

Hi {name},

Thanks for joining the waitlist. Semli is ready for you to try on your iPhone.

Try adding a syllabus, a screenshot of your shifts, or a class message. Check the dates Semli finds before saving them to your plan.

Button: [Get Semli on iPhone](https://www.semli.app/get?r=email-waitlist)

I'd love to hear how it goes. You can reply to this email.

## app-store-launch

To: Waitlist
When: Sent Wed Oct 28, 2026, 10 am Eastern, the morning after the listing went public (was Nov 3; the app released Oct 27)
Subject: Semli is on the App Store
Preview: Bring your classes, shifts, and deadlines into one plan.
Sign-off: Thanks,
Footer: You joined the Semli waitlist.

### Semli is on the ~App Store~.

Hi {name},

You can now download Semli for iPhone. Thanks for following along while I built it.

Add a syllabus, work schedule, or class message to put your dates in one place. You can connect Canvas or Brightspace too. The calendar, to-dos, and reminders are free, with five imports to start.

Button: [Get Semli on iPhone](https://www.semli.app/get?r=email-launch)

Let me know how it fits into your week. Just reply here.

## spring-schedule

To: Survey + Waitlist + App users
When: Tue Nov 17, 2026, 10 am Eastern: spring registration is open at most schools (Nov 2 to 23)
Subject: Picked your spring classes?
Preview: Add them to Semli with a screenshot of your schedule.
Sign-off: Hope registration goes smoothly,
Footer: You signed up for Semli updates.

### Add your ~spring classes~.

Hi {name},

Once you've registered for spring, take a screenshot of the schedule in your school's portal.

Add it in Semli, check the class times, and save. Your classes will repeat through the term.

Button: [Get Semli on iPhone](https://www.semli.app/get?r=email-spring)

> Already have Semli? Open the app and tap Add.

When your syllabi arrive, add those too for your exams and deadlines.

## semester-reminder

To: Survey + Waitlist + App users
When: Tue Jan 5, 2027, 10 am Eastern: the week before most spring terms start (Jan 11 to 20)
Subject: Got a syllabus for the new semester?
Preview: You can start with one syllabus and add the rest later.
Sign-off: Hope your semester starts well,
Footer: You signed up for Semli updates.

### Start with ~one syllabus~.

Hi {name},

If you've got a syllabus for the new semester, that's enough to get started.

Add it in Semli, check the dates, and save them to your plan. Add your work shifts whenever you have them.

Button: [Get Semli on iPhone](https://www.semli.app/get?r=email-semester)

> Already have Semli? Open the app and tap Add.

If a date looks wrong, reply and tell me what happened.

## welcome

Kind: account
When: 45 to 55 minutes after an account first has a confirmed address (database trigger, sent by the 10-minute database schedule)
Subject: Welcome to Semli
Preview: Start with a syllabus, a work schedule, or a class message.
Sign-off: Thanks,
Footer: You got this email because you created a Semli account.

### Welcome to ~Semli~.

Hi {name},

Thanks for signing up. Your account lets you back up your plan and bring it to a new phone.

Start with a syllabus or screenshot of your shifts. Check the dates Semli finds before saving them to your plan.

If anything looks wrong or you're not sure how something works, reply and tell me. I read every reply.

## account-deleted

Kind: account
When: Right after an account is deleted (database trigger; the app asks the site to send at once)
Subject: Your Semli account has been deleted
Preview: Your account and backup are deleted. Cancel Plus separately if you have it.
Sign-off: Thanks for using Semli,
Footer: This confirms that your Semli account was deleted.

### Your account has been deleted.

Hi {name},

We've deleted your Semli account and its plan backup. The app also clears the plan on the device where you deleted your account.

You can still use Semli on your iPhone without an account.

**Deleting your account does not cancel Semli Plus.** If you have a subscription, open your iPhone's Settings, tap your name, then Subscriptions, and choose Semli to cancel it.

If you didn't ask to delete your account, please reply or email [hello@semli.app](mailto:hello@semli.app).

## feedback-thank-you

To: one person
When: Reply after reading their message: npm run email send feedback --to a@b.edu --name Ana --about "…" --reply "…"
Subject: Thanks for writing about Semli
Preview: A reply to your feedback.
Sign-off: Thanks again,
Footer: This is a reply to the feedback you sent about Semli.

### Thanks for ~letting me know~.

Hi {name},

Thanks for telling me about {about}.

{reply}

If you notice anything else, just reply here.

