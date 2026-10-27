import { useLingui } from '@lingui/react/macro';
import { Stack } from 'expo-router';

import { columnHeader } from '@/components/ColumnHeader';
import { navigationButtonOptions } from '@/components/NavButtons';
import { frameStyle, useWebLayout } from '@/lib/layout';

import { palettes } from '@dayli/tokens';
import { mobileFonts, useTheme, headerTitle } from '@/theme';

/** Deep links like /settings/data get the You screen underneath, so the back button always works. */
export const unstable_settings = { anchor: 'index' };

/** Settings pushes from You. Every route needs Back, including the first nested route, and each is singular, so a double tap or a link from another setting never stacks a copy. */
export default function SettingsLayout() {
  const { t } = useLingui();
  const { c } = useTheme();
  // On a wide web window each setting sits in the app's frame, its header too, beside the sidebar.
  const { sidebar, twoPane } = useWebLayout();
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerShadowVisible: false,
        headerStyle: { backgroundColor: c.canvas },
        headerTintColor: c.inkPrimary,
        headerTitleStyle: headerTitle(c.inkPrimary),
        headerTitleAlign: 'center',
        headerBackButtonDisplayMode: 'minimal',
        ...navigationButtonOptions('back'),
        contentStyle: { backgroundColor: c.canvas, ...(sidebar ? frameStyle(twoPane) : null) },
        ...(sidebar ? { header: columnHeader('frame') } : null),
      }}>
      <Stack.Screen name="index" dangerouslySingular options={{ title: t`You` }} />
      <Stack.Screen name="name" dangerouslySingular options={{ title: t`Name` }} />
      <Stack.Screen name="reminders" dangerouslySingular options={{ title: t`Reminders` }} />
      <Stack.Screen name="appearance" dangerouslySingular options={{ title: t`Appearance` }} />
      <Stack.Screen name="major" dangerouslySingular options={{ title: t`Field of study` }} />
      <Stack.Screen name="language" dangerouslySingular options={{ title: t`Language` }} />
      <Stack.Screen name="region" dangerouslySingular options={{ title: t`Region` }} />
      <Stack.Screen name="plan" dangerouslySingular options={{ title: 'Semli Plus', headerTransparent: true, headerStyle: { backgroundColor: 'transparent' }, contentStyle: { backgroundColor: palettes.dark.canvas }, headerTintColor: palettes.dark.inkPrimary, headerTitleStyle: { fontFamily: mobileFonts.medium, color: palettes.dark.inkPrimary, fontSize: 16 } }} />
      <Stack.Screen name="canvas" dangerouslySingular options={{ title: 'Canvas' }} />
      <Stack.Screen name="data" dangerouslySingular options={{ title: t`Your data` }} />
      <Stack.Screen name="can-do" dangerouslySingular options={{ title: t`What Semli can do` }} />
      <Stack.Screen name="plan-status" dangerouslySingular options={{ title: t`Plan diagnostics` }} />
      <Stack.Screen name="server" dangerouslySingular options={{ title: t`Semli server` }} />
    </Stack>
  );
}
