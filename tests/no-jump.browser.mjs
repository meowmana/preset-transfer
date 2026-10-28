// 跑法：PT_PRESET=预设名 node tests/no-jump.browser.mjs —— 要本机测试酒馆(8123)和带柏宝箱分组的预设；点 ➕ 后逐帧看列表有没有闪成平铺
import { createRequire } from 'module';
const puppeteer = createRequire('/home/admin/scripts/paper-anim/web/')('puppeteer-core');
const browser = await puppeteer.launch({ executablePath: '/usr/local/bin/google-chrome', headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('dialog', (d) => d.accept());
await page.setViewport({ width: 412, height: 900, isMobile: true });
await page.goto('http://127.0.0.1:8123/', { waitUntil: 'networkidle2', timeout: 90000 });
await page.waitForFunction(() => window.PresetTransfer, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 3000));
await page.evaluate(() => (window.PresetTransfer.MainUI?.createTransferUI || window.PresetTransfer.createTransferUI)?.());
await new Promise((r) => setTimeout(r, 3000));
await page.evaluate((n) => { window.__ptPreset = n; }, process.env.PT_PRESET || '跳动测试');
const r = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const s = document.querySelector('#left-preset');
  $(s).val([...s.options].find((o) => o.textContent.trim() === (window.__ptPreset)).value).trigger('change');
  $('#right-preset').val('').trigger('change');
  await sleep(1500);
  [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '加载条目')?.click();
  await sleep(4000);
  const list = document.querySelector('#single-entries-list');
  const heads = [...list.querySelectorAll('.pt-transfer-group-header')];
  const head = heads[Math.floor(heads.length / 2)];
  head.click();
  await sleep(800);
  const cont = head.nextElementSibling;
  const items = [...cont.querySelectorAll('.entry-item')];
  const item = items[Math.min(3, items.length - 1)];
  list.scrollTop += item.getBoundingClientRect().top - list.getBoundingClientRect().top - 150;
  await sleep(500);
  const topEntry = () => {
    const lt = list.getBoundingClientRect().top;
    const el = [...list.querySelectorAll('.entry-item')].find((e) => e.offsetParent && e.getBoundingClientRect().bottom > lt + 2);
    return el?.textContent.trim().slice(0, 14);
  };
  const before = { st: list.scrollTop, top: topEntry() };
  const frames = [];
  let run = true;
  const tick = () => { if (!run) return; frames.push([Math.round(performance.now()), list.scrollTop, topEntry(), list.querySelectorAll('.pt-transfer-group-header').length]); requestAnimationFrame(tick); };
  const t0 = performance.now();
  requestAnimationFrame(tick);
  item.querySelector('.create-here-btn').click();
  await sleep(2500);
  run = false;
  const seen = [];
  for (const f of frames) { const k = `${f[1]}|${f[2]}|${f[3]}`; if (seen.at(-1)?.k !== k) seen.push({ k, t: f[0] - Math.round(t0) }); }
  return { group: head.getAttribute('data-group-name'), clicked: item.textContent.trim().slice(0, 14), before, changes: seen };
});
console.log(JSON.stringify(r, null, 1));
await browser.close();
const flat = r.changes.filter((c) => c.k.endsWith('|0'));
if (flat.length) { console.error('列表重画时闪成了平铺：', flat); process.exit(1); }
console.log('no-jump: 没有平铺帧，过');
