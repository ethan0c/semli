import { describe, expect, it } from 'vitest';
import { isCanvasFeed } from './canvas-feed';

describe('isCanvasFeed', () => {
  it('takes Canvas and Brightspace feed links on a real domain only', () => {
    expect(isCanvasFeed('https://canvas.pomona.edu/feeds/calendars/user_abc.ics')).toBe(true);
    expect(isCanvasFeed('https://uga.view.usg.edu/d2l/le/calendar/feed/user/feed.ics?token=abc')).toBe(true);
    expect(isCanvasFeed('https://uga.view.usg.edu/d2l/le/calendar/feed/user/feed.ics')).toBe(false);
    expect(isCanvasFeed('https://127.0.0.1/d2l/le/calendar/feed/user/feed.ics?token=abc')).toBe(false);
    expect(isCanvasFeed('https://example.com:8443/feeds/calendars/user_abc.ics')).toBe(false);
  });
});
