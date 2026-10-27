import { extractTextItems, getDocumentProxy, type StructuredTextItem } from 'unpdf';

/**
 * A PDF's text, laid out the way it reads on the page, so the document model can read a syllabus
 * as text instead of as page images. The API bills a PDF page as an image plus its text (about
 * 7,000 tokens for three pages against about 1,000 for text alone); on the Oct 27, 2026 benchmark,
 * Opus read the five syllabi more accurately from text (98.0% of dates and times, against 96.9%)
 * for a third less (docs/import-speed.md).
 *
 * Returns null when the text can't stand in for the pages: a scan or a photographed handout has
 * little or no text, and a page that is only an image (a calendar saved as a picture) would be
 * missed. Then the whole PDF is read as before.
 */

/** Fewer visible characters than this on any page means the page may be a picture. */
const THIN_PAGE = 80;
/** Less text than this in the whole document isn't worth the risk. */
const MIN_TOTAL = 300;
/** Text extraction is milliseconds; anything slower is a sign of a hostile or broken file. */
const TIMEOUT_MS = 4000;

export async function pdfAsText(base64: string): Promise<string | null> {
  const work = (async () => {
    const pdf = await getDocumentProxy(new Uint8Array(Buffer.from(base64, 'base64')));
    const { items } = await extractTextItems(pdf);
    return chooseText(items.map(layoutPage));
  })();
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS));
  return Promise.race([work, timeout]);
}

/** The document as text, page by page, or null when any page looks like a picture. */
export function chooseText(pages: string[]): string | null {
  const visible = pages.map((p) => p.replace(/\s/g, '').length);
  const total = visible.reduce((a, b) => a + b, 0);
  if (!pages.length || total < MIN_TOTAL || visible.some((n) => n < THIN_PAGE)) return null;
  return pages.map((p, i) => `--- Page ${i + 1} ---\n${p}`).join('\n\n');
}

type Item = Pick<StructuredTextItem, 'str' | 'x' | 'y' | 'width' | 'fontSize'>;

/**
 * One page's text items as lines: items on the same baseline make a row, and each item starts at
 * the column its position gives, so a schedule table keeps its columns (like `pdftotext -layout`).
 */
export function layoutPage(items: Item[]): string {
  const words = items.filter((it) => it.str.trim());
  if (!words.length) return '';
  const widths = words.filter((it) => it.str.length > 0 && it.width > 0).map((it) => it.width / it.str.length).sort((a, b) => a - b);
  const charWidth = widths[Math.floor(widths.length / 2)] || 5;
  const left = Math.min(...words.map((it) => it.x));
  const rows: { y: number; items: Item[] }[] = [];
  for (const it of [...words].sort((a, b) => b.y - a.y || a.x - b.x)) {
    const tolerance = Math.max(2, it.fontSize * 0.4);
    const row = rows.find((r) => Math.abs(r.y - it.y) <= tolerance);
    if (row) row.items.push(it); else rows.push({ y: it.y, items: [it] });
  }
  rows.sort((a, b) => b.y - a.y);
  // A wider gap than a normal line break becomes a blank line, as it reads on the page: it is what
  // separates one table row (a week of a schedule) from the next.
  const gaps = rows.slice(1).map((r, i) => rows[i]!.y - r.y).sort((a, b) => a - b);
  const lineGap = gaps[Math.floor(gaps.length / 2)] || 14;
  return rows
    .map((row, i) => {
      const blank = i > 0 && rows[i - 1]!.y - row.y > lineGap * 1.6 ? '\n' : '';
      let line = '';
      for (const it of row.items.sort((a, b) => a.x - b.x)) {
        const column = Math.round((it.x - left) / charWidth);
        if (line.length < column) line = line.padEnd(column, ' ');
        else if (line && !line.endsWith(' ')) line += ' ';
        line += it.str;
      }
      return blank + line.trimEnd();
    })
    .join('\n');
}
