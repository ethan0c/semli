import { describe, expect, it } from 'vitest';
import { chooseText, layoutPage, pdfAsText } from './pdf-text';

/** A one-page PDF with real text, written by hand: enough for PDF.js to parse. */
function tinyPdf(lines: string[]): string {
  const stream = ['BT', '/F1 12 Tf', ...lines.flatMap((line, i) => [`1 0 0 1 72 ${720 - i * 20} Tm`, `(${line}) Tj`]), 'ET'].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((o, i) => { offsets.push(body.length); body += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body, 'latin1').toString('base64');
}

const item = (str: string, x: number, y: number) => ({ str, x, y, width: str.length * 6, fontSize: 12 });

describe('layoutPage', () => {
  it('keeps a schedule table in its columns', () => {
    const page = layoutPage([item('Week', 72, 700), item('Due', 240, 700), item('1', 72, 680), item('Quiz 1, Sep 5', 240, 680)]);
    const [head, row] = page.split('\n');
    expect(head!.indexOf('Due')).toBe(row!.indexOf('Quiz 1'));
  });
  it('keeps the space between table rows as a blank line', () => {
    const page = layoutPage([item('Week 6', 72, 700), item('Quiz 3', 72, 686), item('Week 7', 72, 650), item('Exam 1', 72, 636)]);
    expect(page).toBe('Week 6\nQuiz 3\n\nWeek 7\nExam 1');
  });
  it('reads rows top to bottom', () => {
    expect(layoutPage([item('second', 72, 680), item('first', 72, 700)])).toBe('first\nsecond');
  });
});

describe('chooseText', () => {
  const full = 'Exam 1 is on Thursday, October 9, in class. '.repeat(5);
  it('reads a document with text on every page as text', () => {
    expect(chooseText([full, full])).toContain('--- Page 2 ---');
  });
  it('reads the whole PDF when any page may be a picture', () => {
    expect(chooseText([full, '', full])).toBeNull();
    expect(chooseText([full, 'Fig. 1', full])).toBeNull();
  });
  it('reads the whole PDF when there is barely any text', () => {
    expect(chooseText(['Syllabus'])).toBeNull();
  });
});

describe('pdfAsText', () => {
  it('pulls the text out of a real PDF', async () => {
    const lines = ['BIOL 110 General Biology, Fall 2026', 'Lectures Monday, Wednesday and Friday, 10:30 to 11:20 am', 'Lab report 1 due Friday, September 18 at 11:59 pm', 'Lab report 2 due Friday, October 2 at 11:59 pm', 'Midterm exam Thursday, October 15, 10:30 to 11:45 am', 'Lab report 3 due Friday, November 6 at 11:59 pm', 'Final exam Tuesday, December 8, 8:00 to 10:00 am', 'No class during Thanksgiving break, November 25 to 27'];
    const text = await pdfAsText(tinyPdf(lines));
    expect(text).toContain('Midterm exam Thursday, October 15');
    expect(text).toContain('--- Page 1 ---');
  });
  it('rejects something that is not a PDF, so the caller reads it whole', async () => {
    await expect(pdfAsText(Buffer.from('not a pdf').toString('base64'))).rejects.toThrow();
  });
});
