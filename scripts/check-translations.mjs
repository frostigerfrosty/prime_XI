import { readFileSync, readdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';

const read = (language) =>
  JSON.parse(readFileSync(new URL(`../src/i18n/${language}.json`, import.meta.url), 'utf8'));
const english = read('en'),
  italian = read('it');
assert.deepEqual(
  Object.keys(english).sort(),
  Object.keys(italian).sort(),
  'Language message sets must match.',
);
for (const dictionary of [english, italian])
  for (const [key, value] of Object.entries(dictionary)) {
    assert.equal(typeof value, 'string', key);
    assert.ok(value.trim(), key);
    assert.deepEqual(
      (key.match(/\{\d+\}/gu) ?? []).sort(),
      (value.match(/\{\d+\}/gu) ?? []).sort(),
      `Placeholders: ${key}`,
    );
  }
for (const folder of ['app', 'components', 'pages'])
  for (const name of readdirSync(new URL(`../src/${folder}/`, import.meta.url)).filter((name) =>
    name.endsWith('.tsx'),
  )) {
    const text = readFileSync(new URL(`../src/${folder}/${name}`, import.meta.url), 'utf8');
    const source = ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    function visit(node) {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 't' &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        const key = node.arguments[0].text.trim().replace(/\s+/gu, ' ');
        if (key && /\p{L}/u.test(key))
          assert.ok(Object.hasOwn(english, key), `${folder}/${name}: missing translation ${key}`);
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
console.log(
  `Both languages cover ${Object.keys(english).length} messages; UI literals and placeholders checked.`,
);
