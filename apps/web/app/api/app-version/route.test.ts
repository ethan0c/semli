import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('the minimum app version', () => {
  it('requires iOS app version 1.2.0 or newer', async () => {
    expect(await GET().json()).toEqual({ minIosVersion: '1.2.0' });
  });
});
