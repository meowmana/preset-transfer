// 推理解析方案跟预设走：存预设时把当前方案写进 preset.extensions，切到该预设时换上
import { PT } from '../core/api-compat.js';
import { normalizePresetBaseName } from '../core/preset-name-utils.js';
import { getCurrentApiInfo, getJQuery, getSillyTavernContext } from '../core/utils.js';

const KEY = 'ptReasoningBinding';
const SAVE_BUTTONS = '#update_oai_preset, #new_oai_preset';

function readCurrent() {
  const $ = getJQuery();
  return {
    name: String($('#reasoning_select').val() ?? ''),
    prefix: String($('#reasoning_prefix').val() ?? ''),
    suffix: String($('#reasoning_suffix').val() ?? ''),
    separator: String($('#reasoning_separator').val() ?? ''),
  };
}

function stampIntoSettings() {
  try {
    const oai = getSillyTavernContext().chatCompletionSettings;
    if (!oai) return;
    const cur = readCurrent();
    if (!cur.prefix || !cur.suffix) return;
    if (!oai.extensions || typeof oai.extensions !== 'object') oai.extensions = {};
    oai.extensions[KEY] = cur;
  } catch (e) {
    console.warn('写入解析方案绑定失败:', e);
  }
}

let installed = false;

// 挂在 window 捕获阶段：柏宝箱在 document 捕获阶段会拦下保存点击自己存，得抢在它前面把方案塞进设置
export function installReasoningBindingSaveHook() {
  if (installed) return;
  installed = true;
  window.addEventListener(
    'click',
    e => {
      if (e.target instanceof Element && e.target.closest(SAVE_BUTTONS)) stampIntoSettings();
    },
    true,
  );
}

export function getReasoningBinding(preset) {
  return preset?.extensions?.[KEY] ?? null;
}

function compareVersions(a, b) {
  const pa = String(a).split('.').map(n => parseInt(n, 10) || 0);
  const pb = String(b).split('.').map(n => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
  }
  return 0;
}

// 名字按第一个版本号切：“万事成真v1.41_2”“万事成真_v1.3_缝好版”都认成“万事成真”
export function splitAtFirstVersion(presetName) {
  const raw = String(presetName ?? '');
  for (const m of raw.matchAll(/v?\d+(?:\.\d+){1,3}|v\d+/gi)) {
    const before = raw[m.index - 1];
    if (before && /[a-z0-9]/i.test(before)) continue;
    const base = normalizePresetBaseName(raw.slice(0, m.index));
    if (base) return { base, version: m[0].replace(/^v/i, '') };
  }
  return { base: '', version: null };
}

function sameFamily(a, b) {
  if (a === b) return true;
  return Math.min(a.length, b.length) >= 2 && (a.startsWith(b) || b.startsWith(a));
}

// 自己没绑过时，找同名不同版本里绑过的，取版本号最高的那个
export function findSiblingReasoningBinding(presetName) {
  const info = splitAtFirstVersion(presetName);
  if (!info.version) return null;
  let best = null;
  for (const name of getCurrentApiInfo()?.presetNames ?? []) {
    if (name === presetName) continue;
    const other = splitAtFirstVersion(name);
    if (!other.version || !sameFamily(other.base, info.base)) continue;
    const bound = getReasoningBinding(PT.API.getPreset?.(name));
    if (!bound?.prefix || !bound?.suffix) continue;
    if (!best || compareVersions(other.version, best.version) > 0) best = { name, version: other.version, bound };
  }
  return best;
}

export function resolveReasoningBinding(presetName, preset) {
  const own = getReasoningBinding(preset);
  if (own?.prefix && own?.suffix) return { bound: own, from: null };
  const sib = findSiblingReasoningBinding(presetName);
  return sib ? { bound: sib.bound, from: sib.name } : { bound: null, from: null };
}

export function applyReasoningBinding(presetName, bound, from = null) {
  try {
    if (!bound || !bound.prefix || !bound.suffix) return false;

    const $ = getJQuery();
    const cur = readCurrent();
    if (cur.prefix === bound.prefix && cur.suffix === bound.suffix && cur.separator === bound.separator) return false;

    const $select = $('#reasoning_select');
    if (bound.name && $select.find('option').filter((_, o) => o.value === bound.name).length) {
      $select.val(bound.name).trigger('change');
    }
    const after = readCurrent();
    if (after.prefix !== bound.prefix) $('#reasoning_prefix').val(bound.prefix).trigger('input');
    if (after.suffix !== bound.suffix) $('#reasoning_suffix').val(bound.suffix).trigger('input');
    if (after.separator !== bound.separator) $('#reasoning_separator').val(bound.separator).trigger('input');

    window.toastr?.info?.(`解析方案已换成 ${bound.name || bound.prefix}${from ? `（沿用「${from}」）` : ''}`, presetName || '');
    return true;
  } catch (e) {
    console.warn('应用解析方案绑定失败:', e);
    return false;
  }
}

// 缝合/搬迁改的是存档里的预设；它正好是当前预设时，切换事件早过了，得手动换上一次
export function applyReasoningBindingIfCurrent(presetName, presetData) {
  try {
    if (getSillyTavernContext().chatCompletionSettings?.preset_settings_openai !== presetName) return false;
    return applyReasoningBinding(presetName, getReasoningBinding(presetData));
  } catch {
    return false;
  }
}
