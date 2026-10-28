import { escapeAttr, escapeHtml, getJQuery, getParentWindow } from '../core/utils.js';
import { CommonStyles } from '../styles/common-styles.js';

const MODAL_ID = 'pt-version-move-modal';
const CHANGED_COLOR = '#e8912d';
const OVERWRITE_COLOR = '#d64545';
const COPY_COLOR = '#2e9e5b';

// candidates: [{ name, plan }]，第一个是默认来源。返回 { sourceName, mineIds, useMineIds, overwriteIds } 或 null（跳过）
function showVersionMoveModal({ targetName, candidates }) {
  const $ = getJQuery();
  const parentWindow = getParentWindow();
  const vars = CommonStyles.getVars();
  const doc = parentWindow.document;

  $(`#${MODAL_ID}`, doc).remove();

  const button = (id, text, primary = false) => `
    <button id="${id}" type="button" style="
      border: 1px solid ${vars.borderColor};
      background: ${primary ? `var(--pt-accent-color, ${vars.accentColor})` : vars.inputBg};
      color: ${primary ? `var(--pt-body-color, ${vars.textColor})` : vars.textColor};
      border-radius: 12px; padding: 10px 14px; cursor: pointer;
      font-weight: ${primary ? 800 : 700}; font-size: calc(var(--pt-font-size) * 0.875);
    ">${escapeHtml(text)}</button>`;

  const html = `
    <div id="${MODAL_ID}" style="
      --pt-font-size: ${vars.fontSize};
      ${CommonStyles.getModalBaseStyles({ maxWidth: '640px' })}
      z-index: 10025;
    ">
      <div style="
        background: ${vars.bgColor}; border: 1px solid ${vars.borderColor}; border-radius: ${vars.borderRadius};
        width: min(640px, 95vw); max-height: calc(var(--pt-vh, 1vh) * 88);
        display: flex; flex-direction: column; overflow: hidden; color: ${vars.textColor};
        box-shadow: 0 20px 50px rgba(0,0,0,0.35);
      ">
        <div style="padding: 14px 16px; border-bottom: 1px solid ${vars.borderColor}; background: ${vars.sectionBg};">
          <div style="font-weight: 800; font-size: calc(var(--pt-font-size) * 1.0625);">版本搬迁</div>
          <div style="font-size: calc(var(--pt-font-size) * 0.8125); opacity: 0.85; margin-top: 4px; overflow-wrap: anywhere;">
            把旧版里你自己的条目搬进「${escapeHtml(targetName)}」，位置和分组照旧，搬过去的会打上缝合记号
          </div>
          <label style="display: flex; align-items: center; gap: 8px; margin-top: 10px; font-size: calc(var(--pt-font-size) * 0.8125);">
            <span style="flex: none;">从哪份搬</span>
            <select id="pt-vm-source" style="flex: 1; min-width: 0; padding: 6px 8px; border-radius: 8px; border: 1px solid ${vars.borderColor}; background: ${vars.inputBg}; color: ${vars.textColor};">
              ${candidates
                .map((c, i) => `<option value="${i}">${escapeHtml(c.name)}（你的 ${c.plan.mine.length} 条）</option>`)
                .join('')}
            </select>
          </label>
        </div>
        <div id="pt-vm-body" style="padding: 12px 16px; overflow-y: auto; overflow-x: hidden; flex: 1;"></div>
        <div style="display: flex; gap: 10px; justify-content: flex-end; padding: 12px 16px; border-top: 1px solid ${vars.borderColor};">
          ${button('pt-vm-skip', '跳过')}
          ${button('pt-vm-confirm', '搬过去', true)}
        </div>
      </div>
    </div>`;

  $(doc.body).append(html);

  const row = (attrs, label, extraStyle = '') => `
    <label style="display: flex; align-items: flex-start; gap: 8px; padding: 6px 2px; ${extraStyle}">
      <input type="checkbox" ${attrs} style="flex: none; margin-top: 3px;">
      <span style="min-width: 0; overflow-wrap: anywhere; line-height: 1.45;">${label}</span>
    </label>`;

  function render(index) {
    const { plan } = candidates[index];
    const mineRows = plan.mine
      .map(m =>
        row(
          `class="pt-vm-mine" data-id="${escapeAttr(m.identifier)}" checked`,
          `${escapeHtml(m.name)}${m.inserted ? '' : '<span style="opacity:.6">（没插入）</span>'}`,
        ),
      )
      .join('');
    const box = (id, kind, color) => `
      <label style="flex: none; width: 44px; display: flex; justify-content: center; padding: 4px 0;">
        <input type="checkbox" class="pt-vm-changed pt-vm-${kind}" data-id="${escapeAttr(id)}" style="accent-color: ${color}; width: 18px; height: 18px; box-shadow: 0 0 0 2px ${color}; border-radius: 3px;">
      </label>`;
    const changedRows = plan.changed
      .map(
        c => `
        <div style="display: flex; align-items: center; gap: 4px; padding: 4px 0; border-bottom: 1px dashed ${vars.borderColor};">
          <span style="flex: 1; min-width: 0; overflow-wrap: anywhere; color:${CHANGED_COLOR}; font-weight:700;">${escapeHtml(c.name)}</span>
          ${box(c.identifier, 'overwrite', OVERWRITE_COLOR)}${box(c.identifier, 'copy', COPY_COLOR)}
        </div>`,
      )
      .join('');
    const changedHead = plan.changed.length
      ? `<div style="display: flex; align-items: center; gap: 4px; font-size: calc(var(--pt-font-size) * 0.75); font-weight: 700;">
          <span style="flex: 1;"></span>
          <a href="#" class="pt-vm-col" data-kind="overwrite" style="flex: none; width: 44px; text-align: center; color:${OVERWRITE_COLOR};">覆盖</a>
          <a href="#" class="pt-vm-col" data-kind="copy" style="flex: none; width: 44px; text-align: center; color:${COPY_COLOR};">+缝</a>
        </div>`
      : '';

    $('#pt-vm-body', doc).html(`
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 4px;">
        <b>你的条目（新版里没有）${plan.mine.length} 条</b>
        <span style="flex: none; font-size: calc(var(--pt-font-size) * 0.8125);">
          <a href="#" id="pt-vm-all">全选</a> · <a href="#" id="pt-vm-none">全不选</a>
        </span>
      </div>
      <div style="font-size: calc(var(--pt-font-size) * 0.75); opacity: 0.7; margin-bottom: 4px;">作者在新版删掉的条目也会出现在这里，不想要就取消勾</div>
      ${mineRows || '<div style="opacity:.6">没有</div>'}
      <div style="margin-top: 14px; margin-bottom: 4px;"><b style="color:${CHANGED_COLOR};">两边内容不一样 ${plan.changed.length} 条</b></div>
      <div style="font-size: calc(var(--pt-font-size) * 0.8125); line-height: 1.5; margin-bottom: 6px;">
        <span style="color:${OVERWRITE_COLOR}; font-weight:700;">红色</span>是把旧版条目覆盖到新预设对应条目，<span style="color:${COPY_COLOR}; font-weight:700;">绿色</span>是在对应条目下方移植一个条目，不选择就是使用新版条目
      </div>
      ${changedHead}
      ${changedRows || '<div style="opacity:.6">没有</div>'}
    `);
  }

  render(0);

  return new Promise(resolve => {
    let settled = false;
    const settle = value => {
      if (settled) return;
      settled = true;
      $(`#${MODAL_ID}`, doc).remove();
      resolve(value);
    };

    const $modal = $(`#${MODAL_ID}`, doc);
    $modal.on('change', '#pt-vm-source', function () {
      render(Number($(this).val()) || 0);
    });
    $modal.on('click', '#pt-vm-all, #pt-vm-none', function (e) {
      e.preventDefault();
      $('.pt-vm-mine', doc).prop('checked', this.id === 'pt-vm-all');
    });
    $modal.on('change', '.pt-vm-changed', function () {
      if (!this.checked) return;
      const other = this.classList.contains('pt-vm-overwrite') ? 'copy' : 'overwrite';
      $(`.pt-vm-${other}`, doc).filter((_, el) => el.dataset.id === this.dataset.id).prop('checked', false);
    });
    $modal.on('click', '.pt-vm-col', function (e) {
      e.preventDefault();
      const kind = this.dataset.kind;
      const $col = $(`.pt-vm-${kind}`, doc);
      const turnOn = $col.filter(':not(:checked)').length > 0;
      $col.each((_, el) => {
        el.checked = turnOn;
        if (turnOn) $(el).trigger('change');
      });
    });
    $modal.on('click', '#pt-vm-skip', () => settle(null));
    $modal.on('click', '#pt-vm-confirm', () => {
      const index = Number($('#pt-vm-source', doc).val()) || 0;
      const ids = selector => $(selector, doc).filter(':checked').map((_, el) => String(el.dataset.id)).get();
      settle({
        sourceName: candidates[index].name,
        mineIds: ids('.pt-vm-mine'),
        useMineIds: ids('.pt-vm-copy'),
        overwriteIds: ids('.pt-vm-overwrite'),
      });
    });
  });
}

export { showVersionMoveModal };
