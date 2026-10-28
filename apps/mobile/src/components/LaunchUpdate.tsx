import * as Updates from 'expo-updates';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { reportError } from '@/lib/errors';

/** When this module loaded: the app's launch, near enough. */
const LAUNCHED_AT = Date.now();
/**
 * How long after launch a downloaded update may still restart the app. An update applies on the next
 * launch by default, so a fresh App Store install ran its build's old code all first session
 * (Oct 27, 2026: imports failing with "close and reopen", fixed in an update days earlier). Within
 * these seconds the person has barely started; after them, the update waits for the next launch
 * rather than restarting someone mid-task.
 */
export const LAUNCH_WINDOW_MS = 8000;

export function LaunchUpdate() {
  if (Platform.OS === 'web' || __DEV__ || !Updates.isEnabled) return null;
  return <ReloadWhenReady />;
}

function ReloadWhenReady() {
  const { isUpdatePending } = Updates.useUpdates();
  useEffect(() => {
    if (!isUpdatePending || Date.now() - LAUNCHED_AT > LAUNCH_WINDOW_MS) return;
    Updates.reloadAsync().catch((error) => reportError('updates.reload', error));
  }, [isUpdatePending]);
  return null;
}
