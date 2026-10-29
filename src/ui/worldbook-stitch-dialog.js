import { getCurrentCharacterWorldbooks } from '../core/worldbook-api.js';
import { escapeHtml, getJQuery } from '../core/utils.js';
import { worldEntryToPrompt } from '../preset/worldbook-to-prompt.js';
import { CommonStyles } from '../styles/common-styles.js';
import { createWorldbookTransferAdapter } from '../transfer/adapters/worldbook-adapter.js';
import { makeSearchableSelect } from './searchable-select.js';
import { createWorldbookEditEntryModal } from '../worldbook/edit-modal.js';

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
    <div id="${DIALOG_ID}" style="position:fixed;top:0;left:0;right:0;z-index:100000;display:flex;justify-content:center;padding:calc(8px + env(safe-area-inset-top)) 8px 0;box-sizing:border-box;pointer-events:none;">
      <div class="pt-wb-stitch-panel" style="pointer-events:auto;width:min(560px,100%);height:calc(var(--pt-vh, 1vh) * 50);display:flex;flex-direction:column;gap:8px;padding:12px;box-sizing:border-box;border-radius:14px;background:${opaque(vars.bgColor)};color:${vars.textColor};border:1px solid ${vars.borderColor};box-shadow:0 6px 18px rgba(0,0,0,.35);">
        <style>
          #preset-transfer-modal.pt-wb-docked { align-items:flex-start !important; padding-top:calc(var(--pt-wb-dock-h, 0px) + 8px) !important; }
          #preset-transfer-modal.pt-wb-docked .transfer-modal-content { max-height:calc(var(--pt-vh, 1vh) * 100 - var(--pt-wb-dock-h, 0px) - 32px) !important; overflow-y:auto !important; }
          #${DIALOG_ID}.pt-wb-folded .pt-wb-stitch-panel { height:auto !important; }
          #${DIALOG_ID}.pt-wb-folded .pt-wb-stitch-body { display:none !important; }
          #${DIALOG_ID}:not(.pt-wb-folded) .pt-wb-stitch-mini { display:none; }
        </style>
        <div style="display:flex;align-items:center;gap:8px;">
          <div style="font-weight:600;flex:1;min-width:0;">从世界书缝入<small class="pt-wb-stitch-mini" style="font-weight:400;color:${vars.tipColor};"></small></div>
          <button type="button" class="pt-wb-stitch-fold" title="缩小" style="${btn}width:32px;height:28px;padding:0;line-height:1;font-size:1.1em;">−</button>
        </div>
        <div class="pt-wb-stitch-body" style="flex:1;min-height:0;display:flex;flex-direction:column;gap:8px;">
        <select class="pt-wb-stitch-book" style="width:100%;padding:8px;border-radius:8px;background:${vars.inputBg};color:${vars.textColor};border:1px solid ${vars.inputBorder};">
          <option value="">选一本世界书</option>${options}
        </select>
        <div style="display:flex;gap:8px;align-items:center;font-size:.875em;">
          <button type="button" class="pt-wb-stitch-all" style="${btn}">全选</button>
          <button type="button" class="pt-wb-stitch-none" style="${btn}">全不选</button>
          <span class="pt-wb-stitch-count" style="margin-left:auto;color:${vars.tipColor};"></span>
        </div>
        <div class="pt-wb-stitch-list" style="flex:1;min-height:120px;overflow-y:auto;overflow-x:hidden;border:1px solid ${vars.borderColor};border-radius:8px;padding:4px;"></div>
        <div class="pt-wb-stitch-tip" style="font-size:.8em;color:${vars.tipColor};">勾上条目，点下面预设里的条目，缝到它后面。缝完接着勾下一条。</div>
        <div style="display:flex;gap:8px;justify-content:flex-end;">
          <button type="button" class="pt-wb-stitch-cancel" style="background:var(--pt-accent-color);color:var(--pt-body-color);border:none;border-radius:8px;padding:6px 16px;font-weight:600;box-shadow:none;">缝完了，关掉</button>
        </div>
        </div>
      </div>
    </div>`;
}

function rowHtml(entry, index) {
    const vars = CommonStyles.getVars();
    const title = entry.name.trim() || '（无标题）';
    const preview = entry.content.replace(/\s+/g, ' ').trim().slice(0, 60);
    const tag = `${entry.role}${entry.enabled ? '' : ' · 已关'}`;
    const done = `<small class="pt-wb-stitch-done" style="display:none;color:${vars.textColor};font-weight:600;"> ✓ 已缝</small>`;
    return `
      <label style="display:flex;gap:8px;align-items:flex-start;padding:8px 6px;border-bottom:1px solid ${vars.borderColor};cursor:pointer;">
        <input type="checkbox" class="pt-wb-stitch-pick" data-index="${index}" style="margin-top:3px;flex:none;">
        <span style="min-width:0;flex:1;">
          <span style="display:block;word-break:break-word;">${escapeHtml(title)} <small style="color:${vars.tipColor};">${escapeHtml(tag)}</small>${done}</span>
          <small style="display:block;color:${vars.tipColor};word-break:break-word;">${escapeHtml(preview)}</small>
          <button type="button" class="pt-wb-stitch-edit" data-index="${index}" style="margin-top:4px;background:transparent;color:${vars.textColor};border:1px solid ${vars.borderColor};border-radius:6px;padding:2px 10px;box-shadow:none;font-size:.8em;">编辑</button>
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

    window.ptWorldbookStitchClose?.();
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
    makeSearchableSelect($dialog.find('.pt-wb-stitch-book'), { label: '世界书', dropdownParent: $dialog.find('.pt-wb-stitch-panel') });
    let entries = [];
    let bookName = '';

    const disarm = () => {
        if (window.transferMode?.fromSide === 'worldbook') window.transferMode = null;
        $('#left-side, #right-side, #single-container').removeClass('transfer-target');
    };
    const pickedIndexes = () =>
        $dialog.find('.pt-wb-stitch-pick:checked').map((_, el) => Number($(el).data('index'))).get();
    const arm = () => {
        const indexes = pickedIndexes();
        const picked = indexes.map(i => entries[i]).filter(Boolean);
        if (!picked.length) {
            disarm();
            return;
        }
        window.transferMode = {
            apiInfo,
            fromSide: 'worldbook',
            toSide: null,
            selectedEntries: picked.map(e => worldEntryToPrompt(e.raw)),
            selectedGroups: [],
            sourceContainer: '',
            worldbookName: bookName,
            ptStitchIndexes: indexes,
        };
        $('#left-side, #right-side, #single-container').addClass('transfer-target');
    };
    const updateCount = () => {
        const n = $dialog.find('.pt-wb-stitch-pick:checked').length;
        $dialog.find('.pt-wb-stitch-count').text(entries.length ? `已选 ${n}/${entries.length}` : '');
        $dialog.find('.pt-wb-stitch-mini').text(bookName ? ` · ${bookName} · 已选 ${n}` : '');
        arm();
    };
    const onStitched = e => {
        const indexes = Array.isArray(e.detail?.indexes) ? e.detail.indexes : [];
        if (e.detail?.ok) {
            for (const i of indexes) {
                const $pick = $dialog.find(`.pt-wb-stitch-pick[data-index="${i}"]`);
                $pick.prop('checked', false);
                $pick.closest('label').find('.pt-wb-stitch-done').show();
            }
        }
        updateCount();
    };
    // Reloading the entry list resets transferMode; re-arm right before a tap on the preset lands.
    const rearmBeforeTap = e => {
        if (window.transferMode || !$(e.target).closest('#left-side, #right-side, #single-container').length) return;
        arm();
    };
    const close = () => {
        window.removeEventListener('pt-worldbook-stitched', onStitched);
        document.removeEventListener('click', rearmBeforeTap, true);
        disarm();
        dockObserver?.disconnect();
        $host.removeClass('pt-wb-docked').css('--pt-wb-dock-h', '');
        $dialog.remove();
        if (window.ptWorldbookStitchClose === close) window.ptWorldbookStitchClose = null;
    };
    window.ptWorldbookStitchClose = close;
    window.addEventListener('pt-worldbook-stitched', onStitched);
    document.addEventListener('click', rearmBeforeTap, true);

    const $panel = $dialog.find('.pt-wb-stitch-panel');
    const syncDock = () => $host.css('--pt-wb-dock-h', `${Math.ceil($panel[0].getBoundingClientRect().bottom)}px`);
    const dockObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(syncDock) : null;
    if ($host.length) {
        $host.addClass('pt-wb-docked');
        syncDock();
        dockObserver?.observe($panel[0]);
    }
    $dialog.find('.pt-wb-stitch-fold').on('click', function () {
        const folded = $dialog.toggleClass('pt-wb-folded').hasClass('pt-wb-folded');
        $(this).text(folded ? '+' : '−').attr('title', folded ? '展开' : '缩小');
        syncDock();
    });
    $dialog.find('.pt-wb-stitch-cancel').on('click', close);
    $dialog.find('.pt-wb-stitch-all').on('click', () => { $dialog.find('.pt-wb-stitch-pick').prop('checked', true); updateCount(); });
    $dialog.find('.pt-wb-stitch-none').on('click', () => { $dialog.find('.pt-wb-stitch-pick').prop('checked', false); updateCount(); });
    $dialog.on('change', '.pt-wb-stitch-pick', updateCount);

    $dialog.on('click', '.pt-wb-stitch-edit', async function (e) {
        e.preventDefault();
        e.stopPropagation();
        const entry = entries[Number($(this).data('index'))];
        if (!entry) return;
        const book = bookName;
        $dialog.hide();
        createWorldbookEditEntryModal(apiInfo, book, entry);
        while ($('#pt-worldbook-edit-modal').length) await new Promise(r => setTimeout(r, 300));
        if (!$dialog.closest('body').length) return;
        $dialog.show();
        if (book !== bookName) return;
        const checked = pickedIndexes();
        const done = $dialog.find('.pt-wb-stitch-done').map((i, el) => ($(el).css('display') !== 'none' ? i : null)).get();
        try {
            entries = await adapter.getEntries(apiInfo, book, 'default');
        } catch {
            return;
        }
        $dialog.find('.pt-wb-stitch-list').html(entries.length ? entries.map(rowHtml).join('') : '这本是空的');
        for (const i of checked) $dialog.find(`.pt-wb-stitch-pick[data-index="${i}"]`).prop('checked', true);
        for (const i of done) $dialog.find('.pt-wb-stitch-done').eq(i).show();
        updateCount();
    });

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
}
