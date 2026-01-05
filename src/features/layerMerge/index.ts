import type { Element, ImageElement } from '@/types';
import { getUiRadiusLg } from '@/ui/standards';
import { computeMergeTargets } from './computeMergeTargets';
import { rasterizeToPng } from './rasterizeToPng';

export interface MergeLayersOptions {
    elements: Element[];
    selectedElementIds: string[];
    mode: 'selected' | 'visible';
    getDescendants: (id: string, all: Element[]) => Element[];
    generateId: () => string;
    zoom: number;
}

export async function mergeLayersToImageElement(
    options: MergeLayersOptions
): Promise<{ newImage: ImageElement; idsToMerge: Set<string> } | null> {
    const { elements, selectedElementIds, mode, getDescendants, generateId, zoom } = options;

    const { idsToMerge, elementsToFlatten } = computeMergeTargets({
        elements,
        selectedElementIds,
        mode,
        getDescendants
    });

    if (elementsToFlatten.length === 0) {
        return null;
    }

    const flattened = await rasterizeToPng(elementsToFlatten, zoom);

    const newImage: ImageElement = {
        id: generateId(),
        type: 'image',
        name: 'Merged Image',
        x: flattened.x,
        y: flattened.y,
        width: flattened.width,
        height: flattened.height,
        href: flattened.href,
        mimeType: flattened.mimeType,
        borderRadius: getUiRadiusLg(),
        isLocked: false,
        isVisible: true,
    };

    return { newImage, idsToMerge };
}
