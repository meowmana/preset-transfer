function entryName(entry) {
    const comment = String(entry?.comment ?? '').trim();
    if (comment) return comment;
    const firstLine = String(entry?.content ?? '').split('\n').map(s => s.trim()).find(Boolean) || '';
    if (firstLine) return firstLine.slice(0, 20);
    return `世界书条目 ${entry?.uid ?? ''}`.trim();
}

export function worldEntryToPrompt(entry) {
    return {
        name: entryName(entry),
        content: String(entry?.content ?? ''),
        role: 'system',
        system_prompt: false,
        marker: false,
        forbid_overrides: false,
        injection_position: 0,
        injection_depth: 4,
    };
}

// 缝合转移遇到同名条目会整条覆盖，世界书来的条目一律改名避开，不碰预设里原有的
export function avoidNameCollisions(prompts, existingNames, bookName) {
    const taken = new Set(Array.from(existingNames || [], n => String(n ?? '')));
    const suffix = String(bookName ?? '').trim() || '世界书';
    return prompts.map(prompt => {
        let name = prompt.name;
        if (taken.has(name)) {
            const base = `${prompt.name}（${suffix}）`;
            name = base;
            for (let i = 2; taken.has(name); i++) name = `${base}${i}`;
        }
        taken.add(name);
        return name === prompt.name ? prompt : { ...prompt, name };
    });
}
