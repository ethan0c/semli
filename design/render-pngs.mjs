/**
 * PNG copies of the brand marks, for places that can't show SVG (email clients, decks, press,
 * App Store Connect uploads). Run `node design/render-pngs.mjs`; it writes design/png/ and the
 * email wordmark the site serves at /email/wordmark.png.
 *
 *   wordmark-ink-{1440,720}.png     ink wordmark, lavender dot, transparent
 *   wordmark-white-{1440,720}.png   white wordmark for dark grounds, transparent
 *   app-icon-{1024,512,180}.png     the two-dot app mark on its dark square
 *   app-mark-{1024,512}.png         the two dots alone, transparent
 *
 * The email wordmark has the email page's paper (#FAF9F6) baked in, so Gmail's dark mode, which
 * darkens the page but never images, can't put ink letters on a dark ground. Shown at 84 px wide;
 * drawn at 3x for sharp screens.
 */
import sharp from 'sharp';
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const file = (name) => fileURLToPath(new URL(`../${name}`, import.meta.url));
const PAPER = '#FAF9F6';
export const EMAIL_WORDMARK = { path: 'apps/web/public/email/wordmark.png', width: 84 };

await mkdir(file('design/png'), { recursive: true });
await mkdir(file('apps/web/public/email'), { recursive: true });

const out = [];
async function render(input, name, width, opts = {}) {
  let img = sharp(typeof input === 'string' ? file(input) : input, { density: 300 }).resize({ width });
  if (opts.flatten) img = img.flatten({ background: opts.flatten });
  await img.png({ compressionLevel: 9 }).toFile(file(name));
  out.push(name);
}

for (const tone of ['ink', 'white']) for (const w of [1440, 720]) await render(`design/wordmark-${tone}.svg`, `design/png/wordmark-${tone}-${w}.png`, w);

const icon = await readFile(file('design/icon-b-dots.svg'), 'utf8');
for (const w of [1024, 512, 180]) await render(Buffer.from(icon), `design/png/app-icon-${w}.png`, w);
const mark = Buffer.from(icon.replace(/<rect\b[^>]*\/>/, ''));
for (const w of [1024, 512]) await render(mark, `design/png/app-mark-${w}.png`, w);

await render('design/wordmark-ink.svg', EMAIL_WORDMARK.path, EMAIL_WORDMARK.width * 3, { flatten: PAPER });

for (const name of out) {
  const { width, height } = await sharp(file(name)).metadata();
  console.log(`  ${name}  ${width} x ${height}`);
}
