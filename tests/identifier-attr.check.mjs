// 跑法：node tests/identifier-attr.check.mjs —— 条目编号必须按原样文字读；jQuery .data() 会把“228”这种纯数字编号转成数字，跟预设里的文字编号对不上
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../src/', import.meta.url).pathname;
const bad = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.js')) {
      readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
        if (/\.data\(\s*['"][\w-]*identifier['"]\s*\)/.test(line)) bad.push(`${p.slice(root.length)}:${i + 1}`);
      });
    }
  }
};
walk(root);
if (bad.length) {
  console.error('这些地方用 .data() 读编号，纯数字编号会出错：\n' + bad.join('\n'));
  process.exit(1);
}
console.log('identifier-attr: 过');
