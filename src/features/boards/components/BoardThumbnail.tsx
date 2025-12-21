import React, { useMemo } from 'react';
import type { Board } from '@/types';
import { getElementBounds, computeImageClip } from '@/utils/canvas';
import type { ImageElement } from '@/types';
import { getUiRadiusLg } from '@/ui/standards';
import { PLACEHOLDER_DATA_URL } from '@/utils/image';

const THUMB_WIDTH = 120;
const THUMB_HEIGHT = 80;

export function BoardThumbnail({ board }: { board: Board }) {
  const { elements, transform } = useMemo(() => {
    const visible = (board.elements || []).filter(el => el.isVisible !== false);
    if (visible.length === 0) return { elements: visible, transform: { scale: 1, dx: 0, dy: 0 } };

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const el of visible) {
      const bounds = getElementBounds(el, visible);
      minX = Math.min(minX, bounds.x);
      minY = Math.min(minY, bounds.y);
      maxX = Math.max(maxX, bounds.x + bounds.width);
      maxY = Math.max(maxY, bounds.y + bounds.height);
    }
    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;
    if (contentWidth <= 0 || contentHeight <= 0) return { elements: visible, transform: { scale: 1, dx: 0, dy: 0 } };

    const scale = Math.min(THUMB_WIDTH / contentWidth, THUMB_HEIGHT / contentHeight) * 0.9;
    const dx = (THUMB_WIDTH - contentWidth * scale) / 2 - minX * scale;
    const dy = (THUMB_HEIGHT - contentHeight * scale) / 2 - minY * scale;
    return { elements: visible, transform: { scale, dx, dy } };
  }, [board]);

  const arrowMarkerId = useMemo(() => `thumb_arrow_${board.id}`, [board.id]);

  return (
    <svg
      viewBox={`0 0 ${THUMB_WIDTH} ${THUMB_HEIGHT}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect width={THUMB_WIDTH} height={THUMB_HEIGHT} fill={board.canvasBackgroundColor || '#0F0D13'} />
      <defs>
        <pattern id="podui-placeholder" width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="#1E1E24" />
          <path d="M0 8 L8 0" stroke="#374151" strokeWidth="1" opacity="0.35" />
          <path d="M-4 8 L8 -4" stroke="#374151" strokeWidth="1" opacity="0.35" />
        </pattern>
        <marker
          id={arrowMarkerId}
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
        </marker>
        {elements
          .filter(el => el.type === 'image')
          .map(el => {
            const img = el as ImageElement;
            const clip = computeImageClip(img, 'thumb_clip_');
            return clip.r > 0 ? (
              <clipPath key={img.id} id={clip.id}>
                <rect x={clip.rect.x} y={clip.rect.y} width={clip.rect.width} height={clip.rect.height} rx={clip.r} ry={clip.r} />
              </clipPath>
            ) : null;
          })}
      </defs>
      <g transform={`translate(${transform.dx} ${transform.dy}) scale(${transform.scale})`}>
        {elements.map(el => {
          if (el.type === 'path') {
            const d = el.points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
            return (
              <path
                key={el.id}
                d={d}
                stroke={el.strokeColor}
                strokeWidth={el.strokeWidth}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity={el.strokeOpacity ?? 1}
              />
            );
          }

          if (el.type === 'image') {
            const opacity = typeof el.opacity === 'number' ? el.opacity / 100 : 1;
            const br = typeof el.borderRadius === 'number' ? el.borderRadius : getUiRadiusLg();
            const clipId = br > 0 ? `url(#thumb_clip_${el.id})` : undefined;
            const isPh = el.href === PLACEHOLDER_DATA_URL || !!el.isPlaceholder;
            if (isPh) {
              return (
                <rect
                  key={el.id}
                  x={el.x}
                  y={el.y}
                  width={el.width}
                  height={el.height}
                  fill="url(#podui-placeholder)"
                  clipPath={clipId}
                />
              );
            }
            return (
              <image
                key={el.id}
                href={el.href}
                x={el.x}
                y={el.y}
                width={el.width}
                height={el.height}
                opacity={opacity}
                clipPath={clipId}
                preserveAspectRatio="none"
              />
            );
          }

          if (el.type === 'video') {
            return (
              <rect
                key={el.id}
                x={el.x}
                y={el.y}
                width={el.width}
                height={el.height}
                fill="#000"
                opacity={0.6}
              />
            );
          }

          if (el.type === 'line') {
            return (
              <line
                key={el.id}
                x1={el.points[0].x}
                y1={el.points[0].y}
                x2={el.points[1].x}
                y2={el.points[1].y}
                stroke={el.strokeColor}
                strokeWidth={el.strokeWidth}
              />
            );
          }

          if (el.type === 'arrow') {
            return (
              <line
                key={el.id}
                x1={el.points[0].x}
                y1={el.points[0].y}
                x2={el.points[1].x}
                y2={el.points[1].y}
                stroke={el.strokeColor}
                strokeWidth={el.strokeWidth}
                markerEnd={`url(#${arrowMarkerId})`}
                color={el.strokeColor}
              />
            );
          }

          if (el.type === 'shape') {
            const strokeDasharray = el.strokeDashArray ? el.strokeDashArray.join(',') : undefined;
            if (el.shapeType === 'rectangle') {
              return (
                <rect
                  key={el.id}
                  x={el.x}
                  y={el.y}
                  width={el.width}
                  height={el.height}
                  rx={el.borderRadius ?? 0}
                  ry={el.borderRadius ?? 0}
                  fill={el.fillColor}
                  stroke={el.strokeColor}
                  strokeWidth={el.strokeWidth}
                  strokeDasharray={strokeDasharray}
                />
              );
            }
            if (el.shapeType === 'circle') {
              return (
                <ellipse
                  key={el.id}
                  cx={el.x + el.width / 2}
                  cy={el.y + el.height / 2}
                  rx={Math.abs(el.width) / 2}
                  ry={Math.abs(el.height) / 2}
                  fill={el.fillColor}
                  stroke={el.strokeColor}
                  strokeWidth={el.strokeWidth}
                  strokeDasharray={strokeDasharray}
                />
              );
            }
            const x1 = el.x + el.width / 2;
            const y1 = el.y;
            const x2 = el.x;
            const y2 = el.y + el.height;
            const x3 = el.x + el.width;
            const y3 = el.y + el.height;
            return (
              <path
                key={el.id}
                d={`M ${x1} ${y1} L ${x2} ${y2} L ${x3} ${y3} Z`}
                fill={el.fillColor}
                stroke={el.strokeColor}
                strokeWidth={el.strokeWidth}
                strokeDasharray={strokeDasharray}
              />
            );
          }

          if (el.type === 'text') {
            const fontSize = Math.max(1, el.fontSize || 12);
            return (
              <text key={el.id} x={el.x} y={el.y + fontSize} fontSize={fontSize} fill={el.fontColor}>
                {el.text}
              </text>
            );
          }

          return null;
        })}
      </g>
    </svg>
  );
}
