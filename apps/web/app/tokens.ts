import { colors, motion, palettes, radius, space, typeScale, type Palette } from '@dayli/tokens';

/**
 * The site's CSS variables, emitted from @dayli/tokens so the web and the app
 * share one source of truth. Rendered once into a <style> in layout.tsx.
 * Names stay the ones globals.css and the modules already use.
 */

const WEIGHT = { light: 300, regular: 400, medium: 500, semibold: 600, serif: 400 } as const;

const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

function colorVars(p: Palette): Record<string, string> {
  return {
    '--canvas': p.canvas,
    '--header': p.header,
    '--row': p.row,
    '--surface': p.surface,
    '--ink': p.inkPrimary,
    '--ink-2': p.inkSecondary,
    '--ink-3': p.inkTertiary,
    '--on-primary': p.onPrimary,
    '--on-accent': p.onAccent,
    '--line': p.line,
    '--nav': p.nav,
    '--scrim': p.scrim,
    '--accent': p.accent,
    '--accent-soft': p.accentSoft,
    '--accent-border': p.accentBorder,
    '--accent-ink': p.accentInk,
    '--control-fill': p.controlFill,
    '--control-ink': p.controlInk,
    '--control-outline': p.controlOutline,
    '--chart-booked': p.chartBooked,
    '--chart-on-booked': p.chartOnBooked,
    '--chart-other': p.chartOther,
    '--conflict': p.conflict,
    '--conflict-bg': p.conflictBg,
    '--changed': p.changed,
    '--changed-bg': p.changedBg,
    '--added': p.added,
    '--added-bg': p.addedBg,
    '--chip': p.chip,
  };
}

/**
 * The site in light mode is white paper and neutral grey, not the app's cream, so the purple
 * reads rich against it (decided Oct 21, 2026; docs/design-system.md). The app is unchanged.
 */
export const sitePalettes = {
  light: { ...palettes.light, canvas: colors.white, header: colors.white, row: colors.siteRow, line: colors.siteLine },
  dark: palettes.dark,
};

// Fixed brand colors stay stable on icons, QR codes and photo backgrounds in either theme.
const brandVars = {
  '--brand-ink': colors.ink,
  '--brand-purple': colors.purple,
  '--brand-purple-on-dark': colors.purpleOnDark,
  '--white': colors.white,
};

/**
 * The home hero's sky sits under a dusk veil in both modes, with white copy and a pale lavender
 * accent word. Photo text uses the same lavender as the app's dark appearance.
 */
const heroVars = {
  '--hero-veil-top': 'color-mix(in srgb, var(--brand-ink) 34%, transparent)',
  '--hero-veil-mid': 'color-mix(in srgb, var(--brand-ink) 40%, transparent)',
  '--hero-ink': colors.white,
  '--hero-accent': colors.purpleOnDark,
  '--hero-glass': 'color-mix(in srgb, var(--brand-ink) 28%, transparent)',
  '--photo-conflict': palettes.dark.conflict,
};

const typeVars: Record<string, string> = {};
for (const [name, t] of Object.entries(typeScale)) {
  const k = `--type-${kebab(name)}`;
  typeVars[`${k}-size`] = `${t.size}px`;
  typeVars[`${k}-line`] = `${t.line}px`;
  typeVars[`${k}-weight`] = String(WEIGHT[t.weight]);
  typeVars[`${k}-tracking`] = `${t.tracking}em`;
}

const motionVars = {
  '--dur-fast': `${motion.duration.fast}ms`,
  '--dur-base': `${motion.duration.base}ms`,
  '--dur-slow': `${motion.duration.slow}ms`,
  '--ease': `cubic-bezier(${motion.easing.join(', ')})`,
  '--stagger': `${motion.stagger}ms`,
  '--press-scale': String(motion.press.scale),
  '--press-opacity': String(motion.press.opacity),
};

const shapeVars: Record<string, string> = {};
for (const [k, v] of Object.entries(radius)) shapeVars[`--radius-${k}`] = `${v}px`;
// The site's own names: a card is the app's field radius; the hero sheet stays the site's 28.
shapeVars['--radius-card'] = `${radius.field}px`;
shapeVars['--radius-sheet'] = '28px';
for (const [k, v] of Object.entries(space)) shapeVars[`--space-${k}`] = `${v}px`;

const block = (vars: Record<string, string>) =>
  Object.entries(vars)
    .map(([k, v]) => `${k}:${v}`)
    .join(';');

export const TOKENS_CSS = [
  `:root{${block({ ...colorVars(sitePalettes.light), ...brandVars, ...heroVars, ...typeVars, ...motionVars, ...shapeVars })};color-scheme:light}`,
  `@media (prefers-color-scheme: dark){:root{${block(colorVars(sitePalettes.dark))};color-scheme:dark}}`,
  `[data-semli-theme="light"]{${block(colorVars(sitePalettes.light))};color-scheme:light}`,
  `[data-semli-theme="dark"]{${block(colorVars(sitePalettes.dark))};color-scheme:dark}`,
].join('\n');
