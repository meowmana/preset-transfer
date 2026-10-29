import { getJQuery } from '../core/utils.js';

export function makeSearchableSelect($select, { label, dropdownParent } = {}) {
  const $ = getJQuery();
  if (!$select?.length || typeof $.fn?.select2 !== 'function') return false;
  $select.select2({
    width: '100%',
    dropdownCssClass: 'pt-preset-list-dropdown',
    ...(dropdownParent ? { dropdownParent } : {}),
    language: { noResults: () => `没有匹配的${label}` },
    templateResult: (item) => (item?.id === '' ? null : item?.text),
  });
  $select.on('select2:open', () => {
    setTimeout(() => {
      const input = document.querySelector('.select2-container--open .select2-search__field');
      if (!input) return;
      input.placeholder = `搜索${label}...`;
      // 手机上别一打开就弹键盘挡住置顶的书，点搜索框再弹
      if (window.matchMedia?.('(pointer: coarse)').matches) input.blur();
    }, 0);
  });
  return true;
}
