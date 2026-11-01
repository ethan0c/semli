import { Linking } from 'react-native';
import { reportError } from './errors';

/** Outbound links from the app. Keep these in step with apps/web/lib/site.ts. */
export const SITE_URL = 'https://semli.app';
export const SUPPORT_EMAIL = 'hello@semli.app';
export const APP_STORE_ID = '6824600264';
export const LINKS = {
  privacy: `${SITE_URL}/privacy`,
  terms: `${SITE_URL}/terms`,
  support: `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Semli feedback')}`,
  appStore: `https://apps.apple.com/app/id${APP_STORE_ID}`,
  review: `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`,
} as const;

/** Opens a link; returns false instead of throwing when nothing can handle it. */
export async function openLink(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch (error) {
    reportError('links.open', error);
    return false;
  }
}

/** The iOS Settings page for Semli, for permissions the system no longer lets us ask for. */
export async function openSystemSettings(): Promise<boolean> {
  try {
    await Linking.openSettings();
    return true;
  } catch (error) {
    reportError('settings.open', error);
    return false;
  }
}
