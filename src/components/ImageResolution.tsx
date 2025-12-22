import React, { useState, useEffect } from 'react';

interface ImageResolutionProps {
  href: string;
  width: number;
  height: number;
  zoom: number;
}

export const ImageResolution: React.FC<ImageResolutionProps> = ({ href, width, height, zoom }) => {
  const [resolution, setResolution] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!href) return;
    const img = new Image();
    img.src = href;
    img.onload = () => {
      setResolution({ w: img.naturalWidth, h: img.naturalHeight });
    };
    // Optional: handle error
  }, [href]);

  if (!resolution) return null;

  // We want the tag to appear constant size on screen, roughly.
  // The SVG is scaled by `zoom`.
  // To counter-act zoom for the UI element, we divide dimensions by zoom.
  const paddingX = 6 / zoom;
  const paddingY = 3 / zoom;
  const fontSize = 11 / zoom;
  const borderRadius = 4 / zoom;
  const margin = 6 / zoom;

  return (
    <foreignObject
      x={0}
      y={0}
      width={width}
      height={height}
      style={{ pointerEvents: 'none', overflow: 'visible' }}
    >
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: margin,
            right: margin,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            color: 'rgba(255, 255, 255, 0.8)',
            padding: `${paddingY}px ${paddingX}px`,
            borderRadius: `${borderRadius}px`,
            fontSize: `${fontSize}px`,
            lineHeight: 1,
            fontFamily: 'system-ui, sans-serif',
            whiteSpace: 'nowrap',
            backdropFilter: 'blur(4px)',
            boxShadow: `0 ${1/zoom}px ${2/zoom}px rgba(0,0,0,0.2)`,
            pointerEvents: 'none', // Allow clicking through to the image
          }}
        >
          {resolution.w} × {resolution.h}
        </div>
      </div>
    </foreignObject>
  );
};
