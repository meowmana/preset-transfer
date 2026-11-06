export const REASONING_BINDING_KEY = 'ptReasoningBinding';

export function readReasoningBinding(presetData) {
  const b = presetData?.extensions?.[REASONING_BINDING_KEY];
  return b && b.prefix && b.suffix ? b : null;
}

// 新版自己绑过就不动；没绑过才把旧版的带过去
export function carryReasoningBinding(binding, targetData) {
  if (!binding || !binding.prefix || !binding.suffix || !targetData) return false;
  if (readReasoningBinding(targetData)) return false;
  if (!targetData.extensions || typeof targetData.extensions !== 'object') targetData.extensions = {};
  targetData.extensions[REASONING_BINDING_KEY] = { ...binding };
  return true;
}
