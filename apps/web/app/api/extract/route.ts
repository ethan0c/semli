import Anthropic from '@anthropic-ai/sdk';
import { extract, MODEL, type StreamedItem } from '@dayli/extract';
import { EXTRACT_STREAM_TYPE, ExtractRequest, IMPORT_MESSAGES, friendlyImportError, type ExtractResponse, type ExtractStreamLine } from '@dayli/schema';
import { errorDiagnostic } from '@dayli/core';
import { checkImportAccess, type Access } from '../../../lib/import-access';
import { cors } from '../../../lib/cors';
import { cacheKey, readCache, writeCache } from '../../../lib/syllabus-cache';

// Dense multi-page syllabi can take more than a minute to read.
export const maxDuration = 180;


export async function OPTIONS(request: Request) {
  return new Response(null, { status: 204, headers: cors(request) });
}

export async function POST(request: Request) {
  const reply = (body: ExtractResponse, status = 200) => Response.json(body, { status, headers: cors(request) });
  let json: unknown;
  try {
    json = await request.json();
  } catch (error) {
    console.error('[extract.request_json]', errorDiagnostic(error));
    return reply({ ok: false, error: IMPORT_MESSAGES.request }, 400);
  }
  const parsed = ExtractRequest.safeParse(json);
  if (!parsed.success) {
    console.error('[extract.request_schema]', { code: 'invalid_request', issues: parsed.error.issues.map(({ code, path }) => ({ code, path })) });
    return reply({ ok: false, error: IMPORT_MESSAGES.request }, 400);
  }

  let access: Access;
  try {
    access = await checkImportAccess(request);
  } catch (err) {
    console.error('[extract.access]', errorDiagnostic(err));
    return reply({ ok: false, error: IMPORT_MESSAGES.unavailable }, 503);
  }
  if (!access.ok) return reply({ ok: false, error: access.error }, access.status);

  // Which model reads is the server's call, never the app's, so it changes on Vercel without a
  // release (docs/env.md): messages and screenshots on the quick reader (Haiku), documents on the
  // document reader (Opus), in fast mode for Plus unless EXTRACT_FAST=0. docs/import-speed.md.
  const read = async (hooks: { onItem?: (item: StreamedItem) => void; onReset?: () => void } = {}): Promise<[ExtractResponse, number]> => {
    // A classmate already read this exact syllabus this term: hand it back at once, for nothing.
    const cache = cacheKey(parsed.data, process.env.EXTRACT_DOCUMENT_MODEL || MODEL);
    const cached = cache ? await readCache(cache) : null;
    if (cached) {
      console.info('[extract.pdf]', { via: 'cache' });
      cached.items.forEach((item) => hooks.onItem?.(item));
      return [{ ok: true, extraction: cached }, 200];
    }
    try {
      const result = await extract(parsed.data, undefined, {
        fast: !!access.plus && process.env.EXTRACT_FAST !== '0',
        readers: { quick: process.env.EXTRACT_QUICK_MODEL, document: process.env.EXTRACT_DOCUMENT_MODEL },
        pdfText: process.env.EXTRACT_PDF_TEXT !== '0',
        ...hooks,
      });
      // How often PDFs read as text, for the cost dashboard; no content, only the path taken.
      if (result.ok && result.via) console.info('[extract.pdf]', { via: result.via });
      if (result.ok && cache) await writeCache(cache, result.extraction);
      if (!result.ok) {
        // A failed read never costs an import.
        await access.refund();
        console.error('[extract.result]', { code: Object.entries(IMPORT_MESSAGES).find(([, message]) => message === result.error)?.[0] ?? 'unknown_failure' });
        return [{ ok: false, error: friendlyImportError(result.error, 422) }, 422];
      }
      return [{ ok: true, extraction: result.extraction }, 200];
    } catch (err) {
      await access.refund();
      console.error('[extract.provider]', errorDiagnostic(err));
      // The monthly spend limit on the Anthropic account stops every import: say so, by name.
      if (err instanceof Anthropic.BadRequestError && /usage limit/i.test(err.message)) {
        console.error('[extract.spend_limit]', { code: 'anthropic_spend_limit' });
        return [{ ok: false, error: IMPORT_MESSAGES.unavailable }, 503];
      }
      if (err instanceof Anthropic.AuthenticationError) return [{ ok: false, error: IMPORT_MESSAGES.unavailable }, 500];
      if (err instanceof Anthropic.RateLimitError) return [{ ok: false, error: IMPORT_MESSAGES.busy }, 429];
      if (err instanceof Anthropic.APIConnectionError) return [{ ok: false, error: IMPORT_MESSAGES.unavailable }, 502];
      // A plain Error from the SDK when no credentials are configured at all.
      if (err instanceof Error && /authentication method|API_KEY/i.test(err.message)) return [{ ok: false, error: IMPORT_MESSAGES.unavailable }, 500];
      return [{ ok: false, error: IMPORT_MESSAGES.unavailable }, 502];
    }
  };

  // A new app asks for the answer as it's written; older apps and the site get one response, as before.
  if (request.headers.get('accept')?.includes(EXTRACT_STREAM_TYPE)) {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        const send = (line: ExtractStreamLine) => controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
        const [response, status] = await read({ onItem: (item) => send({ type: 'item', item }), onReset: () => send({ type: 'reset' }) });
        send({ type: 'done', status, response });
        controller.close();
      },
    });
    return new Response(body, { headers: { ...cors(request), 'content-type': EXTRACT_STREAM_TYPE, 'cache-control': 'no-store, no-transform' } });
  }
  const [response, status] = await read();
  return reply(response, status);
}
