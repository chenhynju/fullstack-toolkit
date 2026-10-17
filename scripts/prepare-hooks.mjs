import { existsSync } from 'node:fs';
// Container/CI source archives have no Git checkout; hooks are a local convenience.
if (existsSync('.git') && !process.env.CI && process.env.NODE_ENV !== 'production') {
  const { default: husky } = await import('husky');
  const result = husky();
  if (result) console.warn('[hooks]', result);
}
