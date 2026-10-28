import { router } from 'expo-router';
import { createContext, useContext } from 'react';

/** The settings that open in You's pane on a wide web window; Your plan keeps its own photo page. */
export const PANE_SETTINGS = ['name', 'major', 'reminders', 'canvas', 'phone-calendar', 'language', 'region', 'appearance', 'can-do', 'data', 'plan-status', 'server'] as const;
export type SettingKey = (typeof PANE_SETTINGS)[number];

export const isSettingKey = (value: unknown): value is SettingKey => (PANE_SETTINGS as readonly unknown[]).includes(value);

/** Set by the You tab on a wide web window, where a setting opens beside the list instead of on its own page. */
export const SettingsPane = createContext<((key: SettingKey) => void) | null>(null);

/** Opens a setting: in You's pane when there is one, as its own page everywhere else. */
export function useOpenSetting(): (key: SettingKey) => void {
  const pane = useContext(SettingsPane);
  return (key) => (pane ? pane(key) : router.push(`/settings/${key}`));
}
