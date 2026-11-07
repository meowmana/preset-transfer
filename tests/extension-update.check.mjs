// 跑法：node tests/extension-update.check.mjs —— 检查更新看的是二改仓库、认得 tong 序号
import fs from 'fs';
const raw = fs.readFileSync(new URL('../src/features/extension-update.js', import.meta.url), 'utf8');
const cut = (from, to) => raw.slice(raw.indexOf(from), raw.indexOf(to));
const src = cut('function normalizeVersion', 'function getLocalManifestUrl') + cut('function parseChangelogSections', 'async function loadLocalManifest');
const { compareVersions, parseGitHubRepo, buildChangelogDelta } = new Function(src + '; return { compareVersions, parseGitHubRepo, buildChangelogDelta };')();
let fail = 0;
const ok = (name, got, want) => { const pass = got === want; console.log(pass ? 'ok  ' : 'FAIL', name, got); if (!pass) fail++; };

ok('tong.28 比 tong.27 新', compareVersions('1.6.3-tong.28', '1.6.3-tong.27'), 1);
ok('tong.10 比 tong.9 新（不按字符串比）', compareVersions('1.6.3-tong.10', '1.6.3-tong.9'), 1);
ok('二改比同号原版新', compareVersions('1.6.3-tong.1', '1.6.3'), 1);
ok('同一版不提示', compareVersions('v1.6.3-tong.27', '1.6.3-tong.27'), 0);
ok('原版大号仍算新', compareVersions('1.6.7', '1.6.3-tong.27'), 1);

const manifest = JSON.parse(fs.readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
const repo = parseGitHubRepo(manifest.homePage);
ok('清单查更新指向二改仓库', repo && `${repo.owner}/${repo.repo}`, 'meowmana/preset-transfer');

const changelog = fs.readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const delta = buildChangelogDelta(changelog, '1.6.3-tong.27', manifest.version);
ok('更新日志挑出本版那段', delta.mode === 'delta' && delta.text.startsWith(`## ${manifest.version}`), true);

process.exit(fail ? 1 : 0);
