// Run each package's own ESLint configuration; do not lint private operator files.
export default {
  '*.{json,md,yml,yaml,css,ts,tsx,js,mjs,mts}': 'prettier --write',
  '{apps,packages}/**/*.{ts,tsx,js,mjs,mts}': 'node scripts/lint-staged.mjs'
};
