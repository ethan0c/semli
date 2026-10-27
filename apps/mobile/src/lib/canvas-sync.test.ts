import { beforeEach, describe, expect, it, vi } from 'vitest';
// vi.mock calls below are hoisted above these imports.
import { CANVAS_MESSAGES } from './canvas';
import { syncCanvas } from './canvas-sync';

const mocks = vi.hoisted(() => ({
  fetchCanvasFeed: vi.fn(), applyPlan: vi.fn(() => 'batch'), showToast: vi.fn(),
  state: {} as Record<string, unknown>,
}));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' }, AppState: { addEventListener: () => ({ remove: () => undefined }) } }));
vi.mock('./api', () => ({ apiBase: () => '' }));
vi.mock('./supabase', () => ({ supabase: null }));
vi.mock('../providers/PurchasesProvider', () => ({ usePurchases: () => ({ isPlus: true }) }));
vi.mock('./canvas', async (original) => ({ ...(await original<typeof import('./canvas')>()), fetchCanvasFeed: mocks.fetchCanvasFeed }));
vi.mock('../store', () => ({
  newId: () => 'course',
  useStore: { getState: () => mocks.state },
}));

const FEED = 'https://school.instructure.com/feeds/calendars/user_abc.ics';
const entry = { externalId: 'canvas:event-assignment-1', kind: 'task', title: 'Essay', courseLabel: null, date: '2099-01-10', start: null, end: null, isDeadline: true, url: null };

beforeEach(() => {
  vi.clearAllMocks();
  const setSettings = (patch: Record<string, unknown>) => { mocks.state.settings = { ...(mocks.state.settings as object), ...patch }; };
  mocks.state = {
    items: {}, courses: [], pending: null, applyPlan: mocks.applyPlan, showToast: mocks.showToast, setSettings,
    settings: { apiUrl: '', canvas: { feedUrl: FEED, lastSyncedAt: null, lastError: null } },
  };
  mocks.fetchCanvasFeed.mockResolvedValue({ ok: true, entries: [entry] });
});

const canvas = () => (mocks.state.settings as { canvas: Record<string, unknown> }).canvas;

describe('Canvas sync', () => {
  it('applies the feed and records the sync', async () => {
    expect(await syncCanvas()).toMatchObject({ ok: true });
    expect(mocks.applyPlan).toHaveBeenCalledOnce();
    expect(canvas().lastSyncedAt).not.toBeNull();
  });

  it('never closes an import under review', async () => {
    mocks.state.pending = { extraction: {}, source: 'Screenshot' };
    expect(await syncCanvas()).toEqual({ ok: false, error: CANVAS_MESSAGES.reviewing });
    expect(mocks.applyPlan).not.toHaveBeenCalled();
    // Not recorded as synced, so the next check runs it.
    expect(canvas().lastSyncedAt).toBeNull();
  });

  it('a disconnect during the fetch stays disconnected', async () => {
    mocks.fetchCanvasFeed.mockImplementation(async () => {
      (mocks.state.settings as { canvas: Record<string, unknown> }).canvas = { feedUrl: null, lastSyncedAt: null, lastError: null };
      return { ok: true, entries: [entry] };
    });
    expect(await syncCanvas()).toEqual({ ok: false, error: CANVAS_MESSAGES.disconnected });
    expect(mocks.applyPlan).not.toHaveBeenCalled();
    expect(canvas()).toEqual({ feedUrl: null, lastSyncedAt: null, lastError: null });
  });

  it('a first connect, with no saved link yet, still saves the link it synced', async () => {
    (mocks.state.settings as { canvas: Record<string, unknown> }).canvas = { feedUrl: null, lastSyncedAt: null, lastError: null };
    expect(await syncCanvas(FEED)).toMatchObject({ ok: true });
    expect(canvas().feedUrl).toBe(FEED);
  });
});
