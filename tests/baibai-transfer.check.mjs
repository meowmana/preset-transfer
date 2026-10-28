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

// 整组的名单要一路传到 transferEntries：界面给 entryIdentifiers，适配器转交 selectedGroups
const display = readFileSync(new URL('../src/display/entry-group-display.js', import.meta.url), 'utf8');
const sel = display.slice(display.indexOf('export function getSelectedGroups('));
assert.match(sel.slice(0, sel.indexOf('\n}\n')), /entryIdentifiers:/);
const adapterTransfer = src.slice(src.indexOf('async transfer(apiInfo, params)'));
assert.match(adapterTransfer.slice(0, adapterTransfer.indexOf('},\n')), /selectedGroups:\s*params\.selectedGroups/);
console.log('baibai-transfer: 7 条全过');
