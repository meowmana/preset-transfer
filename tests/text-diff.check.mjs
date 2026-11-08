// 跑法：node tests/text-diff.check.mjs —— 版本搬迁里“看两版哪里不一样”的比对：拼回去要等于原文，改一个词只标那个词
import assert from 'node:assert/strict';
import { diffText } from '../src/preset/text-diff.js';

const rebuild = (segs, side) => segs.filter(s => s.type === 'same' || s.type === side).map(s => s.text).join('');
const cases = [
  ['第一句。\n第二句写得很长很长。\n第三句。', '第一句。\n第二句写得非常长很长。\n第三句。'],
  ['a\nb\nc', 'a\nc'],
  ['', '全是新的'],
  ['全删了', ''],
  ['一样', '一样'],
];
for (const [a, b] of cases) {
  const segs = diffText(a, b);
  assert.equal(rebuild(segs, 'del'), a, '拼回旧文');
  assert.equal(rebuild(segs, 'add'), b, '拼回新文');
}
const segs = diffText('他今天很开心地出门了。', '他今天很难过地出门了。');
assert.deepEqual(segs.filter(s => s.type !== 'same').map(s => s.text), ['开心', '难过']);
assert.deepEqual(diffText('一样', '一样'), [{ type: 'same', text: '一样' }]);
console.log('ok');
