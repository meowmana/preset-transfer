// 跑法：node tests/reasoning-carry.check.mjs —— 读测试酒馆的“缝好测试”“单栏测试”，只在内存里改
import fs from 'fs';
import { extractStitchPatch, applyStitchPatch } from '../src/preset/stitch-patch.js';
import { applyVersionMove } from '../src/preset/version-move.js';
const dir = '/home/ubuntu/st-test/SillyTavern/data/default-user/OpenAI Settings/';
const load = (n) => JSON.parse(fs.readFileSync(dir + n + '.json', 'utf8'));
const bind = { name: 'ecot', prefix: '<ecot>', suffix: '</ecot>', separator: '\n' };
let fail = 0;
const expect = (name, cond, info) => { console.log(cond ? 'ok  ' : 'FAIL', name, cond ? '' : info ?? ''); if (!cond) fail++; };

const src = load('缝好测试'); src.extensions = { ...(src.extensions || {}), ptReasoningBinding: bind };
const patch = extractStitchPatch(src);
expect('补丁里带了方案', patch.reasoningBinding?.prefix === '<ecot>');
const t1 = load('单栏测试'); delete t1.extensions?.ptReasoningBinding;
const r1 = applyStitchPatch(t1, patch);
expect('缝合带过去', t1.extensions?.ptReasoningBinding?.prefix === '<ecot>' && r1.reasoningCarried, JSON.stringify(t1.extensions?.ptReasoningBinding));
const t2 = load('单栏测试'); t2.extensions = { ...(t2.extensions || {}), ptReasoningBinding: { name: 'x', prefix: '<thinking>', suffix: '</thinking>', separator: '' } };
applyStitchPatch(t2, patch);
expect('新版自己绑过的不覆盖', t2.extensions.ptReasoningBinding.prefix === '<thinking>');
const t3 = load('单栏测试'); delete t3.extensions?.ptReasoningBinding;
const r3 = applyVersionMove(src, t3, { mine: [], changed: [] }, { mineIds: [] });
expect('版本搬迁（没搬条目）也带过去', t3.extensions?.ptReasoningBinding?.prefix === '<ecot>' && r3.reasoningCarried);
process.exit(fail ? 1 : 0);
