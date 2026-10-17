import { expect, test } from 'vitest';
import { releaseLabel } from '@repo/utils';
test('consumer uses the shared contract', () => {
  expect(releaseLabel(' RC-1 ')).toBe('rc-1');
});
