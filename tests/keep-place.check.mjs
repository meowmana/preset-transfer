// 跑法：node tests/keep-place.check.mjs —— 验“插哪落哪”规则（纯函数，不用酒馆）
import assert from 'node:assert/strict';

globalThis.localStorage = undefined;
const mod = await import('../src/features/entry-grouping.js').catch(() => null);
let plan = mod?.planLooseEntryAbsorption;
if (!plan) {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/features/entry-grouping.js', import.meta.url), 'utf8');
  const pick = (name) => src.slice(src.indexOf(`function ${name}(`), src.indexOf('\n}\n', src.indexOf(`function ${name}(`)) + 2);
  plan = new Function(
    `${pick('asArray')}${pick('normalizeMemberIdentifiers')}${pick('orderMemberIdentifiers')}${pick('planLooseEntryAbsorption')} return planLooseEntryAbsorption;`,
  )();
}

const A = { id: 'A', memberIdentifiers: ['a', 'b', 'c', 'd', 'e'] };
const B = { id: 'B', memberIdentifiers: ['x', 'y'] };
const run = (order, seen, loose = []) =>
  plan([A, B], order, seen ? new Set(seen) : null, new Set(loose));

// 夹在中间：abc1de → 进 A（没见过记录也收）
let r = run(['a', 'b', 'c', '1', 'd', 'e', 'x', 'y'], null);
assert.deepEqual(r.groupings[0].memberIdentifiers, ['a', 'b', 'c', '1', 'd', 'e']);

// 贴组尾的新条目：abcde1 → 进 A
r = run(['a', 'b', 'c', 'd', 'e', '1', 'x', 'y'], ['a', 'b', 'c', 'd', 'e', 'x', 'y']);
assert.deepEqual(r.absorbed, ['1']);
assert.equal(r.groupings[0].memberIdentifiers.at(-1), '1');

// 一整块新条目缝在组中间 → 全进 A
r = run(['a', 'b', 'n1', 'n2', 'n3', 'c', 'd', 'e'], null);
assert.deepEqual(r.absorbed, ['n1', 'n2', 'n3']);

// 原来就散在组尾的老条目 → 不动
r = run(['a', 'b', 'c', 'd', 'e', 'old', 'x', 'y'], ['a', 'b', 'c', 'd', 'e', 'old', 'x', 'y']);
assert.deepEqual(r.absorbed, []);

// 她亲手拖出组的 → 夹在中间也不拽回
r = run(['a', 'b', 'c', 'mine', 'd', 'e'], null, ['mine']);
assert.deepEqual(r.absorbed, []);

// 最上面、在所有组前面的新条目 → 不收
r = run(['top', 'a', 'b', 'c', 'd', 'e'], ['a', 'b', 'c', 'd', 'e']);
assert.deepEqual(r.absorbed, []);

console.log('keep-place: 6 条全过');
