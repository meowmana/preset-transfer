import { getPresetDataFromManager } from '../preset/preset-manager.js';

async function saveEntryChanges(apiInfo, presetName, originalEntry, updatedEntry) {
  try {
    const presetData = getPresetDataFromManager(apiInfo, presetName);
    if (!presetData) throw new Error('无法获取预设数据');

    if (!presetData.prompts) presetData.prompts = [];

    // 查找要更新的条目
    // 先按 identifier 找：用“在此处新建”建出的几条都叫“新提示词”，按名字会改到别的那条
    let entryIndex = originalEntry.identifier
      ? presetData.prompts.findIndex(p => p.identifier === originalEntry.identifier)
      : -1;
    if (entryIndex === -1) entryIndex = presetData.prompts.findIndex(p => p.name === originalEntry.name);

    if (entryIndex === -1) {
      throw new Error(`未找到条目 "${originalEntry.name}"`);
    }

    // 检查新名称是否与其他条目冲突（除了当前条目）
    const nameConflict = presetData.prompts.find((p, index) => index !== entryIndex && p.name === updatedEntry.name);

    if (nameConflict) {
      throw new Error(`条目名称 "${updatedEntry.name}" 已存在`);
    }

    // 更新条目，确保保留所有字段包括新版本字段
    const existingPrompt = presetData.prompts[entryIndex];
    presetData.prompts[entryIndex] = {
      ...existingPrompt, // 保留所有现有字段
      name: updatedEntry.name,
      role: updatedEntry.role,
      content: updatedEntry.content,
      injection_depth: updatedEntry.injection_depth,
      injection_position: updatedEntry.injection_position,
      injection_order: updatedEntry.injection_order,
      injection_trigger: updatedEntry.injection_trigger,
      // 确保保留其他可能的字段如 forbid_overrides, system_prompt 等
      forbid_overrides: existingPrompt.forbid_overrides || false,
      system_prompt: existingPrompt.system_prompt || false,
      marker: existingPrompt.marker || false,
    };

    // 保存预设
    await apiInfo.presetManager.savePreset(presetName, presetData);
    console.log(`条目 "${originalEntry.name}" 已更新为 "${updatedEntry.name}"`);
  } catch (error) {
    console.error('保存条目更改失败:', error);
    throw error;
  }
}


export {
  saveEntryChanges
};
