import { useRef, useState, type ComponentRef } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AuthField, GoogleButton } from '@/components/AuthControls';
import { AppleButton } from '@/components/AppleButton';
import { TextButton } from '@/components/Controls';
import { Button, Sheet } from '@/components/Sheet';
import { ACCOUNT_REQUIRED } from '@/lib/web';
import { T } from '@/components/Text';
import { authErrorMessage, validateAuthForm, type AuthFieldErrors, type AuthMode, type SignInResult } from '@/lib/auth';
import { authClient, leaveAuth, useLeaveIfSignedIn } from '@/lib/auth-client';
import { useLastAccount } from '@/lib/last-account';
import { LINKS, openLink } from '@/lib/links';
import { SCREEN_GUTTER, useTheme, space, size } from '@/theme';

const COPY = {
  login: { title: 'Sign in', heading: 'Sign in to Semli.', body: 'Access the plan saved to your account.', action: 'Sign in' },
  signup: { title: 'Sign up', heading: 'Create an account.', body: 'Back up your plan with a free Semli account.', action: 'Create account' },
  'forgot-password': { title: 'Forgot password', heading: 'Reset your password.', body: 'Enter the email you use for Semli. We’ll send you a reset code.', action: 'Send code' },
};

export function AuthForm({ mode }: { mode: AuthMode }) {
  // Forgot password can be opened while signed in; only sign-in and sign-up step aside.
  useLeaveIfSignedIn(mode === 'login' || mode === 'signup');
  const { c } = useTheme();
  // "Continue as" for an email account opens here with the address filled in.
  const params = useLocalSearchParams<{ email?: string }>();
  const last = useLastAccount();
  const [name, setName] = useState('');
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const copy = COPY[mode];
  const forgot = mode === 'forgot-password';
  const signup = mode === 'signup';
  const clear = (field: keyof AuthFieldErrors) => { setErrors((current) => ({ ...current, [field]: undefined })); setNotice(null); };

  async function submit(provider: 'email' | 'google' | 'apple' = 'email') {
    if (lock.current) return;
    if (provider === 'email') {
      const invalid = validateAuthForm(mode, { name, email, password });
      setErrors(invalid);
      if (Object.keys(invalid).length) {
        if (invalid.email) emailRef.current?.focus(); else passwordRef.current?.focus();
        return;
      }
    }
    lock.current = true;
    setBusy(true);
    setNotice(null);
    const address = email.trim();
    try {
      let result: SignInResult | null;
      if (provider === 'google') result = await authClient.signInWithGoogle();
      else if (provider === 'apple') result = await authClient.signInWithApple();
      else if (forgot) { await authClient.resetPassword(address); result = { signedIn: false, confirmEmail: true }; }
      else if (signup) result = await authClient.signUp({ name: name.trim(), email: address, password });
      else result = await authClient.signIn({ email: address, password });
      // Stays busy: the screen is leaving, and a form that springs back for a frame looks broken.
      if (result?.signedIn) { leaveAuth(); return; }
      // On to the code screen; a null result means a provider sheet was cancelled.
      if (result) router.push({ pathname: '/auth/verify', params: { email: address, purpose: forgot ? 'recovery' : 'signup', resendFailed: !result.signedIn && result.resendFailed ? '1' : undefined } });
    } catch (error) {
      setNotice(authErrorMessage(error, `auth.${mode}.${provider}`));
    }
    // A tried password is cleared; a closed Apple or Google sheet leaves the typed one alone (Oct 27, 2026).
    if (provider === 'email') setPassword('');
    setBusy(false);
    lock.current = false;
  }

  /** The typed email goes along to Sign in, Sign up and Forgot password, so nobody types it twice. */
  const carried = () => (email.trim() ? { email: email.trim() } : {});

  return (
    <Sheet title={copy.title} nav="push">
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.body}>
        <View style={styles.hero}>
          <T token="display" accessibilityRole="header">{copy.heading}</T>
          <T token="body" color={c.inkSecondary}>{copy.body}</T>
        </View>
        {!forgot ? <>
          {/* "Last used" on the way this phone last signed in, so nobody makes a second account by accident. */}
          <View style={styles.provider}>
            {last?.provider === 'apple' ? <T token="caption" color={c.inkSecondary} style={styles.lastUsed}>Last used</T> : null}
            <AppleButton onPress={() => void submit('apple')} disabled={busy} />
          </View>
          <View style={styles.provider}>
            {last?.provider === 'google' ? <T token="caption" color={c.inkSecondary} style={styles.lastUsed}>Last used</T> : null}
            <GoogleButton onPress={() => void submit('google')} disabled={busy} />
          </View>
          <View style={styles.divider}><View style={[styles.line, { backgroundColor: c.line }]} /><T token="caption" color={c.inkTertiary}>{last?.provider === 'email' ? 'or with email · last used' : 'or with email'}</T><View style={[styles.line, { backgroundColor: c.line }]} /></View>
        </> : null}
        <View style={{ gap: space.lg }}>
          {signup ? <AuthField label="Name (optional)" value={name} onChangeText={setName} placeholder="Your name" autoComplete="name" autoCapitalize="words"
            maxLength={80} returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => emailRef.current?.focus()} editable={!busy} /> : null}
          <AuthField label="Email address" inputRef={emailRef} value={email} onChangeText={(value) => { setEmail(value); clear('email'); }}
            error={errors.email} placeholder="you@example.com" keyboardType="email-address" autoComplete="email" autoCapitalize="none" autoCorrect={false}
            maxLength={254} editable={!busy} returnKeyType={forgot ? 'send' : 'next'} submitBehavior={forgot ? 'blurAndSubmit' : 'submit'}
            onSubmitEditing={() => { if (forgot) void submit(); else passwordRef.current?.focus(); }} />
          {!forgot ? <AuthField label="Password" inputRef={passwordRef} password value={password} onChangeText={(value) => { setPassword(value); clear('password'); }}
            error={errors.password} placeholder={signup ? 'At least 8 characters' : 'Your password'} autoComplete={signup ? 'new-password' : 'current-password'}
            autoCapitalize="none" autoCorrect={false} maxLength={256} editable={!busy} returnKeyType="go" onSubmitEditing={() => void submit()} /> : null}
          {mode === 'login' ? <TextButton label="Forgot password?" tone="muted" disabled={busy} onPress={() => { setPassword(''); router.push({ pathname: '/auth/forgot-password', params: carried() }); }} style={styles.start} /> : null}
        </View>
        {notice ? <T token="callout" color={c.conflict} accessibilityRole="alert">{notice}</T> : null}
        <View style={{ gap: space.sm }}>
          <Button block label={busy ? 'One moment…' : copy.action} disabled={busy} onPress={() => void submit()} />
          {signup ? <T token="caption" color={c.inkSecondary} style={styles.center}>By creating an account, you agree to our <T token="caption" color={c.accentInk} accessibilityRole="link" onPress={() => void openLink(LINKS.terms)}>Terms</T> and <T token="caption" color={c.accentInk} accessibilityRole="link" onPress={() => void openLink(LINKS.privacy)}>Privacy policy</T>.</T> : null}
          <TextButton label={forgot ? 'Back to sign in' : signup ? 'Already have an account? Sign in' : 'New to Semli? Sign up'} tone="muted"
            disabled={busy}
            onPress={() => { setPassword(''); if (forgot && router.canGoBack()) router.back(); else router.replace({ pathname: signup || forgot ? '/auth/login' : '/auth/signup', params: carried() }); }} style={styles.footerLink} />
          {ACCOUNT_REQUIRED ? null : <TextButton label="Continue as a guest" tone="muted" disabled={busy} onPress={leaveAuth} style={styles.footerLink} />}
        </View>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { flexGrow: 1, paddingHorizontal: SCREEN_GUTTER, paddingTop: space.xl, paddingBottom: space.xxxl, gap: space.xl },
  hero: { gap: space.sm, paddingBottom: space.xs },
  provider: { gap: space.snug },
  lastUsed: { alignSelf: 'flex-end' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  start: { alignSelf: 'flex-start', minHeight: size.target },
  center: { textAlign: 'center' },
  footerLink: { alignSelf: 'center', minHeight: size.target },
});
