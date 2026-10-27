import { Extraction } from '@dayli/schema';

export type StreamedItem = Extraction['items'][number];
const Item = Extraction.shape.items.element;

/**
 * Reads the extraction's JSON as the model writes it and hands over each item of the top-level
 * `items` array the moment its closing brace arrives, so the app can show rows while the rest is
 * still being read. An item that doesn't validate is skipped here; the final, validated answer is
 * still the one review uses.
 */
export function itemScanner(onItem: (item: StreamedItem) => void) {
  let buffer = '';
  let pos = 0;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let key = '';
  let lastKey = '';
  let readingKey = false;
  let inItems = false;
  let start = -1;

  return {
    push(delta: string) {
      buffer += delta;
      for (; pos < buffer.length; pos++) {
        const ch = buffer[pos]!;
        if (inString) {
          if (escaped) escaped = false;
          else if (ch === '\\') escaped = true;
          else if (ch === '"') inString = false;
          else if (readingKey) key += ch;
          continue;
        }
        if (ch === '"') {
          inString = true;
          readingKey = depth === 1;
          if (readingKey) key = '';
        } else if (ch === ':' && depth === 1) {
          lastKey = key;
        } else if (ch === '{' || ch === '[') {
          depth++;
          if (ch === '[' && depth === 2 && lastKey === 'items') inItems = true;
          else if (ch === '{' && inItems && depth === 3) start = pos;
        } else if (ch === '}' || ch === ']') {
          if (ch === '}' && inItems && depth === 3 && start >= 0) {
            try {
              const parsed = Item.safeParse(JSON.parse(buffer.slice(start, pos + 1)));
              if (parsed.success) onItem(parsed.data);
            } catch {
              // A malformed fragment: the final answer is validated anyway.
            }
            start = -1;
          }
          if (ch === ']' && inItems && depth === 2) inItems = false;
          depth--;
        }
      }
    },
  };
}
