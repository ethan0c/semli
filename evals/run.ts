import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { extract, PROMPT_VERSION } from '@dayli/extract';
import { ExtractRequest, Extraction } from '@dayli/schema';
import { EvalCase } from './schema';
import { aggregate, score } from './score';

const root = resolve(import.meta.dirname, '..');
const arg = (name: string) => { const i = process.argv.indexOf(name); return i < 0 ? undefined : process.argv[i + 1]; };
const manifest = resolve(root, arg('--manifest') ?? 'evals/cases.json');
const all = EvalCase.array().parse(JSON.parse(readFileSync(manifest, 'utf8')));
if (new Set(all.map((c) => c.id)).size !== all.length) throw new Error('Duplicate case IDs');
const selected = all.filter((c) => (!arg('--kind') || c.input.kind === arg('--kind')) && (!arg('--case') || c.id === arg('--case')));
if (!selected.length) throw new Error('No eval cases selected');
const digest = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const requests = selected.map((test) => {
  test.expected.items.forEach((item) => new RegExp(item.match, 'i'));
  if (test.input.kind === 'text') return { test, inputHash: digest(test.input.text), request: ExtractRequest.parse({ input: test.input, context: test.context }) };
  const path = resolve(root, 'evals', test.input.file);
  if (!path.startsWith(resolve(root, 'evals/inputs') + '/')) throw new Error(`Input outside evals/inputs: ${test.id}`);
  const bytes = readFileSync(path);
  if (test.input.kind === 'pdf' && bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error(`Not a PDF: ${test.id}`);
  if (bytes.length > 20 * 1024 * 1024) throw new Error(`Input exceeds 20 MB: ${test.id}`);
  return { test, inputHash: digest(bytes), request: ExtractRequest.parse({ input: { kind: test.input.kind, mediaType: test.input.kind === 'image' ? test.input.mediaType : undefined, data: bytes.toString('base64') }, context: test.context }) };
});
const fixtureHash = digest(JSON.stringify(requests.map(({ test, inputHash }) => ({ test, inputHash }))));
const counts = Object.fromEntries(['text', 'image', 'pdf'].map((kind) => [kind, selected.filter((c) => c.input.kind === kind).length]));
const formats = new Set(selected.filter((c) => c.input.kind === 'image').map((c) => c.format));
const coverage = counts.text! >= 30 && counts.image! >= 10 && counts.pdf! >= 5 && formats.size >= 3 && selected.every((c) => c.expected.complete);
console.log(`Validated ${selected.length} cases: ${JSON.stringify(counts)}; screenshot formats=${formats.size}; release coverage=${coverage}`);
if (process.argv.includes('--validate')) process.exit(0);

if (!process.env.ANTHROPIC_API_KEY) {
  const env = resolve(root, 'apps/web/.env');
  if (existsSync(env)) process.loadEnvFile(env);
}
if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is missing. Configure it in the environment or apps/web/.env; no model calls were made.');
const client = new Anthropic({ maxRetries: 1, timeout: 180_000 });
// `--model claude-sonnet-5-5` or `--fast` compares another reader against the same cases.
const options = { model: arg('--model'), fast: process.argv.includes('--fast'), effort: arg('--effort') as 'low' | 'medium' | 'high' | undefined };
const startedAt = new Date().toISOString();
const reportPath = resolve(root, arg('--out') ?? `evals/reports/${startedAt.replace(/[:.]/g, '-')}.json`);
mkdirSync(resolve(reportPath, '..'), { recursive: true });
type Result = { id: string; kind: string; provenance: string; source: string; inputHash: string; elapsedMs: number; score: ReturnType<typeof score>; extraction: Extraction | null; usage?: Anthropic.Usage; error?: string };
const results: Result[] = [];
const groups = () => Object.fromEntries(['text', 'image', 'pdf'].map((kind) => [kind, aggregate(results.filter((r) => r.kind === kind).map((r) => r.score))]));
function save() {
  const byKind = groups();
  const report = { startedAt, model: options.model ?? 'routed', fast: options.fast, effort: options.effort ?? 'default', promptVersion: PROMPT_VERSION, fixtureHash, coverage, counts, byKind, overall: aggregate(results.map((r) => r.score)),
    releasePass: coverage && results.length === selected.length && results.every((r) => !r.error) && Object.values(byKind).every((g) => g.pass), results };
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  return report;
}
// Keep request concurrency low; checkpoint every response so a failed run is inspectable.
const queue = [...requests];
await Promise.all(Array.from({ length: Math.min(3, requests.length) }, async () => {
  while (queue.length) {
    const { test, inputHash, request } = queue.shift()!;
    const start = Date.now();
    let extraction: Extraction | null = null;
    let usage: Anthropic.Usage | undefined;
    let error: string | undefined;
    try {
      const response = await extract(request, client, options);
      if (!response.ok) error = response.error;
      else { extraction = Extraction.parse(response.extraction); usage = response.usage; }
    } catch (err) {
      // Avoid logging provider payloads or credentials.
      error = err instanceof Anthropic.APIError ? `Provider HTTP ${err.status ?? 'connection failure'}` : err instanceof Error ? err.name : 'Unknown error';
    }
    const graded = score(test, extraction);
    results.push({ id: test.id, kind: test.input.kind, provenance: test.provenance, source: test.source, inputHash, elapsedMs: Date.now() - start, score: graded, extraction, usage, error });
    save();
    console.log(`${results.length}/${requests.length} ${test.id}: ${graded.timeCorrect}/${graded.timeTotal} date/time fields; ${graded.matched}/${graded.expected} items; extra=${graded.extra ?? 'ungraded'}${error ? `; ${error}` : ''}`);
    // Authentication/model access errors won't improve by billing the remaining cases.
    if (error?.match(/HTTP (401|403|404)/)) { queue.length = 0; }
  }
}));
const report = save();
console.log(JSON.stringify({ model: options.model ?? 'routed', fast: options.fast, promptVersion: PROMPT_VERSION, byKind: report.byKind, coverage, releasePass: report.releasePass, report: relative(root, reportPath) }, null, 2));
process.exitCode = report.releasePass ? 0 : 1;
