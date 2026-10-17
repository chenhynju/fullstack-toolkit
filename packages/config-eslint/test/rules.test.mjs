import { RuleTester } from 'eslint';
import boundary from '../rules/no-app-imports.mjs';
import taggedConsole from '../rules/no-untagged-console.mjs';

const tester = new RuleTester({ languageOptions: { ecmaVersion: 2022, sourceType: 'module' } });
const filename = '/workspace/packages/ui/src/button.js';
tester.run('no-app-imports', boundary, {
  valid: [
    { filename, code: "import { x } from '@repo/utils';" },
    { filename, code: "export * from './apps-like.js';" },
    { filename: '/workspace/apps/web/page.js', code: "import x from '../../apps/admin/x.js';" }
  ],
  invalid: [
    "import x from '../../../apps/web/x.js';",
    "import x from '@repo/web';",
    "export * from '@apps/admin';",
    "export { x } from '../../apps/api/x.js';",
    "const x = import('../../apps/web/x.js');",
    "const x = require('../../apps/api/x.js');"
  ].map((code) => ({ filename, code, errors: [{ messageId: 'boundary' }] }))
});
tester.run('no-untagged-console', taggedConsole, {
  valid: ["console.log('[build] done');", "console.error('[api] failed', new Error());"],
  invalid: ["console.log('untagged');", 'console.warn();'].map((code) => ({
    code,
    errors: [{ messageId: 'tagged' }]
  }))
});
