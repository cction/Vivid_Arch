import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { translations } from '@/i18n/translations';

interface BananaSidebarProps {
  t: (key: string, ...args: unknown[]) => unknown;
  language: 'en' | 'ZH';
  setPrompt: (prompt: string) => void;
  onGenerate: () => void;
  disabled?: boolean;
  promptBarOffsetPx?: number;
  buttonSize?: number;
}

// Base URL helper to support dev ("/") and electron build ("./")
const BASE_URL = ((import.meta as unknown as { env?: { BASE_URL?: string } })?.env?.BASE_URL) || '/';
const withBase = (p: string) => {
  const normalized = p.startsWith('/') ? p.slice(1) : p;
  return `${BASE_URL}${normalized}`;
};

const BananaIcon: React.FC<{ size?: number }> = ({ size = 40 }) => {
  const primary = withBase('logo/icons8-banana-100.png');
  const fallback = withBase('logo/BA-color.png');
  const svgFallback = withBase('logo/OpenMoji-color_1F34C.svg');
  return (
    <img
      src={primary}
      width={size}
      height={size}
      alt="banana"
      className="block"
      onError={(e) => {
        const t = e.currentTarget;
        t.onerror = null;
        t.src = fallback;
        setTimeout(() => { if (t.naturalWidth === 0) t.src = svgFallback; }, 0);
      }}
    />
  );
};

const BANANA_COLORS = {
  100: '#F9E76D', // --color-banana-100
  200: '#F5DF4D', // --color-banana-200
  dark: '#3b2f1e' // --color-banana-dark
};

// Create a simple SVG data URL thumbnail using the preset name
const makeSvgDataUrl = (label: string) => {
  const safe = label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const svg = `<?xml version='1.0' encoding='UTF-8'?>\n` +
    `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='80'>\n` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='${BANANA_COLORS[100]}'/><stop offset='100%' stop-color='${BANANA_COLORS[200]}'/></linearGradient></defs>\n` +
    `<rect width='100%' height='100%' rx='8' ry='8' fill='url(#g)'/>\n` +
    `<text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='system-ui, sans-serif' font-size='12' fill='${BANANA_COLORS.dark}'>${safe}</text>\n` +
    `</svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
};

// Photo URLs for weather cards (optimized Unsplash sizes)
const PHOTO_URLS: Record<string, string> = {
  // Chinese
  '晴天': 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=360&q=80',
  '清晨': 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=360&q=80',
  '黄昏': 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=360&q=80',
  '夜景': 'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=360&q=80',
  '阴天': 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=360&q=80',
  '雨天': 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=360&q=80',
  '雪景': 'https://images.unsplash.com/photo-1482192596544-9eb780fc7f66?auto=format&fit=crop&w=360&q=80',
  // English
  'Sunny': 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=360&q=80',
  'Morning': 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=360&q=80',
  'Dusk': 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=360&q=80',
  'Night Scene': 'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=360&q=80',
  'Overcast': 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=360&q=80',
  'Rainy': 'https://images.unsplash.com/photo-1501594907352-04cda38ebc29?auto=format&fit=crop&w=360&q=80',
  'Snowy': 'https://images.unsplash.com/photo-1482192596544-9eb780fc7f66?auto=format&fit=crop&w=360&q=80',
};

// Normalize label for robust matching (trim, lowercase, remove spaces)
const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '');

// Try resolve photo url by normalized comparison across keys
const resolvePhotoUrl = (label: string): string | null => {
  const n = normalize(label);
  for (const key in PHOTO_URLS) {
    if (normalize(key) === n) return PHOTO_URLS[key];
  }
  return null;
};

// Map localized card names to local weather icon assets
const ICON_MAP: Record<string, string> = {
  // Chinese
  '晴天': withBase('weather/sun.svg'),
  '清晨': withBase('weather/sunrise.svg'),
  '黄昏': withBase('weather/sunset.svg'),
  '夜景': withBase('weather/night_city.svg'),
  '阴天': withBase('weather/cloud.svg'),
  '雨天': withBase('weather/rain.svg'),
  '雪景': withBase('weather/snow.svg'),
  // English
  'Sunny': withBase('weather/sun.svg'),
  'Morning': withBase('weather/sunrise.svg'),
  'Dusk': withBase('weather/sunset.svg'),
  'Night Scene': withBase('weather/night_city.svg'),
  'Overcast': withBase('weather/cloud.svg'),
  'Rainy': withBase('weather/rain.svg'),
  'Snowy': withBase('weather/snow.svg'),
};

const resolveIconUrl = (label: string): string | null => {
  const n = normalize(label);
  for (const key in ICON_MAP) {
    if (normalize(key) === n) return ICON_MAP[key];
  }
  return null;
};

const getCardImageSrc = (label: string) => {
  const photo = resolvePhotoUrl(label);
  if (photo) return photo;
  const icon = resolveIconUrl(label);
  if (icon) return icon;
  return makeSvgDataUrl(label);
};

// Local icon fallback mapping (runtime image error handler will use this)
const getLocalIconSrc = (label: string): string | null => resolveIconUrl(label);

export const BananaSidebar: React.FC<BananaSidebarProps> = ({ language, setPrompt, onGenerate, disabled = false, promptBarOffsetPx = 0, buttonSize }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<{ left: number; top: number; width: number } | null>(null);
  const builtInPrompts = (language === 'ZH' ? translations.ZH.bananaCards : translations.en.bananaCards) as { name: string; value: string }[];
  void onGenerate;

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const inButton = buttonRef.current?.contains(target) ?? false;
      const inMenu = menuRef.current?.contains(target) ?? false;
      const inWrapper = wrapperRef.current?.contains(target) ?? false;
      if (!(inButton || inMenu || inWrapper)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const handleSelect = (value: string) => {
    if (disabled) return;
    setPrompt(value);
    setIsOpen(false);
    // Do not auto-generate; leave control to user.
    // Uncomment to auto-generate on click:
    // onGenerate();
  };

  return (
    <div className="relative" ref={wrapperRef}>
      {/* Gradient glass circle button styled like PodUI copy.html */}
      <button
        ref={buttonRef}
        onClick={(e) => {
          if (disabled) return;
          setIsOpen(prev => !prev);
          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
          setAnchor({ left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width) });
        }}
        disabled={disabled}
        aria-label="Banana Presets"
        title="Banana Presets"
        aria-pressed={isOpen}
        className="pod-banana-trigger pod-inner-gradient-ring"
        style={{
          height: buttonSize || 40,
          width: buttonSize || 40,
        }}
      >
        {/* Inner glass */}
          <span className="pod-banana-trigger-inner">
          {/* Soft highlight sweep */}
          <span className="pod-banana-sheen" />

          {/* Gentle top rim glow */}
          <span className="pod-banana-glow" />

          {/* Icon centered for circular button */}
          <span className="relative z-[1]">
            <BananaIcon size={Math.max(18, (buttonSize || 40) - 8)} />
          </span>
        </span>
      </button>
      
      {isOpen && anchor && createPortal(
        <div
          ref={menuRef}
          className="pod-panel pod-bg-solid pod-panel-rounded-xl pod-scrollbar-x pod-overlay-position pod-banana-menu"
          style={{ 
            '--pod-left': `${Math.round(anchor.left + anchor.width / 2 - Math.min(window.innerWidth * 0.9, 1024) / 2 + Number(promptBarOffsetPx || 0))}px`, 
            '--pod-bottom': `${Math.round(window.innerHeight - anchor.top + 12)}px` 
          } as React.CSSProperties}
        >
          <div className="flex flex-row gap-2 justify-center flex-wrap md:flex-nowrap">
            {(builtInPrompts || []).slice(0, 7).map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleSelect(item.value)}
                title={item.name}
                className="pod-banana-card-wrapper"
              >
                <div className="pod-banana-card-container">
                  <div className="aspect-square relative overflow-hidden">
                    <img
                      src={getCardImageSrc(item.name)}
                      alt={item.name}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="pod-banana-card-image"
                      onError={(e) => {
                        const fb = getLocalIconSrc(item.name);
                        e.currentTarget.src = fb ?? makeSvgDataUrl(item.name);
                      }}
                    />
                    <div className="pod-banana-card-overlay"></div>
                    <div className="pod-banana-card-content">
                      <h3
                        className="pod-banana-card-text"
                        title={item.name}
                      >
                        {item.name}
                      </h3>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
