import { EXTRACT_STREAM_TYPE, ExtractResponse, ExtractStreamLine, IMPORT_MESSAGES, friendlyImportError, importErrorForStatus, type ExtractRequest, type Extraction } from '@dayli/schema';
import { Platform } from 'react-native';
import { reportError } from './errors';

export const DEFAULT_API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

/**
 * The address to call. semli.app redirects to www.semli.app, and a redirect to another host drops
 * the Authorization header (the fetch standard, which Expo's streaming fetch follows), so imports
 * arrived signed out (Oct 27, 2026). Installs keep the old address in their saved settings, so it
 * is corrected here on every call rather than only in the default.
 */
export function apiBase(apiUrl: string | undefined): string {
  return (apiUrl || DEFAULT_API_URL).replace(/\/+$/, '').replace(/^https:\/\/semli\.app(?=$|\/)/, 'https://www.semli.app');
}

/** One row as it's read. */
export type StreamedItem = Extraction['items'][number];

/** Rows as they're read, for the import screen; only the final response reaches review. */
export type StreamHooks = { onItem: (item: StreamedItem) => void; onReset?: () => void };

/**
 * Sends an import. With `hooks`, asks for the answer as it's written (one line per item, then the
 * response) and hands each item over as it arrives; a server that answers the old way is read the
 * old way. Expo's fetch streams on the phone; the browser's own does on the web.
 */
export async function requestExtraction(apiUrl: string, req: ExtractRequest, headers: Record<string, string> = {}, hooks?: StreamHooks): Promise<ExtractResponse> {
  let res: Response;
  try {
    res = await (hooks ? await streamingFetch() : fetch)(`${apiBase(apiUrl)}/api/extract`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(hooks ? { accept: EXTRACT_STREAM_TYPE } : {}), ...headers },
      body: JSON.stringify(req),
    });
  } catch (error) {
    reportError('import.request', error);
    return { ok: false, error: IMPORT_MESSAGES.connection };
  }
  if (hooks && res.body && res.headers.get('content-type')?.includes(EXTRACT_STREAM_TYPE)) return readStream(res.body, hooks);
  let body: unknown;
  try {
    body = await res.json();
  } catch (error) {
    reportError('import.response_json', { name: 'ResponseError', code: 'invalid_json', status: res.status, message: 'Import response was not JSON', cause: error });
    return { ok: false, error: importErrorForStatus(res.status) };
  }
  return settle(body, res.status);
}

/** The streaming fetch: Expo's on the phone (the global one can't stream there), the browser's on the web. */
async function streamingFetch(): Promise<typeof fetch> {
  if (Platform.OS === 'web') return fetch;
  try {
    return (await import('expo/fetch')).fetch as unknown as typeof fetch;
  } catch {
    return fetch;
  }
}

async function readStream(body: ReadableStream<Uint8Array>, hooks: StreamHooks): Promise<ExtractResponse> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (value) buffer += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const raw = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!raw) continue;
        const line = ExtractStreamLine.safeParse(JSON.parse(raw));
        if (!line.success) continue;
        if (line.data.type === 'item') hooks.onItem(line.data.item);
        else if (line.data.type === 'reset') hooks.onReset?.();
        else return settle(line.data.response, line.data.status);
      }
      if (done) break;
    }
  } catch (error) {
    reportError('import.stream', error);
    return { ok: false, error: IMPORT_MESSAGES.connection };
  }
  reportError('import.stream', { name: 'ResponseError', code: 'stream_ended', message: 'The import stream ended without a response' });
  return { ok: false, error: IMPORT_MESSAGES.connection };
}

/** A response, from a single answer or a stream's last line, checked and made readable. */
function settle(body: unknown, status: number): ExtractResponse {
  const parsed = ExtractResponse.safeParse(body);
  if (!parsed.success || (status >= 400 && parsed.data.ok)) {
    reportError('import.response_schema', { code: 'invalid_response', status });
    return { ok: false, error: importErrorForStatus(status) };
  }
  if (!parsed.data.ok) {
    reportError('import.response', { code: 'import_rejected', status, message: 'The import service could not process the input' });
    return { ok: false, error: friendlyImportError(parsed.data.error, status) };
  }
  return parsed.data;
}
