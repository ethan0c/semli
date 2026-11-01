import { describe, expect, it } from 'vitest';
import { GET } from './route';

describe('the minimum app version', () => {
  it('blocks nobody until a version is set', async () => {
    expect(await GET().json()).toEqual({ minIosVersion: null });
  });
});
