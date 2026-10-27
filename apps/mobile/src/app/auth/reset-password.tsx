import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AuthField } from '@/components/AuthControls';
import { Button, Sheet } from '@/components/Sheet';
import { T } from '@/components/Text';
import { authErrorMessage, validateAuthForm } from '@/lib/auth';
import { authClient, leaveAuth } from '@/lib/auth-client';
import { accountOf, useSession } from '@/lib/supabase';
import { SCREEN_GUTTER, useTheme, space } from '@/theme';

/** After the reset code: the person is signed in, so they only choose the new password. */
export default function ResetPasswordScreen() {
  const { c } = useTheme();
  const signedIn = useSession((s) => !!accountOf(s.session));
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const invalid = validateAuthForm('signup', { email: 'a@b.co', password }).password;
    if (invalid) { setError(invalid); return; }
    setBusy(true);
    try {
      await authClient.updatePassword(password);
      // One toast (Oct 27, 2026): leaveAuth shows this line once the cover has gone.
      leaveAuth('Password changed. You’re signed in.'); // Stays busy while the screen leaves.
    } catch (failure) {
      setError(authErrorMessage(failure, 'auth.reset_password'));
      setPassword('');
      setBusy(false);
    }
  };

  return (
    <Sheet title="New password" nav="push">
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
        <View style={styles.hero}>
          <T token="display" accessibilityRole="header">{signedIn ? 'Choose a new password.' : 'Start with a code.'}</T>
          <T token="body" color={c.inkSecondary}>{signedIn ? 'At least 8 characters. You’ll stay signed in on this phone.' : 'Ask for a reset code first, then choose your new password.'}</T>
        </View>
        {signedIn ? <>
          <AuthField label="New password" password value={password} onChangeText={(v) => { setPassword(v); setError(null); }} error={error ?? undefined}
            placeholder="At least 8 characters" autoComplete="new-password" autoCapitalize="none" autoCorrect={false} maxLength={256} autoFocus
            editable={!busy} returnKeyType="go" onSubmitEditing={() => void save()} />
          <Button label={busy ? 'One moment…' : 'Save password'} disabled={busy} onPress={() => void save()} />
        </> : <Button label="Get a reset code" onPress={() => router.replace('/auth/forgot-password')} />}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { flexGrow: 1, paddingHorizontal: SCREEN_GUTTER, paddingTop: space.xl, paddingBottom: space.xxxl, gap: space.xl },
  hero: { gap: space.sm },
});
