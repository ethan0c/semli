import { chartRange, dayNumber, eventInterval, findConflicts, intervalOf, toMinutes , count } from '@dayli/core';
import type { Item } from '@dayli/schema';
import { chart } from '@dayli/tokens';
import { useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { axisHour, bookedColors, NowLine } from '@/components/ChartMark';
import { T } from '@/components/Text';
import { MAX_TEXT_SCALE, useTheme } from '@/theme';

/** The empty track: 14% of the ink, as hex alpha. */
const TRACK_ALPHA = '24';
/** The shortest stretch the bar covers, in hours, so a day with one class isn't one long block. */
const MIN_SPAN = 6;

/**
 * The day as a bar: plum for booked work and slate for everything else (events, which are
 * never ticked off), grey for what has ended, red where two upcoming things overlap, and a hairline for now.
 * Semli's chart. With `highlight`, that item keeps its colour and everything else is grey;
 * overlaps stay red, past ones too.
 *
 * The bar covers the day's own hours (`chartRange`: half an hour either side of what is on it,
 * and now, at least six hours), not 6 am to midnight, so it is never mostly empty track. Its
 * labels name the real ends, flush with them, and hours in between where they fit.
 */
export function DayBar({ items, now, conflicts, highlight, labels = true }: {
  items: Item[]; now: { date: string; time: string }; conflicts: Set<string>; highlight?: string; labels?: boolean;
}) {
  const { c } = useTheme();
  const nowMin = toMinutes(now.time);
  const base = dayNumber(now.date) * 1440;
  const timed = items
    .filter((it) => it.kind === 'event' && it.start)
    .map((it) => {
      const iv = intervalOf(it);
      const start = iv ? iv.start - base : (dayNumber(it.date) - dayNumber(now.date)) * 1440 + toMinutes(it.start!);
      return { it, start: Math.max(0, start), end: Math.min(1440, iv ? iv.end - base : start + 60) };
    })
    .filter((t) => t.end > t.start);
  // Now is on the bar unless an item is picked, so it counts toward the range.
  const [from, to] = chartRange([...timed, ...(highlight ? [] : [{ start: nowMin, end: nowMin }])], MIN_SPAN);
  const x = (min: number) => ((Math.min(to, Math.max(from, min)) - from) / (to - from)) * 100;
  const blocks = timed
    .map(({ it, start, end }) => {
      const color = highlight
        ? it.id === highlight ? bookedColors(it, c).fill : c.controlOutline
        : end <= nowMin ? c.controlOutline : bookedColors(it, c).fill;
      return { id: it.id, left: x(start), width: x(end) - x(start), color, dim: highlight ? it.id !== highlight : false };
    })
    .filter((b) => b.width > 0)
    .sort((a, b) => Number(!a.dim) - Number(!b.dim));
  const overlaps = findConflicts(items).filter((pair) => conflicts.has(pair.a) || conflicts.has(pair.b)).flatMap((pair) => {
    const a = eventInterval(items.find((it) => it.id === pair.a)!)!;
    const b = eventInterval(items.find((it) => it.id === pair.b)!)!;
    const start = Math.max(a.start, b.start) - base;
    const end = Math.min(a.end, b.end) - base;
    // An overlap that is over stays grey with its blocks, as on Plan, unless an item is picked.
    return end > start && (highlight || end > nowMin) ? [{ id: `${pair.a}:${pair.b}`, left: x(start), width: x(end) - x(start) }] : [];
  });
  const nowLeft = x(nowMin);
  // The now line's canvas halo only where it crosses a block: on the bare track it would notch the sky.
  const nowOnBlock = [...blocks, ...overlaps].some((b) => nowLeft >= b.left && nowLeft <= b.left + b.width);
  return (
    <View style={styles.wrap} accessible accessibilityLabel={`Day timeline, ${axisHour(from)} to ${axisHour(to)}, ${count(blocks.length, 'block')}, ${count(overlaps.length, 'overlap')}`}>
      {/* Ink at low alpha, not the row grey: Today's bar sits on the sky, and a tint reads on cloud and paper alike. */}
      <View style={[styles.track, { backgroundColor: `${c.inkPrimary}${TRACK_ALPHA}` }]}>
        {blocks.map((b) => (
          <View key={b.id} style={[styles.block, { left: `${b.left}%`, width: `${b.width}%`, backgroundColor: b.color, opacity: b.dim ? 0.5 : 1 }]} />
        ))}
        {overlaps.map((span) => <View key={span.id} style={[styles.block, { left: `${span.left}%`, width: `${span.width}%`, backgroundColor: c.conflict }]} />)}
        {!highlight && nowMin >= from && nowMin <= to ? <NowLine at={{ x: nowLeft }} color={c.inkPrimary} halo={nowOnBlock} /> : null}
      </View>
      {labels ? <Axis from={from} to={to} /> : null}
    </View>
  );
}

/**
 * The bar's hour labels. The ends sit flush with the bar's ends; hours in between (every three,
 * or every six on a long day) centre on their hour and show only where each keeps `labelGap`
 * from its neighbours, measured, so a label that would touch another is dropped.
 */
function Axis({ from, to }: { from: number; to: number }) {
  const { c } = useTheme();
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const [sizes, setSizes] = useState<Record<string, number>>({});
  const step = (to - from) / 60 <= 12 ? 3 * 60 : 6 * 60;
  const inner: number[] = [];
  for (let m = Math.ceil((from + 1) / step) * step; m < to; m += step) inner.push(m);
  const start = axisHour(from), end = axisHour(to);
  const all = [start, end, ...inner.map(axisHour)];
  const measured = width > 0 && all.every((l) => sizes[l] !== undefined);
  const px = (m: number) => ((m - from) / (to - from)) * width;
  const shown: number[] = [];
  if (measured) {
    let edge = sizes[start]! + chart.labelGap;
    const limit = width - sizes[end]! - chart.labelGap;
    for (const m of inner) {
      const half = sizes[axisHour(m)]! / 2;
      if (px(m) - half >= edge && px(m) + half <= limit) {
        shown.push(m);
        edge = px(m) + half + chart.labelGap;
      }
    }
  }
  return (
    <View style={[styles.labels, { height: LABEL_HEIGHT * Math.min(fontScale, MAX_TEXT_SCALE) }]} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {/* Each label measured once, off screen, so the spacing rule uses real widths. */}
      {all.filter((l) => sizes[l] === undefined).map((l) => (
        <T key={`m${l}`} token="axis" tabular style={styles.measure}
          onLayout={(e) => { const w = e.nativeEvent.layout.width; setSizes((s) => ({ ...s, [l]: w })); }}>{l}</T>
      ))}
      <T token="axis" color={c.inkSecondary} tabular style={[styles.label, { left: 0 }]}>{start}</T>
      {shown.map((m) => (
        <T key={m} token="axis" color={c.inkSecondary} tabular
          style={[styles.label, { left: px(m) - sizes[axisHour(m)]! / 2 }]}>{axisHour(m)}</T>
      ))}
      <T token="axis" color={c.inkSecondary} tabular style={[styles.label, { right: 0 }]}>{end}</T>
    </View>
  );
}

const LABEL_HEIGHT = 14;

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  track: { height: chart.track, borderRadius: chart.track / 2, position: 'relative' },
  block: { position: 'absolute', top: 0, height: chart.track, borderRadius: chart.track / 2 },
  labels: { position: 'relative' },
  label: { position: 'absolute' },
  measure: { position: 'absolute', opacity: 0 },
});
