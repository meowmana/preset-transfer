// 跑法：node tests/baibai-transfer.check.mjs —— 验整组搬来的条目登记进目标预设柏宝箱的同名组
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../src/transfer/adapters/preset-adapter.js', import.meta.url), 'utf8');
const start = src.indexOf('function addBaibaiGroups(');
const add = new Function(`${src.slice(start, src.indexOf('\n}\n', start) + 2)} return addBaibaiGroups;`)();

const data = { extensions: { baibaiToolkit: { presetPromptGroups: {
  groups: [{ id: 'g1', name: '文风', order: 0 }], prompts: { old: { groupId: 'g1' } } } } } };
assert.equal(add(data, [{ name: '文风', memberIdentifiers: ['n1', 'n2'] }, { name: 'CoT', memberIdentifiers: ['n3'] }]), true);
const store = data.extensions.baibaiToolkit.presetPromptGroups;
assert.equal(store.prompts.n1.groupId, 'g1');
assert.equal(store.groups.length, 2);
assert.equal(store.prompts.n3.groupId, store.groups[1].id);
assert.equal(store.groups[1].name, 'CoT');
assert.equal(add({ extensions: {} }, [{ name: 'x', memberIdentifiers: ['a'] }]), false);
console.log('baibai-transfer: 5 条全过');
