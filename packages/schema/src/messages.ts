/** Shared copy keeps import errors consistent on the website and in the app. */
export const IMPORT_MESSAGES = {
  unavailable: "Semli can't read this right now. Please try again in a few minutes.",
  busy: 'Semli is busy right now. Please try again in a minute.',
  timeout: 'This is taking longer than expected. Try again, or send a shorter message or a smaller file.',
  connection: "We couldn't reach Semli. Check your internet connection and try again.",
  request: "We couldn't read what you sent. Try sending your message or file again.",
  tooLarge: 'This file is too large. Choose a file of 20 MB or less, or send just the pages you need.',
  unsupported: 'Choose a PDF or an image in PNG, JPEG, WebP, or GIF format.',
  file: "We couldn't open this file. Choose it again, or try another PDF or image.",
  empty: "We couldn't find anything to add. Include an event or to-do and when it happens, then try again.",
  unreadable: "We couldn't read this. Try a clearer image, a different PDF, or type the details instead.",
  tooMuch: 'There is too much to read at once. Try a shorter message or send a few pages at a time.',
  incomplete: "We couldn't read this. Try sending it again, or type the details instead.",
  quota: "You've used this month's free imports. Semli Plus has unlimited imports, or add things by hand for free.",
  demoLimit: "That's the limit for previews today. Get the iPhone app to keep going.",
  session: "Semli couldn't confirm this phone. Close and reopen Semli, then try again.",
  /** Many guest imports from one network today; signing in (free) lifts it. Never shown to a signed-in user. */
  guestLimit: "Lots of people on this network are importing today. Sign in (it's free) to keep going.",
} as const;

/** Even a schema-valid server error must be known product copy before it reaches a screen. */
export function friendlyImportError(message: string, status: number): string {
  return (Object.values(IMPORT_MESSAGES) as string[]).includes(message) ? message : importErrorForStatus(status);
}

export function importErrorForStatus(status: number): string {
  if (status === 400 || status === 422) return IMPORT_MESSAGES.request;
  if (status === 401) return IMPORT_MESSAGES.session;
  if (status === 402) return IMPORT_MESSAGES.quota;
  if (status === 408 || status === 504) return IMPORT_MESSAGES.timeout;
  if (status === 413) return IMPORT_MESSAGES.tooLarge;
  if (status === 415) return IMPORT_MESSAGES.unsupported;
  if (status === 429) return IMPORT_MESSAGES.busy;
  return IMPORT_MESSAGES.unavailable;
}
