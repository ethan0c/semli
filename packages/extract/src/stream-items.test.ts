import { describe, expect, it } from 'vitest';
import { itemScanner, type StreamedItem } from './stream-items';

const item = (title: string, extra: object = {}) => ({ kind: 'event', title, category: 'school', date: '2026-10-29', start: '09:00', end: '10:15', is_deadline: false, repeat_weekdays: ['tue', 'thu'], repeat_until: '2026-12-10', course_code: 'PSYC 101', evidence: 'Tue/Thu 9:00-10:15 {room "B"}', confidence: 0.9, question: null, ...extra });
const answer = JSON.stringify({ detected_type: 'syllabus', employer: null, course: { code: 'PSYC 101', title: 'Intro "Psych"', instructor: null }, covers_from: null, covers_to: null, items: [item('Lecture'), item('Quiz 1, "chapters 1-2"', { kind: 'task', start: null, end: null, repeat_weekdays: [], repeat_until: null }), item('Final exam')] });

function feed(chunks: string[]): string[] {
  const seen: StreamedItem[] = [];
  const scan = itemScanner((it) => seen.push(it));
  chunks.forEach((c) => scan.push(c));
  return seen.map((it) => it.title);
}

describe('itemScanner', () => {
  it('hands over each item as it completes, in order', () => {
    expect(feed([answer])).toEqual(['Lecture', 'Quiz 1, "chapters 1-2"', 'Final exam']);
  });
  it('copes with any chunking, including mid-string and mid-escape', () => {
    for (const size of [1, 2, 3, 7, 13, 64]) {
      const chunks = Array.from({ length: Math.ceil(answer.length / size) }, (_, i) => answer.slice(i * size, (i + 1) * size));
      expect(feed(chunks)).toEqual(['Lecture', 'Quiz 1, "chapters 1-2"', 'Final exam']);
    }
  });
  it('shows nothing until an item is complete', () => {
    const cut = answer.indexOf('Quiz 1');
    expect(feed([answer.slice(0, cut)])).toEqual(['Lecture']);
  });
  it('skips an item that does not validate', () => {
    const bad = JSON.stringify({ detected_type: 'general', employer: null, course: null, covers_from: null, covers_to: null, items: [{ title: 'No fields' }, item('Good')] });
    expect(feed([bad])).toEqual(['Good']);
  });
});
