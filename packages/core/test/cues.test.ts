import { afterEach, describe, expect, it } from 'vitest';
import { heardClauses, resetDateLocale, setDateLocale } from '../src';

afterEach(() => resetDateLocale());

const labels = (text: string) => heardClauses(text).map((c) => c.label);

describe('heard clauses', () => {
  it('reads the personas’ own demo lines', () => {
    expect(labels('Clinical Tuesday 7–3, pharm exam next Friday, and I’m working Sat 4–10')).toEqual(['Tue · 7 am–3 pm', 'Next Fri', 'Sat · 4–10 pm']);
    expect(labels('I work Fri 4–10, statics exam Monday at 9, and the lab report is due Wednesday')).toEqual(['Fri · 4–10 pm', 'Mon · 9 am', 'Wed']);
    expect(labels('I work Fri 4–10, data structures midterm Monday at 9, and PA2 is due Wednesday at 11:59')).toEqual(['Fri · 4–10 pm', 'Mon · 9 am', 'Wed · 11:59 am']);
  });
  it('hears spoken numbers, am and pm, and the words for noon', () => {
    expect(labels('shift tomorrow from seven to three')).toEqual(['Tomorrow · 7 am–3 pm']);
    expect(labels('dentist Thursday at 4:30 pm then gym at six')).toEqual(['Thu · 4:30 pm', '6 pm']);
    expect(labels('study group tonight at noon no wait at 9 pm')).toEqual(['Tonight · 12 pm']);
    expect(labels('9 to 5 on Saturday and 11 to 7 on Sunday')).toEqual(['Sat · 9 am–5 pm', 'Sun · 11 am–7 pm']);
    expect(labels('working 4 to 10 pm Friday')).toEqual(['Fri · 4–10 pm']);
    expect(labels('open 7 am to 3')).toEqual(['7 am–3 pm']);
  });
  it('hears dates', () => {
    expect(labels('midterm paper due October 24th, quiz on the 3rd, and the final is 12/15')).toEqual(['Oct 24', 'The 3rd', 'Dec 15']);
    expect(labels('exam next week')).toEqual(['Next week']);
  });
  it('reads numeric dates and the clock the way the region does', () => {
    setDateLocale({ dayFirst: true, hour12: false });
    expect(labels('essay due 24/10 at 14:00')).toEqual(['24 Oct · 14:00']);
    expect(labels('seminar 4/11 from 9 to 11')).toEqual(['4 Nov · 09:00–11:00']);
    expect(labels('the final is 12/15')).toEqual([]);
  });
  it('leaves numbers that are not times alone', () => {
    expect(labels('read chapter 6 and problem set 4')).toEqual([]);
    expect(labels('PSYC 101 in room 204')).toEqual([]);
    expect(labels('I’m so tired honestly')).toEqual([]);
    expect(labels('read chapter 6 by Friday')).toEqual(['Fri']);
  });
  it('keeps clauses whole and in order', () => {
    const heard = heardClauses('Clinical Tuesday 7 to 3 and then study group Wednesday at 7');
    expect(heard.map((c) => c.text)).toEqual(['Clinical Tuesday 7 to 3', 'study group Wednesday at 7']);
    expect(heard[0]!.cues.map((c) => c.kind)).toEqual(['weekday', 'range']);
    expect(heard[1]!.label).toBe('Wed · 7 am');
  });
});

describe('voice transcript', () => {
  it('ignores an empty result, so stopping never wipes what was said', async () => {
    const { nextTranscript } = await import('../src');
    expect(nextTranscript('', 'bio quiz thursday', '')).toBeNull();
    expect(nextTranscript('', 'bio quiz thursday', '   ')).toBeNull();
  });
  it('keeps an earlier sentence when a pause restarts the transcript', async () => {
    const { nextTranscript } = await import('../src');
    expect(nextTranscript('', 'Bio quiz Thursday at nine and the lab report is due Friday', 'Working Saturday'))
      .toEqual({ committed: 'Bio quiz Thursday at nine and the lab report is due Friday', last: 'Working Saturday' });
    expect(nextTranscript('', 'Bio quiz', 'Bio quiz Thursday')).toEqual({ committed: '', last: 'Bio quiz Thursday' });
  });
});
