import type { Element } from '@/types';

export interface ComputeMergeTargetsOptions {
    elements: Element[];
    selectedElementIds: string[];
    mode: 'selected' | 'visible';
    getDescendants: (id: string, all: Element[]) => Element[];
}

export interface MergeTargetsResult {
    idsToMerge: Set<string>;
    elementsToFlatten: Element[];
}

export function computeMergeTargets({
    elements,
    selectedElementIds,
    mode,
    getDescendants
}: ComputeMergeTargetsOptions): MergeTargetsResult {
    const idsToMerge = new Set<string>();

    if (mode === 'selected' && selectedElementIds.length > 0) {
        selectedElementIds.forEach(id => {
            idsToMerge.add(id);
            const el = elements.find(e => e.id === id);
            if (el && el.type === 'group') {
                getDescendants(id, elements).forEach(desc => idsToMerge.add(desc.id));
            }
        });
    } else {
        elements.forEach(el => {
            if (el.isVisible !== false) {
                idsToMerge.add(el.id);
                if (el.type === 'group') {
                    getDescendants(el.id, elements).forEach(desc => idsToMerge.add(desc.id));
                }
            }
        });
    }

    const elementsToFlatten = elements.filter(el => idsToMerge.has(el.id) && el.type !== 'group');

    return { idsToMerge, elementsToFlatten };
}
