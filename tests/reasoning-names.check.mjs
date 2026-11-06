// 跑法：node tests/reasoning-names.check.mjs —— 同名旧版沿用解析方案时怎么认“同名”
import fs from 'fs';
import { normalizePresetBaseName } from '../src/core/preset-name-utils.js';
const raw = fs.readFileSync(new URL('../src/features/reasoning-binding.js', import.meta.url), 'utf8');
const src = raw.slice(raw.indexOf('export function splitAtFirstVersion'), raw.indexOf('// 自己没绑过时'));
const { splitAtFirstVersion, sameFamily } = new Function('normalizePresetBaseName', src.replace(/export /g, '') + '; return { splitAtFirstVersion, sameFamily };')(normalizePresetBaseName);
let fail = 0;
const same = (a, b, want) => { const got = sameFamily(splitAtFirstVersion(a).base, splitAtFirstVersion(b).base) && !!splitAtFirstVersion(a).version; console.log(got === want ? 'ok  ' : 'FAIL', a, '~', b, got); if (got !== want) fail++; };
same('万事成真v1.41_2', '万事成真1.3封好版', true);
same('万事成真的1.41_2', '万事成真_v1.3_缝好版', true);
same('万事成真_v1.26-已归组', '万事成真 v1.41', true);
same('【Ako】1.92_正式版', 'Ako 1.91', true);
same('万事成真v1.41', 'Ako 1.91', false);
same('万事成真', '万事成真v1.41', false);
process.exit(fail ? 1 : 0);
