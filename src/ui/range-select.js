const STYLE_ID = 'pt-range-select-style';
const HOLD_MS = 500;
const MOVE_LIMIT = 10;

function ensureStyle(doc) {
    if (doc.getElementById(STYLE_ID)) return;
    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .pt-range-list .pt-range-item { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }
      .pt-range-anchor {
        position: relative;
        outline: 2px dashed var(--pt-body-color, currentColor) !important; outline-offset: -3px;
        background-image: linear-gradient(rgba(127, 127, 127, 0.22), rgba(127, 127, 127, 0.22)) !important;
      }
      .pt-range-anchor::after {
        content: '起点 · 点另一条勾上中间';
        position: absolute; top: -9px; right: 8px; z-index: 11; pointer-events: none;
        padding: 0 6px; border-radius: 6px; font-size: 11px; line-height: 16px; white-space: nowrap;
        background: rgba(0, 0, 0, 0.8); color: #fff; border: 1px solid var(--pt-body-color, #fff);
      }
    `;
    doc.head.appendChild(style);
}

const isShown = el => el.getClientRects().length > 0;

export function bindRangeSelect(list, { itemSelector, checkboxSelector, ignoreSelector = 'button', canSelect = () => true }) {
    if (!list || list.ptRangeSelect) return list?.ptRangeSelect;
    ensureStyle(list.ownerDocument);
    list.classList.add('pt-range-list');

    let anchor = null;
    let last = null;
    let press = null;
    let swallowClickUntil = 0;

    const itemOf = target => {
        if (!(target instanceof Element) || target.closest(ignoreSelector)) return null;
        const item = target.closest(itemSelector);
        return item && list.contains(item) ? item : null;
    };
    const boxOf = item => item.querySelector(checkboxSelector);
    const clearAnchor = () => {
        anchor?.classList.remove('pt-range-anchor');
        anchor = null;
    };
    const setAnchor = item => {
        clearAnchor();
        anchor = item;
        item.classList.add('pt-range-anchor');
        navigator.vibrate?.(15);
    };
    const markItems = () => list.querySelectorAll(itemSelector).forEach(el => el.classList.add('pt-range-item'));

    const fillRange = (from, to, checked) => {
        const all = [...list.querySelectorAll(itemSelector)];
        const a = all.indexOf(from);
        const b = all.indexOf(to);
        if (a < 0 || b < 0) return 0;
        const span = all.slice(Math.min(a, b), Math.max(a, b) + 1).filter(el => el === from || el === to || isShown(el));
        let changed = 0;
        for (const item of span) {
            const box = boxOf(item);
            if (!box || box.checked === checked) continue;
            box.checked = checked;
            box.indeterminate = false;
            box.dispatchEvent(new Event('change', { bubbles: true }));
            changed += 1;
        }
        return changed;
    };

    const swallow = e => {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
    };

    const onClick = e => {
        if (Date.now() < swallowClickUntil) {
            swallowClickUntil = 0;
            swallow(e);
            return;
        }
        const item = itemOf(e.target);
        if (!item) return;
        if (!canSelect(item)) {
            clearAnchor();
            return;
        }
        if (anchor && !anchor.isConnected) clearAnchor();
        if (last && !last.isConnected) last = null;

        if (anchor) {
            swallow(e);
            if (item !== anchor) fillRange(anchor, item, true);
            last = item;
            clearAnchor();
            return;
        }
        if (e.shiftKey && last && last !== item) {
            swallow(e);
            fillRange(last, item, !!boxOf(last)?.checked);
            last = item;
            return;
        }
        last = item;
    };

    const endPress = () => {
        if (press) clearTimeout(press.timer);
        press = null;
    };
    const onPointerDown = e => {
        endPress();
        if (e.button != null && e.button !== 0 && e.pointerType === 'mouse') return;
        const item = itemOf(e.target);
        if (!item || !canSelect(item)) return;
        markItems();
        press = { item, id: e.pointerId, x: e.clientX, y: e.clientY, held: false };
        press.timer = setTimeout(() => {
            if (press) press.held = true;
        }, HOLD_MS);
    };
    const onPointerMove = e => {
        if (!press || e.pointerId !== press.id) return;
        if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > MOVE_LIMIT) endPress();
    };
    const onPointerUp = e => {
        if (!press || e.pointerId !== press.id) return;
        const { item, held } = press;
        endPress();
        if (!held || !item.isConnected) return;
        if (anchor === item) clearAnchor();
        else setAnchor(item);
        swallowClickUntil = Date.now() + 800;
    };
    const onContextMenu = e => {
        if (press?.held || Date.now() < swallowClickUntil) e.preventDefault();
    };
    const onMouseDown = e => {
        if (e.shiftKey && itemOf(e.target)) e.preventDefault();
    };

    list.addEventListener('click', onClick, true);
    list.addEventListener('pointerdown', onPointerDown);
    list.addEventListener('pointermove', onPointerMove);
    list.addEventListener('pointerup', onPointerUp);
    list.addEventListener('pointercancel', endPress);
    list.addEventListener('contextmenu', onContextMenu);
    list.addEventListener('mousedown', onMouseDown);
    markItems();

    const api = {
        clearAnchor,
        get anchor() {
            return anchor;
        },
    };
    list.ptRangeSelect = api;
    return api;
}
