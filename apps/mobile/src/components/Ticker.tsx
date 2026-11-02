import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View, useWindowDimensions, type TextStyle } from 'react-native';
import Animated, { LayoutAnimationConfig, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { durations, ease, enter, exit, layout, springs } from '@/lib/motion';
import { textScaleCap, textStyle, useTheme, type TypeToken } from '@/theme';

/** Each digit's strip: 0 to 9 and 0 again, so a roll past 9 has a cell to land on. */
const CELLS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
/** How far a changing word travels, as a share of its line, while it fades. */
const TRAVEL = 0.6;

type Direction = 1 | -1;
type Common = { token?: TypeToken; color?: string; style?: TextStyle; accessibilityLabel?: string; maxFontSizeMultiplier?: number };

/**
 * Text that changes in place, the way a brokerage balance does. Every number rolls to its new
 * value one digit column at a time, all columns the way the number moved (up for more, down for
 * fewer); a column that appears or goes fades while the rest glide to make room. Words that
 * change slide out and in along the same direction. Digits are tabular, so columns never shift.
 * `direction` sets the way for text with no number to compare, like a month after a swipe.
 */
export function Ticker({ value, direction, reserveValues, token = 'body', color, style, accessibilityLabel, maxFontSizeMultiplier }: Common & {
  value: string;
  direction?: Direction;
  /** Reserve the tallest of these readouts, keeping surrounding content still as the value changes. */
  reserveValues?: readonly string[];
}) {
  const { c } = useTheme();
  const { fontScale } = useWindowDimensions();
  const base = useMemo<TextStyle>(() => ({ ...textStyle(token, color ?? c.inkPrimary), fontVariant: ['tabular-nums'], ...style }), [token, color, c.inkPrimary, style]);
  const line = lineOf(base);
  const cap = maxFontSizeMultiplier ?? textScaleCap(token);
  // The phone's text size grows a Text and its line height but not a View's height, so the digit
  // columns use the grown line. On the plain one, a step up showed half a 4 over half a 5 for "5"
  // (iPhone 15, Nov 1, 2026).
  const cell = line * Math.min(fontScale, cap ?? fontScale);
  const dir = useDirection(value, direction);
  const content = (
    <LayoutAnimationConfig skipEntering>
      {/* Wraps between words when the line outgrows its space, so a long readout is never cut off. */}
      <View style={styles.line} accessible accessibilityRole="text" accessibilityLabel={accessibilityLabel ?? value}>
        {words(value).map((word, w) => (
          <Animated.View key={w} layout={layout} entering={enter.fade} exiting={exit.fade} style={styles.line}>
            {word.map((p, i) => (
              <Animated.View key={`${i}-${p.kind}`} layout={layout} entering={enter.fade} exiting={exit.fade}>
                {p.kind === 'number'
                  ? <Digits text={p.text} dir={dir} line={line} cell={cell} style={base} maxFontSizeMultiplier={cap} />
                  : <Slide text={p.text} dir={dir} line={line} style={base} maxFontSizeMultiplier={cap} />}
              </Animated.View>
            ))}
          </Animated.View>
        ))}
      </View>
    </LayoutAnimationConfig>
  );
  if (!reserveValues?.length) return content;
  return (
    <View>
      <TickerMeasurements key={JSON.stringify(reserveValues)} values={reserveValues} line={line} cell={cell} style={base} maxFontSizeMultiplier={cap} />
      <View style={styles.overlaid}>{content}</View>
    </View>
  );
}

/** Static copies use the ticker's word boundaries and digit boxes, without animation work. */
const TickerMeasurements = memo(function TickerMeasurements({ values, line, cell, style, maxFontSizeMultiplier }: {
  values: readonly string[]; line: number; cell: number; style: TextStyle; maxFontSizeMultiplier?: number;
}) {
  const [heights, setHeights] = useState<Record<number, number>>({});
  return (
    <View style={{ opacity: 0, minHeight: Math.max(cell, ...Object.values(heights)) }}
      pointerEvents="none" aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {values.map((value, index) => (
        <View key={index} style={[styles.overlaid, styles.line]} onLayout={({ nativeEvent: { layout: { height } } }) => {
          setHeights((previous) => previous[index] === height ? previous : { ...previous, [index]: height });
        }}>
          {words(value).map((word, w) => (
            <View key={w} style={styles.line}>
              {word.map((p, i) => (
                <View key={`${i}-${p.kind}`}>
                  {p.kind === 'number' ? (
                    <View style={styles.row}>
                      {[...p.text].map((digit, j) => (
                        <View key={j} style={{ height: cell, overflow: 'hidden' }}>
                          <Text maxFontSizeMultiplier={maxFontSizeMultiplier} style={[style, { lineHeight: line }]}>{digit}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <View style={styles.clip}>
                      <View style={styles.staying}>
                        <Text maxFontSizeMultiplier={maxFontSizeMultiplier} style={[style, { lineHeight: line }]}>{p.text}</Text>
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
});

/**
 * A whole label that slides to its next wording, for pills and short lines with no number to
 * roll ("Due today" → "Done"). The box eases to the new width while the words cross.
 */
export function Swap({ value, direction = 1, token = 'body', color, style, numberOfLines = 1, maxFontSizeMultiplier }: Common & { value: string; direction?: Direction; numberOfLines?: number }) {
  const { c } = useTheme();
  const base: TextStyle = { ...textStyle(token, color ?? c.inkPrimary), ...style };
  return <Slide text={value} dir={direction} line={lineOf(base)} style={base} numberOfLines={numberOfLines} maxFontSizeMultiplier={maxFontSizeMultiplier} />;
}

function lineOf(style: TextStyle): number {
  return style.lineHeight ?? (style.fontSize ?? 16) * 1.2;
}

type Piece = { kind: 'number' | 'text'; text: string };

/** "5 plans · 12 work hours" → numbers, words and the spaces between, so each can change alone. */
function pieces(value: string): Piece[] {
  return value.split(/(\d+|\s+)/).filter(Boolean).map((text) => ({ kind: /^\d+$/.test(text) ? 'number' : 'text', text }));
}

/** Pieces by word, each with the space after it, so a wrap falls between words and "12h 30m" never strands its "m". */
function words(value: string): Piece[][] {
  return (value.match(/\S+\s*/g) ?? []).map(pieces);
}

/** The way the text moved: the given direction, else the first number that changed, else up. */
function useDirection(value: string, direction?: Direction): Direction {
  const [last, setLast] = useState({ value, dir: direction ?? 1 as Direction });
  if (last.value === value) return last.dir;
  const dir = direction ?? numberDirection(last.value, value);
  setLast({ value, dir });
  return dir;
}

/** Which way an ISO date just moved: 1 when it went later, -1 when earlier. Pass it as a Ticker's `direction`. */
export function useDateDirection(date: string): Direction {
  const [last, setLast] = useState({ date, dir: 1 as Direction });
  if (last.date === date) return last.dir;
  const dir: Direction = date > last.date ? 1 : -1;
  setLast({ date, dir });
  return dir;
}

function numberDirection(before: string, after: string): Direction {
  const a = before.match(/\d+/g) ?? [];
  const b = after.match(/\d+/g) ?? [];
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return Number(b[i]) > Number(a[i]) ? 1 : -1;
  }
  return b.length < a.length ? -1 : 1;
}

/** A run of digits. Columns are keyed from the right, so the ones column stays put when a tens column arrives. */
function Digits({ text, dir, line, cell, style, maxFontSizeMultiplier }: { text: string; dir: Direction; line: number; cell: number; style: TextStyle; maxFontSizeMultiplier?: number }) {
  const digits = [...text];
  return (
    <View style={styles.row}>
      {digits.map((d, i) => (
        <Animated.View key={`c${digits.length - i}`} layout={layout} entering={enter.fade} exiting={exit.fade}>
          <Digit digit={+d} dir={dir} line={line} cell={cell} style={style} maxFontSizeMultiplier={maxFontSizeMultiplier} />
        </Animated.View>
      ))}
    </View>
  );
}

/**
 * One digit column on the gentle spring. Its position counts cells without wrapping, so a roll
 * can go either way any number of times; the strip shows that position modulo ten.
 */
function Digit({ digit, dir, line, cell, style, maxFontSizeMultiplier }: { digit: number; dir: Direction; line: number; cell: number; style: TextStyle; maxFontSizeMultiplier?: number }) {
  const at = useRef(digit);
  const y = useSharedValue(digit);
  useEffect(() => {
    const from = ((at.current % 10) + 10) % 10;
    if (from === digit) return;
    at.current += dir > 0 ? (digit - from + 10) % 10 : -((from - digit + 10) % 10);
    y.value = withSpring(at.current, springs.gentle);
  }, [digit, dir, y]);
  const strip = useAnimatedStyle(() => ({ transform: [{ translateY: -(((y.value % 10) + 10) % 10) * cell }] }));
  return (
    <View style={{ height: cell, overflow: 'hidden' }}>
      <Animated.View style={strip}>
        {CELLS.map((d, i) => (
          <Text key={i} maxFontSizeMultiplier={maxFontSizeMultiplier} style={[style, { lineHeight: line, height: cell }]}>{d}</Text>
        ))}
      </Animated.View>
    </View>
  );
}

/**
 * Text that slides when it changes: the old wording leaves the way the change went and fades,
 * the new one arrives from the other side, over `base` on the one curve. The leaving copy is
 * lifted out of layout, so the box takes the new width at once and the `layout` transition eases it.
 */
function Slide({ text, dir, line, style, numberOfLines, maxFontSizeMultiplier }: { text: string; dir: Direction; line: number; style: TextStyle; numberOfLines?: number; maxFontSizeMultiplier?: number }) {
  const [shown, setShown] = useState({ gen: 0, text, prev: null as string | null, dir });
  if (shown.text !== text) setShown({ gen: shown.gen + 1, text, prev: shown.text, dir });
  const leg = { line, style, numberOfLines, maxFontSizeMultiplier, dir: shown.dir };
  return (
    <Animated.View layout={layout} style={styles.clip}>
      {shown.prev !== null ? <Leg key={`out${shown.gen}`} mode="out" text={shown.prev} {...leg} /> : null}
      <Leg key={`in${shown.gen}`} mode={shown.gen === 0 ? 'still' : 'in'} text={shown.text} {...leg} />
    </Animated.View>
  );
}

function Leg({ mode, text, dir, line, style, numberOfLines, maxFontSizeMultiplier }: {
  mode: 'still' | 'in' | 'out'; text: string; dir: Direction; line: number; style: TextStyle; numberOfLines?: number; maxFontSizeMultiplier?: number;
}) {
  const p = useSharedValue(mode === 'still' ? 1 : 0);
  useEffect(() => {
    if (mode !== 'still') p.value = withTiming(1, { duration: durations.base, easing: ease });
  }, [mode, p]);
  const travel = line * TRAVEL;
  const animated = useAnimatedStyle(() => mode === 'out'
    ? { opacity: 1 - p.value, transform: [{ translateY: -dir * travel * p.value }] }
    : { opacity: p.value, transform: [{ translateY: dir * travel * (1 - p.value) }] });
  return (
    <Animated.View style={[mode === 'out' ? styles.leaving : styles.staying, animated]}>
      <Text numberOfLines={numberOfLines} maxFontSizeMultiplier={maxFontSizeMultiplier} style={[style, { lineHeight: line }]}>{text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end' },
  line: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' },
  clip: { overflow: 'hidden', flexShrink: 1 },
  staying: { flexShrink: 1 },
  leaving: { position: 'absolute', top: 0, left: 0 },
  overlaid: { position: 'absolute', top: 0, left: 0, right: 0 },
});
