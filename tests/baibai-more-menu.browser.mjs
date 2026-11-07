// 跑法：node tests/baibai-more-menu.browser.mjs —— 要本机测试酒馆(8123)装着柏宝箱且开着预设分组；看柏宝箱的三个点菜单里有没有美化正则、点了能不能打开美化窗口、列表重画后还在不在
import { createRequire } from 'module';
const puppeteer = createRequire('/home/admin/scripts/paper-anim/web/')('puppeteer-core');
const browser = await puppeteer.launch({ executablePath: '/usr/local/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('dialog', (d) => d.dismiss());
await page.setViewport({ width: 412, height: 900, isMobile: true, deviceScaleFactor: 2 });
await page.goto('http://127.0.0.1:8123/', { waitUntil: 'networkidle2', timeout: 90000 });
await page.waitForFunction(() => window.PresetTransfer, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 4000));
await page.evaluate(() => document.querySelector('#leftNavDrawerIcon')?.click());
await new Promise((r) => setTimeout(r, 2500));

const count = () => page.evaluate(() => {
  const list = document.querySelector('#completion_prompt_manager_list');
  return {
    menus: list.querySelectorAll('.bai-bai-preset-prompt-actions').length,
    wands: list.querySelectorAll('.bai-bai-preset-prompt-actions .pt-baibai-beautify-action').length,
    ours: list.querySelectorAll('.pt-entry-more-btn').length,
  };
});

const first = await count();
await page.evaluate(async () => (await import('/scripts/openai.js')).promptManager.render(false));
await new Promise((r) => setTimeout(r, 2500));
const afterRerender = await count();

const target = await page.evaluateHandle(() => {
  const rows = [...document.querySelectorAll('#completion_prompt_manager_list li[data-pm-identifier]')];
  return rows.find((r) => r.offsetParent && r.querySelector('.bai-bai-preset-prompt-actions-hint'));
});
const id = await target.evaluate((r) => r.getAttribute('data-pm-identifier'));
const hint = await target.$('.bai-bai-preset-prompt-actions-hint');
await hint.evaluate((e) => e.scrollIntoView({ block: 'center' }));
await hint.click();
await new Promise((r) => setTimeout(r, 600));
const wand = await target.$('.pt-baibai-beautify-action');
const wandVisible = wand ? await wand.evaluate((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; }) : false;
if (process.env.PT_SHOT) await page.screenshot({ path: process.env.PT_SHOT });
if (wandVisible) await wand.click();
await new Promise((r) => setTimeout(r, 1500));
const modal = await page.evaluate(() => {
  const m = document.querySelector('#pt-entry-beautify-modal');
  return { open: !!m && !!m.offsetParent, identifier: m?.getAttribute('data-pt-identifier') ?? null };
});
const menuClosed = await target.evaluate((r) => !r.querySelector('.bai-bai-preset-prompt-actions-visible'));
await browser.close();

const result = { first, afterRerender, id, wandVisible, modal, menuClosed };
console.log(JSON.stringify(result, null, 1));
const fails = [];
if (!first.menus) fails.push('测试酒馆里没看到柏宝箱的三个点菜单，检查前提不成立');
if (first.wands !== first.menus) fails.push('不是每个柏宝箱菜单里都有美化正则');
if (afterRerender.wands !== afterRerender.menus) fails.push('列表重画后美化正则丢了');
if (first.ours) fails.push('柏宝箱接管时又冒出了我们自己的三个点');
if (!wandVisible) fails.push('打开柏宝箱菜单后看不到美化正则');
if (!modal.open || modal.identifier !== id) fails.push('点美化正则没打开对应条目的美化窗口');
if (!menuClosed) fails.push('点完美化正则柏宝箱菜单没收起');
if (fails.length) { console.error(fails.join('\n')); process.exit(1); }
console.log('baibai-more-menu: 过');
