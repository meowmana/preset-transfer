// 跑法：node tests/version-move.check.mjs —— 验版本搬迁：旧版自有条目搬进新版、打缝合记号、内容不同的勾上才复制一份缝到下面
import assert from 'node:assert/strict';
const { planVersionMove, applyVersionMove } = await import('../src/preset/version-move.js');

const p = (identifier, name, content = name) => ({ identifier, name, role: 'system', content });
const preset = (prompts, order, groups, members) => ({
  prompts,
  prompt_order: [{ character_id: 100001, order: order.map(([identifier, enabled]) => ({ identifier, enabled })) }],
  extensions: { baibaiToolkit: { presetPromptGroups: { groups, prompts: Object.fromEntries(Object.entries(members).map(([k, v]) => [k, { groupId: v }])) } } },
});
const isStitch = x => x?.pt_meta?.presetTransfer?.kind === 'stitch';

const oldV = preset(
  [p('main', 'Main'), p('a1', '起笔'), p('m1', '我的文风'), p('a2', '破甲', '我改过的破甲'), p('m2', 'NSFW私货'), p('a3', '收尾'), p('m3', '没插入的')],
  [['main', true], ['a1', true], ['m1', true], ['a2', true], ['m2', false], ['a3', true]],
  [{ id: 'o-top', name: '顶部' }, { id: 'o-nsfw', name: 'NSFW①' }, { id: 'o-end', name: '尾部' }],
  { a1: 'o-top', m1: 'o-top', a2: 'o-top', m2: 'o-nsfw', a3: 'o-end' },
);
const fresh = () => preset(
  [p('main', 'Main'), p('a1', '起笔'), p('a2', '破甲', '作者新破甲'), p('a3', '收尾'), p('a4', '作者新加')],
  [['main', true], ['a1', true], ['a2', true], ['a3', true], ['a4', true]],
  [{ id: 'n-top', name: '顶部' }, { id: 'n-end', name: '尾部' }],
  { a1: 'n-top', a2: 'n-top', a3: 'n-end', a4: 'n-end' },
);

const newV = fresh();
const plan = planVersionMove(oldV, newV);
assert.deepEqual(plan.mine.map(m => m.identifier), ['m1', 'm2', 'm3']);
assert.deepEqual(plan.changed.map(c => c.identifier), ['a2']);

const r = applyVersionMove(oldV, newV, plan, { mineIds: ['m1', 'm2', 'm3'], useMineIds: ['a2'] });
const order = newV.prompt_order[0].order;
const ids = order.map(o => o.identifier);
const nameOf = id => newV.prompts.find(x => x.identifier === id)?.name;
const tag = newV.extensions.baibaiToolkit.presetPromptGroups;
const gname = id => tag.groups.find(g => g.id === tag.prompts[id]?.groupId)?.name;
assert.deepEqual(ids.map(nameOf), ['Main', '起笔', '我的文风', '破甲', '破甲（缝）', 'NSFW私货', '收尾', '作者新加']);
assert.equal(newV.prompts.find(x => x.identifier === 'a2').content, '作者新破甲', '作者那条不动');
const copy = newV.prompts.find(x => x.name === '破甲（缝）');
assert.equal(copy.content, '我改过的破甲');
assert.ok(isStitch(copy));
assert.equal(order.find(o => o.identifier === copy.identifier).enabled, false, '缝过来的副本先关着');
assert.equal(order.find(o => nameOf(o.identifier) === 'NSFW私货').enabled, false, '原来关着的照旧关着');
assert.equal(order.find(o => nameOf(o.identifier) === '我的文风').enabled, true);
assert.ok(newV.prompts.filter(x => ['我的文风', 'NSFW私货', '没插入的'].includes(x.name)).every(isStitch), '搬过去的都打缝合记号');
assert.ok(!ids.some(id => nameOf(id) === '没插入的') && newV.prompts.some(x => x.name === '没插入的'), '没插入的照旧不插入');
assert.equal(gname(ids[2]), '顶部');
assert.equal(gname(copy.identifier), '顶部');
assert.equal(gname(ids[5]), 'NSFW①', '整组都是自己条目的组照原样建');
assert.equal(r.copied, 1);

const newV2 = fresh();
applyVersionMove(oldV, newV2, planVersionMove(oldV, newV2), { mineIds: ['m1'], useMineIds: [] });
assert.deepEqual(newV2.prompts.map(x => x.name).sort(), ['Main', '作者新加', '我的文风', '收尾', '破甲', '起笔'].sort(), '不勾的什么都不加');
console.log('version-move: 过');
