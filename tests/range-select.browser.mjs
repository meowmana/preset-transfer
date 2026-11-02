// 跑法：node tests/range-select.browser.mjs —— 要本机测试酒馆(8123)、预设“缝好测试”“单栏测试”、世界书 Eldoria；只勾选不写盘。SHOT_DIR 给了就存截图
import { createRequire } from 'module';
const puppeteer = createRequire('/home/admin/scripts/paper-anim/web/')('puppeteer-core');
const browser = await puppeteer.launch({ executablePath: '/usr/local/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('dialog', (d) => d.accept());
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.setViewport({ width: 412, height: 900, isMobile: true, hasTouch: true });
await page.goto('http://127.0.0.1:8123/', { waitUntil: 'networkidle2', timeout: 90000 });
await page.waitForFunction(() => window.PresetTransfer, { timeout: 60000 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(3000);
await page.evaluate(() => (window.PresetTransfer.MainUI?.createTransferUI || window.PresetTransfer.createTransferUI)?.());
await sleep(3000);
await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pick = (id, name) => { const s = document.querySelector(id); $(s).val([...s.options].find((o) => o.textContent.trim() === name).value).trigger('change'); };
  pick('#left-preset', '缝好测试');
  pick('#right-preset', '单栏测试');
  await sleep(1500);
  [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '加载条目')?.click();
  await sleep(4000);
  document.querySelectorAll('#left-entries-list .pt-transfer-group-header').forEach((h) => { if (h.nextElementSibling && !h.nextElementSibling.offsetParent) h.click(); });
  await sleep(800);
});

const results = {};
const fail = [];
const expect = (name, cond, info) => { results[name] = cond ? 'ok' : ['FAIL', info]; if (!cond) fail.push(name); };

const visibleItems = (sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length).map((e) => e.dataset.identifier || e.querySelector('[data-index]')?.dataset.index), sel);
const checkedOf = (sel, box) => page.evaluate((sel, box) => [...document.querySelectorAll(sel)].map((e) => e.querySelector(box)?.checked ? 1 : 0).join(''), sel, box);
const center = (sel, nth) => page.evaluate((sel, nth) => {
  const el = [...document.querySelectorAll(sel)].filter((e) => e.getClientRects().length)[nth];
  el.scrollIntoView({ block: 'center' });
  const r = (el.querySelector('.entry-name') || el.querySelector('span span') || el).getBoundingClientRect();
  return { x: r.left + Math.min(40, r.width / 2), y: r.top + r.height / 2 };
}, sel, nth);
const longPress = async (sel, nth) => { const p = await center(sel, nth); await page.touchscreen.touchStart(p.x, p.y); await sleep(750); await page.touchscreen.touchEnd(); await sleep(400); };
const tap = async (sel, nth) => { const p = await center(sel, nth); await page.touchscreen.tap(p.x, p.y); await sleep(400); };
const shiftClick = async (sel, nth) => { const p = await center(sel, nth); await page.keyboard.down('Shift'); await page.mouse.click(p.x, p.y); await page.keyboard.up('Shift'); await sleep(400); };
const click = async (sel, nth) => { const p = await center(sel, nth); await page.mouse.click(p.x, p.y); await sleep(400); };

const L = '#left-entries-list .entry-item:not(.position-item)';
const LB = '.entry-checkbox';
const count = () => page.$eval('#left-selection-count', (e) => e.textContent.trim());
const none = () => page.evaluate(() => document.querySelector('#left-select-none').click());

const leftVisible = await visibleItems(L);
results.leftVisible = leftVisible.length;
await none();
await longPress(L, 2);
expect('左·长按出起点', await page.evaluate(() => document.querySelectorAll('#left-entries-list .pt-range-anchor').length === 1));
expect('左·长按不勾', (await checkedOf(L, LB)).indexOf('1') < 0);
await tap(L, 6);
let c = await checkedOf(L, LB);
expect('左·点终点勾上 3..7', c.slice(0, 9) === '001111100' && (c.match(/1/g) || []).length === 5, c);
expect('左·计数', /已选择 5\//.test(await count()), await count());
expect('左·起点清掉', await page.evaluate(() => !document.querySelector('#left-entries-list .pt-range-anchor')));
await tap(L, 4);
c = await checkedOf(L, LB);
expect('左·再点一次取消单条', c.slice(0, 9) === '001101100', c);
expect('左·取消后计数', /已选择 4\//.test(await count()), await count());
await longPress(L, 3);
await tap(L, 3);
expect('左·点起点自己=撤销起点', await page.evaluate(() => !document.querySelector('#left-entries-list .pt-range-anchor')) && (await checkedOf(L, LB)).slice(0, 9) === '001101100');
await none();
await click(L, 1);
await shiftClick(L, 4);
c = await checkedOf(L, LB);
expect('左·Shift 点击勾 2..5', c.slice(0, 9) === '011110000', c);
await click(L, 2);
await shiftClick(L, 3);
c = await checkedOf(L, LB);
expect('左·Shift 按起点状态取消 3..4', c.slice(0, 9) === '010010000', c);
await none();

await page.evaluate(() => { const i = document.querySelector('#left-entry-search-inline'); i.value = '去'; i.dispatchEvent(new Event('input', { bubbles: true })); });
await sleep(1200);
const filtered = await visibleItems(L);
results.filteredVisible = filtered.length;
if (filtered.length >= 3) {
  await longPress(L, 0);
  await tap(L, filtered.length - 1);
  const st = await page.evaluate((L) => [...document.querySelectorAll(L)].map((e) => ({ v: e.getClientRects().length > 0, c: e.querySelector('.entry-checkbox').checked })), L);
  expect('左·筛选时只勾可见', st.every((s) => s.c === s.v) && st.some((s) => !s.v), st.filter((s) => s.c !== s.v).length);
  expect('左·筛选计数', new RegExp(`已选择 ${filtered.length}/`).test(await count()), await count());
  if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/range-left-filtered.png` });
} else {
  expect('左·筛选有足够条目', false, filtered.length);
}
await page.evaluate(() => { const i = document.querySelector('#left-entry-search-inline'); i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); });
await sleep(1200);
await none();
await longPress(L, 2);
await tap(L, 5);
await longPress(L, 6);
if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/range-left-preset.png` });
await tap(L, 6);
await none();

await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  document.querySelector('#pt-stitch-from-worldbook').click();
  await sleep(2000);
  $('#pt-wb-stitch-dialog .pt-wb-stitch-book').val('Eldoria').trigger('change');
  await sleep(2000);
});
const W = '#pt-wb-stitch-dialog .pt-wb-stitch-list label';
const WB = '.pt-wb-stitch-pick';
const wcount = () => page.$eval('#pt-wb-stitch-dialog .pt-wb-stitch-count', (e) => e.textContent.trim());
results.wbItems = (await visibleItems(W)).length;
await longPress(W, 1);
expect('书·长按出起点', await page.evaluate(() => document.querySelectorAll('#pt-wb-stitch-dialog .pt-range-anchor').length === 1));
expect('书·长按不勾', (await checkedOf(W, WB)).indexOf('1') < 0);
await tap(W, 3);
c = await checkedOf(W, WB);
expect('书·点终点勾上 2..4', c === '0111', c);
expect('书·计数', /已选 3\//.test(await wcount()), await wcount());
expect('书·勾了就武装缝入', await page.evaluate(() => window.transferMode?.fromSide === 'worldbook' && window.transferMode.ptStitchIndexes.join() === '1,2,3'));
await tap(W, 2);
c = await checkedOf(W, WB);
expect('书·再点一次取消单条', c === '0101', c);
await page.evaluate(() => document.querySelector('#pt-wb-stitch-dialog .pt-wb-stitch-none').click());
await click(W, 0);
await shiftClick(W, 2);
c = await checkedOf(W, WB);
expect('书·Shift 点击勾 1..3', c === '1110', c);
expect('书·Shift 计数', /已选 3\//.test(await wcount()), await wcount());
await page.evaluate(() => document.querySelector('#pt-wb-stitch-dialog .pt-wb-stitch-none').click());
await longPress(W, 0);
await tap(W, 1);
await longPress(W, 2);
if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/range-worldbook-stitch.png` });
await tap(W, 2);

await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  document.querySelector('#pt-wb-stitch-dialog .pt-wb-stitch-cancel')?.click();
  document.querySelector('#preset-transfer-modal')?.remove();
  await (window.PresetTransfer.MainUI?.createTransferUI || window.PresetTransfer.createTransferUI)({ adapterKey: 'worldbook' });
  await sleep(2500);
  const pick = (id, name) => { const s = document.querySelector(id); $(s).val([...s.options].find((o) => o.value === name || o.textContent.trim() === name).value).trigger('change'); };
  pick('#left-preset', 'Eldoria');
  pick('#right-preset', '缝合测试书');
  await sleep(1500);
  [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '加载条目')?.click();
  await sleep(3000);
});
results.wbModeItems = (await visibleItems(L)).length;
await none();
await longPress(L, 0);
expect('世界书模式·长按出起点', await page.evaluate(() => document.querySelectorAll('#left-entries-list .pt-range-anchor').length === 1));
await tap(L, 2);
c = await checkedOf(L, LB);
expect('世界书模式·点终点勾上 1..3', c === '1110', c);
expect('世界书模式·计数', /已选择 3\/4/.test(await count()), await count());
await tap(L, 1);
expect('世界书模式·再点一次取消', (await checkedOf(L, LB)) === '1010');
await none();
await click(L, 1);
await shiftClick(L, 3);
c = await checkedOf(L, LB);
expect('世界书模式·Shift 勾 2..4', c === '0111', c);
await longPress(L, 0);
if (process.env.SHOT_DIR) await page.screenshot({ path: `${process.env.SHOT_DIR}/range-worldbook-mode.png` });
await tap(L, 0);

console.log(JSON.stringify(results, null, 1));
await browser.close();
if (fail.length) { console.error('区间多选没过：', fail.join('，')); process.exit(1); }
console.log('range-select: 长按起点+点终点、Shift 点击、取消、筛选、计数都过');
