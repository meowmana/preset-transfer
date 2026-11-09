// 跑法：node tests/same-version-names.check.mjs —— 版本搬迁认“同系列旧版”时，名字不像也不能报错
import { arePresetsSameDifferentVersion } from '../src/core/preset-name-utils.js';
let fail = 0;
const same = (a, b, want) => {
  let got;
  try { got = arePresetsSameDifferentVersion(a, b).match; } catch (e) { got = '报错 ' + e.message; }
  console.log(got === want ? 'ok  ' : 'FAIL', a, '~', b, got);
  if (got !== want) fail++;
};
same('【未定】Gemini-v0.0.3(正式版)', '【未定】Gemini-v0.0.2(正式版)缝', true);
same('【未定】Gemini-v0.0.3(正式版)', '【测试】Gemini-v0.0.2(测试版)', false);
same('Gemini v0.0.3', '【未定】Gemini 正式版 v0.0.2', true);
same('万事成真v1.41', 'Ako 1.91', false);
same('万事成真v1.52_1', '万事成真v1.41_2', true);
same('万事成真v1.52_1', '万事成真_v1.3_缝好版', true);
process.exit(fail ? 1 : 0);
