// 跑法：node tests/stitch-guard.check.mjs —— 验缝合不会往只剩出厂条目的空壳上缝，导入监听要让酒馆等它做完
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('../src/preset/stitch-patch.js', import.meta.url), 'utf8');
const take = (name) => { const i = src.indexOf(`function ${name}(`); return src.slice(i, src.indexOf('\n}\n', i) + 2); };
const ids = src.slice(src.indexOf('const BUILTIN_PROMPT_IDS'), src.indexOf(']);', src.indexOf('const BUILTIN_PROMPT_IDS')) + 3);
const guard = new Function('isStitchEntry', `${ids}\n${take('assertTargetHasOwnEntries')} return assertTargetHasOwnEntries;`)(
  (p) => p?.pt_meta?.presetTransfer?.kind === 'stitch',
);
const builtin = ['main', 'chatHistory', 'jailbreak'].map((identifier) => ({ identifier }));
const stitch = { identifier: 's1', pt_meta: { presetTransfer: { kind: 'stitch', stitchId: 'x' } } };
assert.throws(() => guard({ prompts: [...builtin, stitch] }), /没读到原有条目/);
assert.throws(() => guard({ prompts: [] }), /没读到原有条目/);
assert.doesNotThrow(() => guard({ prompts: [...builtin, { identifier: 'author-1' }] }));
assert.match(src, /assertTargetHasOwnEntries\(targetData\);\n\s+const targetOrder = getOrCreateDummyCharacterPromptOrder/);

const auto = readFileSync(new URL('../src/features/preset-stitch-automation.js', import.meta.url), 'utf8');
assert.match(auto, /'oai_preset_import_ready', payload => handleOaiPresetImportReady\(payload\)\)/);

const ord = readFileSync(new URL('../src/preset/prompt-order-utils.js', import.meta.url), 'utf8');
const oi = ord.indexOf('function getOrCreateDummyCharacterPromptOrder(');
const getOrder = new Function(`${ord.slice(oi, ord.indexOf('\n}\n', oi) + 2)} return getOrCreateDummyCharacterPromptOrder;`)();
const p = { prompt_order: [{ character_id: 100000, order: [{ identifier: 'a', enabled: true }, { identifier: 'b', enabled: false }] }] };
assert.deepEqual(getOrder(p).order.map((o) => o.identifier), ['a', 'b']);
console.log('stitch-guard: 过');

const wi = auto.indexOf('async function waitForPresetWithEntries(');
const ids2 = auto.slice(auto.indexOf('const BUILTIN_PROMPT_IDS'), auto.indexOf(']);', auto.indexOf('const BUILTIN_PROMPT_IDS')) + 3);
const states = [{}, {}, { prompts: [{ identifier: 'main' }, { identifier: 'author-1' }] }];
let reads = 0;
const wait = new Function('getPresetDataFromManager', 'PT', 'window', `${ids2}\n${auto.slice(wi, auto.indexOf('\n}\n', wi) + 2)} return waitForPresetWithEntries;`)(
  () => states[Math.min(reads++, states.length - 1)], { API: {} }, {},
);
const got = await wait({}, 'x', 5000);
assert.equal(got.prompts.length, 2);
assert.ok(reads >= 3);
const waitEmpty = new Function('getPresetDataFromManager', 'PT', 'window', `${ids2}\n${auto.slice(wi, auto.indexOf('\n}\n', wi) + 2)} return waitForPresetWithEntries;`)(() => ({}), { API: {} }, {});
await assert.rejects(waitEmpty({}, 'x', 600), /一直没读到条目/);
assert.equal((auto.match(/await waitForPresetWithEntries\(apiInfo, targetPresetName\)/g) || []).length, 2);
let clicked = 0;
const waitSelected = new Function('getPresetDataFromManager', 'PT', 'window', `${ids2}\n${auto.slice(wi, auto.indexOf('\n}\n', wi) + 2)} return waitForPresetWithEntries;`)(
  () => (clicked ? { prompts: [{ identifier: 'author-1' }] } : {}),
  { API: { getLoadedPresetName: () => 'x' } },
  { jQuery: (sel) => ({ trigger: () => { assert.equal(sel, '#update_oai_preset'); clicked++; } }) },
);
assert.equal((await waitSelected({}, 'x', 5000)).prompts.length, 1);
assert.equal(clicked, 1);
console.log('stitch-guard 改名空窗: 过');
