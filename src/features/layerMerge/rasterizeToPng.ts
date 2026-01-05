import type { Element, ImageElement } from '@/types';
import { getElementBounds, computeImageClip } from '@/utils/canvas';

const fetchImageAsDataUrl = async (url: string): Promise<string> => {
    if (url.startsWith('data:')) return url;
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.warn(`[LayerMerge] Failed to convert image to data URL: ${url}`, error);
        return url; // Fallback to original URL
    }
};

export const rasterizeToPng = async (
    elementsToFlatten: Element[],
    zoom: number
): Promise<{ href: string; mimeType: 'image/png', width: number, height: number, x: number, y: number }> => {
    const validElements = elementsToFlatten.filter(el => el.type !== 'video');
    if (validElements.length === 0) {
        throw new Error('No valid elements to flatten.');
    }

    // Pre-process images to Data URLs to ensure they load inside the SVG
    const processedElements = await Promise.all(validElements.map(async (el) => {
        if (el.type === 'image') {
            const dataUrl = await fetchImageAsDataUrl(el.href);
            return { ...el, href: dataUrl };
        }
        return el;
    }));

    return new Promise((resolve, reject) => {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        processedElements.forEach(element => {
            const bounds = getElementBounds(element, processedElements);
            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.width);
            maxY = Math.max(maxY, bounds.y + bounds.height);
        });

        const combinedWidth = maxX - minX;
        const combinedHeight = maxY - minY;

        if (combinedWidth <= 0 || combinedHeight <= 0) {
            return reject(new Error('Cannot flatten elements with zero or negative dimensions.'));
        }

        const offsetX = -minX;
        const offsetY = -minY;

        const clipDefs = processedElements.filter(el => el.type === 'image').map(el => {
            const clip = computeImageClip(el as ImageElement, 'flat_clip_');
            return clip.r > 0 ? `<clipPath id="${clip.id}"><rect x="${clip.rect.x + offsetX}" y="${clip.rect.y + offsetY}" width="${clip.rect.width}" height="${clip.rect.height}" rx="${clip.r}" ry="${clip.r}" /></clipPath>` : '';
        }).join('');

        const elementSvgStrings = processedElements.map(element => {
            let elementSvgString = '';
            switch (element.type) {
                case 'image': {
                    const clip = computeImageClip(element as ImageElement, 'flat_clip_');
                    const cp = clip.r > 0 ? ` clip-path="url(#${clip.id})"` : '';
                    elementSvgString = `<image href="${element.href}" x="${element.x + offsetX}" y="${element.y + offsetY}" width="${element.width}" height="${element.height}" opacity="${typeof element.opacity === 'number' ? element.opacity / 100 : 1}"${cp} />`;
                    break;
                }
                case 'path': {
                    const pointsWithOffset = element.points.map(p => ({ x: p.x + offsetX, y: p.y + offsetY }));
                    const pathData = pointsWithOffset.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
                    elementSvgString = `<path d="${pathData}" stroke="${element.strokeColor}" stroke-width="${element.strokeWidth / zoom}" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${element.strokeOpacity || 1}" />`;
                    break;
                }
                case 'shape': {
                    const shapeProps = `transform="translate(${element.x + offsetX}, ${element.y + offsetY})" fill="${element.fillColor}" stroke="${element.strokeColor}" stroke-width="${element.strokeWidth / zoom}"`;
                    if (element.shapeType === 'rectangle') elementSvgString = `<rect width="${element.width}" height="${element.height}" rx="${element.borderRadius || 0}" ry="${element.borderRadius || 0}" ${shapeProps} />`;
                    else if (element.shapeType === 'circle') elementSvgString = `<ellipse cx="${element.width / 2}" cy="${element.height / 2}" rx="${element.width / 2}" ry="${element.height / 2}" ${shapeProps} />`;
                    else if (element.shapeType === 'triangle') elementSvgString = `<polygon points="${element.width / 2},0 0,${element.height} ${element.width},${element.height}" ${shapeProps} />`;
                    break;
                }
                case 'arrow': {
                    const [start, end] = element.points;
                    const angle = Math.atan2(end.y - start.y, end.x - start.x);
                    const headLength = (element.strokeWidth / zoom) * 4;
                    const arrowHeadHeight = headLength * Math.cos(Math.PI / 6);
                    const lineEnd = { x: end.x - arrowHeadHeight * Math.cos(angle), y: end.y - arrowHeadHeight * Math.sin(angle) };
                    const headPoint1 = { x: end.x - headLength * Math.cos(angle - Math.PI / 6), y: end.y - headLength * Math.sin(angle - Math.PI / 6) };
                    const headPoint2 = { x: end.x - headLength * Math.cos(angle + Math.PI / 6), y: end.y - headLength * Math.sin(angle + Math.PI / 6) };
                    elementSvgString = `
            <line x1="${start.x + offsetX}" y1="${start.y + offsetY}" x2="${lineEnd.x + offsetX}" y2="${lineEnd.y + offsetY}" stroke="${element.strokeColor}" stroke-width="${element.strokeWidth / zoom}" stroke-linecap="round" />
            <polygon points="${end.x + offsetX},${end.y + offsetY} ${headPoint1.x + offsetX},${headPoint1.y + offsetY} ${headPoint2.x + offsetX},${headPoint2.y + offsetY}" fill="${element.strokeColor}" />
          `;
                    break;
                }
                case 'line': {
                    const [start, end] = element.points;
                    elementSvgString = `<line x1="${start.x + offsetX}" y1="${start.y + offsetY}" x2="${end.x + offsetX}" y2="${end.y + offsetY}" stroke="${element.strokeColor}" stroke-width="${element.strokeWidth / zoom}" stroke-linecap="round" />`;
                    break;
                }
                case 'text': {
                    elementSvgString = `
            <foreignObject x="${element.x + offsetX}" y="${element.y + offsetY}" width="${element.width}" height="${element.height}">
              <div xmlns="http://www.w3.org/1999/xhtml" style="font-size: ${element.fontSize}px; color: ${element.fontColor}; width: 100%; height: 100%; word-break: break-word; font-family: sans-serif; padding:0; margin:0; line-height: 1.2;">
                ${element.text.replace(/\n/g, '<br />')}
              </div>
            </foreignObject>
          `;
                    break;
                }
                case 'group': {
                    elementSvgString = '';
                    break;
                }
            }
            return elementSvgString;
        }).join('');

        const fullSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${combinedWidth}" height="${combinedHeight}"><defs>${clipDefs}</defs>${elementSvgStrings}</svg>`;
        
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const svgDataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(fullSvg)))}`;
        
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = combinedWidth;
            canvas.height = combinedHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0);
                resolve({ href: canvas.toDataURL('image/png'), mimeType: 'image/png', width: combinedWidth, height: combinedHeight, x: minX, y: minY });
            } else {
                reject(new Error('Could not get canvas context.'));
            }
        };
        
        img.onerror = (err, source, lineno, colno, error) => {
            console.error('[LayerMerge] SVG Load Error:', { err, source, lineno, colno, error, svgLength: svgDataUrl.length });
            reject(new Error(`Failed to load SVG into image. Details logged to console.`));
        };
        
        img.src = svgDataUrl;
    });
};
