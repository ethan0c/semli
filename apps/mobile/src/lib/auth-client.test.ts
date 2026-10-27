import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthClient } from './auth';
import { snapshotFromRecords, type PlanRecord, type StoredRecord } from './sync-records';

/*
 * The sign-in flow end to end with the provider mocked: where each outcome lands (planner,
 * onboarding, the code screen), what the backup does to a new phone, and the error paths.
 */

type Listener = (state: Record<string, unknown>, prev: Record<string, unknown>) => void;
function fakeStore<S extends Record<string, unknown>>(initial: () => S) {
  let state = initial();
  const listeners = new Set<Listener>();
  const api = {
    getState: () => state,
    setState: (patch: Partial<S> | ((s: S) => Partial<S>)) => {
      const prev = state;
      state = { ...state, ...(typeof patch === 'function' ? patch(state) : patch) };
      listeners.forEach((l) => l(state, prev));
    },
    subscribe: (l: Listener) => { listeners.add(l); return () => listeners.delete(l); },
    // Each test loads the modules afresh, so the last test's subscribers go too.
    reset: () => { state = initial(); listeners.clear(); },
  };
  return api;
}

const mocks = vi.hoisted(() => {
  const auth = {
    signInWithPassword: vi.fn(), signUp: vi.fn(), signInWithOAuth: vi.fn(), exchangeCodeForSession: vi.fn(),
    signInWithIdToken: vi.fn(),
    resetPasswordForEmail: vi.fn(), verifyOtp: vi.fn(), resend: vi.fn(), updateUser: vi.fn(), signOut: vi.fn(), getSession: vi.fn(),
  };
  // The account's sync records, held in memory; `legacy` is the whole-plan backup from before sync.
  const server = { rows: new Map<string, StoredRecord>(), seq: 0, legacy: null as unknown, pushedBy: null as string | null };
  const cloud = { pullRecords: vi.fn(), pushRecords: vi.fn(), readLegacyPlan: vi.fn() };
  const channel = { on: () => channel, subscribe: () => channel };
  return {
    auth, server, cloud,
    supabase: { auth, rpc: vi.fn(), channel: vi.fn(() => channel), removeChannel: vi.fn() },
    router: { dismissTo: vi.fn(), replace: vi.fn(), push: vi.fn() },
    browser: { maybeCompleteAuthSession: vi.fn(), openAuthSessionAsync: vi.fn() },
    purchases: { logOut: vi.fn() },
    apple: { signInAsync: vi.fn(), AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 } },
    crypto: { randomUUID: vi.fn(), digestStringAsync: vi.fn(), CryptoDigestAlgorithm: { SHA256: 'SHA-256' } },
    platform: { OS: 'ios' },
    store: null as unknown as ReturnType<typeof fakeStore>,
    session: null as unknown as ReturnType<typeof fakeStore>,
  };
});

vi.mock('expo-linking', () => ({ createURL: (path: string) => `semli://${path}` }));
vi.mock('expo-router', () => ({ router: mocks.router }));
vi.mock('expo-web-browser', () => mocks.browser);
vi.mock('expo-apple-authentication', () => mocks.apple);
vi.mock('expo-crypto', () => mocks.crypto);
vi.mock('react-native', () => ({ Platform: mocks.platform, AppState: { addEventListener: () => ({ remove: () => undefined }) } }));
vi.mock('react-native-purchases', () => ({ default: mocks.purchases }));
vi.mock('./supabase', () => ({
  supabase: mocks.supabase,
  useSession: mocks.session,
  accountOf: (session: { user?: { is_anonymous?: boolean } } | null) => (session && !session.user?.is_anonymous ? session : null),
  deleteReplacedGuest: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../store', () => ({ useStore: mocks.store }));
vi.mock('./feedback', () => ({ feedback: vi.fn() }));
vi.mock('./motion', () => ({ durations: { slow: 0 } }));
vi.mock('./cloud-store', () => mocks.cloud);
vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn().mockResolvedValue(null), setItem: vi.fn().mockResolvedValue(undefined), removeItem: vi.fn().mockResolvedValue(undefined) } }));

const DEFAULTS = () => ({
  name: '', seeded: false, onboarded: false, isStudent: true, major: null as string | null, weekKinds: [] as string[], lms: null,
  reminders: {}, breaks: [], planIntent: null, canvas: { feedUrl: null, lastSyncedAt: null, lastError: null }, cloud: { backedUpAt: null as string | null, error: null as string | null },
});
const item = (id: string) => ({ id, kind: 'task', title: id, category: 'school', icon: 'check', date: '2026-10-20', start: null, end: null, isDeadline: false, done: false, completedAt: null, courseId: null, employer: null, sourceId: null, batchId: null, notes: null, createdAt: '2026-10-01T00:00:00Z' });

const user = { id: 'u1', email: 'ama@example.com' };
const session = { user, access_token: 't' };
const fields = { email: 'ama@example.com', password: 'correct horse' };
const row = (over: object = {}) => ({ version: 1, items: [], courses: [], schedules: [], taskWorkDates: {}, settings: {}, ...over });

mocks.store = fakeStore(() => ({
  hydrated: true, items: {} as Record<string, unknown>, courses: [], schedules: [], taskWorkDates: {}, settings: DEFAULTS(), toast: null as unknown,
  setSettings: (patch: object) => mocks.store.setState((s) => ({ settings: { ...(s.settings as object), ...patch } })),
  showToast: (message: string) => mocks.store.setState({ toast: { message } }),
  planChoice: null as unknown,
  clearAll: () => mocks.store.setState({ items: {}, courses: [], schedules: [], taskWorkDates: {}, planChoice: null, settings: DEFAULTS() }),
}));
mocks.session = fakeStore(() => ({ session: null as unknown, ready: true }));

let authClient: AuthClient;
let leaveAuth: () => void;
let completeAuthFromUrl: (url: string) => Promise<unknown>;

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
  vi.stubEnv('EXPO_PUBLIC_SUPABASE_KEY', 'publishable');
  mocks.store.reset();
  mocks.session.reset();
  // A sign-in that succeeds, with no backup row yet.
  mocks.auth.getSession.mockResolvedValue({ data: { session } });
  mocks.auth.signInWithPassword.mockResolvedValue({ data: { session, user }, error: null });
  mocks.server.rows.clear();
  mocks.server.seq = 0;
  mocks.server.legacy = null;
  mocks.cloud.pullRecords.mockImplementation(async (_user: string, after: number) => [...mocks.server.rows.values()].filter((r) => r.seq > after).sort((a, b) => a.seq - b.seq));
  mocks.cloud.pushRecords.mockImplementation(async (user: string, records: PlanRecord[]) => {
    mocks.server.pushedBy = user;
    for (const r of records) mocks.server.rows.set(`${r.kind}:${r.id}`, { ...r, seq: ++mocks.server.seq });
  });
  mocks.cloud.readLegacyPlan.mockImplementation(async () => mocks.server.legacy);
  mocks.purchases.logOut.mockResolvedValue(undefined);
  mocks.platform.OS = 'ios';
  mocks.crypto.randomUUID.mockReturnValue('one-time-nonce');
  mocks.crypto.digestStringAsync.mockResolvedValue('sha256-nonce');
  mocks.apple.signInAsync.mockResolvedValue({ identityToken: 'apple-token', fullName: null });
  mocks.auth.signInWithIdToken.mockResolvedValue({ data: { session, user }, error: null });
  mocks.auth.updateUser.mockResolvedValue({ data: { user }, error: null });
  ({ authClient, leaveAuth, completeAuthFromUrl } = await import('./auth-client'));
});
afterEach(() => vi.unstubAllEnvs());

const settings = () => mocks.store.getState().settings as ReturnType<typeof DEFAULTS>;
/** The account's plan as the server now holds it. */
const saved = () => ({ user_id: mocks.server.pushedBy, data: snapshotFromRecords([...mocks.server.rows.values()]) });
/** An account whose plan is the whole-plan backup from before sync. */
const legacy = (snapshot: object, at: string | null = null) => { mocks.server.legacy = { snapshot, at }; };

describe('logging in on a new phone', () => {
  it('goes to onboarding when the account has no backup', async () => {
    expect(await authClient.signIn(fields)).toEqual({ signedIn: true, restored: false });
    expect(settings().onboarded).toBe(false);
    expect(saved()).toMatchObject({ user_id: 'u1', data: { onboarded: false } });
    leaveAuth();
    expect(mocks.router.replace).toHaveBeenCalledWith('/onboarding?step=role');
    expect(mocks.router.dismissTo).not.toHaveBeenCalled();
  });

  it('goes to onboarding, with the profile filled in, when the account signed up but never finished', async () => {
    // The row every sign-in writes: empty, from a phone that had not finished onboarding.
    legacy(row({ settings: { name: 'Ama', major: 'nursing' }, onboarded: false }));
    expect(await authClient.signIn(fields)).toEqual({ signedIn: true, restored: false });
    expect(settings()).toMatchObject({ onboarded: false, seeded: false, name: 'Ama', major: 'nursing' });
    leaveAuth();
    expect(mocks.router.replace).toHaveBeenCalledWith('/onboarding?step=role');
  });

  it('skips onboarding and lands in the planner when the account finished it elsewhere', async () => {
    legacy(row({ items: [item('a')], settings: { name: 'Ama' }, onboarded: true }));
    expect(await authClient.signIn(fields)).toEqual({ signedIn: true, restored: true });
    expect(settings()).toMatchObject({ onboarded: true, seeded: true, name: 'Ama' });
    expect(Object.keys(mocks.store.getState().items as object)).toEqual(['a']);
    expect(saved().data.items.map((i) => i.id)).toEqual(['a']);
    leaveAuth();
    expect(mocks.router.dismissTo).toHaveBeenCalledWith('/');
    expect(mocks.router.replace).not.toHaveBeenCalled();
  });

  it('treats a backup saved before the flag as finished only when it holds a plan', async () => {
    legacy(row({ items: [item('a')] }));
    await authClient.signIn(fields);
    expect(settings().onboarded).toBe(true);
    // Another account, so nothing the first sign-in uploaded.
    mocks.store.reset();
    mocks.server.rows.clear();
    legacy(row());
    await authClient.signIn(fields);
    expect(settings().onboarded).toBe(false);
  });

  it('still signs in when the backup cannot be read', async () => {
    mocks.cloud.pullRecords.mockRejectedValue(new Error('offline'));
    expect(await authClient.signIn(fields)).toEqual({ signedIn: true, restored: false });
    expect(settings().onboarded).toBe(false);
    expect(mocks.session.getState().session).toBe(session);
  });
});

describe('logging in on a phone with a plan', () => {
  const twoPlans = () => {
    mocks.store.setState({ items: { b: item('b') }, settings: { ...DEFAULTS(), onboarded: true, seeded: true, name: 'Phone' } });
    legacy(row({ items: [item('a')], settings: { name: 'Cloud' }, onboarded: true }), '2026-10-12T00:00:00Z');
  };

  it('never merges: with two plans it asks, and saves nothing until one is kept', async () => {
    twoPlans();
    await authClient.signIn(fields);
    expect(Object.keys(mocks.store.getState().items as object)).toEqual(['b']);
    expect(mocks.store.getState().planChoice).toMatchObject({ remoteAt: '2026-10-12T00:00:00Z' });
    expect(mocks.cloud.pushRecords).not.toHaveBeenCalled();
  });

  it('keeping the account plan replaces this phone’s plan', async () => {
    twoPlans();
    await authClient.signIn(fields);
    const { keepAccountPlan } = await import('./cloud');
    await keepAccountPlan();
    expect(Object.keys(mocks.store.getState().items as object)).toEqual(['a']);
    expect(settings().name).toBe('Cloud');
    expect(saved().data.items.map((i) => i.id)).toEqual(['a']);
    expect(mocks.store.getState().planChoice).toBeNull();
  });

  it('keeping this iPhone’s plan overwrites the backup with it', async () => {
    twoPlans();
    await authClient.signIn(fields);
    const { keepPhonePlan } = await import('./cloud');
    await keepPhonePlan();
    expect(Object.keys(mocks.store.getState().items as object)).toEqual(['b']);
    expect(saved().data.items.map((i) => i.id)).toEqual(['b']);
  });

  it('a guest backing up gives the new account its plan without asking', async () => {
    mocks.store.setState({ items: { b: item('b') }, settings: { ...DEFAULTS(), onboarded: true, seeded: true } });
    await authClient.signIn(fields);
    expect(mocks.store.getState().planChoice).toBeNull();
    expect(saved().data.items.map((i) => i.id)).toEqual(['b']);
  });

  it('as a guest, leaving the welcome goes to the planner once onboarded and to onboarding before', () => {
    leaveAuth();
    expect(mocks.router.replace).toHaveBeenCalledWith('/onboarding?step=role');
    mocks.store.setState({ settings: { ...DEFAULTS(), onboarded: true } });
    leaveAuth();
    expect(mocks.router.dismissTo).toHaveBeenCalledWith('/');
  });
});

describe('email login and sign-up', () => {
  it('surfaces a wrong password without touching the backup or navigating', async () => {
    mocks.auth.signInWithPassword.mockResolvedValue({ data: {}, error: { code: 'invalid_credentials', message: 'Invalid login credentials' } });
    await expect(authClient.signIn(fields)).rejects.toMatchObject({ code: 'invalid_credentials' });
    expect(mocks.cloud.pushRecords).not.toHaveBeenCalled();
    expect(mocks.router.replace).not.toHaveBeenCalled();
    expect(mocks.router.dismissTo).not.toHaveBeenCalled();
  });

  it('sends a fresh code and goes to the code screen when the email was never confirmed', async () => {
    mocks.auth.signInWithPassword.mockResolvedValue({ data: {}, error: { code: 'email_not_confirmed', message: 'Email not confirmed' } });
    mocks.auth.resend.mockResolvedValue({ error: null });
    expect(await authClient.signIn(fields)).toEqual({ signedIn: false, confirmEmail: true });
    expect(mocks.auth.resend).toHaveBeenCalledWith({ type: 'signup', email: fields.email });
  });

  it('still goes to the code screen when the fresh code hits the email rate limit', async () => {
    mocks.auth.signInWithPassword.mockResolvedValue({ data: {}, error: { code: 'email_not_confirmed' } });
    mocks.auth.resend.mockRejectedValue({ code: 'over_email_send_rate_limit' });
    expect(await authClient.signIn(fields)).toEqual({ signedIn: false, confirmEmail: true, resendFailed: true });
  });

  it('waits for the emailed code after sign-up and keeps the name on this phone', async () => {
    mocks.auth.signUp.mockResolvedValue({ data: { user: { ...user, identities: [{ id: 'i1' }] }, session: null }, error: null });
    expect(await authClient.signUp({ ...fields, name: 'Ama' })).toEqual({ signedIn: false, confirmEmail: true });
    expect(mocks.auth.signUp).toHaveBeenCalledWith({ email: fields.email, password: fields.password, options: { data: { full_name: 'Ama' } } });
    expect(settings().name).toBe('Ama');
    expect(mocks.cloud.pushRecords).not.toHaveBeenCalled();
  });

  it('never overwrites a name already on this phone', async () => {
    mocks.store.setState({ settings: { ...DEFAULTS(), name: 'Phone' } });
    mocks.auth.signUp.mockResolvedValue({ data: { user: { ...user, identities: [{ id: 'i1' }] }, session: null }, error: null });
    await authClient.signUp({ ...fields, name: 'Ama' });
    expect(settings().name).toBe('Phone');
  });

  it('tells someone with an account to log in instead of waiting for a code that never comes', async () => {
    // With confirmation on, Supabase answers an existing email with a user that has no identities.
    mocks.auth.signUp.mockResolvedValue({ data: { user: { ...user, identities: [] }, session: null }, error: null });
    const { authErrorMessage } = await import('./auth');
    await expect(authClient.signUp(fields)).rejects.toMatchObject({ code: 'user_already_exists' });
    await authClient.signUp(fields).catch((e) => expect(authErrorMessage(e)).toMatch(/Sign in instead/));
    expect(settings().name).toBe('');
  });

  it('signs straight in when confirmation is off', async () => {
    mocks.auth.signUp.mockResolvedValue({ data: { user: { ...user, identities: [{ id: 'i1' }] }, session }, error: null });
    expect(await authClient.signUp(fields)).toEqual({ signedIn: true, restored: false });
  });
});

describe('the emailed code', () => {
  it('a sign-up code signs in and restores like a login', async () => {
    mocks.auth.verifyOtp.mockResolvedValue({ data: { session }, error: null });
    legacy(row({ items: [item('a')], onboarded: true }));
    expect(await authClient.verifyCode(fields.email, '123456', 'signup')).toEqual({ signedIn: true, restored: true });
    expect(mocks.auth.verifyOtp).toHaveBeenCalledWith({ email: fields.email, token: '123456', type: 'signup' });
    expect(settings().onboarded).toBe(true);
  });

  it('a reset code signs in so the new password can be saved', async () => {
    mocks.auth.verifyOtp.mockResolvedValue({ data: { session }, error: null });
    expect(await authClient.verifyCode(fields.email, '123456', 'recovery')).toEqual({ signedIn: true, restored: false });
    expect(mocks.auth.verifyOtp).toHaveBeenCalledWith({ email: fields.email, token: '123456', type: 'recovery' });
    mocks.auth.updateUser.mockResolvedValue({ error: null });
    await authClient.updatePassword('new password');
    expect(mocks.auth.updateUser).toHaveBeenCalledWith({ password: 'new password' });
  });

  it('a wrong or stale code is explained and nothing is restored', async () => {
    mocks.auth.verifyOtp.mockResolvedValue({ data: {}, error: { code: 'otp_expired', message: 'Token has expired or is invalid' } });
    const { authErrorMessage } = await import('./auth');
    await authClient.verifyCode(fields.email, '000000', 'signup').then(() => { throw new Error('verified'); }, (e) => expect(authErrorMessage(e)).toMatch(/wrong or has expired/));
    expect(mocks.cloud.pushRecords).not.toHaveBeenCalled();
  });

  it('resends through the matching channel', async () => {
    mocks.auth.resend.mockResolvedValue({ error: null });
    mocks.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
    await authClient.resendCode(fields.email, 'signup');
    expect(mocks.auth.resend).toHaveBeenCalledWith({ type: 'signup', email: fields.email });
    await authClient.resendCode(fields.email, 'recovery');
    expect(mocks.auth.resetPasswordForEmail).toHaveBeenCalledWith(fields.email);
    await authClient.resetPassword(fields.email);
    expect(mocks.auth.resetPasswordForEmail).toHaveBeenCalledTimes(2);
  });
});

describe('Google', () => {
  beforeEach(() => {
    mocks.auth.signInWithOAuth.mockResolvedValue({ data: { url: 'https://accounts.google.com/o/oauth2' }, error: null });
  });

  it('opens the provider sheet with the app’s callback and signs in from the redirect', async () => {
    mocks.browser.openAuthSessionAsync.mockResolvedValue({ type: 'success', url: 'semli://auth/callback?code=abc' });
    mocks.auth.exchangeCodeForSession.mockResolvedValue({ data: { session }, error: null });
    expect(await authClient.signInWithGoogle()).toEqual({ signedIn: true, restored: false });
    expect(mocks.auth.signInWithOAuth).toHaveBeenCalledWith({ provider: 'google', options: { redirectTo: 'semli://auth/callback', skipBrowserRedirect: true } });
    expect(mocks.browser.openAuthSessionAsync).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2', 'semli://auth/callback');
    expect(mocks.auth.exchangeCodeForSession).toHaveBeenCalledWith('abc');
  });

  it('a closed sheet is not an error and signs nobody in', async () => {
    mocks.browser.openAuthSessionAsync.mockResolvedValue({ type: 'cancel' });
    expect(await authClient.signInWithGoogle()).toBeNull();
    expect(mocks.auth.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(mocks.cloud.pushRecords).not.toHaveBeenCalled();
  });

  it('explains a redirect that carries an error instead of a code', async () => {
    const { authErrorMessage } = await import('./auth');
    await expect(completeAuthFromUrl('semli://auth/callback?error_code=flow_state_expired&error=access_denied')).rejects.toMatchObject({ code: 'flow_state_expired' });
    expect(authErrorMessage({ code: 'flow_state_expired' })).toMatch(/took too long/);
    await expect(completeAuthFromUrl('semli://auth/callback')).rejects.toThrow(/No code/);
  });
});

describe('Apple', () => {
  it('gives Apple the hashed nonce and Supabase the original, then backs up the plan', async () => {
    expect(await authClient.signInWithApple()).toEqual({ signedIn: true, restored: false });
    expect(mocks.crypto.digestStringAsync).toHaveBeenCalledWith('SHA-256', 'one-time-nonce');
    expect(mocks.apple.signInAsync).toHaveBeenCalledWith({ requestedScopes: [0, 1], nonce: 'sha256-nonce' });
    expect(mocks.auth.signInWithIdToken).toHaveBeenCalledWith({ provider: 'apple', token: 'apple-token', nonce: 'one-time-nonce' });
    expect(mocks.cloud.pushRecords).toHaveBeenCalled();
  });

  it('cancels quietly without signing in or backing anything up', async () => {
    mocks.apple.signInAsync.mockRejectedValueOnce({ code: 'ERR_REQUEST_CANCELED' });
    expect(await authClient.signInWithApple()).toBeNull();
    expect(mocks.auth.signInWithIdToken).not.toHaveBeenCalled();
    expect(mocks.cloud.pushRecords).not.toHaveBeenCalled();
  });

  it('never claims success without a token or after the backend rejects it', async () => {
    mocks.apple.signInAsync.mockResolvedValueOnce({ identityToken: null, fullName: null });
    await expect(authClient.signInWithApple()).rejects.toMatchObject({ code: 'apple_identity_token_missing' });
    expect(mocks.auth.signInWithIdToken).not.toHaveBeenCalled();
    mocks.auth.signInWithIdToken.mockResolvedValueOnce({ error: { code: 'provider_disabled' } });
    await expect(authClient.signInWithApple()).rejects.toMatchObject({ code: 'provider_disabled' });
    expect(mocks.cloud.pushRecords).not.toHaveBeenCalled();
  });

  it('captures the first-authorization name and preserves it on subsequent sign-ins', async () => {
    mocks.apple.signInAsync.mockResolvedValueOnce({ identityToken: 'apple-token', fullName: { givenName: 'Ama', familyName: 'Jones' } });
    await authClient.signInWithApple();
    expect(settings().name).toBe('Ama');
    expect(mocks.auth.updateUser).toHaveBeenCalledWith({ data: { full_name: 'Ama Jones' } });
    await authClient.signInWithApple();
    expect(settings().name).toBe('Ama');
    expect(mocks.auth.updateUser).toHaveBeenCalledTimes(1);
  });

  it('keeps an existing local name and completes login if metadata saving fails', async () => {
    mocks.store.setState({ settings: { ...DEFAULTS(), name: 'My name' } });
    mocks.apple.signInAsync.mockResolvedValueOnce({ identityToken: 'apple-token', fullName: { givenName: 'Ama' } });
    mocks.auth.updateUser.mockResolvedValueOnce({ error: new Error('metadata write failed') });
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    try {
      expect(await authClient.signInWithApple()).toMatchObject({ signedIn: true });
      expect(settings().name).toBe('My name');
      expect(log).toHaveBeenCalledWith('[Semli error]', expect.objectContaining({ operation: 'auth.apple.save_name' }));
    } finally { log.mockRestore(); }
  });

  it('does not open an Apple sheet on Android', async () => {
    mocks.platform.OS = 'android';
    await expect(authClient.signInWithApple()).rejects.toThrow(/available on iPhone/);
    expect(mocks.apple.signInAsync).not.toHaveBeenCalled();
  });
});

describe('signing out', () => {
  const signedInWithPlan = () => {
    mocks.session.setState({ session });
    mocks.store.setState({ items: { b: item('b') }, settings: { ...DEFAULTS(), onboarded: true, cloud: { backedUpAt: '2026-10-19T00:00:00Z', error: 'x' } } });
    mocks.auth.signOut.mockResolvedValue({ error: null });
  };

  it('backs up first, then ends the session; the screen clears the plan after it has left', async () => {
    signedInWithPlan();
    await authClient.signOut();
    expect(saved().data.items.map((i) => i.id)).toEqual(['b']);
    expect(mocks.cloud.pushRecords.mock.invocationCallOrder[0]!).toBeLessThan(mocks.auth.signOut.mock.invocationCallOrder[0]!);
    expect(mocks.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(mocks.purchases.logOut).toHaveBeenCalled();
    // Clearing here would pull the signed-in screens out from under the navigation (account.tsx clears).
    expect(Object.keys(mocks.store.getState().items as object)).toEqual(['b']);
  });

  it('stays signed in, with the plan, when the backup can’t be saved', async () => {
    signedInWithPlan();
    mocks.cloud.pushRecords.mockRejectedValue({ message: 'offline' });
    await expect(authClient.signOut()).rejects.toMatchObject({ code: 'backup_before_sign_out' });
    expect(mocks.auth.signOut).not.toHaveBeenCalled();
    expect(Object.keys(mocks.store.getState().items as object)).toEqual(['b']);
  });

  it('deleting the account removes the row and the user, then logs out', async () => {
    mocks.supabase.rpc.mockResolvedValue({ error: null });
    mocks.auth.signOut.mockResolvedValue({ error: null });
    await authClient.deleteAccount();
    expect(mocks.supabase.rpc).toHaveBeenCalledWith('delete_account');
    expect(mocks.auth.signOut).toHaveBeenCalled();
  });

  it('deleting the account ends the session and leaves clearing to the screen', async () => {
    mocks.store.setState({ items: { b: item('b') }, settings: { ...DEFAULTS(), onboarded: true } });
    mocks.supabase.rpc.mockResolvedValue({ error: null });
    mocks.auth.signOut.mockResolvedValue({ error: null });
    await authClient.deleteAccount();
    expect(mocks.supabase.rpc).toHaveBeenCalledWith('delete_account');
    expect(mocks.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(Object.keys(mocks.store.getState().items as object)).toEqual(['b']);
  });

  it('an Apple account is re-authorized and its token revoked before the account is deleted', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    mocks.auth.getSession.mockResolvedValue({ data: { session: { ...session, user: { ...user, app_metadata: { provider: 'apple' } } } } });
    mocks.apple.signInAsync.mockResolvedValue({ authorizationCode: 'code-1' });
    mocks.supabase.rpc.mockResolvedValue({ error: null });
    mocks.auth.signOut.mockResolvedValue({ error: null });
    await authClient.deleteAccount();
    expect(fetchMock.mock.calls[0]![0]).toMatch(/\/api\/account\/apple-revoke$/);
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ code: 'code-1' });
    expect(fetchMock.mock.invocationCallOrder[0]!).toBeLessThan(mocks.supabase.rpc.mock.invocationCallOrder[0]!);
    vi.unstubAllGlobals();
  });

  it('nothing is deleted when Apple refuses the revocation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 502 })));
    mocks.auth.getSession.mockResolvedValue({ data: { session: { ...session, user: { ...user, app_metadata: { provider: 'apple' } } } } });
    mocks.apple.signInAsync.mockResolvedValue({ authorizationCode: 'code-1' });
    await expect(authClient.deleteAccount()).rejects.toMatchObject({ code: 'apple_revoke_failed' });
    expect(mocks.supabase.rpc).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('a guest’s erase deletes the anonymous record and clears the phone', async () => {
    const { eraseThisPhone } = await import('./auth-client');
    mocks.store.setState({ items: { b: item('b') }, settings: { ...DEFAULTS(), onboarded: true } });
    mocks.auth.getSession.mockResolvedValue({ data: { session: { ...session, user: { ...user, is_anonymous: true } } } });
    mocks.supabase.rpc.mockResolvedValue({ error: null });
    mocks.auth.signOut.mockResolvedValue({ error: null });
    await eraseThisPhone();
    expect(mocks.supabase.rpc).toHaveBeenCalledWith('delete_account');
    expect(mocks.store.getState().items).toEqual({});
  });

  it('a failed deletion keeps the session', async () => {
    mocks.supabase.rpc.mockResolvedValue({ error: { code: 'x', message: 'nope' } });
    await expect(authClient.deleteAccount()).rejects.toBeTruthy();
    expect(mocks.auth.signOut).not.toHaveBeenCalled();
  });
});

describe('the line after signing in', () => {
  it('welcomes a new account by name and says where the plan is', async () => {
    const { welcomeLine } = await import('./auth-client');
    expect(welcomeLine({ first: 'Ethan', email: 'e@x.com', apple: false, isNew: true, restored: false }))
      .toBe('Welcome to Semli, Ethan. You’re signed up with e@x.com, and your plan is backed up.');
  });
  it('welcomes someone back to a restored plan, and keeps an Apple relay address out of it', async () => {
    const { welcomeLine } = await import('./auth-client');
    expect(welcomeLine({ first: null, email: 'x@privaterelay.appleid.com', apple: true, isNew: false, restored: true })).toBe('Welcome back. Your backed-up plan is on this iPhone.');
    expect(welcomeLine({ first: null, email: 'x@privaterelay.appleid.com', apple: true, isNew: false, restored: false })).toBe('Signed in with Apple. Your plan is backed up.');
  });
});
