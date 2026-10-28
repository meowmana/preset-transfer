// 跑法：node tests/stitch-groups.check.mjs —— 验自动缝合把缝进来的条目登记进柏宝箱的组
import assert from 'node:assert/strict';
const { extractStitchPatch, applyStitchPatch } = await import('../src/preset/stitch-patch.js');

const stitch = (identifier, name) => ({ identifier, name, role: 'system', content: name, pt_meta: { presetTransfer: { kind: 'stitch', stitchId: `sid-${identifier}` } } });
const author = (identifier, name) => ({ identifier, name, role: 'system', content: name });
const preset = (prompts, order, groups, members) => ({
  prompts,
  prompt_order: [{ character_id: 100001, order: order.map(identifier => ({ identifier, enabled: true })) }],
  extensions: { baibaiToolkit: { presetPromptGroups: { groups, prompts: Object.fromEntries(Object.entries(members).map(([k, v]) => [k, { groupId: v }])) } } },
});

const source = preset(
  [author('a1', '起笔'), author('a2', '文风甲'), stitch('s1', '🌷语言净化'), author('a3', '文风乙'), stitch('s2', '我的私货'), author('b1', '收尾'), stitch('s3', '顶头')],
  ['s3', 'a1', 'a2', 's1', 'a3', 's2', 'b1'],
  [{ id: 'g-open', name: '开头' }, { id: 'g-style', name: '文风' }, { id: 'g-mine', name: '只在旧版有的组' }, { id: 'g-end', name: '结尾' }],
  { a1: 'g-open', a2: 'g-style', s1: 'g-style', a3: 'g-style', s2: 'g-mine', b1: 'g-end', s3: 'g-open' },
);
const target = preset(
  [author('a1', '起笔'), author('a2', '文风甲'), author('a3', '文风乙'), author('b1', '收尾')],
  ['a1', 'a2', 'a3', 'b1'],
  [{ id: 'n-open', name: '开头' }, { id: 'n-style', name: '文风' }, { id: 'n-end', name: '结尾' }],
  { a1: 'n-open', a2: 'n-style', a3: 'n-style', b1: 'n-end' },
);

const patch = extractStitchPatch(source);
assert.equal(patch.runs.flatMap(r => r.stitches).find(s => s.stitchId === 'sid-s1').groupName, '文风');
const applied = applyStitchPatch(target, JSON.parse(JSON.stringify(patch)));
const tag = target.extensions.baibaiToolkit.presetPromptGroups.prompts;
const order = target.prompt_order[0].order.map(o => o.identifier);
const idOf = name => target.prompts.find(p => p.name === name).identifier;
assert.equal(tag[idOf('🌷语言净化')]?.groupId, 'n-style', '同名组');
assert.equal(tag[idOf('我的私货')]?.groupId, 'n-style', '没有同名组就跟正上方那条');
assert.equal(tag[idOf('顶头')]?.groupId, 'n-open', '同名组（顶头那条）');
assert.equal(applied.groupedStitches, 3);
assert.equal(target.prompts.length, 7);
assert.deepEqual(order.slice(0, 1), [idOf('顶头')]);

// 旧快照没有组名：跟正上方那条；排在最顶上就跟正下方那条
const old = JSON.parse(JSON.stringify(patch));
old.runs.forEach(r => r.stitches.forEach(s => delete s.groupName));
const t2 = preset(
  [author('a1', '起笔'), author('a2', '文风甲'), author('a3', '文风乙'), author('b1', '收尾')],
  ['a1', 'a2', 'a3', 'b1'],
  [{ id: 'n-open', name: '开头' }, { id: 'n-style', name: '文风' }, { id: 'n-end', name: '结尾' }],
  { a1: 'n-open', a2: 'n-style', a3: 'n-style', b1: 'n-end' },
);
applyStitchPatch(t2, old);
const tag2 = t2.extensions.baibaiToolkit.presetPromptGroups.prompts;
const id2 = name => t2.prompts.find(p => p.name === name).identifier;
assert.equal(tag2[id2('🌷语言净化')]?.groupId, 'n-style');
assert.equal(tag2[id2('我的私货')]?.groupId, 'n-style');
assert.equal(tag2[id2('顶头')]?.groupId, 'n-open');

// 目标没用柏宝箱：不加任何东西
const t3 = { prompts: [author('a1', '起笔')], prompt_order: [{ character_id: 100001, order: [{ identifier: 'a1', enabled: true }] }] };
applyStitchPatch(t3, JSON.parse(JSON.stringify(patch)));
assert.equal(t3.extensions, undefined);
console.log('stitch-groups: 过');
