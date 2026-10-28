import { useLingui } from '@lingui/react/macro';
import { useLocalSearchParams } from 'expo-router';
import { useState, type ComponentType } from 'react';
import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/Controls';
import { SettingsHome } from '@/components/SettingsHome';
import { T } from '@/components/Text';
import { steadyScreen } from '@/components/SteadyScreen';
import { COLUMN, useWebLayout } from '@/lib/layout';
import { SettingsPane, isSettingKey, type SettingKey } from '@/lib/settings-pane';
import { useScreenShortcuts } from '@/lib/shortcuts';
import { SCREEN_GUTTER, useTheme, space } from '@/theme';
import AppearanceScreen from '../settings/appearance';
import CanDoScreen from '../settings/can-do';
import CanvasScreen from '../settings/canvas';
import DataScreen from '../settings/data';
import LanguageScreen from '../settings/language';
import MajorScreen from '../settings/major';
import NameScreen from '../settings/name';
import PhoneCalendarScreen from '../settings/phone-calendar';
import PlanStatusScreen from '../settings/plan-status';
import RegionScreen from '../settings/region';
import RemindersScreen from '../settings/reminders';
import ServerScreen from '../settings/server';

const SCREENS: Record<SettingKey, ComponentType> = {
  name: NameScreen, major: MajorScreen, reminders: RemindersScreen, canvas: CanvasScreen, 'phone-calendar': PhoneCalendarScreen, language: LanguageScreen, region: RegionScreen,
  appearance: AppearanceScreen, 'can-do': CanDoScreen, data: DataScreen, 'plan-status': PlanStatusScreen, server: ServerScreen,
};

/**
 * The fourth tab. The same screen is reachable at /settings for deep links. On a wide web window it
 * is a split view, as desktop settings are: the list stays put and each setting opens beside it.
 * `?open=data` opens one directly (the sidebar's sync line does).
 */
function YouTab() {
  const { t } = useLingui();
  const { c } = useTheme();
  const { twoPane } = useWebLayout();
  const { open: asked } = useLocalSearchParams<{ open?: string }>();
  const [open, setOpen] = useState<SettingKey | null>(isSettingKey(asked) ? asked : null);
  const [lastAsked, setLastAsked] = useState(asked);
  if (asked !== lastAsked) {
    setLastAsked(asked);
    if (isSettingKey(asked)) setOpen(asked);
  }
  useScreenShortcuts({ Escape: () => setOpen(null) }, !!open);

  if (!twoPane) return <SettingsHome inTab />;

  const titles: Record<SettingKey, string> = {
    name: t`Name`, major: t`Field of study`, reminders: t`Reminders`, canvas: 'Canvas', 'phone-calendar': 'iPhone calendar', language: t`Language`, region: t`Region`,
    appearance: t`Appearance`, 'can-do': t`What Semli can do`, data: t`Your data`, 'plan-status': t`Plan diagnostics`, server: t`Semli server`,
  };
  const Screen = open ? SCREENS[open] : null;
  return (
    <View style={styles.panes}>
      <View style={{ width: COLUMN }}>
        <SettingsPane.Provider value={setOpen}><SettingsHome inTab /></SettingsPane.Provider>
      </View>
      <View style={[styles.pane, { borderLeftColor: c.line }]}>
        {open && Screen ? <>
          <View style={styles.head}>
            <T token="titleSm" accessibilityRole="header" style={{ flex: 1 }}>{titles[open]}</T>
            <IconButton icon="x" label={t`Close`} size={32} onPress={() => setOpen(null)} />
          </View>
          <View style={{ flex: 1 }}><Screen key={open} /></View>
        </> : (
          <View style={styles.empty}><T token="callout" color={c.inkSecondary}>{t`Choose a setting to change it here.`}</T></View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panes: { flex: 1, flexDirection: 'row' },
  pane: { flex: 1, borderLeftWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: SCREEN_GUTTER, paddingTop: space.xl, paddingBottom: space.xxs },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SCREEN_GUTTER },
});

export default steadyScreen(YouTab);
