import * as Application from 'expo-application';
import { useEffect, useState } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Sheet';
import { T } from '@/components/Text';
import { minimumVersion, isOlderThan } from '@/lib/force-update';
import { LINKS, openLink } from '@/lib/links';
import { hideSplash } from '@/lib/splash';
import { SCREEN_GUTTER, space, useTheme } from '@/theme';

/** How often a phone left open asks again as it comes back to the front. */
const RECHECK_MS = 60 * 60 * 1000;

/**
 * True when the server says this build is too old. The installed build's version, not the update's:
 * an over-the-air update can't move a person off an old build, only the App Store can. A failed
 * check never blocks, so someone offline keeps their plan.
 */
export function useUpdateRequired(): boolean {
  const [required, setRequired] = useState(false);
  useEffect(() => {
    const version = Application.nativeApplicationVersion;
    if (Platform.OS !== 'ios' || __DEV__ || !version) return;
    let checkedAt = 0;
    const check = async () => {
      if (Date.now() - checkedAt < RECHECK_MS) return;
      checkedAt = Date.now();
      const minimum = await minimumVersion();
      setRequired(minimum !== null && isOlderThan(version, minimum));
    };
    void check();
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void check(); });
    return () => subscription.remove();
  }, []);
  return required;
}

/** Takes the whole app, native covers included, until the person updates. No way past it, by design. */
export function UpdateRequired() {
  const { c } = useTheme();
  useEffect(() => { hideSplash(); }, []);
  return (
    <View style={[styles.page, { backgroundColor: c.canvas }]}>
      <View style={styles.copy}>
        <T token="display" accessibilityRole="header">Update Semli to keep going</T>
        <T token="lead" color={c.inkSecondary}>This version no longer works. Your plan is safe and will be here after you update.</T>
      </View>
      <Button label="Open the App Store" onPress={() => { void openLink(LINKS.appStore); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: 'center', paddingHorizontal: SCREEN_GUTTER, gap: space.xl },
  copy: { gap: space.snug },
});
