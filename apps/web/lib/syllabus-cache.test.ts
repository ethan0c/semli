import { afterEach, describe, expect, it, vi } from 'vitest';
import { cacheKey, readCache, termOf, writeCache } from './syllabus-cache';

vi.mock('@dayli/extract', () => ({ PROMPT_VERSION: 'v1' }));

const context = { today: '2026-08-24', timezone: 'America/Chicago', locale: 'en-US', region: 'US', courses: [], employers: [] };
const pdf = (data: string, over: object = {}) => ({ input: { kind: 'pdf' as const, data }, context: { ...context, ...over } });
const syllabus = { detected_type: 'syllabus' as const, employer: null, course: null, covers_from: null, covers_to: null, items: [{ kind: 'task' as const, title: 'Quiz 1', category: 'school' as const, date: '2026-09-04', start: null, end: null, is_deadline: true, repeat_weekdays: [], repeat_until: null, course_code: null, evidence: 'Quiz 1, Sep 4', confidence: 0.9, question: null }] };

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('cacheKey', () => {
  it('is the same for classmates in the same term, different across terms and readers', () => {
    const a = cacheKey(pdf('JVBERi0xLjQ='), 'opus');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(cacheKey(pdf('JVBERi0xLjQ=', { today: '2026-09-15' }), 'opus')).toBe(a);
    expect(cacheKey(pdf('JVBERi0xLjQ=', { today: '2027-01-12' }), 'opus')).not.toBe(a);
    expect(cacheKey(pdf('JVBERi0xLjQ='), 'sonnet')).not.toBe(a);
    expect(cacheKey(pdf('JVBERi0xLjQ=', { locale: 'en-GB', region: 'GB' }), 'opus')).not.toBe(a);
  });
  it('never keys anything but a PDF', () => {
    expect(cacheKey({ input: { kind: 'text', text: 'Exam Friday' }, context }, 'opus')).toBeNull();
  });
  it('splits the year into terms', () => {
    expect([termOf('2026-01-10'), termOf('2026-06-20'), termOf('2026-08-01')]).toEqual(['2026-spring', '2026-summer', '2026-fall']);
  });
});

describe('the cache', () => {
  it('does nothing without the service key', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    vi.stubEnv('SUPABASE_URL', 'https://db.test'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    expect(await readCache('a'.repeat(64))).toBeNull();
    await writeCache('a'.repeat(64), syllabus);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('hands back a stored read, and treats a failure as no read', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://db.test'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify([{ extraction: syllabus }]))));
    expect((await readCache('a'.repeat(64)))?.items[0]?.title).toBe('Quiz 1');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
    expect(await readCache('a'.repeat(64))).toBeNull();
  });
  it('keeps syllabi only, never work schedules', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://db.test'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service');
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 201 })); vi.stubGlobal('fetch', fetch);
    await writeCache('a'.repeat(64), { ...syllabus, detected_type: 'work_schedule' });
    expect(fetch).not.toHaveBeenCalled();
    await writeCache('a'.repeat(64), syllabus);
    expect(fetch).toHaveBeenCalledOnce();
  });
});
