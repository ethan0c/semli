import { addDays, dateLocale, localParts } from '@dayli/core';
import { IMPORT_MESSAGES, type ExtractContext, type ExtractRequest } from '@dayli/schema';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import { useStore } from '@/store';
import { devImportFile } from '@/lib/dev';
import { realRecords } from '@/lib/planner-preview';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
type ImageType = (typeof IMAGE_TYPES)[number];
export const MAX_BYTES = 20 * 1024 * 1024;

/** Thrown with a sentence the user can read. */
export class InputError extends Error {}

/** How far ahead a typed request can see the plan, and how many events it carries at most. */
const SCHEDULE_DAYS = 21;
const SCHEDULE_MAX = 150;

/**
 * Everything the extractor needs to know about this user, from the store. A typed or dictated
 * message also carries the next three weeks of timed events, so "before work" has a time to end at.
 */
export function extractionContext(input?: ExtractRequest['input']): ExtractContext {
  const { settings, courses, schedules, items } = useStore.getState();
  const today = localParts(new Date()).date;
  const last = addDays(today, SCHEDULE_DAYS - 1);
  const schedule = input?.kind === 'text'
    ? realRecords(Object.values(items))
      .filter((it) => it.kind === 'event' && !it.done && it.start && it.date >= today && it.date <= last)
      .sort((a, b) => a.date.localeCompare(b.date) || a.start!.localeCompare(b.start!))
      .slice(0, SCHEDULE_MAX)
      .map((it) => ({ date: it.date, start: it.start!, end: it.end, title: it.title.slice(0, 120) }))
    : undefined;
  return {
    ...(schedule?.length ? { schedule } : {}),
    name: settings.name,
    today,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: dateLocale().locale,
    region: dateLocale().region,
    courses: realRecords(courses).map((k) => ({ code: k.code, title: k.title })),
    employers: [...new Set(realRecords(schedules).map((s) => s.employer))],
  };
}

type Picked = { input: ExtractRequest['input']; source: string };

/** A browser file as base64, without the `data:` prefix. expo-file-system can't read files on the web. */
function readBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the file.'));
    reader.readAsDataURL(file);
  });
}

/** A picked file's contents: the browser's File on the web, the file at `uri` everywhere else. */
async function contentsOf(asset: { uri: string; file?: Blob }): Promise<string> {
  if (Platform.OS === 'web' && asset.file) return readBase64(asset.file);
  return new File(asset.uri).base64();
}

/** A file dropped or pasted on the web (an image or a PDF) as an import, or null if Semli can't read it. */
export async function inputFromFile(file: Blob & { name?: string }): Promise<Picked | null> {
  if (file.size > MAX_BYTES) throw new InputError(IMPORT_MESSAGES.tooLarge);
  if (file.type === 'application/pdf') return { input: { kind: 'pdf', data: await readBase64(file) }, source: file.name || 'PDF' };
  if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) return null;
  return { input: { kind: 'image', mediaType: file.type as ImageType, data: await readBase64(file) }, source: 'Screenshot' };
}

/** Photo library or camera → image input, or null if the user cancelled. */
export async function pickImageInput(fromCamera: boolean): Promise<Picked | null> {
  const perm = fromCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new InputError(
      fromCamera
        ? 'To take a photo, allow Semli to use your camera in your device settings. You can also type the details instead.'
        : 'To choose a screenshot, allow Semli to access your photos in your device settings. You can also type the details instead.',
    );
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.85 };
  const result = fromCamera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  if (asset.fileSize && asset.fileSize > MAX_BYTES) throw new InputError(IMPORT_MESSAGES.tooLarge);
  const data = await contentsOf(asset);
  const guess = asset.mimeType ?? (asset.uri.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg');
  const mediaType = (IMAGE_TYPES as readonly string[]).includes(guess) ? (guess as ImageType) : 'image/jpeg';
  return { input: { kind: 'image', mediaType, data }, source: fromCamera ? 'Photo' : 'Screenshot' };
}

/** Files app → PDF input, or null if cancelled. */
export async function pickPdfInput(): Promise<Picked | null> {
  if (__DEV__) {
    // A recording (design/clips) names its syllabus instead of opening the Files sheet.
    const fake = devImportFile();
    if (fake) return fake;
  }
  const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  if (asset.size && asset.size > MAX_BYTES) throw new InputError(IMPORT_MESSAGES.tooLarge);
  const data = await contentsOf(asset);
  return { input: { kind: 'pdf', data }, source: asset.name };
}
