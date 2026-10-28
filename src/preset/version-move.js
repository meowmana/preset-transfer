import { ensureUniqueIdentifier } from '../core/utils.js';
import { getNameMatchKey } from './entry-match-utils.js';
import { applyStitchPatch, extractStitchPatch } from './stitch-patch.js';
import { assignNewStitchMeta, getStitchId, isStitchEntry, PT_META_FIELD, PT_META_NAMESPACE } from './stitch-meta.js';

const DUMMY_CHARACTER_ID = 100001;
const BUILTIN_PROMPT_IDS = new Set([
  'main', 'nsfw', 'dialogueExamples', 'jailbreak', 'chatHistory', 'worldInfoAfter', 'worldInfoBefore',
  'enhanceDefinitions', 'charDescription', 'charPersonality', 'scenario', 'personaDescription',
]);

function cloneDeep(value) {
  try {
    return structuredClone(value);
  } catch {
    return JSON.parse(JSON.stringify(value));
  }
}

function getOrderIds(presetData) {
  const order = (presetData?.prompt_order ?? []).find(o => o && o.character_id === DUMMY_CHARACTER_ID);
  return (Array.isArray(order?.order) ? order.order : []).map(o => o?.identifier).filter(Boolean);
}

function normalizeContent(text) {
  return typeof text === 'string' ? text.replace(/\r\n/g, '\n').trim() : '';
}

// 旧版的条目按“新版里找不找得到同一条”分两类：找不到的算用户自己的，找得到但内容不同的标出来
function planVersionMove(oldData, newData) {
  const oldPrompts = (Array.isArray(oldData?.prompts) ? oldData.prompts : []).filter(p => p?.identifier);
  const newPrompts = (Array.isArray(newData?.prompts) ? newData.prompts : []).filter(p => p?.identifier);

  const newById = new Map(newPrompts.map(p => [p.identifier, p]));
  const newByNameKey = new Map();
  for (const p of newPrompts) {
    const key = getNameMatchKey(p.name);
    if (key && !newByNameKey.has(key)) newByNameKey.set(key, p);
  }

  const orderIds = getOrderIds(oldData);
  const inOrder = new Set(orderIds);
  const oldById = new Map(oldPrompts.map(p => [p.identifier, p]));
  const sequence = [...orderIds.filter(id => oldById.has(id)), ...oldPrompts.map(p => p.identifier).filter(id => !inOrder.has(id))];

  const mine = [];
  const changed = [];
  for (const identifier of sequence) {
    if (BUILTIN_PROMPT_IDS.has(identifier)) continue;
    const prompt = oldById.get(identifier);
    const counterpart = newById.get(identifier) ?? newByNameKey.get(getNameMatchKey(prompt.name));
    const name = typeof prompt.name === 'string' && prompt.name.trim() ? prompt.name : identifier;
    if (!counterpart) {
      mine.push({ identifier, name, inserted: inOrder.has(identifier) });
      continue;
    }
    if (isStitchEntry(counterpart)) continue;
    if (normalizeContent(prompt.content) !== normalizeContent(counterpart.content)) {
      changed.push({ identifier, name, targetIdentifier: counterpart.identifier });
    }
  }

  return { mine, changed };
}

function stripStitchMeta(prompt) {
  const root = prompt?.[PT_META_FIELD];
  if (!root || typeof root !== 'object') return prompt;
  const next = { ...prompt, [PT_META_FIELD]: { ...root } };
  delete next[PT_META_FIELD][PT_META_NAMESPACE];
  if (Object.keys(next[PT_META_FIELD]).length === 0) delete next[PT_META_FIELD];
  return next;
}

// 选中的用户条目当成缝合条目搬进新版（沿用原记号，没有就新打一个），留在原来的邻居和组旁边
function applyVersionMove(oldData, newData, plan, choices = {}) {
  const mineIds = new Set(choices.mineIds ?? plan.mine.map(m => m.identifier));
  const useMineIds = new Set(choices.useMineIds ?? []);
  const overwriteIds = new Set(choices.overwriteIds ?? []);
  const now = new Date().toISOString();

  const source = cloneDeep(oldData);
  source.prompts = (source.prompts ?? []).map(p => {
    if (!p?.identifier) return p;
    if (mineIds.has(p.identifier)) return getStitchId(p) ? p : assignNewStitchMeta(p, { now });
    return isStitchEntry(p) ? stripStitchMeta(p) : p;
  });

  let moved = { addedPrompts: 0, updatedPrompts: 0, insertedOrder: 0, groupedStitches: 0 };
  if (mineIds.size > 0) {
    moved = applyStitchPatch(newData, extractStitchPatch(source));
  }

  // 两边都有、内容不同的：缝一份＝把旧版那份复制一条缝到作者那条正下方，先关着；覆盖＝作者那条只换内容
  let copied = 0;
  let overwritten = 0;
  const oldById = new Map((oldData.prompts ?? []).filter(p => p?.identifier).map(p => [p.identifier, p]));
  const order = (newData.prompt_order ?? []).find(o => o && o.character_id === DUMMY_CHARACTER_ID);
  const store = newData.extensions?.baibaiToolkit?.presetPromptGroups;
  for (const item of plan.changed) {
    const mineVersion = oldById.get(item.identifier);
    if (!mineVersion) continue;
    if (overwriteIds.has(item.identifier)) {
      const target = newData.prompts.find(x => x?.identifier === item.targetIdentifier);
      if (target) {
        target.content = mineVersion.content;
        overwritten += 1;
      }
      continue;
    }
    if (!useMineIds.has(item.identifier)) continue;
    const copy = assignNewStitchMeta(stripStitchMeta(cloneDeep(mineVersion)), { now });
    copy.identifier = ensureUniqueIdentifier(newData, `${item.identifier}-feng`);
    copy.name = `${item.name}（缝）`;
    newData.prompts.push(copy);
    if (Array.isArray(order?.order)) {
      const at = order.order.findIndex(o => o?.identifier === item.targetIdentifier);
      if (at !== -1) order.order.splice(at + 1, 0, { identifier: copy.identifier, enabled: false });
    }
    const groupId = store?.prompts?.[item.targetIdentifier]?.groupId;
    if (groupId) store.prompts[copy.identifier] = { groupId };
    copied += 1;
  }

  return { moved: moved.addedPrompts + moved.updatedPrompts, grouped: moved.groupedStitches ?? 0, copied, overwritten };
}

export { planVersionMove, applyVersionMove };
