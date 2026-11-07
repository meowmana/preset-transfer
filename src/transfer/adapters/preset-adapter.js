import { ensureAllEntriesHaveNewFields } from '../../preset/new-version-fields.js';
import { getOrderedPromptEntries, getPresetDataFromManager } from '../../preset/preset-manager.js';
import { getTargetPromptsList } from '../../preset/prompt-order-utils.js';
import { applyGroupingChangesToPresetData } from '../../features/entry-grouping.js';
import { syncNativePromptManagerIfActive } from '../../preset/native-sync.js';
import {
    applyInsertEntryToPreset,
    applyTransferEntriesToPreset,
    applyDeleteEntriesFromPreset,
} from '../../core/preset-data-pure.js';

function withPtKey(entries) {
    return entries.map(entry => ({
        ...entry,
        ptKey: entry?.name || '',
    }));
}

async function insertEntry(apiInfo, targetPreset, newEntry, insertPosition, autoEnable, displayMode = 'default', options = {}) {
    const targetData = getPresetDataFromManager(apiInfo, targetPreset);
    if (!targetData) throw new Error('无法获取目标预设数据');

    const referencePromptList = getTargetPromptsList(targetPreset, 'include_disabled');
    const {
        targetData: updatedTargetData,
        stitchedPrompt,
        resolvedTargetIdentifier,
    } = applyInsertEntryToPreset(targetData, newEntry, insertPosition, autoEnable, {
        ...options,
        referencePromptList,
    });

    const targetGroupId = String(options?.targetGroupId ?? '').trim();
    if (resolvedTargetIdentifier || targetGroupId) {
        const dummyCharacterId = 100001;
        const characterPromptOrder = updatedTargetData.prompt_order?.find(order => order.character_id === dummyCharacterId);
        const orderedIdentifiers = (characterPromptOrder?.order || []).map(entry => String(entry?.identifier ?? '').trim()).filter(Boolean);
        applyGroupingChangesToPresetData(updatedTargetData, orderedIdentifiers, {
            movedIdentifiers: [stitchedPrompt.identifier],
            reassignOptions: { targetIdentifier: resolvedTargetIdentifier, targetGroupId },
        });
    }

    tagBaibaiGroup(updatedTargetData, [stitchedPrompt.identifier], { targetGroupId, targetIdentifier: resolvedTargetIdentifier });
    await apiInfo.presetManager.savePreset(targetPreset, updatedTargetData, { skipUpdate: true });
    await syncNativePromptManagerIfActive(apiInfo, targetPreset, updatedTargetData);
}

// 目标用柏宝箱分组时，把插进来的条目登记进柏宝箱的组：优先点中的组，其次上面那条所在的组。
function tagBaibaiGroup(presetData, identifiers, { targetGroupId, targetIdentifier } = {}) {
    const store = presetData?.extensions?.baibaiToolkit?.presetPromptGroups;
    if (!store || !Array.isArray(store.groups)) return null;
    if (!store.prompts || typeof store.prompts !== 'object') store.prompts = {};

    const exists = id => !!id && store.groups.some(g => String(g?.id ?? '') === id);
    const picked = String(targetGroupId ?? '').trim();
    let groupId = picked.startsWith('baibai:') ? picked.slice('baibai:'.length) : '';
    if (!exists(groupId)) groupId = String(store.prompts[String(targetIdentifier ?? '').trim()]?.groupId ?? '');
    if (!exists(groupId)) return '';

    for (const identifier of identifiers) {
        store.prompts[identifier] = { ...(store.prompts[identifier] || {}), groupId };
    }
    return groupId;
}

// 目标预设用柏宝箱分组时，把整组搬来的条目也登记进柏宝箱的同名组（没有就新建）
function addBaibaiGroups(presetData, groups) {
    const store = presetData?.extensions?.baibaiToolkit?.presetPromptGroups;
    if (!store || !Array.isArray(store.groups)) return false;
    if (!store.prompts || typeof store.prompts !== 'object') store.prompts = {};

    let changed = false;
    for (const group of groups) {
        const name = String(group?.name ?? '').trim() || '分组';
        let target = store.groups.find(g => String(g?.name ?? '').trim() === name);
        if (!target) {
            const maxOrder = store.groups.reduce((m, g) => Math.max(m, Number(g?.order) || 0), -1);
            target = {
                id: `pt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
                name,
                order: maxOrder + 1,
                collapsed: false,
                enabled: true,
            };
            store.groups.push(target);
        }
        for (const identifier of group.memberIdentifiers || []) {
            store.prompts[identifier] = { ...(store.prompts[identifier] || {}), groupId: target.id };
            changed = true;
        }
    }
    return changed;
}

async function transferEntries(
    apiInfo,
    sourcePreset,
    targetPreset,
    selectedEntries,
    insertPosition,
    autoEnable,
    displayMode = 'default',
    options = {},
) {
    const sourceData = getPresetDataFromManager(apiInfo, sourcePreset);
    const targetData = getPresetDataFromManager(apiInfo, targetPreset);
    if (!sourceData || !targetData) throw new Error('无法获取预设数据');

    const referencePromptList = getTargetPromptsList(targetPreset, 'include_disabled');
    const targetGroupId = String(options?.targetGroupId ?? '').trim();
    const selectedGroups = Array.isArray(options?.selectedGroups) ? options.selectedGroups : [];

    const {
        targetData: updatedTargetData,
        insertedOrderEntries,
        transferredIdentifierMap,
        resolvedTargetIdentifier,
    } = applyTransferEntriesToPreset(targetData, selectedEntries, insertPosition, autoEnable, {
        ...options,
        referencePromptList,
    });

    const dummyCharacterId = 100001;
    const characterPromptOrder = updatedTargetData.prompt_order?.find(order => order.character_id === dummyCharacterId);
    const orderedIdentifiers = (characterPromptOrder?.order || []).map(entry => String(entry?.identifier ?? '').trim()).filter(Boolean);

    let preservedGroups = null;
    if (selectedGroups.length > 0) {
        preservedGroups = selectedGroups
            .map(group => {
                const memberIdentifiers = (Array.isArray(group?.entryIdentifiers) ? group.entryIdentifiers : [])
                    .map(identifier => transferredIdentifierMap.get(String(identifier ?? '').trim()))
                    .filter(Boolean);

                if (memberIdentifiers.length === 0) return null;
                return {
                    name: String(group?.name ?? '').trim() || '分组',
                    memberIdentifiers,
                };
            })
            .filter(Boolean);
    }

    const hasReassign = (resolvedTargetIdentifier || targetGroupId) && insertedOrderEntries.length > 0;
    if (hasReassign) {
        tagBaibaiGroup(updatedTargetData, insertedOrderEntries.map(entry => entry.identifier), {
            targetGroupId,
            targetIdentifier: resolvedTargetIdentifier,
        });
    }
    // 两套分组同时建会在提示词面板里套成两层，目标用柏宝箱就只进柏宝箱
    const hasPreserved = !!preservedGroups?.length && !addBaibaiGroups(updatedTargetData, preservedGroups);

    if (hasReassign || hasPreserved) {
        applyGroupingChangesToPresetData(updatedTargetData, orderedIdentifiers, {
            movedIdentifiers: hasReassign ? insertedOrderEntries.map(entry => entry.identifier) : null,
            reassignOptions: { targetIdentifier: resolvedTargetIdentifier, targetGroupId },
            preservedGroups: hasPreserved ? preservedGroups : null,
        });
    }

    await apiInfo.presetManager.savePreset(targetPreset, updatedTargetData, { skipUpdate: true });
    await syncNativePromptManagerIfActive(apiInfo, targetPreset, updatedTargetData);
}

async function deleteEntries(apiInfo, presetName, selectedEntries) {
    const sourceData = getPresetDataFromManager(apiInfo, presetName);
    if (!sourceData) throw new Error('无法获取源预设数据');

    const { presetData: updatedSourceData } = applyDeleteEntriesFromPreset(sourceData, selectedEntries);

    await apiInfo.presetManager.savePreset(presetName, updatedSourceData, { skipUpdate: true });
    await syncNativePromptManagerIfActive(apiInfo, presetName, updatedSourceData);
}

export function createPresetTransferAdapter() {
    return {
        id: 'preset',
        ui: {
            toolTitle: '预设条目转移工具',
            containerLabel: '预设',
        },
        capabilities: {
            supportsInsertPosition: true,
            supportsUninsertedMode: true,
            supportsEdit: true,
            supportsCopy: true,
            supportsMove: true,
            supportsCompare: true,
            supportsBatchDeleteContainers: true,
        },
        async listContainers(apiInfo) {
            return Array.isArray(apiInfo?.presetNames) ? apiInfo.presetNames.slice() : [];
        },
        async getEntries(apiInfo, name, displayMode) {
            const presetData = getPresetDataFromManager(apiInfo, name);
            const entries = ensureAllEntriesHaveNewFields(getOrderedPromptEntries(presetData, displayMode));
            return withPtKey(entries);
        },
        async transfer(apiInfo, params) {
            return await transferEntries(
                apiInfo,
                params.sourceContainer,
                params.targetContainer,
                params.entries,
                params.insertPosition,
                params.autoEnable,
                params.displayMode,
                {
                    targetGroupId: params.targetGroupId,
                    targetIdentifier: params.targetIdentifier,
                    selectedGroups: params.selectedGroups,
                },
            );
        },
        async deleteEntries(apiInfo, params) {
            return await deleteEntries(apiInfo, params.container, params.entries);
        },
        async insertEntry(apiInfo, params) {
            return await insertEntry(
                apiInfo,
                params.container,
                params.entry,
                params.insertPosition,
                params.autoEnable,
                params.displayMode,
                {
                    targetGroupId: params.targetGroupId,
                    targetIdentifier: params.targetIdentifier,
                    selectedGroups: params.selectedGroups,
                },
            );
        },
    };
}
