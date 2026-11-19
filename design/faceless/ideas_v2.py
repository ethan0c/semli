"""Thirty original five-slide posts for each of the two faceless accounts.

The first account is broad and practical. The second uses a softer, more
aspirational TikTok voice without pretending the stock photos are the owner's
life or making personal-result claims.
"""


def parse(text: str) -> list[tuple[str, str, str, str, str]]:
    rows = [tuple(part.strip() for part in line.split("|")) for line in text.strip().splitlines()]
    if len(rows) != 30 or any(len(row) != 5 for row in rows):
        raise ValueError("Each account needs 30 five-slide posts")
    return rows


GENERAL = parse("""
the 10-minute reset for when your day goes off track | don't rewrite your whole to-do list. | pick the one thing that still matters today. | set a 10-minute timer. start with the rough version. | move the rest to tomorrow. today doesn't need a full comeback.
if your to-do list has 30 things on it, read this | only a few of those things are due today. | write down the real deadlines first. | choose one thing you can finish before lunch. | the rest can stay on the list, not in your head.
how to start a task you've been avoiding for weeks | open the file or find the form. | write down what 'done' actually means. | do the first ugly five minutes. | you can improve it after you have something to work with.
your inbox doesn't need to run your whole day | check for anything truly time-sensitive. | turn the rest into tasks or archive it. | reply to one message you've been avoiding. | then close the tab and do the work you opened it for.
if you keep picking up your phone mid-task | put it out of reach, not just face down. | write stray thoughts on paper. | finish one short block before checking. | a planned break feels better than twenty tiny interruptions.
the morning routine for people who aren't morning people | decide your first task the night before. | put what you need where you'll see it. | give yourself time to wake up. | a slower start can still be a real start.
a sunday reset that doesn't eat your whole sunday | look at the fixed plans first. | pick two things that need prep. | put one open block on the calendar. | stop planning and go enjoy what's left of the day.
why the same task keeps moving to tomorrow | maybe it's too big to start as written. | change 'finish report' to 'open report and outline page one.' | give that step a real time slot. | move the rest only after you've tried the first part.
if your calendar is packed but nothing gets finished | meetings and errands need space around them. | find one block for the actual work. | name what you'll do in that block. | leave some room for things that run late.
things to do tonight so tomorrow is less annoying | check your first appointment. | put your keys and charger in one place. | write the one thing you need to start. | ten minutes tonight can save a scramble tomorrow.
when you catch yourself scrolling instead of starting | ask what you're avoiding. | make that task smaller. | do five minutes before you reopen the app. | if you're tired, take a real break instead.
the focus block that works on a messy day | choose one outcome, not five. | close the tabs you don't need. | set a short end time. | when you stop, write the next step.
if every little task feels urgent | write the actual due dates beside them. | separate today from this week. | do the one with a real consequence first. | loud isn't always urgent.
how to make errands stop taking your whole day | put the stops in one list. | group the ones near each other. | check opening hours before leaving. | leave a little time to get home and reset.
the five-minute check before your week starts | look for the busiest day. | move one flexible task away from it. | add time for travel or setup. | a plan should survive a normal delay.
if planning has become another form of procrastination | stop choosing a new app. | write the next action on paper. | start before you redesign the system. | keep the tool you'll actually reopen.
how to finish a project that's 80% done | list what's left, not everything you did. | decide what 'good enough' requires. | finish the missing pieces first. | polish only after the full thing exists.
a low-energy day can still have a plan | choose one thing that truly needs doing. | make the first step small. | leave space for rest. | don't write a schedule for a version of you with more energy.
multitasking is making this take longer | pick the task you're actually doing. | park the other thoughts in a note. | give it twenty uninterrupted minutes. | switch when you finish a part, not every time you get bored.
when three deadlines land on the same day | write the time each one is due. | estimate the work you still need. | do the one with the least wiggle room first. | ask for help before the final hour.
if you never get around to the creative thing | stop waiting for an empty afternoon. | make a tiny version you can do today. | keep the materials easy to reach. | ten real minutes beats a perfect plan you never open.
starting late doesn't mean the day is over | look at the hours you still have. | choose one useful thing that fits. | do it before reorganizing your whole life. | call it a day when you've done enough.
your desk doesn't need to be perfect to work | clear only the space you need. | put one task in front of you. | move the clutter out of reach. | tidy the rest when you're actually done.
if you have twelve tabs open and no clue why | save the links you may need later. | keep the task and one reference open. | write down the question you're trying to answer. | close the search when you have enough to move on.
try this before opening your phone in the morning | drink some water if it's nearby. | check what time you have to leave. | do one tiny thing for the day ahead. | then decide what you want from your phone.
when the day is full of things you can't control | list the decisions that are yours. | choose the next small one. | stop planning around other people's maybes. | update your plan when you get real information.
the life admin hour you keep putting off | choose three boring tasks. | put the logins or paperwork in reach. | do the quickest one first. | stop when the hour is up, even if the list isn't.
if a task is so vague you can't start it | write the result you need. | ask what the first visible action is. | check what information is missing. | start with what you know instead of waiting for clarity.
how to get back into work after an interruption | write down where you left off. | close whatever pulled you away. | start with the next two-minute step. | you don't need to rebuild the whole morning.
end your day without carrying the list to bed | check what you actually finished. | move the unfinished things to real dates. | write tomorrow's first task. | close the list. the day can be over.
""")


HER = parse("""
how to be the girl who actually follows through | stop building a routine for a version of you who wakes up at 5. | pick 2 things you can do on a normal tuesday. | put your phone across the room for the first 20 minutes. | consistency looks kind of boring. that's the point.
habits that make you seem more put together than you feel | keep your keys, wallet and charger in one spot. | check tomorrow's first plan before bed. | answer the message you've been dodging. | nobody sees the prep. they just see you show up on time.
if you keep starting your life over every monday | maybe the routine is asking for too much. | keep one habit from last week. | do it even on an ordinary day. | you don't need a new personality by sunday.
how to feel a little less all over the place | write down everything circling your head. | mark what actually needs you this week. | choose one thing for today. | the list can hold the rest for now.
the low-key organised girl routine | check your calendar before saying yes. | put dates in as soon as you get them. | leave space between plans. | being organised is mostly remembering what you agreed to.
an easier morning without a 5am alarm | pick your clothes the night before. | put the bag by the door. | decide what breakfast is. | give yourself a morning that fits your actual life.
the boring habits behind a quiet glow up | sleep when you can. | keep your space usable. | show up to the things you said mattered. | the little things count even when nobody notices.
the 20-minute reset when everything feels off | put one thing away. | drink water or make tea. | write down the next thing you need to do. | you don't have to fix your whole life tonight.
for the girl who leaves the house in a panic | check the time you really need to leave. | put the essentials by the door. | stop adding 'one quick thing' before you go. | getting there calmly is enough of a win.
if your calendar looks cute but your week feels awful | check how much time the plans take. | leave room to get places and come home. | move something that doesn't need to be this week. | a good week needs breathing space.
small boundaries that protect your time | don't say yes while staring at your calendar. | check what that time was for. | give a clear answer when you know. | your plans count even when they're just for you.
how to be consistent without a perfect routine | make the habit small enough for a tired day. | keep it attached to something you already do. | miss a day without making it a story. | come back the next day. that's the whole thing.
maybe your best hour isn't in the morning | notice when you actually have focus. | put one important task there. | save lighter tasks for the foggy hours. | build around your real energy, not someone's aesthetic.
little things that make tomorrow feel easier | clear the part of your desk you use. | write down the first task. | put your phone charger where it belongs. | let tomorrow start with less searching.
if your phone keeps stealing the first hour of your day | don't make a dramatic rule you'll break. | leave it across the room for twenty minutes. | do one real-life thing first. | see if you want to keep going.
for the girl who gets home tired and still has things to do | sit down for a real break. | pick one task that matters tonight. | make the first step tiny. | the rest can wait for a day with more room.
how to make your week feel less chaotic | look at the fixed plans. | choose one open evening to keep open. | move prep before the busy day. | a little space in the plan changes the feeling of the week.
be the girl who keeps small promises to herself | make a promise you can actually keep. | put it somewhere you'll see it. | do it without waiting to feel inspired. | then make the next one just as realistic.
if you start everything and finish nothing | choose the thing closest to done. | ignore the urge to make it perfect. | finish and put it away. | the relief is better than another new plan.
soft life admin for a sunday afternoon | pay the thing that's due. | book the appointment you've delayed. | clear one corner of your room. | then stop. you deserve the rest of sunday.
reset your room without turning it into a project | take out the trash. | put clothes in one place. | clear the surface you use most. | the rest can wait until you actually have time.
when every tiny decision feels exhausting | decide what's for dinner early. | wear the outfit that already works. | write down your top two tasks. | save your energy for choices that matter.
quietly ambitious habits that don't look exciting | keep the appointment. | send the email. | practice when nobody is watching. | doing what you said you'd do adds up.
tiny habits for the girl who wants her days back | open the blinds. | check the calendar once. | start one task before scrolling. | small routines can make a day feel like yours again.
not every productive day looks aesthetic | sometimes it's laundry and two emails. | sometimes it's just starting late. | sometimes rest is the plan. | real life doesn't need to look good in a recap.
habits for your twenties that are actually useful | write dates down when you hear them. | ask questions before you say yes. | keep a little space in your schedule. | be kind to the version of you learning as she goes.
the reset for a day that got away from you | stop trying to save every hour. | pick one thing you can still do. | set a ten-minute timer. | tomorrow doesn't need to carry all of today.
the night routine that isn't a full production | put your phone to charge. | check the first thing on tomorrow's calendar. | set out one thing you'll need. | go to bed without planning a new life.
confidence can look like following through | do the small thing you promised yourself. | write down when you'll do the next one. | let it be private. | you don't need to announce every change for it to count.
a weekend reset for the girl who's been doing a lot | pick one chore that will make monday easier. | make room for something you actually enjoy. | leave a block with no plans. | rest belongs on the schedule too.
""")
