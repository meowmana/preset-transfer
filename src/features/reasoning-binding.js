// 推理解析方案跟预设走：存预设时把当前方案写进 preset.extensions，切到该预设时换上
import { getJQuery, getSillyTavernContext } from '../core/utils.js';

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

export function applyReasoningBinding(presetName, bound) {
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

    window.toastr?.info?.(`解析方案已换成 ${bound.name || bound.prefix}`, presetName || '');
    return true;
  } catch (e) {
    console.warn('应用解析方案绑定失败:', e);
    return false;
  }
}
