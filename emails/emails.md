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
- Link to the app with `https://www.semli.app/beta?r=email-<name>`, never the App Store directly. The site counts the click under that tag and passes it on to the App Store as a campaign, so App Store Connect counts installs per email too.
- The send command fills in `{about}` and `{reply}` in `feedback-thank-you`.

Write like the founder talking to one person, and sign off as Semli. Use everyday words, short sentences, and sentence case. Skip all caps and em or en dashes. Keep group emails under 80 words from greeting to sign-off, with one main thing to do.

## survey-invite

To: Survey
When: Nov 3, 2026, once the Survey TestFlight link accepts testers
Subject: An update on that student planner survey
Preview: I built Semli with your feedback. It's ready to try.
Sign-off: Thanks again,
Footer: You shared your email in the student planning survey.

### Come try ~Semli~.

Hi {name},

You answered my survey about juggling classes and work. Your feedback helped me build Semli, and I'd love for you to try it.

Add a syllabus or screenshot of your shifts, check the dates, and save them to your calendar.

Button: [Try Semli on iPhone](https://testflight.apple.com/join/vG3RD6EJ)

> If asked, install Apple's free TestFlight app, then reopen this invite.

Something wrong or confusing? Reply and let me know.

## public-beta-invite

To: Waitlist
When: When the public Beta group has room and TESTFLIGHT_URL is set on Vercel
Subject: You're invited to try Semli
Preview: The iPhone beta is ready for your classes and shifts.
Sign-off: Thanks for trying it,
Footer: You joined the Semli beta waitlist.

### You're ~invited~.

Hi {name},

Thanks for waiting. You can now try Semli on your iPhone.

Start with a syllabus, a screenshot of your shifts, or a class message. Check the dates Semli finds, then save them to your calendar.

Button: [Try Semli on iPhone](https://semli.app/beta?r=email-waitlist)

> If asked, install Apple's free TestFlight app, then reopen this invite. There's room for 200 testers.

Let me know how it goes. I read every reply.

## app-store-launch

To: Survey + Waitlist
When: Wed Oct 28, 2026, 10 am Eastern, the morning after the listing went public (was Nov 3; the app released Oct 27)
Subject: Semli is on the App Store
Preview: You can now get Semli on your iPhone.
Sign-off: Thanks,
Footer: You're getting this because you answered the Semli student survey or joined the waitlist. One email, then only the occasional update.

### Semli is on the ~App Store~.

Hi {name},

Semli is on the App Store. Thanks for being here while I built it.

Add your syllabi, work schedule, or class messages to start your plan. It works with Canvas and Brightspace too. The calendar, to-dos, and reminders are free, and you get five imports to start.

Button: [Get Semli on iPhone](https://www.semli.app/get?r=email-launch)

Reply and tell me how it fits into your week. I read every one.

## spring-schedule

To: Survey + Waitlist + App users
When: Tue Nov 17, 2026, 10 am Eastern: spring registration is open at most schools (Nov 2 to 23)
Subject: Registered for spring? Add your classes now
Preview: Add a screenshot of your class schedule to Semli.
Sign-off: Good luck with registration,
Footer: You signed up for Semli updates.

### Got your ~spring schedule~?

Hi {name},

If you've picked your spring classes, you can add them to Semli now.

Take a screenshot of the schedule in your school's portal. Add it in Semli, check the class times, and save them. They'll repeat through the term.

Button: [Get Semli on iPhone](https://www.semli.app/beta?r=email-spring)

> Already have Semli? Open the app and tap Add.

When you get your syllabi in January, add those too to bring in your exam dates.

## semester-reminder

To: Survey + Waitlist + App users
When: Tue Jan 5, 2027, 10 am Eastern: the week before most spring terms start (Jan 11 to 20)
Subject: Got a syllabus for the new semester?
Preview: Start with one syllabus or a week of shifts.
Sign-off: Hope your semester gets off to a good start,
Footer: You signed up for Semli updates.

### Start with ~one syllabus~.

Hi {name},

Getting ready for the semester? You don't need your whole schedule to get started.

Add a syllabus or a week of shifts to Semli. Check the dates before saving, then add the rest as you get them.

Button: [Get Semli on iPhone](https://www.semli.app/beta?r=email-semester)

> Already have Semli? Open the app and tap Add.

If the dates don't look right, reply and tell me what happened.

## welcome

Kind: account
When: 45 to 55 minutes after an account first has a confirmed address (database trigger, sent by the 10-minute database schedule)
Subject: Welcome to Semli
Preview: Your plan is now backed up to your account.
Sign-off: Thanks,
Footer: You got this email because you created a Semli account.

### Welcome to ~Semli~.

Hi {name},

Thanks for signing up. Your plan now backs up to your account, so you can get it back when you switch phones.

To get started, add a syllabus or screenshot of your shifts. Check the dates Semli finds, then save them.

If a date looks wrong or something's confusing, reply and tell me. I read every reply.

## account-deleted

Kind: account
When: Right after an account is deleted (database trigger; the app asks the site to send at once)
Subject: Your Semli account has been deleted
Preview: Your saved plan stays on your phone. Plus needs to be cancelled separately.
Sign-off: Thanks for using Semli,
Footer: You got this email because your Semli account was deleted.

### Your account has been deleted.

Hi {name},

We've removed your sign-in details, email address, and plan backup from our servers. This is the last email we'll send to this address about your account.

The plan saved on your phone is still there, and you can keep using Semli as a guest. To remove that plan too, delete the app or clear it in You → Your data.

**Deleting your account does not cancel Semli Plus.** Apple manages your subscription. To cancel it, open your iPhone's Settings, tap your name, then Subscriptions, and choose Semli.

If you didn't ask to delete your account, please reply or email [hello@semli.app](mailto:hello@semli.app) today.

## feedback-thank-you

To: one person
When: Reply after reading their message: npm run email send feedback --to a@b.edu --name Ana --about "…" --reply "…"
Subject: Thanks for your feedback on Semli
Preview: I appreciate you taking the time to write.
Sign-off: Thanks again,
Footer: You got this reply because you sent feedback about Semli.

### Thanks for ~letting me know~.

Hi {name},

Thanks for telling me about {about}.

{reply}

If anything else comes up, just reply here.

