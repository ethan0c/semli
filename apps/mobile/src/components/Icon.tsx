import type { IconName } from '@dayli/schema';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconKey =
  | IconName
  | 'home'
  | 'plus'
  | 'x'
  | 'camera'
  | 'image'
  | 'file'
  | 'mic'
  | 'stop'
  | 'chevronLeft'
  | 'chevronRight'
  | 'undo'
  | 'tick'
  | 'user'
  | 'sparkle'
  | 'alert'
  | 'trash'
  | 'clock'
  | 'volume'
  | 'vibrate'
  | 'bell'
  | 'send'
  | 'share'
  | 'remove'
  | 'appearance'
  | 'list'
  | 'search'
  | 'chart'
  | 'globe'
  | 'mail'
  | 'star'
  | 'lock';

type El = { d: string } | { rect: [number, number, number, number, number] } | { circle: [number, number, number] };

// 24-unit grid, 1.75 stroke, rounded caps, outline style.
const GLYPHS: Record<IconKey, El[]> = {
  calendar: [{ rect: [3, 4, 18, 18, 3] }, { d: 'M16 2v4M8 2v4M3 10h18' }],
  book: [
    { d: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z' },
    { d: 'M6.5 17A2.5 2.5 0 0 0 4 19.5 2.5 2.5 0 0 0 6.5 22H20v-5' },
  ],
  check: [{ rect: [3, 3, 18, 18, 4] }, { d: 'm8.5 12 2.5 2.5 4.5-5' }],
  work: [{ rect: [2, 7, 20, 14, 3] }, { d: 'M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16' }],
  bag: [{ d: 'M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z' }, { d: 'M3 6h18M16 10a4 4 0 0 1-8 0' }],
  pen: [{ d: 'M17 3a2.8 2.8 0 0 1 4 4L7.5 20.5 2 22l1.5-5.5z' }],
  school: [{ d: 'M22 10 12 5 2 10l10 5 10-5z' }, { d: 'M6 12v5c3 3 9 3 12 0v-5' }],
  exam: [{ d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }, { d: 'M14 2v6h6M9 15l2 2 4-4' }],
  heart: [{ d: 'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z' }],
  home: [{ d: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' }],
  plus: [{ d: 'M12 5v14M5 12h14' }],
  x: [{ d: 'M18 6 6 18M6 6l12 12' }],
  camera: [{ d: 'M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z' }, { circle: [12, 13, 4] }],
  image: [{ rect: [3, 3, 18, 18, 3] }, { circle: [8.5, 8.5, 1.5] }, { d: 'M21 15l-5-5L5 21' }],
  file: [{ d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }, { d: 'M14 2v6h6' }],
  mic: [{ d: 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z' }, { d: 'M19 10v2a7 7 0 0 1-14 0v-2M12 19v4' }],
  stop: [{ rect: [7, 7, 10, 10, 2] }],
  chevronLeft: [{ d: 'm15 18-6-6 6-6' }],
  chevronRight: [{ d: 'm9 18 6-6-6-6' }],
  share: [{ d: 'M12 15V3m-4 4 4-4 4 4M7 10H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-2' }],
  undo: [{ d: 'M3 7v6h6' }, { d: 'M21 17a9 9 0 0 0-15-6.7L3 13' }],
  tick: [{ d: 'm5 12 5 5L20 7' }],
  user: [{ circle: [12, 8, 4] }, { d: 'M4 21a8 8 0 0 1 16 0' }],
  sparkle: [{ d: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z' }, { d: 'M19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z' }],
  alert: [{ circle: [12, 12, 9] }, { d: 'M12 8v4M12 16h.01' }],
  trash: [{ d: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6' }],
  clock: [{ circle: [12, 12, 9] }, { d: 'M12 7v5l3 2' }],
  bell: [{ d: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9' }, { d: 'M13.7 21a2 2 0 0 1-3.4 0' }],
  volume: [{ d: 'M11 5 6 9H3v6h3l5 4z' }, { d: 'M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14' }],
  vibrate: [{ rect: [7, 3, 10, 18, 2] }, { d: 'M3 9v6M21 9v6' }],
  send: [{ d: 'M12 19V5M5 12l7-7 7 7' }],
  remove: [{ circle: [12, 12, 9] }, { d: 'M9 12h6' }],
  appearance: [{ circle: [12, 12, 3] }, { d: 'M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.2 2.2M16.9 16.9l2.2 2.2M4.9 19.1l2.2-2.2M16.9 7.1l2.2-2.2' }],
  list: [{ d: 'M4 7h16M4 12h16M4 17h10' }],
  search: [{ circle: [11, 11, 7] }, { d: 'm20 20-3.5-3.5' }],
  chart: [{ d: 'M5 20V10M12 20V4M19 20v-7' }],
  globe: [{ circle: [12, 12, 9] }, { d: 'M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18' }],
  mail: [{ rect: [3, 5, 18, 14, 2] }, { d: 'm3 7 9 6 9-6' }],
  star: [{ d: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z' }],
  lock: [{ rect: [4, 11, 16, 10, 2] }, { d: 'M8 11V7a4 4 0 0 1 8 0v4' }],
};

export function Icon({
  name,
  size = 20,
  color,
  strokeWidth = 1.75,
}: {
  name: IconKey;
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round">
      {GLYPHS[name].map((el, i) => {
        if ('d' in el) return <Path key={i} d={el.d} />;
        if ('rect' in el) {
          const [x, y, w, h, rx] = el.rect;
          return <Rect key={i} x={x} y={y} width={w} height={h} rx={rx} />;
        }
        const [cx, cy, r] = el.circle;
        return <Circle key={i} cx={cx} cy={cy} r={r} />;
      })}
    </Svg>
  );
}

