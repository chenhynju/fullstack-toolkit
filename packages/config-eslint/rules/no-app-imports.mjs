// Shared packages must not depend on application implementation details.
export default {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      boundary: 'Shared packages must not import apps/*; move the contract into a shared package.'
    }
  },
  create(context) {
    const filename = context.filename.replaceAll('\\', '/');
    if (!filename.includes('/packages/')) return {};
    function check(node) {
      const value = node?.value;
      if (typeof value !== 'string') return;
      const normalized = value.replaceAll('\\', '/');
      if (
        /(^|\/)apps\//.test(normalized) ||
        /^@apps\//.test(normalized) ||
        /^@repo\/(web|admin|api)(\/|$)/.test(normalized)
      )
        context.report({ node, messageId: 'boundary' });
    }
    return {
      ImportDeclaration: (node) => check(node.source),
      ExportNamedDeclaration: (node) => check(node.source),
      ExportAllDeclaration: (node) => check(node.source),
      ImportExpression: (node) => check(node.source),
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'require')
          check(node.arguments[0]);
      }
    };
  }
};
