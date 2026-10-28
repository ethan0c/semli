import { reportError } from './errors';

export type AuthMode = 'login' | 'signup' | 'forgot-password';
export type AuthFields = { name?: string; email: string; password: string };
export type AuthFieldErrors = Partial<Record<keyof AuthFields, string>>;

/** Form checks only. The eventual identity provider remains responsible for authentication. */
export function validateAuthForm(mode: AuthMode, fields: AuthFields): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  const email = fields.email.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) errors.email = 'Enter a valid email address.';
  if (mode !== 'forgot-password' && !fields.password) errors.password = 'Enter your password.';
  else if (mode === 'signup' && fields.password.length < 8) errors.password = 'Use at least 8 characters.';
  return errors;
}

/**
 * Accounts are on once the Supabase project keys are set (see docs/supabase.md); without them the
 * welcome is one "Get started" and You shows no account rows. Guests never need an account.
 */
export const ACCOUNTS_ENABLED = !!(process.env.EXPO_PUBLIC_SUPABASE_URL && process.env.EXPO_PUBLIC_SUPABASE_KEY);
/** Live share links need their own backend work; the preview stays hidden until then. */
export const SHARING_ENABLED = true;

/** No provider is configured. Never manufacture sessions, reset emails or account deletion. */
export class AuthUnavailableError extends Error {}

async function unavailable(action: string): Promise<never> {
  throw new AuthUnavailableError(`${action} isn’t available yet. You can keep using Semli as a guest.`);
}

/** Email codes, not links: they work when the email is opened on another device. */
export type CodePurpose = 'signup' | 'recovery';

export type SignInResult = { signedIn: true; restored: boolean } | { signedIn: false; confirmEmail: true; resendFailed?: boolean };

export interface AuthClient {
  signIn: (fields: AuthFields) => Promise<SignInResult>;
  signUp: (fields: AuthFields) => Promise<SignInResult>;
  signInWithGoogle: () => Promise<SignInResult | null>;
  signInWithApple: () => Promise<SignInResult | null>;
  /** Sends a code by email; verifyCode with 'recovery' signs in so updatePassword can run. */
  resetPassword: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string, purpose: CodePurpose) => Promise<SignInResult>;
  resendCode: (email: string, purpose: CodePurpose) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

// Credentials remain in component memory: no persistence, analytics or network requests.
export const unavailableClient: AuthClient = {
  signIn: () => unavailable('Email login'),
  signUp: () => unavailable('Account creation'),
  signInWithGoogle: () => unavailable('Google sign-in'),
  signInWithApple: () => unavailable('Apple sign-in'),
  resetPassword: () => unavailable('Password reset'),
  verifyCode: () => unavailable('Email codes'),
  resendCode: () => unavailable('Email codes'),
  updatePassword: () => unavailable('Password reset'),
  signOut: () => unavailable('Sign out'),
  deleteAccount: () => unavailable('Account deletion'),
};

/** Supabase error codes we can explain; anything else is a plain retry. Never echo provider text. */
const MESSAGES: Record<string, string> = {
  invalid_credentials: 'That email and password don’t match. Try again or reset your password.',
  backup_before_sign_out: 'We couldn’t back up your latest changes, so you’re still signed in. Check your connection and try again.',
  apple_reauth_cancelled: 'Confirm with Apple to delete your account. Nothing was deleted.',
  apple_revoke_failed: 'We couldn’t reach Apple to remove Sign in with Apple. Nothing was deleted. Try again.',
  user_already_exists: 'There’s already an account with that email. Sign in instead.',
  email_exists: 'There’s already an account with that email. Sign in instead.',
  email_not_confirmed: 'Confirm your email first. Open the code screen to request a new code.',
  weak_password: 'Choose a longer password, at least 8 characters.',
  same_password: 'Choose a password you haven’t used here before.',
  over_email_send_rate_limit: 'Too many emails in a row. Wait a minute and try again.',
  over_request_rate_limit: 'Too many tries in a row. Wait a minute and try again.',
  otp_expired: 'That code is wrong or has expired. Check the latest email, or send a new code.',
  flow_state_expired: 'That sign-in took too long. Please try again.',
  otp_disabled: 'Email codes aren’t available right now. Please try again later.',
  session_not_found: 'Your session has ended. Please sign in again.',
  refresh_token_not_found: 'Your session has ended. Please sign in again.',
  refresh_token_already_used: 'Your session has ended. Please sign in again.',
  user_banned: 'This account can’t sign in. Contact hello@semli.app for help.',
  signup_disabled: 'New accounts aren’t available right now. You can keep using Semli as a guest.',
  email_provider_disabled: 'Email sign-in isn’t available right now. Try Google, or continue as a guest.',
  provider_disabled: 'This sign-in method isn’t available right now. Try email, or continue as a guest.',
  apple_identity_token_missing: 'Apple sign-in didn’t finish. Please try again, or use email.',
  access_denied: 'Sign-in wasn’t allowed. Please try again or choose another sign-in method.',
  oauth_callback_missing: 'Sign-in didn’t finish. Please start again.',
};

export function authErrorMessage(error: unknown, operation = 'auth'): string {
  reportError(operation, error);
  if (error instanceof AuthUnavailableError) return error.message;
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
  const fallback = operation === 'account.delete' ? 'We couldn’t delete your account. Please try again, or contact hello@semli.app for help.'
    : operation === 'account.sign_out' ? 'We couldn’t sign you out. Please try again.'
    : operation === 'auth.reset_password' ? 'We couldn’t save your new password. Please try again.'
    : operation === 'auth.verify_code' ? 'We couldn’t check that code. Check your connection and try again.'
    : operation === 'auth.resend_code' || operation.startsWith('auth.forgot-password') ? 'We couldn’t send a code. Check your connection and try again.'
    : operation.includes('apple') ? 'Apple sign-in didn’t finish. Try again, or sign in with email.'
    : operation.includes('google') ? 'Google sign-in didn’t finish. Try again, or sign in with email.'
    : operation.startsWith('auth.signup') ? 'We couldn’t create your account. Check your connection and try again.'
    : operation.startsWith('auth.login') ? 'We couldn’t sign you in. Check your connection and try again.'
    : 'We couldn’t connect. Please try again.';
  return (typeof code === 'string' && MESSAGES[code]) || fallback;
}
