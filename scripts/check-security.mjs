import { readdir, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import ts from 'typescript';

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const path = `${directory}/${entry.name}`;
        return entry.isDirectory() ? walk(path) : [path];
      }),
    )
  ).flat();
}
// A small regression guard for this application, not a replacement for CodeQL/review.
for (const path of (await walk('src')).filter((path) => /\.tsx?$/.test(path))) {
  const source = ts.createSourceFile(
    path,
    await readFile(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  function visit(node) {
    if (ts.isJsxAttribute(node))
      assert.notEqual(
        node.name.getText(source),
        'dangerouslySetInnerHTML',
        `${path}: raw HTML rendering`,
      );
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      assert.ok(
        !['eval', 'Function'].includes(node.expression.getText(source)),
        `${path}: dynamic code execution`,
      );
      if (['setTimeout', 'setInterval'].includes(node.expression.getText(source)))
        assert.ok(
          !node.arguments?.[0] || !ts.isStringLiteral(node.arguments[0]),
          `${path}: string timer`,
        );
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken)
      assert.ok(
        !/\.(innerHTML|outerHTML)$/.test(node.left.getText(source)),
        `${path}: raw HTML assignment`,
      );
    ts.forEachChild(node, visit);
  }
  visit(source);
}
for (const path of (await walk('.github/workflows')).filter((path) => path.endsWith('.yml'))) {
  const source = await readFile(path, 'utf8');
  for (const match of source.matchAll(/^\s*- uses: (\S+)/gm))
    assert.match(
      match[1],
      /^[\w-]+\/[\w./-]+@[a-f0-9]{40}$/,
      `${path}: action must use an immutable commit`,
    );
  assert.ok(
    !source.includes('pull_request_target:'),
    `${path}: privileged PR execution needs separate review`,
  );
  assert.ok(!source.includes('permissions: write-all'), `${path}: excessive token permissions`);
}
console.log('Security regression guards passed: React sinks and pinned workflow actions.');
