import Anthropic from '@anthropic-ai/sdk';
import { extract } from '@dayli/extract';
import { ExtractRequest, IMPORT_MESSAGES, friendlyImportError, type ExtractResponse } from '@dayli/schema';
import { errorDiagnostic } from '@dayli/core';
import { checkImportAccess, type Access } from '../../../lib/import-access';
import { cors } from '../../../lib/cors';

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

  try {
    // Fast mode unless EXTRACT_FAST=0: the same accuracy at a third to half the wait, for twice the price.
    const result = await extract(parsed.data, undefined, { fast: process.env.EXTRACT_FAST !== '0' });
    if (!result.ok) {
      // A failed read never costs an import.
      await access.refund();
      console.error('[extract.result]', { code: Object.entries(IMPORT_MESSAGES).find(([, message]) => message === result.error)?.[0] ?? 'unknown_failure' });
      return reply({ ok: false, error: friendlyImportError(result.error, 422) }, 422);
    }
    return reply({ ok: true, extraction: result.extraction });
  } catch (err) {
    await access.refund();
    console.error('[extract.provider]', errorDiagnostic(err));
    if (err instanceof Anthropic.AuthenticationError) {
      return reply({ ok: false, error: IMPORT_MESSAGES.unavailable }, 500);
    }
    if (err instanceof Anthropic.RateLimitError) {
      return reply({ ok: false, error: IMPORT_MESSAGES.busy }, 429);
    }
    if (err instanceof Anthropic.APIConnectionError) {
      return reply({ ok: false, error: IMPORT_MESSAGES.unavailable }, 502);
    }
    // A plain Error from the SDK when no credentials are configured at all.
    if (err instanceof Error && /authentication method|API_KEY/i.test(err.message)) {
      return reply({ ok: false, error: IMPORT_MESSAGES.unavailable }, 500);
    }
    return reply({ ok: false, error: IMPORT_MESSAGES.unavailable }, 502);
  }
}
