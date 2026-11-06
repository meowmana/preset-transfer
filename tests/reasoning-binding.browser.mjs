// 跑法：node tests/reasoning-binding.browser.mjs —— 要本机测试酒馆(8123)，会改写预设“插班测试”“跳动测试”的 extensions，“兜底测试”不能带绑定
import { createRequire } from 'module';
const puppeteer = createRequire('/home/admin/scripts/paper-anim/web/')('puppeteer-core');
const browser = await puppeteer.launch({ executablePath: '/usr/local/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto('http://127.0.0.1:8123/', { waitUntil: 'networkidle2', timeout: 90000 });
await page.waitForFunction(() => window.PresetTransfer, { timeout: 60000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(3000);

const pick = (name) => page.evaluate((name) => {
  const s = document.querySelector('#settings_preset_openai');
  $(s).val([...s.options].find((o) => o.textContent.trim() === name).value).trigger('change');
}, name);
const setFix = (pre, suf) => page.evaluate((pre, suf) => {
  $('#reasoning_prefix').val(pre).trigger('input');
  $('#reasoning_suffix').val(suf).trigger('input');
}, pre, suf);
const fix = () => page.evaluate(() => [$('#reasoning_prefix').val(), $('#reasoning_suffix').val()].join('|'));
const save = () => page.evaluate(() => document.querySelector('#update_oai_preset').click());

const fail = [];
const expect = (name, cond, info) => { console.log(cond ? 'ok  ' : 'FAIL', name, cond ? '' : info); if (!cond) fail.push(name); };

await pick('插班测试'); await sleep(2500);
await setFix('<ecot>', '</ecot>'); await save(); await sleep(2500);
await pick('跳动测试'); await sleep(2500);
await setFix('<thinking>', '</thinking>'); await save(); await sleep(2500);

await pick('插班测试'); await sleep(2500);
expect('切回插班测试换成 ecot', (await fix()) === '<ecot>|</ecot>', await fix());
await pick('跳动测试'); await sleep(2500);
expect('切到跳动测试换成 thinking', (await fix()) === '<thinking>|</thinking>', await fix());
await pick('兜底测试'); await sleep(2500);
expect('没绑定的预设不动', (await fix()) === '<thinking>|</thinking>', await fix());

const fs = await import('fs');
const disk = JSON.parse(fs.readFileSync('/home/ubuntu/st-test/SillyTavern/data/default-user/OpenAI Settings/插班测试.json', 'utf8'));
expect('预设文件里存了方案', disk.extensions?.ptReasoningBinding?.prefix === '<ecot>', JSON.stringify(disk.extensions?.ptReasoningBinding));

await browser.close();
if (fail.length) { console.log('失败', fail.length); process.exit(1); }
console.log('全过');
