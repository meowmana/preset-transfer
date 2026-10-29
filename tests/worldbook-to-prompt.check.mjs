// 跑法：node tests/worldbook-to-prompt.check.mjs —— 世界书条目转预设条目、重名不覆盖
import assert from 'node:assert/strict';
import { avoidNameCollisions, worldEntryToPrompt } from '../src/preset/worldbook-to-prompt.js';

const atDepth = worldEntryToPrompt({ uid: 3, comment: ' 文风·冷 ', content: '句子短。', position: 4, depth: 2, role: 2 });
assert.equal(atDepth.name, '文风·冷');
assert.equal(atDepth.injection_position, 1);
assert.equal(atDepth.injection_depth, 2);
assert.equal(atDepth.role, 'assistant');

const relative = worldEntryToPrompt({ uid: 7, comment: '', content: '\n  第一行很长很长很长很长很长很长很长很长很长\n第二行', position: 0, role: 1 });
assert.equal(relative.name, '第一行很长很长很长很长很长很长很长很长很');
assert.equal(relative.injection_position, 0);
assert.equal(relative.role, 'system');
assert.equal(worldEntryToPrompt({ uid: 9, content: '' }).name, '世界书条目 9');

const renamed = avoidNameCollisions(
    [{ name: '文风' }, { name: '文风' }, { name: '新的' }, { name: '文风（书）' }],
    ['文风', '文风（书）'],
    '书',
).map(p => p.name);
assert.deepEqual(renamed, ['文风（书）2', '文风（书）3', '新的', '文风（书）（书）']);
assert.equal(new Set(renamed).size, renamed.length);

console.log('worldbook-to-prompt: 全过');
