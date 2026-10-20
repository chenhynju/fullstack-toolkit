// Run formatters before ESLint so overlapping files are never mutated concurrently.
export default {
  '*.{json,md,yml,yaml,css,ts,tsx,js,mjs,mts}': ['prettier --write', 'node scripts/lint-staged.mjs']
};
