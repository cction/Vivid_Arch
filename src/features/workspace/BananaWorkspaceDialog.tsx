import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { translations } from '@/i18n/translations';
import { PromptBar, PromptBarProps } from '@/features/prompt/PromptBar';

interface BananaWorkspaceDialogProps extends PromptBarProps {
  open: boolean;
  onClose: () => void;
  // prompt, setPrompt, language are inherited from PromptBarProps
}

// Icons
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

const ChevronLeftIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"></polyline>
  </svg>
);

const XIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const AlertCircleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"></circle>
    <line x1="12" y1="8" x2="12" y2="12"></line>
    <line x1="12" y1="16" x2="12.01" y2="16"></line>
  </svg>
);

// Base URL helper
const BASE_URL = ((import.meta as unknown as { env?: { BASE_URL?: string } })?.env?.BASE_URL) || '/';
const withBase = (p: string) => {
  const normalized = p.startsWith('/') ? p.slice(1) : p;
  return `${BASE_URL}${normalized}`;
};

// --- Image Resolution Logic (Ported from BananaSidebar) ---
const BANANA_COLORS = {
  100: '#F9E76D',
  200: '#F5DF4D',
  dark: '#3b2f1e'
};

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

const PHOTO_URLS: Record<string, string> = {
  // Chinese
  '晴天': 'https://images.unsplash.com/photo-1652882196700-3c29b23052c6?auto=format&fit=crop&w=360&q=80',
  '清晨': 'https://images.unsplash.com/photo-1695841090345-39399210e7b6?auto=format&fit=crop&w=360&q=80',
  '黄昏': 'https://images.unsplash.com/photo-1670813347701-352337009210?auto=format&fit=crop&w=360&q=80',
  '夜景': 'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=360&q=80',
  '阴天': 'https://images.unsplash.com/photo-1760533091926-4f5b8e15c203?auto=format&fit=crop&w=360&q=80',
  '雨天': 'https://images.unsplash.com/photo-1587413579923-52d36908bf0e?auto=format&fit=crop&w=360&q=80',
  '雪景': 'https://images.unsplash.com/photo-1482192596544-9eb780fc7f66?auto=format&fit=crop&w=360&q=80',
  // English
  'Sunny': 'https://images.unsplash.com/photo-1652882196700-3c29b23052c6?auto=format&fit=crop&w=360&q=80',
  'Morning': 'https://images.unsplash.com/photo-1695841090345-39399210e7b6?auto=format&fit=crop&w=360&q=80',
  'Dusk': 'https://images.unsplash.com/photo-1670813347701-352337009210?auto=format&fit=crop&w=360&q=80',
  'Night Scene': 'https://images.unsplash.com/photo-1465101046530-73398c7f28ca?auto=format&fit=crop&w=360&q=80',
  'Overcast': 'https://images.unsplash.com/photo-1760533091926-4f5b8e15c203?auto=format&fit=crop&w=360&q=80',
  'Rainy': 'https://images.unsplash.com/photo-1587413579923-52d36908bf0e?auto=format&fit=crop&w=360&q=80',
  'Snowy': 'https://images.unsplash.com/photo-1482192596544-9eb780fc7f66?auto=format&fit=crop&w=360&q=80',
};

const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '');

const resolvePhotoUrl = (label: string): string | null => {
  const n = normalize(label);
  for (const key in PHOTO_URLS) {
    if (normalize(key) === n) return PHOTO_URLS[key];
  }
  return null;
};

const ICON_MAP: Record<string, string> = {
  '晴天': withBase('weather/sun.svg'),
  '清晨': withBase('weather/sunrise.svg'),
  '黄昏': withBase('weather/sunset.svg'),
  '夜景': withBase('weather/night_city.svg'),
  '阴天': withBase('weather/cloud.svg'),
  '雨天': withBase('weather/rain.svg'),
  '雪景': withBase('weather/snow.svg'),
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

const extImagesEnabled = (() => {
  if (typeof window === 'undefined') return true;
  try { return (localStorage.getItem('pod-ext-images') || '') !== 'off'; } catch { return true; }
})();

const getCardImageSrc = (label: string) => {
  const photo = extImagesEnabled ? resolvePhotoUrl(label) : null;
  if (photo) return photo;
  const icon = resolveIconUrl(label);
  if (icon) return icon;
  return makeSvgDataUrl(label);
};

const getLocalIconSrc = (label: string): string | null => resolveIconUrl(label);

export function BananaWorkspaceDialog({ 
  open, 
  onClose, 
  language, 
  setPrompt,
  ...promptBarProps 
}: BananaWorkspaceDialogProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (open && e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Handle messages from iframe
  useEffect(() => {
    console.log('[BananaWorkspace] Message listener mounting...');
    
    const handleMessage = (event: MessageEvent) => {
      // Debug log for ALL messages to troubleshoot
      console.log('[BananaWorkspace] Message received (raw):', {
        origin: event.origin,
        data: event.data,
        type: typeof event.data,
        isTrusted: event.isTrusted
      });

      const ALLOWED_ORIGINS = ['https://p.vividai.com.cn'];
      
      // Allow exact match or if it's from the same site (useful for testing if run locally)
      // Also check if the origin ends with vividai.com.cn to allow subdomains if needed
      if (!ALLOWED_ORIGINS.includes(event.origin) && !event.origin.endsWith('.vividai.com.cn')) {
        console.warn('[BananaWorkspace] Blocked message from unauthorized origin:', event.origin);
        return;
      }

      try {
        const { type, prompt: newPrompt } = event.data || {};
        
        // Log if we see a VIVIDAI_PROMPT type, even if other checks fail
        if (type === 'VIVIDAI_PROMPT') {
            console.log('[BananaWorkspace] Found VIVIDAI_PROMPT message. Payload:', newPrompt);
        }

        if (type === 'VIVIDAI_PROMPT' && typeof newPrompt === 'string') {
           // Security: Limit prompt length to avoid memory/rendering issues
           if (newPrompt.length > 20000) {
             console.warn('[BananaWorkspace] Prompt too long, truncated to 20k chars');
             if (setPrompt) {
               setPrompt(newPrompt.slice(0, 20000));
             }
             return;
           }

           console.log('[BananaWorkspace] Successfully syncing prompt from iframe:', newPrompt.slice(0, 20) + '...');
           if (setPrompt) {
             setPrompt(newPrompt);
           }
        }
      } catch (err) {
        console.error('[BananaWorkspace] Error handling message:', err);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [setPrompt]);

  // Reset states when opened
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIframeLoading(true);
      setIframeError(false);
      setSearchTerm('');
    }
  }, [open]);

  const t = (key: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (translations[language as keyof typeof translations] as any)?.[key] || key;
  };

  const bananaCards = (translations[language].bananaCards || []) as { name: string; value: string }[];
  const filteredCards = bananaCards.filter((card) =>
    card.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    card.value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-8">
          {/* Main Container with Animation */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }} // Smooth ease-out curve
            className="relative flex overflow-hidden rounded-xl bg-[#18181b] transition-all duration-300 border border-[#27272a] shadow-xl"
            style={{
              width: 'min(96vw, 1440px)',
              height: 'min(90vh, 860px)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 z-50 p-2 text-white/40 hover:text-white bg-black/20 hover:bg-black/50 rounded-lg transition-all backdrop-blur-md"
              title={t('close') || 'Close'}
            >
              <XIcon />
            </button>

            {/* LEFT: Sidebar */}
            <div 
              className="flex flex-col border-r border-[#27272a] bg-[#121214] transition-all duration-300 ease-in-out relative"
              style={{ width: isSidebarCollapsed ? '64px' : '220px', cursor: isSidebarCollapsed ? 'pointer' : 'default' }}
              onClick={() => {
                if (isSidebarCollapsed) {
                  setIsSidebarCollapsed(false);
                }
              }}
            >
              {/* Sidebar Header */}
              <div className="flex flex-col p-3 border-b border-[#27272a] bg-[#121214] min-h-[60px] justify-center">
                {!isSidebarCollapsed ? (
                  <div className="flex items-center gap-2">
                    <div className="relative group flex-1">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-white/30 group-focus-within:text-white/60 transition-colors">
                        <SearchIcon />
                      </div>
                      <input
                        type="text"
                        className="w-full bg-[#27272a]/50 border border-transparent focus:border-[#3f3f46] rounded-md py-1.5 pl-8 pr-2 text-xs text-white placeholder-white/30 focus:outline-none focus:bg-[#27272a] transition-all"
                        placeholder={t('search') || 'Search...'}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsSidebarCollapsed(true);
                      }}
                      className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/5 transition-colors flex-shrink-0"
                    >
                      <ChevronLeftIcon />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                     <button 
                       className="text-white/30 hover:text-white transition-colors p-1.5 hover:bg-white/5 rounded-md"
                       onClick={(e) => {
                         e.stopPropagation(); // Prevent double trigger since parent also expands
                         setIsSidebarCollapsed(false);
                       }}
                       title="Search"
                     >
                       <SearchIcon />
                     </button>
                   </div>
                )}
              </div>

          {/* Sidebar List */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-1 custom-scrollbar">
            {filteredCards.map((card, index) => (
              <button
                key={index}
                className={`w-full flex items-center gap-3 p-2.5 rounded-md transition-all group text-left ${
                  isSidebarCollapsed ? 'justify-center' : ''
                } hover:bg-white/5 active:bg-white/10`}
                title={card.name}
                onClick={() => {
                  if (setPrompt) {
                    setPrompt(card.value);
                  }
                  console.log('Preset clicked:', card.name);
                }}
              >
                <div className="relative w-9 h-9 rounded-md overflow-hidden flex-shrink-0 bg-[#27272a] shadow-sm group-hover:shadow-md transition-shadow">
                   <img 
                     src={getCardImageSrc(card.name)} 
                     alt={card.name}
                     className="w-full h-full object-cover opacity-75 group-hover:opacity-100 transition-opacity grayscale group-hover:grayscale-0"
                     onError={(e) => {
                        const fb = getLocalIconSrc(card.name);
                        e.currentTarget.src = fb ?? makeSvgDataUrl(card.name);
                     }}
                   />
                </div>
                {!isSidebarCollapsed && (
                  <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <div className="text-sm text-white/80 group-hover:text-white truncate font-medium">{card.name}</div>
                    {/* <div className="text-[10px] text-white/40 group-hover:text-white/50 truncate font-mono">{card.value}</div> */}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* RIGHT: Main Content */}
        <div className="flex flex-col flex-1 min-w-0 h-full bg-[#18181b]">
          {/* Top: Iframe Area */}
          <div className="flex-1 relative min-h-[240px] bg-[#09090b] overflow-hidden rounded-none">
            {iframeLoading && !iframeError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-[#0F0D13]">
                <div className="w-12 h-12 border-2 border-white/10 border-t-[#C5AEF6] rounded-full animate-spin mb-4"></div>
                <div className="text-white/40 text-sm animate-pulse">Loading VividAI...</div>
              </div>
            )}
            
            {iframeError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-[#0F0D13] p-8 text-center">
                <div className="text-red-400 mb-4 opacity-80"><AlertCircleIcon /></div>
                <h3 className="text-white font-medium mb-2">Unable to load webpage</h3>
                <p className="text-white/50 text-sm max-w-md mb-6">
                  Verify your internet connection or try opening it in a browser.
                </p>
                <a 
                  href="https://p.vividai.com.cn/" 
                  target="_blank" 
                  rel="noreferrer"
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white transition-colors"
                >
                  Open in Browser
                </a>
              </div>
            ) : (
              <iframe 
                src="https://p.vividai.com.cn/"
                className="w-full border-none block"
                style={{
                  height: 'calc(100% + 90px)',
                  marginTop: '-90px'
                }}
                title="VividAI Web"
                onLoad={() => setIframeLoading(false)}
                onError={() => {
                  setIframeLoading(false);
                  setIframeError(true);
                }}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals"
                allow="clipboard-write *; clipboard-read *; fullscreen *"
              />
            )}
          </div>

          {/* Bottom: PromptBar Area */}
          <div className="flex-none bg-[#18181b] border-t border-[#27272a] relative z-20">
             <PromptBar
                language={language}
                setPrompt={setPrompt}
                {...promptBarProps}
                mode="static"
                forceExpanded={true}
                noBorderRadius={true}
                noBorder={true}
                className="w-full bg-transparent"
                containerRef={null}
                onBananaClick={onClose} // Clicking banana inside workspace closes workspace (returns to single prompt mode)
             />
          </div>
        </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
