'use client';

import { useEffect, useRef } from 'react';
import { appIconColors } from '@dayli/tokens';
import type { Qr } from '@/lib/qr';
import { MARK, QrCode } from '@/components/QrCode';

/** Where the dialog's button goes: the counted link, which opens the App Store. */
export const GET_APP_HREF = '/get?r=demo';

/** The app icon (design/icon-b-dots.svg), the way the App Store shows it. */
function AppIcon() {
  return (
    <svg className="getapp-icon" viewBox="0 0 1024 1024" aria-hidden="true">
      <rect width="1024" height="1024" fill={appIconColors.background} />
      <circle cx={MARK.big.cx} cy={MARK.big.cy} r={MARK.big.r} fill={appIconColors.foreground} />
      <circle cx={MARK.small.cx} cy={MARK.small.cy} r={MARK.small.r} fill={appIconColors.accent} />
    </svg>
  );
}

/**
 * Shown when the site's previews run out: an App Store style header, the copy and the link on
 * the left, a QR for the phone on lavender paper on the right. A native dialog, so focus,
 * Escape and the backdrop come from the browser.
 */
export function GetAppDialog({ open, onClose, qr }: { open: boolean; onClose: () => void; qr: Qr }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="getapp"
      aria-labelledby="getapp-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <button type="button" className="getapp-close" onClick={onClose} aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
      <div className="getapp-copy">
        <div className="getapp-app">
          <AppIcon />
          <div>
            <div className="getapp-name">Semli</div>
            <div className="getapp-sub">AI student planner · Free</div>
          </div>
        </div>
        <p className="getapp-kicker">You’ve used your free website previews.</p>
        <h2 id="getapp-title" className="getapp-title">
          Keep planning in the <span className="getapp-word">app</span>.
        </h2>
        <p className="getapp-text">
          Turn syllabi, work schedules, and messages into one plan. Review the dates, then add them alongside your classes and shifts.
        </p>
        <a className="btn getapp-btn" href={GET_APP_HREF}>
          Get the iPhone app
        </a>
      </div>
      <div className="getapp-qr">
        <div className="getapp-code">
          <QrCode qr={qr} label="QR code to get the iPhone app" />
        </div>
        <span>Scan with your iPhone to get the app</span>
      </div>
    </dialog>
  );
}
