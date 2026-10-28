// 跑法：node tests/baibai-groups.check.mjs —— 用真预设文件验“按柏宝箱组显示”
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const presetPath = process.argv[2];
const src = readFileSync(new URL('../src/display/entry-group-display.js', import.meta.url), 'utf8');
const start = src.indexOf('export function readBaibaiGroupings(');
const body = src.slice(start, src.indexOf('\n}\n', start) + 2).replace('export ', '');
const preset = presetPath
  ? JSON.parse(readFileSync(presetPath, 'utf8'))
  : { extensions: { baibaiToolkit: { presetPromptGroups: {
      groups: [{ id: 'g2', name: '文风', order: 1 }, { id: 'g1', name: '顶部', order: 0 }, { id: 'g3', name: '空组', order: 2 }],
      prompts: { a: { groupId: 'g1' }, b: { groupId: 'g2' }, c: { groupId: 'g2' }, d: { groupId: 'nope' } },
    } } } };
const PT = { API: { getPreset: () => preset } };
const read = new Function('PT', `${body} return readBaibaiGroupings;`)(PT);
const out = read('x');

if (!presetPath) {
  assert.deepEqual(out.map((g) => g.name), ['顶部', '文风']);
  assert.deepEqual(out[1].memberIdentifiers, ['b', 'c']);
  console.log('baibai-groups: 假数据 2 条全过');
} else {
  console.log(out.map((g) => `${g.name}(${g.memberIdentifiers.length})`).join(' / '));
}
