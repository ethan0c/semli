import * as AppleAuthentication from 'expo-apple-authentication';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import Purchases from 'react-native-purchases';
import { Platform } from 'react-native';

import { ACCOUNTS_ENABLED, AuthUnavailableError, unavailableClient, type AuthClient, type SignInResult } from './auth';
import { restoreFromCloud, saveToCloud, stopSync } from './cloud';
import { forgetAccount, maskEmail, rememberAccount, type Provider } from './last-account';
import { reportError } from './errors';
import { posthog, track } from './analytics';
import { accountOf, deleteReplacedGuest, supabase, useSession } from './supabase';
import { ACCOUNT_REQUIRED, APPLE_ON_WEB } from './web';
import { useStore } from '../store';
import { feedback } from './feedback';
import { durations } from './motion';

WebBrowser.maybeCompleteAuthSession();

/** Only Google uses a redirect; email confirmation and reset use emailed codes. */
const callbackUrl = () => Linking.createURL('auth/callback');

/**
 * The web leaves for the provider's page and comes back to /auth/callback, which finishes the
 * sign-in (a popup would be blocked once the click is a network call behind). Never settles: the
 * page is navigating away.
 */
async function signInByRedirect(provider: 'google' | 'apple'): Promise<null> {
  const { error } = await supabase!.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/auth/callback` } });
  if (error) throw error;
  return new Promise<null>(() => undefined);
}

/** Every sign-in ends here: establish analytics identity before restoring the backed-up plan. */
async function signedIn(): Promise<SignInResult> {
  const { data: { session } } = await supabase!.auth.getSession();
  const user = session?.user;
  if (user && !user.is_anonymous) {
    void deleteReplacedGuest(user.id);
    const fullName = user.user_metadata?.full_name;
    posthog?.identify(user.id, {
      ...(user.email ? { email: user.email } : {}),
      ...(typeof fullName === 'string' ? { name: fullName } : {}),
    });
    track('auth_completed');
    const provider = user.app_metadata?.provider;
    const first = (typeof fullName === 'string' ? fullName : useStore.getState().settings.name).trim().split(/\s+/)[0] || null;
    if (provider === 'apple' || provider === 'google' || provider === 'email') {
      void rememberAccount({ firstName: first, provider: provider as Provider, maskedEmail: maskEmail(user.email), ...(provider === 'email' && user.email ? { email: user.email } : {}) });
    }
  }

  const result = await restoreFromCloud().catch((error: unknown) => {
    reportError('cloud.restore_after_sign_in', error);
    const { settings, setSettings } = useStore.getState();
    setSettings({ cloud: { ...settings.cloud, error: 'You’re signed in, but we couldn’t restore your backup. Check your connection and try again. Your plan on this phone is still here.' } });
    return { restored: false };
  });
  const restored = result.restored;
  if (user && !user.is_anonymous) {
    const fullName = user.user_metadata?.full_name;
    welcome = {
      first: (typeof fullName === 'string' ? fullName : useStore.getState().settings.name).trim().split(/\s+/)[0] || null,
      email: user.email ?? null,
      apple: user.app_metadata?.provider === 'apple',
      // Made in the last few minutes: this sign-in is the account's first.
      isNew: Date.now() - Date.parse(user.created_at) < NEW_ACCOUNT_MS,
      restored,
    };
  }
  return { signedIn: true, restored };
}

/** An account this young is being signed into for the first time. */
const NEW_ACCOUNT_MS = 10 * 60 * 1000;

/** Who just signed in, said once the sign-in screens have closed (see `leaveAuth`). */
let welcome: { first: string | null; email: string | null; apple: boolean; isNew: boolean; restored: boolean } | null = null;

/**
 * The line that tells someone their sign-in worked: who they are now, and where their plan is.
 * Exported for tests.
 */
export function welcomeLine(w: NonNullable<typeof welcome>): string {
  const name = w.first ? `, ${w.first}` : '';
  const who = w.apple || !w.email ? 'with Apple' : `as ${w.email}`;
  if (w.isNew) return `Welcome to Semli${name}. You’re signed up ${w.apple || !w.email ? 'with Apple' : `with ${w.email}`}, and your plan is backed up.`;
  if (w.restored) return `Welcome back${name}. Your backed-up plan is on this iPhone.`;
  return `Signed in ${who}. Your plan is backed up.`;
}

/** The redirect back from Google: `?code=` (PKCE) or `?error_code=`. */
export async function completeAuthFromUrl(url: string): Promise<SignInResult> {
  const query = url.includes('?') ? url.slice(url.indexOf('?') + 1).split('#')[0]! : '';
  const params = new URLSearchParams(query);
  const errorCode = params.get('error_code');
  if (errorCode) throw { code: errorCode };
  const code = params.get('code');
  if (!code) throw Object.assign(new Error('No code in the redirect.'), { code: 'oauth_callback_missing' });
  const { error } = await supabase!.auth.exchangeCodeForSession(code);
  if (error) throw error;
  return signedIn();
}

const supabaseClient: AuthClient = {
  async signIn({ email, password }) {
    const { error } = await supabase!.auth.signInWithPassword({ email, password });
    if (error) {
      // Signed up but never entered the code: send a fresh one and go to the code screen.
      if (error.code !== 'email_not_confirmed') throw error;
      try {
        const { error: resendError } = await supabase!.auth.resend({ type: 'signup', email });
        if (resendError) throw resendError;
      } catch (resendError) {
        reportError('auth.resend_before_confirmation', resendError);
        return { signedIn: false, confirmEmail: true, resendFailed: true };
      }
      return { signedIn: false, confirmEmail: true };
    }
    return signedIn();
  },

  async signUp({ name, email, password }) {
    const { data, error } = await supabase!.auth.signUp({
      email,
      password,
      options: { data: name ? { full_name: name } : undefined },
    });
    if (error) throw error;
    // With confirmation on, Supabase answers an existing email with a user that has no identities
    // and sends nothing, so the code screen would wait forever.
    if (data.user && data.user.identities?.length === 0) throw { code: 'user_already_exists' };
    if (name && !useStore.getState().settings.name) useStore.getState().setSettings({ name });
    // With email confirmation on, the session arrives once the emailed code is entered.
    if (!data.session) return { signedIn: false, confirmEmail: true };
    return signedIn();
  },

  async signInWithGoogle() {
    if (Platform.OS === 'web') return signInByRedirect('google');
    const redirectTo = callbackUrl();
    const { data, error } = await supabase!.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } });
    if (error) throw error;
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') return null;
    return completeAuthFromUrl(result.url);
  },

  async signInWithApple() {
    if (APPLE_ON_WEB) return signInByRedirect('apple');
    if (Platform.OS !== 'ios') throw new AuthUnavailableError('Apple sign-in is available on iPhone. Try Google or email on this device.');
    const Crypto = await import('expo-crypto');
    // Apple receives the hash; Supabase verifies it against the original, single-use nonce.
    const nonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
    let credential: AppleAuthentication.AppleAuthenticationCredential;
    try {
      credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
        nonce: hashedNonce,
      });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ERR_REQUEST_CANCELED') return null;
      throw error;
    }
    if (!credential.identityToken) throw Object.assign(new Error('Apple returned no identity token.'), { code: 'apple_identity_token_missing' });
    const { error } = await supabase!.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken, nonce });
    if (error) throw error;

    // Apple sends the name only on the first authorization. Never erase it on later logins.
    const name = [credential.fullName?.givenName, credential.fullName?.middleName, credential.fullName?.familyName].filter(Boolean).join(' ').trim();
    if (name) {
      if (!useStore.getState().settings.name) useStore.getState().setSettings({ name: credential.fullName?.givenName || name });
      try {
        const { error: nameError } = await supabase!.auth.updateUser({ data: { full_name: name } });
        if (nameError) throw nameError;
      } catch (nameError) {
        // Authentication succeeded: a metadata failure must not send someone back to login.
        reportError('auth.apple.save_name', nameError);
      }
    }
    return signedIn();
  },

  async resetPassword(email) {
    const { error } = await supabase!.auth.resetPasswordForEmail(email);
    if (error) throw error;
  },

  async verifyCode(email, code, purpose) {
    const { error } = await supabase!.auth.verifyOtp({ email, token: code, type: purpose });
    if (error) throw error;
    return signedIn();
  },

  async resendCode(email, purpose) {
    const { error } = purpose === 'signup'
      ? await supabase!.auth.resend({ type: 'signup', email })
      : await supabase!.auth.resetPasswordForEmail(email);
    if (error) throw error;
  },

  async updatePassword(password) {
    const { error } = await supabase!.auth.updateUser({ password });
    if (error) throw error;
  },

  /**
   * The plan is backed up, then leaves this phone; signing in again brings it back. If the last
   * changes can't be saved (offline), nothing happens, so signing out never loses work.
   */
  async signOut() {
    try {
      await saveToCloud(true);
    } catch (error) {
      reportError('cloud.backup_before_sign_out', error);
      throw { code: 'backup_before_sign_out' };
    }
    await endSession();
    // The caller clears the plan once it has left the signed-in screens (see account.tsx).
  },

  /**
   * Removes the account, its backup and the plan on this phone. An account that used Sign in
   * with Apple is re-authorized first so its Apple token can be revoked, as App Review requires.
   */
  async deleteAccount() {
    const { data: { session } } = await supabase!.auth.getSession();
    const viaApple = session?.user.app_metadata?.provider === 'apple' || !!session?.user.identities?.some((i) => i.provider === 'apple');
    if (viaApple && session) await revokeApple(session.access_token);
    const { error } = await supabase!.rpc('delete_account');
    if (error) throw error;
    // The database queued the confirmation email; ask the site to send it now rather than at the
    // next daily run. Best effort: the cron sends it anyway.
    void fetch(`${useStore.getState().settings.apiUrl}/api/emails`, { method: 'POST' }).catch(() => {});
    await endSession();
    await forgetAccount();
  },
};

/** Ends the session and the purchase identity on this phone; the plan is the caller's to keep or clear. */
async function endSession() {
  // Sync stops first: the screen clears the plan next, and those removals must never reach the account.
  stopSync(true);
  const { error } = await supabase!.auth.signOut({ scope: 'local' });
  if (error) throw error;
  track('account_signed_out');
  posthog?.reset();
  await Purchases.logOut().catch((error: unknown) => reportError('purchases.log_out', error));
  const { settings, setSettings } = useStore.getState();
  setSettings({ cloud: { ...settings.cloud, backedUpAt: null, error: null } });
}

/** A fresh Apple authorization code, revoked by the server with the app's Sign in with Apple key. */
async function revokeApple(accessToken: string) {
  if (Platform.OS !== 'ios') return;
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({ requestedScopes: [] });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ERR_REQUEST_CANCELED') throw { code: 'apple_reauth_cancelled' };
    throw error;
  }
  if (!credential.authorizationCode) throw { code: 'apple_reauth_cancelled' };
  const res = await fetch(`${useStore.getState().settings.apiUrl}/api/account/apple-revoke`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ code: credential.authorizationCode }),
  });
  // 503: the server has no Apple key yet. Deleting still goes ahead; the failure is logged to fix.
  if (res.status === 503) { reportError('account.apple_revoke_unconfigured', new Error('Apple revocation is not configured')); return; }
  if (!res.ok) throw { code: 'apple_revoke_failed' };
}

/**
 * A guest's "Erase plan": the plan and setup leave this phone, and the anonymous record the
 * import limit created on the server is deleted too (App Review counts it as an account).
 */
export async function eraseThisPhone(): Promise<void> {
  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user.is_anonymous) {
      const { error } = await supabase.rpc('delete_account');
      if (error) throw error;
      await supabase.auth.signOut({ scope: 'local' }).catch((error: unknown) => reportError('auth.anonymous_sign_out', error));
    }
  }
  useStore.getState().clearAll('everything');
}

export const authClient: AuthClient = ACCOUNTS_ENABLED && supabase ? supabaseClient : unavailableClient;

/**
 * Leaving the auth screens, signed in or as a guest: back to the planner, or on to onboarding
 * for a phone that hasn't finished it. The whole auth cover goes, including any screens
 * under it, so one tap never lands back on a form.
 */
/**
 * The web's sign-in screens step aside for someone already signed in: a reload or a typed URL
 * that lands on /auth goes on to onboarding or the plan instead of asking them to sign in again.
 * Recovery, reset and callback screens don't use it; they finish their own step first.
 */
export function useLeaveIfSignedIn(enabled = true) {
  const ready = useSession((s) => s.ready);
  const signedIn = useSession((s) => !!accountOf(s.session));
  useEffect(() => {
    if (enabled && ACCOUNT_REQUIRED && ready && signedIn) leaveAuth();
  }, [enabled, ready, signedIn]);
}

/**
 * Closes the sign-in screens. After a sign-in it says so, with the success sound: a sign-in that
 * only closed a screen left people unsure it had worked. `message` replaces the line (a new password).
 */
export function leaveAuth(message?: string) {
  // The web has no cover to dismiss: the callback page, or a typed URL, may be the only screen.
  if (Platform.OS === 'web') router.replace(useStore.getState().settings.onboarded ? '/' : '/onboarding?step=role');
  else if (useStore.getState().settings.onboarded) router.dismissTo('/');
  else router.replace('/onboarding?step=role');
  const line = message ?? (welcome ? welcomeLine(welcome) : null);
  welcome = null;
  if (!line) return;
  // Once the cover has gone, so the toast rises on the screen they land on.
  setTimeout(() => {
    feedback('success');
    useStore.getState().showToast(line);
  }, durations.slow);
}
