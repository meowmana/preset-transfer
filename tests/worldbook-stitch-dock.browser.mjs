// 跑法：node tests/worldbook-stitch-dock.browser.mjs —— 要本机测试酒馆(8123)、预设“缝好测试”、世界书 Eldoria；会往预设里缝两条，跑前自己备份
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const s = document.querySelector('#left-preset');
  $(s).val([...s.options].find((o) => o.textContent.trim() === '缝好测试').value).trigger('change');
  $('#right-preset').val('').trigger('change');
  await sleep(1500);
  [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '加载条目')?.click();
  await sleep(4000);
  document.querySelector('#pt-stitch-from-worldbook').click();
  await sleep(2000);
  $('#pt-wb-stitch-dialog .pt-wb-stitch-book').val('Eldoria').trigger('change');
  await sleep(2000);
});
const cover = await page.evaluate(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const panelBottom = () => document.querySelector('#pt-wb-stitch-dialog .pt-wb-stitch-panel').getBoundingClientRect().bottom;
  const sel = document.querySelector('#single-preset, #left-preset');
  const content = document.querySelector('#preset-transfer-modal .transfer-modal-content');
  const openBottom = panelBottom();
  const contentTopOpen = content.getBoundingClientRect().top;
  document.querySelector('#pt-wb-stitch-dialog .pt-wb-stitch-fold').click();
  await sleep(500);
  const foldedBottom = panelBottom();
  const contentTopFolded = content.getBoundingClientRect().top;
  const foldedPickHidden = document.querySelector('#pt-wb-stitch-dialog .pt-wb-stitch-list').offsetParent === null;
  document.querySelector('#pt-wb-stitch-dialog .pt-wb-stitch-fold').click();
  await sleep(500);
  return { openBottom, contentTopOpen, foldedBottom, contentTopFolded, foldedPickHidden, selTop: sel?.getBoundingClientRect().top };
});
console.log(JSON.stringify({ cover }));
if (!(cover.contentTopOpen >= cover.openBottom && cover.foldedBottom < cover.openBottom - 100 && cover.contentTopFolded < cover.contentTopOpen && cover.foldedPickHidden)) {
  console.error('面板盖住了下面的预设，或缩小没生效'); process.exit(1);
}
const stitchOne = (pickIndex, targetNth) => page.evaluate(async (pickIndex, targetNth) => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pick = document.querySelector(`#pt-wb-stitch-dialog .pt-wb-stitch-pick[data-index="${pickIndex}"]`);
  pick.click();
  await sleep(300);
  let items = [...document.querySelectorAll('#single-entries-list .entry-item')].filter((e) => e.offsetParent);
  if (items.length <= targetNth) {
    document.querySelector('#single-entries-list .pt-transfer-group-header')?.click();
    await sleep(800);
    items = [...document.querySelectorAll('#single-entries-list .entry-item')].filter((e) => e.offsetParent);
  }
  const target = items[Math.min(targetNth, items.length - 1)];
  target.scrollIntoView({ block: 'end' });
  await sleep(300);
  target.click();
  await sleep(4000);
}, pickIndex, targetNth);
await stitchOne(0, 5);
await page.screenshot({ path: process.env.SHOT || '/tmp/wb-stitch-dock.png' });
const mid = await page.evaluate(() => ({
  open: !!document.querySelector('#pt-wb-stitch-dialog'),
  done0: getComputedStyle(document.querySelector('#pt-wb-stitch-dialog .pt-wb-stitch-pick[data-index="0"]').closest('label').querySelector('.pt-wb-stitch-done')).display !== 'none',
  checked0: document.querySelector('#pt-wb-stitch-dialog .pt-wb-stitch-pick[data-index="0"]').checked,
}));
await page.evaluate(() => $('#single-display-mode').val('include_disabled').trigger('change'));
await sleep(3000);
await stitchOne(1, 9);
const end = await page.evaluate(() => ({
  open: !!document.querySelector('#pt-wb-stitch-dialog'),
  done: [...document.querySelectorAll('#pt-wb-stitch-dialog .pt-wb-stitch-done')].map((e) => getComputedStyle(e).display !== 'none'),
  names: [...document.querySelectorAll('#single-entries-list .entry-item')].map((e) => e.textContent.trim()).filter((t) => /eldoria|shadowfang/i.test(t)),
}));
const dbg = await page.evaluate(() => { const l = document.querySelector('#pt-wb-stitch-dialog .pt-wb-stitch-pick[data-index="0"]').closest('label'); const d = l.querySelector('.pt-wb-stitch-done'); const cs = getComputedStyle(d); return { html: l.querySelector('span span').outerHTML.slice(0, 400), color: cs.color, disp: cs.display, w: d.getBoundingClientRect().width }; });
await page.screenshot({ path: (process.env.SHOT || '/tmp/wb-stitch-dock.png').replace('.png', '-end.png') });
console.log(JSON.stringify({ mid, end, dbg }, null, 1));
await browser.close();
const ok = mid.open && mid.done0 && !mid.checked0 && end.open && end.done[0] && end.done[1] && end.names.length >= 2;
if (!ok) { console.error('世界书缝入面板：没有一直摊着或没缝进去'); process.exit(1); }
console.log('worldbook-stitch-dock: 连缝两条、面板没关，过');
