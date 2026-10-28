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
