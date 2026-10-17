// Console output must start with a stable [tag] for filtering.
/** @type {import('eslint').Rule.RuleModule} */
const noUntaggedConsole = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Console calls must start with a [tag] string literal',
      recommended: true
    },
    messages: {
      tagged: 'Console calls must start with [tag], for example console.log("[api] ...")'
    },
    schema: []
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        const isConsole =
          callee.type === 'MemberExpression' &&
          callee.object.type === 'Identifier' &&
          callee.object.name === 'console';
        if (!isConsole) {
          return;
        }
        const firstArg = node.arguments[0];
        const hasTag =
          firstArg &&
          firstArg.type === 'Literal' &&
          typeof firstArg.value === 'string' &&
          /^\[[\w-]+\]/.test(firstArg.value);
        if (!hasTag) {
          context.report({ node, messageId: 'tagged' });
        }
      }
    };
  }
};

export default noUntaggedConsole;
