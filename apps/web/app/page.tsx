import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { CountUp } from '@/components/CountUp';
import { FeatureCard } from '@/components/FeatureCard';
import { Pill, Row, TermLine, WeekChart } from '@/components/Mock';
import { QrCode } from '@/components/QrCode';
import { Reveal } from '@/components/Reveal';
import { Shot } from '@/components/Shot';
import cafeShift from '@/public/photos/cafe-shift.jpg';
import campus from '@/public/photos/campus.jpg';
import heroAutumn from '@/public/photos/hero-autumn.jpg';
import heroGolden from '@/public/photos/hero-golden.jpg';
import library from '@/public/photos/library.jpg';
import sky from '@/public/photos/sky.jpg';
import table from '@/public/photos/table.jpg';
import { GET_APP_QR } from '@/lib/qr';
import { faqJsonLd, pageMetadata } from '@/lib/seo';
import { APP_STORE_URL, FREE_IMPORTS_PER_MONTH, FREE_IMPORTS_TO_START, money, plan } from '@/lib/site';
import styles from './home.module.css';

export const metadata: Metadata = pageMetadata({ path: '/' });

/** From the spring 2026 student survey (docs/pricing-and-positioning.md). No invented counts; public copy says "more than 50". */
const PROOF = [
  { n: '83%', q: 'have missed or nearly missed an assignment because it got buried' },
  { n: '73%', q: 'get assignments outside Canvas, at least sometimes' },
  { n: '65%', q: 'want reminders on their phone' },
];

/** Free and Plus side by side; the full table lives on /pricing. */
const FREE = ['Calendar, to-dos, and the Today screen', 'Reminders', `Start with ${FREE_IMPORTS_TO_START} AI imports, then ${FREE_IMPORTS_PER_MONTH} a month`, 'Canvas or Brightspace assignments, imported once', 'Export your data'];
const PLUS = ['Unlimited AI imports', 'Canvas and Brightspace updates when you open the app', 'Changes to your work schedule, compared', 'Suggested times when plans overlap', 'Urgent items that ring like an alarm'];

const FAQS = [
  { q: 'What can I add to Semli?', a: 'Paste a message or upload a screenshot, photo, or PDF up to 20 MB. Try a syllabus, class timetable, work schedule, or a deadline from your group chat. Review the dates Semli finds before adding them to your plan.' },
  { q: 'Does Semli work with Canvas or Brightspace?', a: 'Yes, both, including eLC at UGA. Paste your Canvas calendar feed link, or the Subscribe link from your Brightspace calendar, to import assignments. With Plus, Semli checks for updates when you open the app (at most every few hours), and you can tap Sync now any time. You can also upload a syllabus PDF or a screenshot of your to-do list.' },
  { q: 'Can I use my plan in Apple Calendar or Google Calendar?', a: 'Yes. Go to You → Your data → Add to Calendar to export your events and dated to-dos, then import the file into Apple Calendar or Google Calendar. This creates a one-time copy. Changes in Semli won’t sync automatically, so export again when you need an updated copy.' },
  { q: 'What happens to my uploads?', a: 'Our AI provider reads your upload to find dates and schedule details. Semli’s servers don’t save the upload or the AI response. The plan you confirm stays on your phone, with cloud backup if you create an account. Our privacy policy explains how the AI provider handles your data.' },
  { q: 'What can I do for free?', a: `Use the calendar, to-dos, and reminders with no time limit. Start with ${FREE_IMPORTS_TO_START} AI imports, then ${FREE_IMPORTS_PER_MONTH} a month. Plus adds unlimited imports, Canvas and Brightspace updates, and comparisons when your work schedule changes.` },
  { q: 'Is Semli available on Android?', a: 'Not yet. Semli is coming to iPhone first. In the meantime, you can try the syllabus import demo on our website without an account.' },
];

/** Photos are Unsplash, recorded in public/photos/SOURCES.md. They are decorative: empty alt, text carries the meaning.
 *  Static imports give each one a blurred placeholder, so a card never flashes empty while its photo loads. */

/** The fan of students over the survey numbers. */
const FACES = [heroAutumn, table, campus, heroGolden, library];

/* The floating cards on the feature photos: one moment each, drawn from the mockup pieces. */
const SHIFT = { top: 56, height: 33 } as const; // 4–10 pm
const PLAN_WEEK = [
  { label: 'Mon', blocks: [{ top: 17, height: 7, tone: 'green' as const }, SHIFT, { top: 72, height: 5, tone: 'red' as const, half: true }] },
  { label: 'Tue', blocks: [{ top: 6, height: 44 }] },
  { label: 'Wed', blocks: [{ top: 17, height: 7 }, SHIFT] },
  { label: 'Thu' },
  { label: 'Fri', blocks: [SHIFT] },
  { label: 'Sat', blocks: [{ top: 17, height: 33 }] },
  { label: 'Sun', blocks: [{ top: 28, height: 33 }] },
];
const SYL_MARKS = [
  { left: 4, kind: 'dot' as const },
  { left: 17, kind: 'ring' as const },
  { left: 31, kind: 'dot' as const },
  { left: 44, kind: 'dot' as const },
  { left: 58, kind: 'target' as const },
  { left: 73, kind: 'dot' as const },
  { left: 85, kind: 'dot' as const },
  { left: 100, kind: 'target' as const },
];
const SYL_MONTHS = [{ label: 'Sep', left: 0 }, { label: 'Oct', left: 27 }, { label: 'Nov', left: 56 }, { label: 'Dec', left: 86 }];
/** A stagger index for siblings revealing together; globals.css multiplies it by the stagger token. */
const stagger = (i: number) => ({ '--i': i } as React.CSSProperties);

/** The Apple mark, the way Bevel and Cluely put it in their one button. */
function AppleMark() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M16.37 12.63c-.02-2.3 1.88-3.4 1.96-3.46-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.83-.81-3-.79-1.55.02-2.97.9-3.77 2.28-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.35 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.39 0 1.78.74 3 .72 1.24-.02 2.02-1.12 2.78-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.4-.92-2.4-3.69zM14.08 5.88c.63-.77 1.06-1.84.94-2.9-.91.04-2.01.6-2.66 1.37-.58.68-1.1 1.77-.96 2.81 1.01.08 2.05-.52 2.68-1.28z" />
    </svg>
  );
}

function GetApp({ className = 'btn' }: { className?: string }) {
  return <a className={className} href={APP_STORE_URL}><AppleMark />Get the iPhone app</a>;
}

export default function Home() {
  const fromMonthly = money(Math.round((plan('yearly').student / 12) * 100) / 100);
  return (
    <main className={`page ${styles.home}`}>
      {/* The hero: one card, a pastel sky, the headline centred, one button, the app rising from the edge. */}
      <section className={styles.hero} aria-labelledby="home-title">
        <div className={styles.heroPhoto} aria-hidden>
          <Image src={sky} alt="" fill priority placeholder="blur" sizes="100vw" />
        </div>
        <div className={styles.heroCopy}>
          <h1 id="home-title" className="serif">Your week, already <span className={styles.accentWord}>organized</span>.</h1>
          <p className={styles.heroSub}>Classes, shifts, and deadlines in one plan. Add a syllabus, a work schedule, or a message, and Semli lays out what’s next.</p>
          <GetApp />
          <p className={styles.note}>Free on iPhone. No account needed.</p>
        </div>
        <div className={styles.heroShot}>
          <Shot name="today" width={440} priority label="Today: 34 minutes until Stats lecture ends, a full day on one bar, then the list with one overlap" />
          {/* Desktop only: product cards on the left stay light to match the phone capture. */}
          <div className={styles.heroCards} data-semli-theme="light">
            <a className={styles.heroCard} href="#term-title" aria-label="Syllabus imports: STAT 200, 8 dates over the semester, three of them exams">
              <div className={styles.cardBig}>8 dates</div>
              <div className={styles.cardSub}>STAT 200 · 3 exams, 5 due dates</div>
              <TermLine months={SYL_MONTHS} marks={SYL_MARKS} style={{ marginTop: 14 }} />
            </a>
            <a className={styles.heroCard} href="#diff-title" aria-label="Work schedule updates: Campus Café next week, 3 changes, one new shift and one moved">
              <div className={styles.cardBig}>3 changes</div>
              <div className={styles.cardSub}>Campus Café · next week</div>
              <div style={{ marginTop: 6 }}>
                <Row lead="dot" title="Thu 22 · 5–9 pm" trailing={<Pill tone="green">New</Pill>} />
                <Row lead="dot" title="Sat 24 · 9 am–3 pm" trailing={<Pill>Moved</Pill>} last />
              </div>
            </a>
          </div>
          <div className={styles.heroQr}>
            <div className="getapp-code">
              <QrCode qr={GET_APP_QR} label="QR code to get the iPhone app" />
            </div>
            <p>Scan with your iPhone to get the app</p>
          </div>
        </div>
      </section>

      <section className={styles.proof} aria-label="What students told us">
        <Reveal className={styles.faces} aria-hidden>
          {FACES.map((photo, i) => (
            <div key={i} className={styles.face} style={{ '--r': `${(i - 2) * 4}deg`, '--y': `${Math.abs(i - 2) * 10}px` } as React.CSSProperties}>
              <Image src={photo} alt="" fill placeholder="blur" sizes="120px" />
            </div>
          ))}
        </Reveal>
        <Reveal as="p" className={styles.bandEyebrow}>What students told us</Reveal>
        <div className={styles.stats}>
          {PROOF.map((p, i) => (
            <Reveal key={p.n} className={styles.stat} style={stagger(i)}>
              <div className={styles.statN}><CountUp value={p.n} /></div>
              <p>{p.q}</p>
            </Reveal>
          ))}
        </div>
        <Reveal as="p" className={styles.source}>From a survey of more than 50 college students, spring 2026.</Reveal>
      </section>

      <section className={styles.feature} aria-labelledby="week-title">
        <Reveal className={styles.featureCopy}>
          <p className="eyebrow">Your whole week</p>
          <h2 id="week-title" className="section-title">See the week at a glance.</h2>
          <p className="lede">See where classes, shifts, and deadlines fit together. Plan the week, look at today by the hour, and spot overlaps in red.</p>
          <Link className="textlink" href="/work-and-school-schedule-planner">Work and school in one plan</Link>
        </Reveal>
        <Reveal className={styles.single} style={stagger(1)}>
          <FeatureCard photo={heroGolden} position="62% 40%" label="This week: 31 things and 30 work hours, as seven day bars">
            <div className={styles.cardBig}>31 things</div>
            <div className={styles.cardSub}>30 work hours · 1 overlap</div>
            <WeekChart days={PLAN_WEEK} height={64} style={{ marginTop: 12 }} />
          </FeatureCard>
        </Reveal>
      </section>

      <section className={`${styles.feature} ${styles.flip}`} aria-labelledby="diff-title">
        <Reveal className={styles.featureCopy}>
          <p className="eyebrow">For your work week</p>
          <h2 id="diff-title" className="section-title">Your work schedule, updated.</h2>
          <p className="lede">With Plus, compare an updated schedule with the shifts already in your plan. See what’s new, moved, or removed, then choose which changes to keep.</p>
          <Link className="textlink" href="/pricing">What Plus adds</Link>
        </Reveal>
        <Reveal className={styles.single} style={stagger(1)}>
          <FeatureCard photo={cafeShift} position="72% center" hang="left" label="Compared with what you have: 3 changes, one new shift, one moved, one dropped">
            <div className={styles.cardBig}>3 changes</div>
            <div className={styles.cardSub}>Campus Café · next week</div>
            <div style={{ marginTop: 6 }}>
              <Row lead="dot" title="Thu 22 · 5–9 pm" trailing={<Pill tone="green">New</Pill>} />
              <Row lead="dot" title="Sat 24 · 9 am–3 pm" trailing={<Pill>Moved</Pill>} />
              <Row lead="dot" title="Sun 25 · 11–5" strike muted trailing={<Pill tone="red">Dropped</Pill>} last />
            </div>
          </FeatureCard>
        </Reveal>
      </section>

      <section className={styles.feature} aria-labelledby="term-title">
        <Reveal className={styles.featureCopy}>
          <p className="eyebrow">For your semester</p>
          <h2 id="term-title" className="section-title">Your syllabus, laid out for the semester.</h2>
          <p className="lede">Bring class times, exams, and assignment dates out of the PDF and into your plan. Connect Canvas or Brightspace for assignments. With Plus, Semli checks for updates when you open the app.</p>
          <Link className="textlink" href="/syllabus-to-calendar">How syllabus imports work</Link>
        </Reveal>
        <Reveal className={styles.single} style={stagger(1)}>
          <FeatureCard photo={library} position="50% 55%" label="STAT 200 from the syllabus: 8 dates over the semester, three of them exams">
            <div className={styles.cardBig}>8 dates</div>
            <div className={styles.cardSub}>STAT 200 · 3 exams, 5 due dates</div>
            <TermLine months={SYL_MONTHS} marks={SYL_MARKS} style={{ marginTop: 14 }} />
          </FeatureCard>
        </Reveal>
      </section>

      <section className={`${styles.band} ${styles.soft} ${styles.plans}`} aria-labelledby="price-title">
        <Reveal className={styles.plansHead}>
          <h2 id="price-title" className="section-title">Start free. Add more with Plus.</h2>
          <p className="lede">Everything you need to plan the week is free. Plus adds unlimited imports, Canvas and Brightspace updates, and help when your schedule changes.</p>
        </Reveal>
        <div className={styles.planCards}>
          <Reveal className={styles.planCard}>
            <h3 className={styles.planName}>Free</h3>
            <p className={styles.planPrice}>$0</p>
            <p className={styles.planNote}>No time limit. No account needed.</p>
            <ul className={styles.planList}>{FREE.map((f) => <li key={f}>{f}</li>)}</ul>
          </Reveal>
          <Reveal className={styles.planCard} style={stagger(1)}>
            <h3 className={styles.planName}>Plus</h3>
            <p className={styles.planPrice}>{fromMonthly}<span> a month</span></p>
            <p className={styles.planNote}>For students, billed yearly. Or {money(plan('semester').student)} every six months.</p>
            <ul className={styles.planList}>{PLUS.map((f) => <li key={f}>{f}</li>)}</ul>
            <Link className={`btn accent ${styles.planBtn}`} href="/pricing">See pricing</Link>
          </Reveal>
        </div>
      </section>

      <section className={`faq ${styles.faq}`} aria-labelledby="home-faq-title">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQS)) }} />
        <Reveal>
          <h2 id="home-faq-title">Common questions.</h2>
          <Link className="textlink" href="/privacy">Read our privacy policy</Link>
        </Reveal>
        <Reveal className="faq-list" style={stagger(1)}>{FAQS.map(({ q, a }) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</Reveal>
      </section>

      {/* The close: the last line, then the one thing to do. */}
      <section className={`${styles.band} ${styles.photoBand} ${styles.closing}`} aria-labelledby="final-title">
        <div className={styles.bandPhoto} aria-hidden>
          <Image src={heroAutumn} alt="" fill placeholder="blur" sizes="100vw" />
        </div>
        <Reveal as="h2" id="final-title" className="section-title serif">One less thing to keep in your head.</Reveal>
        <Reveal className={styles.ctas} style={stagger(1)}>
          <GetApp />
        </Reveal>
      </section>
    </main>
  );
}
