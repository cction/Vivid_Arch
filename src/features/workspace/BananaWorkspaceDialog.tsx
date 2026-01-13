import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { translations, WeatherPreset } from '@/i18n/translations';
import { PromptBar, PromptBarProps } from '@/features/prompt/PromptBar';

interface BananaWorkspaceDialogProps extends PromptBarProps {
  open: boolean;
  onClose: () => void;
  onToggleWeatherId: (id: string) => void;
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

const ChevronDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9"></polyline>
  </svg>
);

const ChevronUpIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15"></polyline>
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
  onToggleWeatherId,
  ...promptBarProps 
}: BananaWorkspaceDialogProps) {
  const WEB_TITLE = 'Prompt Lab';
  const COMPACT_KEY = 'BANANAPOD_WORKSPACE_COMPACT';
  const IFRAME_BASE_URL = 'https://p.vividai.com.cn/';
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const iframeWindowRef = useRef<Window | null>(null);
  const sessionIdRef = useRef<string>('');
  const initSentRef = useRef(false);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCompact, setIsCompact] = useState(() => {
    try {
      const raw = localStorage.getItem(COMPACT_KEY);
      return raw === '1';
    } catch {
      return false;
    }
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [iframeLoading, setIframeLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  const [iframeUrl, setIframeUrl] = useState(IFRAME_BASE_URL);
  const sidebarCollapsed = isCompact ? false : isSidebarCollapsed;

  const createSessionId = () => {
    const now = Date.now();
    try {
      const buf = new Uint32Array(2);
      crypto.getRandomValues(buf);
      return `bws_${now}_${buf[0].toString(16)}${buf[1].toString(16)}`;
    } catch {
      return `bws_${now}_${Math.random().toString(16).slice(2)}`;
    }
  };

  const getIframeOrigin = () => {
    try {
      const src = iframeRef.current?.src || IFRAME_BASE_URL;
      return new URL(src).origin;
    } catch {
      return '';
    }
  };

  const postInitToIframe = () => {
    const win = iframeWindowRef.current;
    if (!win) return;
    const origin = getIframeOrigin();
    if (!origin) return;
    if (!sessionIdRef.current) return;
    win.postMessage(
      {
        type: 'VIVIDAI_INIT',
        version: 1,
        sessionId: sessionIdRef.current,
        capabilities: { promptSync: true },
        requestReady: true,
      },
      origin
    );
    initSentRef.current = true;
  };

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

      const expectedOrigin = getIframeOrigin();
      if (expectedOrigin && event.origin !== expectedOrigin) {
        console.warn('[BananaWorkspace] Blocked message from unexpected origin:', event.origin);
        return;
      }

      if (iframeWindowRef.current && event.source !== iframeWindowRef.current) {
        console.warn('[BananaWorkspace] Blocked message from unexpected source window');
        return;
      }

      try {
        const data = event.data;
        if (!data || typeof data !== 'object') return;
        const msg = data as { type?: unknown; prompt?: unknown; sessionId?: unknown; version?: unknown };
        const type = msg.type;
        const newPrompt = msg.prompt;
        const incomingSessionId = typeof msg.sessionId === 'string' ? msg.sessionId : '';
        const incomingVersion = msg.version;

        if (incomingVersion !== 1) return;
        if (!incomingSessionId || incomingSessionId !== sessionIdRef.current) {
          const src = event.source as Window | null;
          if (src && typeof (src as unknown as { postMessage?: unknown }).postMessage === 'function') {
            src.postMessage(
              { type: 'VIVIDAI_PROMPT_ACK', version: 1, sessionId: sessionIdRef.current, ok: false, reason: 'session_mismatch' },
              event.origin
            );
          }
          return;
        }
        
        // Log if we see a VIVIDAI_PROMPT type, even if other checks fail
        if (type === 'VIVIDAI_PROMPT') {
            console.log('[BananaWorkspace] Found VIVIDAI_PROMPT message. Payload:', newPrompt);
        }

        if (type === 'VIVIDAI_READY') {
          console.log('[BananaWorkspace] Iframe READY:', { sessionId: incomingSessionId });
          return;
        }

        if (type === 'VIVIDAI_PROMPT' && typeof newPrompt === 'string') {
           // Security: Limit prompt length to avoid memory/rendering issues
           if (newPrompt.length > 20000) {
             console.warn('[BananaWorkspace] Prompt too long, truncated to 20k chars');
             if (setPrompt) {
               setPrompt(newPrompt.slice(0, 20000));
             }
             const src = event.source as Window | null;
             if (src && typeof (src as unknown as { postMessage?: unknown }).postMessage === 'function') {
               src.postMessage(
                 { type: 'VIVIDAI_PROMPT_ACK', version: 1, sessionId: sessionIdRef.current, ok: true, truncated: true },
                 event.origin
               );
             }
             return;
           }

           console.log('[BananaWorkspace] Successfully syncing prompt from iframe:', newPrompt.slice(0, 20) + '...');
           if (setPrompt) {
             setPrompt(newPrompt);
           }
           const src = event.source as Window | null;
           if (src && typeof (src as unknown as { postMessage?: unknown }).postMessage === 'function') {
             src.postMessage(
               { type: 'VIVIDAI_PROMPT_ACK', version: 1, sessionId: sessionIdRef.current, ok: true },
               event.origin
             );
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
      const ts = Date.now();
      setIframeUrl(`${IFRAME_BASE_URL}?ts=${ts}`);
      const sid = createSessionId();
      sessionIdRef.current = sid;
      initSentRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    try {
      localStorage.setItem(COMPACT_KEY, isCompact ? '1' : '0');
    } catch {
      // ignore
    }
  }, [isCompact]);

  const t = (key: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (translations[language as keyof typeof translations] as any)?.[key] || key;
  };

  const bananaCards = (translations[language].bananaCards || []) as WeatherPreset[];
  const filteredCards = bananaCards.filter((card) =>
    card.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    card.value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AnimatePresence>
      {open && (
        <div
          className={`fixed inset-0 z-[100] flex items-end justify-center p-4 pb-8 ${
            isCompact ? 'pointer-events-none bg-transparent' : 'bg-black/80 backdrop-blur-sm'
          }`}
        >
          {/* Main Container with Animation */}
          <motion.div
            layout
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ 
              duration: 0.4, 
              ease: [0.16, 1, 0.3, 1],
              layout: { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
            }} 
            className="relative flex overflow-hidden rounded-xl bg-[var(--workspace-bg-main)] border border-[var(--workspace-border)] shadow-xl pointer-events-auto"
            style={{
              width: isCompact ? 'min(92vw, 1080px)' : 'min(96vw, 1440px)',
              height: isCompact ? 'auto' : 'min(90vh, 860px)',
              maxHeight: isCompact ? '60vh' : '90vh'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* LEFT: Sidebar */}
            <motion.div 
              layout="position"
              className="flex flex-col border-r border-[var(--workspace-border)] bg-[var(--workspace-bg-sidebar)] z-10"
              initial={false}
              animate={{
                width: isCompact ? 180 : (sidebarCollapsed ? 64 : 220)
              }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              style={{
                cursor: isCompact ? 'default' : sidebarCollapsed ? 'pointer' : 'default',
                position: isCompact ? 'absolute' : 'relative',
                height: '100%',
                left: 0,
                top: 0
              }}
              onClick={() => {
                if (!isCompact && sidebarCollapsed) {
                  setIsSidebarCollapsed(false);
                }
              }}
            >
              {/* Sidebar Header */}
              <div className="banana-workspace-header flex items-center px-3 border-b border-[var(--workspace-border)] bg-[var(--workspace-bg-header)]">
                {!sidebarCollapsed ? (
                  <div className="flex items-center gap-2">
                    <div className="relative group flex-1">
                      <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-white/10 group-focus-within:text-white/40 group-hover:text-white/30 transition-colors">
                        <SearchIcon />
                      </div>
                      <input
                        type="text"
                        className="banana-workspace-search-input w-full bg-transparent border-none rounded-md pl-8 pr-2 text-xs text-white placeholder-white/10 focus:outline-none focus:bg-[var(--workspace-input-focus-bg)] hover:bg-[var(--workspace-input-bg)] focus:ring-1 focus:ring-white/5 transition-all"
                        placeholder={t('search') || 'Search...'}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    {!isCompact && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsSidebarCollapsed(true);
                        }}
                        className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/5 transition-colors flex-shrink-0"
                        aria-label="Collapse sidebar"
                      >
                        <ChevronLeftIcon />
                      </button>
                    )}
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
              <div
                className={`flex-1 overflow-y-auto overflow-x-hidden p-3 pod-scrollbar-fine ${
                  isCompact ? 'grid grid-cols-3 gap-2 content-start' : 'space-y-1'
                }`}
              >
                {filteredCards.map((card) => {
                  const isSelected = promptBarProps.selectedWeatherId === card.id;
                  const disabled = promptBarProps.isLoading;

                  return (
                    <button
                      key={card.id}
                      disabled={disabled}
                      aria-pressed={isSelected}
                      className={`transition-all group text-left rounded-md overflow-hidden ${
                        isCompact
                          ? 'w-full aspect-square p-1.5 flex items-center justify-center'
                          : `w-full flex items-center p-0 ${isSidebarCollapsed ? 'justify-center p-2.5' : ''}`
                      } ${
                        isSelected
                          ? (isCompact || sidebarCollapsed) ? '' : 'bg-transparent ring-0'
                          : (isCompact || sidebarCollapsed) ? '' : 'hover:bg-white/5 active:bg-white/10 p-2.5 gap-3'
                      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      title={card.name}
                      style={{
                        '--tw-ring-color': isSelected ? 'var(--workspace-card-ring)' : undefined,
                        height: (!isCompact && !sidebarCollapsed && isSelected) ? '120px' : 'auto'
                      } as React.CSSProperties}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (disabled) return;
                        onToggleWeatherId(card.id);
                        requestAnimationFrame(() => {
                          const el = document.querySelector(
                            'textarea.pod-prompt-textarea'
                          ) as HTMLTextAreaElement | null;
                          el?.focus();
                        });
                      }}
                    >
                      <div
                        className={`relative rounded-md overflow-hidden flex-shrink-0 bg-[var(--workspace-card-bg)] shadow-sm transition-all ${
                          isCompact ? 'w-12 h-12' : (isSelected && !sidebarCollapsed ? 'w-full h-full rounded-none' : 'w-9 h-9')
                        } ${
                          isSelected && !sidebarCollapsed && !isCompact ? '' : (isSelected ? 'ring-2 ring-opacity-60' : 'group-hover:shadow-md')
                        }`}
                        style={{
                          '--tw-ring-color': isSelected ? 'var(--workspace-card-ring)' : undefined
                        } as React.CSSProperties}
                      >
                        <img
                          src={getCardImageSrc(card.name)}
                          alt={card.name}
                          className={`w-full h-full object-cover transition-opacity ${
                            isSelected && !sidebarCollapsed && !isCompact ? 'opacity-60' : 'opacity-75 group-hover:opacity-100'
                          }`}
                          onError={(e) => {
                            const fb = getLocalIconSrc(card.name);
                            e.currentTarget.src = fb ?? makeSvgDataUrl(card.name);
                          }}
                        />
                        {isSelected && !isCompact && !sidebarCollapsed && (
                          <>
                            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/50 to-transparent"></div>
                            <div className="absolute inset-0 p-5 flex flex-col justify-center items-start z-10">
                              <div className="flex items-center gap-2 mb-2">
                                <span className="bg-[var(--brand-solid)] text-white text-[10px] px-1.5 py-0.5 rounded-sm font-medium tracking-widest shadow-sm">PRESET</span>
                                <span className="text-white/40 text-[10px] font-mono tracking-widest">HQ</span>
                              </div>
                              <h3 className="text-2xl font-serif text-white leading-none mb-2 drop-shadow-lg">{card.name}</h3>
                              <div className="w-8 h-0.5 bg-[var(--brand-primary)] mb-2 shadow-[0_0_4px_rgba(197,174,246,0.3)]"></div>
                              <p className="text-[10px] text-white/60 font-mono tracking-widest">ID: {card.id}</p>
                            </div>
                          </>
                        )}
                      </div>
                      {!isCompact && !sidebarCollapsed && !isSelected && (
                        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                          <div className="text-sm text-white/80 group-hover:text-white truncate font-medium">
                            {card.name}
                          </div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
        </motion.div>

        {/* RIGHT: Main Content */}
        <div 
          className="flex flex-col flex-1 min-w-0 h-full bg-[var(--workspace-bg-main)] transition-all duration-300 ease-in-out"
          style={{
            marginLeft: isCompact ? '180px' : '0'
          }}
        >
            <div className="banana-workspace-header flex items-center justify-between gap-3 px-4 border-b border-[var(--workspace-border)] bg-[var(--workspace-bg-header)]">
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-center select-none group cursor-default">
                <span className="text-lg font-black tracking-tight text-[var(--brand-solid)] group-hover:text-[var(--brand-primary)] transition-colors duration-300">Prompt</span>
                <span className="text-lg font-light tracking-[0.2em] pod-text-white-sheen ml-1">LAB</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => {
                  setIsCompact((v) => !v);
                  requestAnimationFrame(() => {
                    const el = document.querySelector('textarea.pod-prompt-textarea') as HTMLTextAreaElement | null;
                    el?.focus();
                  });
                }}
                className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                aria-label={isCompact ? 'Expand webpage' : 'Collapse webpage'}
                aria-expanded={!isCompact}
                title={isCompact ? 'Expand' : 'Collapse'}
              >
                {isCompact ? <ChevronUpIcon /> : <ChevronDownIcon />}
              </button>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                title={t('close') || 'Close'}
                aria-label={t('close') || 'Close'}
              >
                <XIcon />
              </button>
            </div>
          </div>

          {/* Top: Iframe Area */}
          <motion.div
            initial={false}
            animate={{
              height: isCompact ? 0 : 'auto',
              opacity: isCompact ? 0 : 1,
              flexGrow: isCompact ? 0 : 1,
              minHeight: isCompact ? 0 : 240
            }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="relative bg-black overflow-hidden rounded-none"
            style={{ pointerEvents: isCompact ? 'none' : 'auto' }}
          >
            {iframeLoading && !iframeError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-[var(--color-base-dark)]">
                <div className="w-12 h-12 border-2 border-white/10 border-t-[var(--brand-primary)] rounded-full animate-spin mb-4"></div>
                <div className="text-white/40 text-sm animate-pulse">Loading VividAI...</div>
              </div>
            )}
            
            {iframeError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-10 bg-[var(--color-base-dark)] p-8 text-center">
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
                ref={iframeRef}
                src={iframeUrl}
                className="w-full border-none block"
                style={{
                  height: 'calc(100% + 90px)',
                  marginTop: '-90px'
                }}
                title={WEB_TITLE}
                onLoad={() => {
                  setIframeLoading(false);
                  iframeWindowRef.current = iframeRef.current?.contentWindow ?? null;
                  if (!initSentRef.current) {
                    postInitToIframe();
                  }
                }}
                onError={() => {
                  setIframeLoading(false);
                  setIframeError(true);
                }}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals"
                allow="clipboard-write *; clipboard-read *; fullscreen *"
              />
            )}
          </motion.div>

          {/* Bottom: PromptBar Area */}
          <div className={`flex-none bg-[var(--workspace-bg-main)] relative z-20 ${isCompact ? '' : 'border-t border-[var(--workspace-border)]'}`}>
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
