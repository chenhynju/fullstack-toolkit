import { describe, expect, it } from 'vitest';
import { releaseLabel } from './index';
describe('releaseLabel', () => {
  it('normalizes display input without allowing paths', () => {
    expect(releaseLabel(' Release-42 ')).toBe('release-42');
    expect(releaseLabel('a')).toBe('a');
  });
  it.each(['', '../release', 'hello/world', '-bad', 'a'.repeat(51)])('rejects %j', (input) => {
    expect(() => releaseLabel(input)).toThrow();
  });
});
