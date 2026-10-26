// `npm run store:changes`: what reached the app since the last store release, for writing What's New.
// `npm run store:check`: checks every locale in store.config.json against the listing rules in
// docs/app-store-connect.md (limits, the Oct 23, 2026 rejection, keyword hygiene) before a push.
// `changes` takes `--since <ref>` to start somewhere other than the last release tag.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const CONFIG = 'apps/mobile/store.config.json';
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const readJson = (path) => JSON.parse(readFileSync(join(ROOT, path), 'utf8'));

/** The last store release: the newest `v1.2.3` tag, skipping over-the-air `-ota` tags. */
function lastRelease() {
  return git('tag', '--list', 'v*', '--sort=-v:refname').split('\n').find((t) => t && !t.includes('-ota')) ?? null;
}

// ---- changes ------------------------------------------------------------------------

/** Paths a person using the app could notice. Tests never count. */
const APP_PATHS = ['apps/mobile/src/', 'apps/mobile/app.json', 'packages/core/src/', 'packages/schema/', 'packages/extract/', 'packages/tokens/'];
const isAppFile = (f) => APP_PATHS.some((p) => f.startsWith(p)) && !/\.test\.[jt]sx?$|\/test\//.test(f);
/** Conventional-commit types that rarely change what anyone sees. */
const QUIET = /^(chore|test|docs|ci|build|style|refactor)(\(|:|!)/;

function changes(since) {
  const base = since ?? lastRelease();
  if (!base) { console.error('No release tag found. Pass --since <ref>.'); process.exit(1); }
  const hashes = git('log', `${base}..HEAD`, '--no-merges', '--format=%H').split('\n').filter(Boolean);
  const app = [];
  const skipped = [];
  for (const h of hashes) {
    const subject = git('show', '-s', '--format=%s', h);
    const body = git('show', '-s', '--format=%b', h);
    const files = git('show', '--name-only', '--format=', h).split('\n').filter(isAppFile);
    if (files.length) app.push({ subject, body, files, quiet: QUIET.test(subject) });
    else skipped.push(subject);
  }
  const notes = readJson(CONFIG).apple.info['en-US'].releaseNotes;
  console.log(`Since ${base} (${git('log', '-1', '--format=%cs', base)}): ${app.length} of ${hashes.length} commits touch the app.`);
  console.log(`Current What's New (en-US): ${notes}\n`);
  for (const c of app.reverse()) {
    console.log(`- ${c.subject}${c.quiet ? '  [probably not visible]' : ''}`);
    for (const line of c.body.split('\n').filter(Boolean).slice(0, 6)) console.log(`    ${line}`);
    const shown = c.files.map((f) => f.replace(/^apps\/mobile\/src\//, '')).slice(0, 8);
    console.log(`    files: ${shown.join(', ')}${c.files.length > shown.length ? `, +${c.files.length - shown.length} more` : ''}`);
  }
  if (skipped.length) console.log(`\nNot in the app (docs, web, emails, tests): ${skipped.join(' · ')}`);
}

// ---- check --------------------------------------------------------------------------

const LIMITS = { title: 30, subtitle: 30, keywords: 100, description: 4000, promoText: 170, releaseNotes: 4000 };
/** Guideline 2.3.7 and the Oct 23, 2026 rejection: none of these in the fields search and the first screen show. */
const NO_PRICING = /\bfree\b|\btrials?\b|[$£€]\s?\d|\bprice[sd]?\b|\bdiscount\b|\bsale\b/i;
const NO_PRICING_FIELDS = ['title', 'subtitle', 'keywords', 'promoText', 'releaseNotes'];
/** Prices stay out of the description too; "free plan" and trial eligibility may stay. */
const NO_AMOUNTS = /[$£€]\s?\d/;
/** Claims that need a number to cite (docs/launch-checklist.md). */
const UNSUPPORTED = /#1\b|\bnumber one\b/i;
/** All-caps words read as template UI; these are names, not shouting. */
const CAPS_OK = new Set(['AI', 'PDF', 'PDFS', 'iOS', 'ICS', 'URL', 'UK', 'US', 'FAQ', 'GPA', 'RN', 'BSN', 'NCLEX']);
/** Spellings that belong to one side of the Atlantic. */
const US_ONLY = /\b(honor|color|favorite|center)\b/i;
const UK_ONLY = /\b(honour|colour|favourite|centre)\b/i;

function check() {
  const config = readJson(CONFIG);
  const appVersion = readJson('apps/mobile/app.json').expo.version;
  const errors = [];
  const warnings = [];
  const release = lastRelease();
  const released = release ? JSON.parse(git('show', `${release}:${CONFIG}`)) : null;

  if (config.apple.version !== appVersion) errors.push(`apple.version is ${config.apple.version} but app.json expo.version is ${appVersion}.`);
  if (release && release === `v${appVersion}`) warnings.push(`${appVersion} is already released (${release}). Bump expo.version and apple.version before the next store build.`);

  for (const [locale, info] of Object.entries(config.apple.info)) {
    const at = (field) => `${locale} ${field}`;
    const text = { ...info, keywords: (info.keywords ?? []).join(',') };
    for (const [field, max] of Object.entries(LIMITS)) {
      const n = [...(text[field] ?? '')].length;
      if (n > max) errors.push(`${at(field)} is ${n} characters; the limit is ${max}.`);
    }
    for (const field of NO_PRICING_FIELDS) {
      const hit = text[field]?.match(NO_PRICING);
      if (hit) errors.push(`${at(field)} says "${hit[0]}": no prices, trials or "free" here (guideline 2.3.7, rejected Oct 23, 2026).`);
    }
    if (NO_AMOUNTS.test(info.description ?? '')) errors.push(`${at('description')} has a price; the paywall shows the live store price.`);
    for (const field of Object.keys(LIMITS)) {
      if (UNSUPPORTED.test(text[field] ?? '')) errors.push(`${at(field)} claims "#1" without a number to cite.`);
      const shouting = (text[field] ?? '').match(/\b[A-Z]{3,}\b/g)?.filter((w) => !CAPS_OK.has(w));
      if (shouting?.length) warnings.push(`${at(field)} has all-caps ${[...new Set(shouting)].join(', ')}; use sentence case.`);
    }
    const prose = [info.description, info.promoText, info.releaseNotes, info.subtitle].join(' ');
    const wrong = locale === 'en-US' ? prose.match(UK_ONLY) : locale === 'en-GB' || locale === 'en-AU' ? prose.match(US_ONLY) : null;
    if (wrong) warnings.push(`${locale} spells "${wrong[0]}"; check the storefront's spelling.`);

    // Keywords: each one a single search term, no spaces, nothing the name or subtitle already indexes.
    const indexed = new Set(`${info.title} ${info.subtitle}`.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
    const seen = new Set();
    for (const raw of info.keywords ?? []) {
      const k = raw.toLowerCase();
      if (/\s/.test(raw)) errors.push(`${at('keywords')} "${raw}" has a space; Apple combines single words, so spaces only spend characters.`);
      if (seen.has(k)) errors.push(`${at('keywords')} repeats "${raw}".`);
      seen.add(k);
      if (indexed.has(k)) errors.push(`${at('keywords')} "${raw}" is already in the title or subtitle.`);
      else if (indexed.has(k.replace(/s$/, '')) || indexed.has(`${k}s`)) warnings.push(`${at('keywords')} "${raw}" is a plural of a title or subtitle word; Apple may already match it.`);
    }

    const before = released?.apple.info[locale];
    if (before && release !== `v${appVersion}` && before.releaseNotes === info.releaseNotes) warnings.push(`${at('releaseNotes')} is unchanged since ${release}; write What's New for ${appVersion}.`);
  }

  for (const w of warnings) console.log(`warning  ${w}`);
  for (const e of errors) console.log(`error    ${e}`);
  console.log(errors.length || warnings.length ? `\n${errors.length} errors, ${warnings.length} warnings.` : 'All locales pass.');
  if (errors.length) process.exit(1);
}

const [command, ...rest] = process.argv.slice(2);
const sinceAt = rest.indexOf('--since');
if (command === 'changes') changes(sinceAt >= 0 ? rest[sinceAt + 1] : undefined);
else if (command === 'check') check();
else { console.error('Usage: store-notes.mjs changes [--since <ref>] | check'); process.exit(1); }
