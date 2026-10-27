import { createHash } from 'node:crypto';
import { PROMPT_VERSION } from '@dayli/extract';
import { Extraction, type ExtractRequest } from '@dayli/schema';

/**
 * Finished syllabus reads, kept so the next student who uploads the identical file gets it at once
 * and for nothing (supabase/migrations/20261027140000_syllabus_cache.sql). Only syllabi and course
 * schedules: never work schedules, messages or screenshots, which are personal. Every failure here
 * (no service key, a slow or missing table) means an ordinary read, never a failed import.
 */

const CACHEABLE = new Set(['syllabus', 'course_schedule']);
/** About a semester; an older read is ignored. */
const KEEP_DAYS = 150;
/** A cache lookup that takes longer than this is abandoned for an ordinary read. */
const LOOKUP_MS = 1500;

function service(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? { url: url.replace(/\/$/, ''), key } : null;
}

/** Fall (Aug–Dec), spring (Jan–May) or summer (Jun–Jul) of a year: classmates upload weeks apart. */
export function termOf(date: string): string {
  const month = Number(date.slice(5, 7));
  return `${date.slice(0, 4)}-${month >= 8 ? 'fall' : month >= 6 ? 'summer' : 'spring'}`;
}

/** The cache key for a PDF read, or null for anything else. */
export function cacheKey(req: ExtractRequest, reader: string): string | null {
  if (req.input.kind !== 'pdf') return null;
  const { today, locale, region } = req.context;
  return createHash('sha256').update(req.input.data).update(`|${PROMPT_VERSION}|${reader}|${termOf(today)}|${locale ?? ''}|${region ?? ''}`).digest('hex');
}

export async function readCache(key: string): Promise<Extraction | null> {
  const s = service();
  if (!s) return null;
  const since = new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString();
  try {
    const res = await fetch(`${s.url}/rest/v1/syllabus_cache?key=eq.${key}&created_at=gte.${encodeURIComponent(since)}&select=extraction`, {
      headers: { apikey: s.key, authorization: `Bearer ${s.key}` },
      signal: AbortSignal.timeout(LOOKUP_MS),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as { extraction?: unknown }[];
    const parsed = Extraction.safeParse(rows[0]?.extraction);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function writeCache(key: string, extraction: Extraction): Promise<void> {
  const s = service();
  if (!s || !CACHEABLE.has(extraction.detected_type) || !extraction.items.length) return;
  try {
    await fetch(`${s.url}/rest/v1/syllabus_cache`, {
      method: 'POST',
      headers: { apikey: s.key, authorization: `Bearer ${s.key}`, 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ key, detected_type: extraction.detected_type, extraction, created_at: new Date().toISOString() }),
      signal: AbortSignal.timeout(LOOKUP_MS),
    });
  } catch {
    // A missed write only means the next classmate reads it again.
  }
}
