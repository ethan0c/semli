'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { useReveal } from '@/components/Reveal';
import { feedback } from '@/lib/feedback';
import fireworks from '@/public/photos/plus-fireworks.jpg';
import { APP_STORE_LIVE, APP_STORE_URL, FREE_IMPORTS_PER_MONTH, FREE_IMPORTS_TO_START, PLUS_PLANS, TRIAL_DAYS, money, type PlanId } from '@/lib/site';

const FREE = [
  'Calendar, to-dos, and repeating classes',
  'Reminders and overlap warnings',
  `Start with ${FREE_IMPORTS_TO_START} AI imports, then ${FREE_IMPORTS_PER_MONTH} a month`,
  'Add or edit items by hand anytime',
  'Optional account with plan backup',
];
/** The billing term, as the store states it: the semester plan is a six-month subscription. */
const PERIOD: Record<PlanId, string> = { monthly: '/ month', semester: '/ 6 months', yearly: '/ year' };

/** The app's price-first paywall: photo, hairline plan rows, green student switch, one action. */
export function PlanCards() {
  const [billing, setBilling] = useState<PlanId>('yearly');
  const [student, setStudent] = useState(true);
  const selected = PLUS_PLANS.find((p) => p.id === billing)!;
  const priceOf = (p: (typeof PLUS_PLANS)[number]) => student ? p.student : p.regular;
  const price = priceOf(selected);
  const monthlyPrice = priceOf(PLUS_PLANS.find((p) => p.id === 'monthly')!);
  const [freeRef, freeIn] = useReveal<HTMLElement>();
  const [plusRef, plusIn] = useReveal<HTMLElement>();

  return (
    <section className="plans" aria-label="Choose between Semli Free and Plus">
      <div className="plan-grid">
        <article className="plan" aria-labelledby="free-title" ref={freeRef} data-reveal="self" data-in={freeIn ? '' : undefined}>
          <header className="plan-heading">
            <p className="plan-label">Semli</p>
            <h2 id="free-title">Free</h2>
            <div className="price"><span className="amt">$0</span><span className="per">forever</span></div>
            <p className="plan-description">Your week, with room for work and school. No payment details needed.</p>
          </header>
          <ul>{FREE.map((feature) => <li key={feature}>{feature}</li>)}</ul>
          <div className="plan-actions">
            <Link className="btn ghost" href="/syllabus-to-calendar#try">Try a schedule</Link>
            <p className="plan-caption">Keep using the free plan for as long as you like.</p>
          </div>
        </article>

        <article className="plan featured" data-semli-theme="dark" aria-labelledby="plus-title" ref={plusRef} data-reveal="self" data-in={plusIn ? '' : undefined} style={{ '--i': 1 } as React.CSSProperties}>
          <div className="paywall-photo" aria-hidden="true">
            <Image src={fireworks} alt="" fill priority placeholder="blur" sizes="(max-width: 480px) 100vw, 440px" quality={85} />
          </div>
          <header className="plan-heading">
            <h2 id="plus-title">More life.<br />Less juggling.</h2>
            <p className="plan-label">Semli <span className="plan-plus">Plus</span></p>
            <div className="price" aria-live="polite" aria-atomic="true">
              <span className="amt rise" key={`${billing}-${student}`}>{money(price)}</span>
              <span className="per">{PERIOD[billing]}</span>
            </div>
            <p className="plan-caption">{money(price)} billed {selected.billed}.{selected.months > 1 ? ` Equivalent to ${money(price / selected.months)} a month.` : ''}</p>
            <p className="plan-description">Unlimited imports, Canvas and Brightspace updates when you open the app, work-schedule updates, suggested times for overlapping plans, and urgent items that ring like an alarm.</p>
          </header>

          <div>
            <fieldset className="plan-options">
              <legend className="sr-only">Choose a Semli Plus plan</legend>
              {PLUS_PLANS.map((p) => {
                const amount = priceOf(p);
                const saving = Math.round((1 - amount / p.months / monthlyPrice) * 100);
                return (
                  <label className="plan-option" key={p.id}>
                    <input type="radio" name="semli-plus-plan" value={p.id} checked={billing === p.id}
                      onChange={() => { setBilling(p.id); feedback('select'); }} />
                    <span className="plan-term">{p.name}</span>
                    {saving >= 5 ? <span className="plan-saving">Save {saving}%</span> : null}
                    <span className="plan-monthly">{money(amount / p.months)} / mo</span>
                  </label>
                );
              })}
            </fieldset>
            <label className="student">
              <span>
                I&apos;m a college student
                <small id="student-pricing-detail">No student ID needed. {student ? `Regular price is ${money(selected.regular)}` : `Students pay ${money(selected.student)}`} {selected.billed}.</small>
              </span>
              <input type="checkbox" role="switch" checked={student} aria-label="I'm a college student" aria-describedby="student-pricing-detail"
                onChange={(event) => { setStudent(event.target.checked); feedback('select'); }} />
              <span className="sw" aria-hidden="true" />
            </label>
          </div>

          <div className="plan-actions">
            {APP_STORE_LIVE ? <a className="btn" href={APP_STORE_URL}>Get Semli Plus on iPhone</a> : <Link className="btn" href="/#beta">Join the beta waitlist</Link>}
            <p className="plan-caption">Eligible new subscribers can try Plus free for {TRIAL_DAYS} days. Subscriptions are purchased in the iPhone app. Prices shown in USD.</p>
            <div className="plan-links"><Link href="/terms">Terms</Link><span aria-hidden="true">·</span><Link href="/privacy">Privacy</Link></div>
          </div>
        </article>
      </div>
    </section>
  );
}
