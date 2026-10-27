import { toQR } from 'toqr';
import { SITE_URL } from './site';

/** toqr's error-correction level H (its enum is not exported): survives the mark in the middle. */
const EC_HIGH = 2 as Parameters<typeof toQR>[1];

export type Qr = {
  /** Modules per side. */
  size: number;
  /** Every data module as a round dot, in module units; the three eyes and the middle are left out. */
  dots: string;
  /** The cleared square in the middle, where the mark sits: its first module and width. */
  hole: { at: number; size: number };
};

/** A branded QR code: round dots, the eyes drawn by the dialog, the Semli mark in the middle. Built on the server so the encoder never ships. */
export function qrCode(text: string): Qr {
  const modules = toQR(text, EC_HIGH);
  const size = Math.sqrt(modules.length);
  // About a quarter of the width, odd so it centers on a module.
  const holeSize = Math.round(size * 0.24) | 1;
  const at = (size - holeSize) / 2;
  const inEye = (x: number, y: number) => (x < 8 && y < 8) || (x >= size - 8 && y < 8) || (x < 8 && y >= size - 8);
  const inHole = (x: number, y: number) => x >= at - 1 && x < at + holeSize + 1 && y >= at - 1 && y < at + holeSize + 1;
  let dots = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (modules[y * size + x] && !inEye(x, y) && !inHole(x, y)) dots += `M${x + 0.04} ${y + 0.5}a.46 .46 0 1 0 .92 0a.46 .46 0 1 0-.92 0`;
    }
  }
  return { size, dots, hole: { at, size: holeSize } };
}

/** The try-it box's get-the-app code, counted: semli.app/get?r=demo-qr, which opens the App Store. */
export const GET_APP_QR = qrCode(`${SITE_URL}/get?r=demo-qr`);
