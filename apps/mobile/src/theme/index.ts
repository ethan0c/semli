import { fade, fontFamily, iconSize, palettes, radius, shadow, size, space, typeScale, type Palette, type TypeToken } from '@dayli/tokens';
import { createContext, useContext } from 'react';
import { Platform, useColorScheme, type TextStyle, type ViewStyle } from 'react-native';
import { initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useStore } from '@/store';

export { fade, iconSize, radius, shadow, size, space };
export type { Palette, TypeToken };

/** A rectangle's corners from `radius`, drawn as Apple's continuous curve on iOS. Pills and circles don't need it. */
export function corner(r: number): ViewStyle {
  return Platform.OS === 'ios' ? { borderRadius: r, borderCurve: 'continuous' } : { borderRadius: r };
}

/**
 * The status bar's height for a tab's header. iOS native tabs measure each tab in its own
 * safe-area provider, which reads 0 until the tab is first shown, so a header placed by it
 * jumped down on first visit. The window's inset at launch is right from the first frame
 * (the app is portrait only); the live value still wins when it is larger.
 */
export function useTopInset(): number {
  const live = useSafeAreaInsets().top;
  return Math.max(live, initialWindowMetrics?.insets.top ?? 0);
}

/** Readable UI text. The outlined brand wordmark stays independent. */
export const mobileFonts = fontFamily;

/** Forces one appearance for a subtree, like a chart on a dark showcase page. */
export const ForceAppearance = createContext<'light' | 'dark' | null>(null);

/** Palette for the current appearance: a forced one, the user's choice in You, or the system setting. */
export function useTheme(): { c: Palette; dark: boolean } {
  const scheme = useColorScheme();
  const pref = useStore((s) => s.settings.appearance);
  const forced = useContext(ForceAppearance);
  const dark = forced ? forced === 'dark' : pref === 'dark' || (pref !== 'light' && scheme === 'dark');
  return { c: dark ? palettes.dark : palettes.light, dark };
}

export function textStyle(token: TypeToken, color: string): TextStyle {
  const t = typeScale[token];
  return {
    fontFamily: mobileFonts[t.weight],
    fontSize: t.size,
    lineHeight: t.line,
    letterSpacing: t.size * t.tracking,
    color,
  };
}

/**
 * How far the phone's text size may grow type with no room to grow: the 56 and 34 numbers and titles,
 * and chart labels in their fixed columns. This is the largest standard size; the accessibility
 * sizes past it reach 3.6x and would push these off the screen. All other text keeps growing.
 */
export const MAX_TEXT_SCALE = 1.35;
export function textScaleCap(token: TypeToken): number | undefined {
  return token === 'displayXl' || token === 'display' || token === 'axis' ? MAX_TEXT_SCALE : undefined;
}

/** The system header's title on every pushed screen: the headline face in ink. */
export function headerTitle(color: string) {
  const t = typeScale.headline;
  return { fontFamily: mobileFonts[t.weight], fontSize: t.size, color };
}

/** Shared horizontal screen margin, based on the Cal AI app reference. */
export const SCREEN_GUTTER = space.xl;

/** Space left under scrolling content so the tab bar never covers the last row. */
export const NAV_INSET = 140;

/** Spacing every screen of a kind shares, so no two settings pages or tab sections drift apart. */
export const screen = {
  /** A settings page under the system header: groups 24 apart, room to scroll past the last. */
  settingsBody: { paddingHorizontal: SCREEN_GUTTER, paddingTop: space.md, paddingBottom: space.xxxl + space.xs, gap: space.xl },
  /** A section on a tab or detail page: 24 under the one above. */
  section: { paddingTop: space.xl },
} as const;
