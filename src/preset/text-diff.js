const CHAR_DIFF_LIMIT = 2000;

function lcsOps(a, b) {
  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const ops = [];
  for (let i = 0; i < start; i++) ops.push({ type: 'same', value: a[i] });

  const n = endA - start;
  const m = endB - start;
  const table = new Uint32Array((n + 1) * (m + 1));
  const at = (i, j) => i * (m + 1) + j;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[at(i, j)] =
        a[start + i] === b[start + j] ? table[at(i + 1, j + 1)] + 1 : Math.max(table[at(i + 1, j)], table[at(i, j + 1)]);
    }
  }
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[start + i] === b[start + j]) {
      ops.push({ type: 'same', value: a[start + i] });
      i++;
      j++;
    } else if (table[at(i + 1, j)] >= table[at(i, j + 1)]) {
      ops.push({ type: 'del', value: a[start + i++] });
    } else {
      ops.push({ type: 'add', value: b[start + j++] });
    }
  }
  while (i < n) ops.push({ type: 'del', value: a[start + i++] });
  while (j < m) ops.push({ type: 'add', value: b[start + j++] });

  for (let k = endA; k < a.length; k++) ops.push({ type: 'same', value: a[k] });
  return ops;
}

function pushSegment(out, type, text) {
  if (!text) return;
  const last = out[out.length - 1];
  if (last && last.type === type) last.text += text;
  else out.push({ type, text });
}

// 一两个字的“相同”夹在改动中间时并进改动，免得一句话被切成碎渣
function absorbTinySame(segments) {
  const out = [];
  for (let k = 0; k < segments.length; k++) {
    const seg = segments[k];
    const prev = segments[k - 1];
    const next = segments[k + 1];
    if (seg.type === 'same' && seg.text.length <= 2 && !seg.text.includes('\n') && prev && next && prev.type !== 'same' && next.type !== 'same') {
      pushSegment(out, 'del', seg.text);
      pushSegment(out, 'add', seg.text);
      continue;
    }
    pushSegment(out, seg.type, seg.text);
  }
  // del/add 交错时整理成先删后加
  const merged = [];
  let del = '';
  let add = '';
  const flush = () => {
    pushSegment(merged, 'del', del);
    pushSegment(merged, 'add', add);
    del = '';
    add = '';
  };
  for (const seg of out) {
    if (seg.type === 'del') del += seg.text;
    else if (seg.type === 'add') add += seg.text;
    else {
      flush();
      pushSegment(merged, 'same', seg.text);
    }
  }
  flush();
  return merged;
}

// 返回 [{ type: 'same'|'del'|'add', text }]，del 是只有旧文有的，add 是只有新文有的
function diffText(oldText, newText) {
  const oldLines = String(oldText ?? '').replace(/\r\n/g, '\n').split('\n');
  const newLines = String(newText ?? '').replace(/\r\n/g, '\n').split('\n');
  const lineOps = lcsOps(oldLines, newLines);

  const segments = [];
  let delLines = [];
  let addLines = [];
  const flushChanged = () => {
    if (!delLines.length && !addLines.length) return;
    const oldBlock = delLines.map(l => l + '\n').join('');
    const newBlock = addLines.map(l => l + '\n').join('');
    if (delLines.length && addLines.length && oldBlock.length <= CHAR_DIFF_LIMIT && newBlock.length <= CHAR_DIFF_LIMIT) {
      for (const op of lcsOps([...oldBlock], [...newBlock])) pushSegment(segments, op.type, op.value);
    } else {
      pushSegment(segments, 'del', oldBlock);
      pushSegment(segments, 'add', newBlock);
    }
    delLines = [];
    addLines = [];
  };
  for (const op of lineOps) {
    if (op.type === 'del') delLines.push(op.value);
    else if (op.type === 'add') addLines.push(op.value);
    else {
      flushChanged();
      pushSegment(segments, 'same', op.value + '\n');
    }
  }
  flushChanged();

  const last = segments[segments.length - 1];
  if (last) last.text = last.text.replace(/\n$/, '');
  return absorbTinySame(segments.filter(s => s.text));
}

export { diffText };
