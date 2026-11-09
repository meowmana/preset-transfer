// 跑法：node tests/worldbook-delete-silent.check.mjs —— 批量删世界书条目不能每条再弹一次确认，删完要立刻从数据里消失
import { applyDeleteEntriesFromWorldbook } from '../src/core/worldbook-data-pure.js';

let popups = 0;
async function fakeStDelete(data, uid, { silent = false } = {}) {
  const ok = silent || (popups++, await new Promise(() => {}));
  if (!ok) return false;
  delete data.entries[uid];
  return true;
}

const data = { entries: { 1: { uid: 1 }, 2: { uid: 2 }, 3: { uid: 3 } } };
applyDeleteEntriesFromWorldbook(data, [{ raw: { uid: 1 } }, { raw: { uid: 3 } }], { deleteEntryFn: fakeStDelete });

const left = Object.keys(data.entries).join(',');
if (popups || left !== '2') {
  console.error(`弹了 ${popups} 次确认，剩下的条目是 ${left}（应该是 0 次、只剩 2）`);
  process.exit(1);
}
console.log('worldbook-delete-silent: 过');
