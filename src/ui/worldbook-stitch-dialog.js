import { getCurrentCharacterWorldbooks } from '../core/worldbook-api.js';
import { escapeHtml, getJQuery } from '../core/utils.js';
import { worldEntryToPrompt } from '../preset/worldbook-to-prompt.js';
import { CommonStyles } from '../styles/common-styles.js';
import { createWorldbookTransferAdapter } from '../transfer/adapters/worldbook-adapter.js';
import { makeSearchableSelect } from './searchable-select.js';

const DIALOG_ID = 'pt-wb-stitch-dialog';

const opaque = color => String(color).replace(/rgba\(([^,]+),([^,]+),([^,]+),[^)]*\)/, 'rgb($1,$2,$3)');

function dialogHtml(names, pinnedNames) {
    const vars = CommonStyles.getVars();
    const opt = n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`;
    const pinned = pinnedNames.filter(n => names.includes(n));
    const options = pinned.length
        ? `<optgroup label="当前角色">${pinned.map(opt).join('')}</optgroup><optgroup label="其他世界书">${names.filter(n => !pinned.includes(n)).map(opt).join('')}</optgroup>`
        : names.map(opt).join('');
    const btn = `background:transparent;color:${vars.textColor};border:1px solid ${vars.borderColor};border-radius:8px;padding:6px 14px;box-shadow:none;font-size:inherit;`;
    return `
    <div id="${DIALOG_ID}" style="position:fixed;top:0;left:0;width:100vw;height:calc(var(--pt-vh, 1vh) * 100);z-index:100000;background:rgba(0,0,0,.6);display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:calc(16px + env(safe-area-inset-top)) 12px 16px;box-sizing:border-box;">
      <div style="width:min(560px,100%);max-height:calc(var(--pt-vh, 1vh) * 100 - 40px);margin:auto 0;display:flex;flex-direction:column;gap:10px;padding:16px;box-sizing:border-box;border-radius:14px;background:${opaque(vars.bgColor)};color:${vars.textColor};border:1px solid ${vars.borderColor};">
        <div style="font-weight:600;">从世界书缝入</div>
        <select class="pt-wb-stitch-book" style="width:100%;padding:8px;border-radius:8px;background:${vars.inputBg};color:${vars.textColor};border:1px solid ${vars.inputBorder};">
          <option value="">选一本世界书</option>${options}
        </select>
        <div style="display:flex;gap:8px;align-items:center;font-size:.875em;">
          <button type="button" class="pt-wb-stitch-all" style="${btn}">全选</button>
          <button type="button" class="pt-wb-stitch-none" style="${btn}">全不选</button>
          <span class="pt-wb-stitch-count" style="margin-left:auto;color:${vars.tipColor};"></span>
        </div>
        <div class="pt-wb-stitch-list" style="flex:1;min-height:120px;overflow-y:auto;overflow-x:hidden;border:1px solid ${vars.borderColor};border-radius:8px;padding:4px;"></div>
        <div style="font-size:.8em;color:${vars.tipColor};">勾好后点“选位置”，再点预设里的一个条目，缝到它后面（会跟着进它所在的组）。和预设里重名的会自动加上书名，不会盖掉原来的。</div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button type="button" class="pt-wb-stitch-cancel" style="${btn}">取消</button>
          <button type="button" class="pt-wb-stitch-go" disabled style="background:var(--pt-accent-color);color:var(--pt-body-color);border:none;border-radius:8px;padding:6px 16px;font-weight:600;box-shadow:none;">选位置</button>
        </div>
      </div>
    </div>`;
}

function rowHtml(entry, index) {
    const vars = CommonStyles.getVars();
    const title = entry.name.trim() || '（无标题）';
    const preview = entry.content.replace(/\s+/g, ' ').trim().slice(0, 60);
    const tag = `${entry.role}${entry.enabled ? '' : ' · 已关'}`;
    return `
      <label style="display:flex;gap:8px;align-items:flex-start;padding:8px 6px;border-bottom:1px solid ${vars.borderColor};cursor:pointer;">
        <input type="checkbox" class="pt-wb-stitch-pick" data-index="${index}" style="margin-top:3px;flex:none;">
        <span style="min-width:0;flex:1;">
          <span style="display:block;word-break:break-word;">${escapeHtml(title)} <small style="color:${vars.tipColor};">${escapeHtml(tag)}</small></span>
          <small style="display:block;color:${vars.tipColor};word-break:break-word;">${escapeHtml(preview)}</small>
        </span>
      </label>`;
}

export async function openWorldbookStitchDialog(apiInfo) {
    const $ = getJQuery();
    const adapter = createWorldbookTransferAdapter();
    let names;
    try {
        names = await adapter.listContainers(apiInfo);
    } catch (error) {
        alert('读不到世界书列表: ' + error.message);
        return;
    }
    if (!names.length) {
        alert('还没有世界书');
        return;
    }

    $(`#${DIALOG_ID}`).remove();
    const $host = $('#preset-transfer-modal');
    let pinnedNames = [];
    try {
        pinnedNames = await getCurrentCharacterWorldbooks();
    } catch {
        pinnedNames = [];
    }
    ($host.length ? $host : $('body')).append(dialogHtml(names, pinnedNames));
    const $dialog = $(`#${DIALOG_ID}`);
    makeSearchableSelect($dialog.find('.pt-wb-stitch-book'), { label: '世界书', dropdownParent: $dialog });
    let entries = [];
    let bookName = '';

    const updateCount = () => {
        const n = $dialog.find('.pt-wb-stitch-pick:checked').length;
        $dialog.find('.pt-wb-stitch-count').text(entries.length ? `已选 ${n}/${entries.length}` : '');
        $dialog.find('.pt-wb-stitch-go').prop('disabled', n === 0);
    };
    const close = () => $dialog.remove();

    $dialog.on('click', e => { if (e.target === $dialog[0]) close(); });
    $dialog.find('.pt-wb-stitch-cancel').on('click', close);
    $dialog.find('.pt-wb-stitch-all').on('click', () => { $dialog.find('.pt-wb-stitch-pick').prop('checked', true); updateCount(); });
    $dialog.find('.pt-wb-stitch-none').on('click', () => { $dialog.find('.pt-wb-stitch-pick').prop('checked', false); updateCount(); });
    $dialog.on('change', '.pt-wb-stitch-pick', updateCount);

    $dialog.find('.pt-wb-stitch-book').on('change', async function () {
        bookName = String($(this).val() ?? '');
        const $list = $dialog.find('.pt-wb-stitch-list').empty();
        entries = [];
        updateCount();
        if (!bookName) return;
        try {
            entries = await adapter.getEntries(apiInfo, bookName, 'default');
        } catch (error) {
            $list.text('读不出这本: ' + error.message);
            return;
        }
        $list.html(entries.length ? entries.map(rowHtml).join('') : '这本是空的');
        updateCount();
    });

    $dialog.find('.pt-wb-stitch-go').on('click', () => {
        const picked = $dialog
            .find('.pt-wb-stitch-pick:checked')
            .map((_, el) => entries[Number($(el).data('index'))])
            .get()
            .filter(Boolean);
        if (!picked.length) return;
        window.transferMode = {
            apiInfo,
            fromSide: 'worldbook',
            toSide: null,
            selectedEntries: picked.map(e => worldEntryToPrompt(e.raw)),
            selectedGroups: [],
            sourceContainer: '',
            worldbookName: bookName,
        };
        close();
        $('#left-side, #right-side, #single-container').addClass('transfer-target');
        alert(`已拿起《${bookName}》的 ${picked.length} 条。点预设里的一个条目，缝到它后面。`);
    });
}
