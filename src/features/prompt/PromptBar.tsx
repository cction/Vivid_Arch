import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { QuickPrompts } from './QuickPrompts';
import { BananaSidebar } from '@/features/sidebar/BananaSidebar';
import { IconButton, Textarea } from '../../ui';
import type { UserEffect, GenerationMode } from '@/types';

interface PromptBarProps {
    t: (key: string, ...args: unknown[]) => string;
    language: 'en' | 'ZH';
    prompt: string;
    setPrompt: (prompt: string) => void;
    onGenerate: () => void;
    isLoading: boolean;
    isSelectionActive: boolean;
    selectedElementCount: number;
    userEffects: UserEffect[];
    onAddUserEffect: (effect: UserEffect) => void;
    onDeleteUserEffect: (id: string) => void;
    generationMode: GenerationMode;
    setGenerationMode: (mode: GenerationMode) => void;
    videoAspectRatio: '16:9' | '9:16';
    setVideoAspectRatio: (ratio: '16:9' | '9:16') => void;
    activeImageModel: string;
    imageSize: '1K' | '2K' | '4K';
    setImageSize: (size: '1K' | '2K' | '4K') => void;
    containerRef?: React.Ref<HTMLDivElement>;
    imageAspectRatio: string;
    setImageAspectRatio: (ratio: string) => void;
    setImageModel: (model: string) => void;
    apiProvider: 'WHATAI' | 'Grsai';
}

function readTokenPx(name: string, fallback: number) {
    try {
        const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        const n = parseFloat(v.replace('px', ''));
        return Number.isFinite(n) ? n : fallback;
    } catch {
        return fallback;
    }
}

function computeExpandedWidth() {
    const spaceX = readTokenPx('--space-10', 40);
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
    const target = Math.min(580, Math.max(320, Math.round(vw - spaceX * 2)));
    return target;
}
const ASPECT_RATIOS = [
    { id: 'auto', label: 'auto' },
    { id: '1:1', label: '1:1' },
    { id: '16:9', label: '16:9' },
    { id: '9:16', label: '9:16' },
    { id: '4:3', label: '4:3' },
    { id: '3:4', label: '3:4' },
    { id: '3:2', label: '3:2' },
    { id: '2:3', label: '2:3' },
    { id: '5:4', label: '5:4' },
    { id: '4:5', label: '4:5' },
    { id: '21:9', label: '21:9' },
];

export const PromptBar: React.FC<PromptBarProps> = ({
    t,
    language,
    prompt,
    setPrompt,
    onGenerate,
    isLoading,
    isSelectionActive,
    selectedElementCount,
    userEffects,
    onAddUserEffect,
    onDeleteUserEffect,
    generationMode,
    setGenerationMode,
    videoAspectRatio,
    setVideoAspectRatio,
    activeImageModel,
    imageSize,
    setImageSize,
    containerRef,
    imageAspectRatio,
    setImageAspectRatio,
    setImageModel,
    apiProvider
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
    const [isRatioMenuOpen, setIsRatioMenuOpen] = useState(false);
    const [modelMenuAnchor, setModelMenuAnchor] = useState<{ left: number; top: number; width: number } | null>(null);
    const [ratioMenuAnchor, setRatioMenuAnchor] = useState<{ left: number; top: number; width: number } | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const modelMenuRef = useRef<HTMLDivElement>(null);
    const ratioMenuRef = useRef<HTMLDivElement>(null);
    const modelButtonRef = useRef<HTMLButtonElement>(null);
    const ratioButtonRef = useRef<HTMLButtonElement>(null);
    const modelPortalRef = useRef<HTMLDivElement>(null);
    const ratioPortalRef = useRef<HTMLDivElement>(null);
    const blockCollapseUntilRef = useRef<number>(0);
    const [expandedWidth, setExpandedWidth] = useState<number>(580);
    const [maxTextareaHeight, setMaxTextareaHeight] = useState<number>(240);

    useEffect(() => {
        const apply = () => setExpandedWidth(computeExpandedWidth());
        apply();
        const onResize = () => apply();
        window.addEventListener('resize', onResize, { passive: true });
        return () => window.removeEventListener('resize', onResize);
    }, []);
    useEffect(() => {
        const apply = () => {
            const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
            const target = Math.min(360, Math.max(160, Math.round(vh * 0.4)));
            setMaxTextareaHeight(target);
        };
        apply();
        const onResize = () => apply();
        window.addEventListener('resize', onResize, { passive: true });
        return () => window.removeEventListener('resize', onResize);
    }, []);
    const expandedContentRef = useRef<HTMLDivElement>(null);

    const [contentHeight, setContentHeight] = useState<number | 'auto'>('auto');

    // Measure content height
    useEffect(() => {
        if (!expandedContentRef.current) return;
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContentHeight(entry.contentRect.height + 16); // +16 for padding (top 4 + bottom 12)
            }
        });
        observer.observe(expandedContentRef.current);
        return () => observer.disconnect();
    }, [isExpanded]);

    // Auto-expand if prompt is not empty
    useEffect(() => {
        if (prompt.trim().length > 0 && !isExpanded) {
            const id = setTimeout(() => setIsExpanded(true), 0);
            return () => clearTimeout(id);
        }
    }, [prompt, isExpanded]);

    // Click outside to collapse
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const inWrapper = wrapperRef.current?.contains(target) ?? false;
            const inModelButton = modelButtonRef.current?.contains(target) ?? false;
            const inModelPortal = modelPortalRef.current?.contains(target) ?? false;
            const inRatioButton = ratioButtonRef.current?.contains(target) ?? false;
            const inRatioPortal = ratioPortalRef.current?.contains(target) ?? false;

            if (!inModelButton && !inModelPortal) {
                setIsModelMenuOpen(false);
            }
            if (!inRatioButton && !inRatioPortal) {
                setIsRatioMenuOpen(false);
            }

            const now = Date.now();
            if (prompt.trim().length === 0 && !(inWrapper || inModelButton || inModelPortal || inRatioButton || inRatioPortal) && now >= blockCollapseUntilRef.current) {
                setIsExpanded(false);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [prompt]);

    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        let raf = requestAnimationFrame(() => {
            el.style.height = 'auto';
            const sh = el.scrollHeight;
            const mh = maxTextareaHeight;
            el.style.height = `${Math.min(sh, mh)}px`;
            el.style.overflowY = sh > mh ? 'auto' : 'hidden';
        });
        return () => cancelAnimationFrame(raf);
    }, [prompt, maxTextareaHeight]);

    

    const getPlaceholderText = () => {
        if (!isSelectionActive) {
            return generationMode === 'video' ? t('promptBar.placeholderDefaultVideo') : t('promptBar.placeholderDefault');
        }
        if (selectedElementCount === 1) {
            return t('promptBar.placeholderSingle');
        }
        return t('promptBar.placeholderMultiple', selectedElementCount);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!isLoading && prompt.trim()) {
                onGenerate();
            }
        }
    };

    const handleSaveEffect = () => {
        let name: string | null = null;
        const canPrompt = typeof window !== 'undefined' && typeof window.prompt === 'function';
        if (canPrompt) {
            name = window.prompt(t('myEffects.saveEffectPrompt'), t('myEffects.defaultName'));
        }
        const fallback = prompt.trim().slice(0, 16) || t('myEffects.defaultName');
        const finalName = (name ?? fallback).trim();
        if (finalName && prompt.trim()) {
            onAddUserEffect({ id: `user_${Date.now()}`, name: finalName, value: prompt });
        }
    };

    // Handle Banana Sidebar selection
    const handleBananaSelect = (val: string) => {
        setPrompt(val);
        setIsExpanded(true);
    };

    const MODELS = apiProvider === 'Grsai'
        ? [
            { id: 'nano-banana-fast', label: 'Standard_B', short: 'Std_B' },
            { id: 'nano-banana-pro', label: 'Professional_B', short: 'Pro_B' },
          ]
        : [
            { id: 'nano-banana', label: 'Standard_A', short: 'Std_A' },
            { id: 'nano-banana-2', label: 'Professional_A', short: 'Pro_A' },
          ];
    const activeModelLabel = MODELS.find(m => m.id === activeImageModel)?.label || activeImageModel || 'Model';
    const sizeAllowed = activeImageModel === 'nano-banana-pro' || activeImageModel === 'nano-banana-2';
    const effectiveSize = sizeAllowed ? imageSize : '1K';
    const sizeDisabled = !sizeAllowed;

    const space3 = readTokenPx('--space-3', 12);
    const space4 = readTokenPx('--space-4', 16);
    const space10 = readTokenPx('--space-10', 40);
    const textareaPadding = (() => {
        const right = (prompt.trim() && !isLoading) ? space10 * 4.25 : space10 * 3.25;
        return `${space4}px ${Math.round(right)}px ${space4}px ${space3}px`;
    })();

    return (
        <div ref={containerRef} className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[100] flex justify-center">
            <motion.div
                ref={wrapperRef}
                initial={false}
                animate={{
                    width: isExpanded ? expandedWidth : 180,
                    height: isExpanded ? contentHeight : 56,
                    borderRadius: isExpanded ? 24 : 999
                }}
                transition={{
                    borderRadius: isExpanded ? {
                        duration: 0.06,
                        ease: "easeOut",
                        delay: 0
                    } : {
                        type: "tween",
                        ease: "easeOut",
                        duration: 0.06,
                        delay: 0
                    },
                    width: {
                        type: "tween",
                        ease: [0.16, 1, 0.3, 1],
                        duration: 0.1,
                        delay: 0
                    },
                    height: {
                        type: "tween",
                        ease: [0.16, 1, 0.3, 1],
                        duration: 0.1,
                        delay: 0
                    },
                    default: {
                        type: "tween",
                        ease: "easeOut",
                        duration: 0.1,
                        delay: 0
                    }
                }}
                className="relative pod-prompt-bar overflow-hidden"
            >
                <AnimatePresence mode="sync">
                    {!isExpanded ? (
                        /* Collapsed Pill View */
                        <motion.div
                            key="collapsed"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1, transition: { duration: 0.1, delay: 0 } }}
                            exit={{ opacity: 0, transition: { duration: 0.08, delay: 0 } }}
                            className="absolute inset-0 flex items-center gap-3 w-full px-3 cursor-pointer"
                            onClick={() => setIsExpanded(true)}
                        >
                            <div className="flex items-center gap-3 w-full">
                                <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                    <BananaSidebar
                                        t={t}
                                        language={language}
                                        setPrompt={handleBananaSelect}
                                        onGenerate={() => { }}
                                        disabled={isLoading}
                                        promptBarOffsetPx={0}
                                        buttonSize={40}
                                    />
                                </div>
                                <span className="text-neutral-400 text-sm font-medium truncate select-none">
                                    Talk to me...
                                </span>
                            </div>
                        </motion.div>
                    ) : (
                        /* Expanded Card View */
                        <motion.div
                            key="expanded"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1, transition: { duration: 0.12, delay: 0 } }}
                            exit={{ opacity: 0, transition: { duration: 0.08 } }}
                            className="flex flex-col px-3 pt-1 pb-3 gap-0"
                            style={{ width: expandedWidth }}
                            ref={expandedContentRef}
                        >
                            {/* Body: Input Area */}
                            <div className="relative group rounded-xl px-1 transition-colors">
                                {/* Top-Right Controls: QuickPrompts + Mode Switcher */}
                            <div className="pod-prompt-top-controls">
                                {prompt.trim() && !isLoading && (
                                    <IconButton
                                        onClick={handleSaveEffect}
                                        title={t('myEffects.saveEffectTooltip')}
                                        noHoverHighlight
                                        className="pod-circle-button"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" /></svg>
                                    </IconButton>
                                )}
                                <QuickPrompts
                                        t={t}
                                        language={language}
                                        setPrompt={setPrompt}
                                        disabled={!isSelectionActive || isLoading}
                                        userEffects={userEffects}
                                        onDeleteUserEffect={onDeleteUserEffect}
                                        className="pod-circle-button"
                                    />
                                    {/* Mode Switcher */}
                                    <div className="pod-prompt-mode-switch">
                                        <button
                                            onClick={() => setGenerationMode('image')}
                                            className={`pod-prompt-mode-button ${generationMode === 'image' ? 'active' : ''}`}
                                            title="Image Mode"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                                        </button>
                                        <button
                                            onClick={() => setGenerationMode('video')}
                                            className={`pod-prompt-mode-button ${generationMode === 'video' ? 'active' : ''}`}
                                            title="Video Mode"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg>
                                        </button>
                                    </div>
                                </div>

                                <Textarea
                                    ref={textareaRef}
                                    rows={3}
                                    value={prompt}
                                    onChange={(e) => setPrompt((e.target as HTMLTextAreaElement).value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={getPlaceholderText()}
                                    className="pod-prompt-textarea pod-scrollbar-y"
                                    style={{ '--pod-textarea-padding': textareaPadding, maxHeight: `${maxTextareaHeight}px` } as React.CSSProperties}
                                    disabled={isLoading}
                                    autoFocus
                                />
                            </div>

                            {/* Footer: Controls Row */}
                            <div className="flex items-center justify-between pt-1">
                                {/* Left: Banana Button */}
                                <div className="relative">
                                    <BananaSidebar
                                        t={t}
                                        language={language}
                                        setPrompt={setPrompt}
                                        onGenerate={onGenerate}
                                        disabled={isLoading}
                                        promptBarOffsetPx={0}
                                        buttonSize={36}
                                    />
                                </div>

                                {/* Right: Settings & Generate */}
                                <div className="flex items-center overflow-x-auto no-scrollbar gap-[var(--space-2)]">
                                    {/* Model Selector */}
                                    {generationMode === 'image' && (
                                        <div className="relative" ref={modelMenuRef}>
                                            <button
                                                ref={modelButtonRef}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                                setModelMenuAnchor({ left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width) });
                                                setIsModelMenuOpen(!isModelMenuOpen);
                                            }}
                                                className="pod-prompt-selector"
                                            >
                                                {activeModelLabel}
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${isModelMenuOpen ? 'rotate-180' : ''}`}><path d="m6 9 6 6 6-6" /></svg>
                                            </button>
                                            {isModelMenuOpen && modelMenuAnchor && createPortal(
                                                <motion.div
                                                    ref={modelPortalRef}
                                                    initial={{ opacity: 0, y: -4, scale: 0.95 }}
                                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                                    className="pod-prompt-menu-overlay pod-overlay-position w-48"
                                                    style={{ 
                                                        '--pod-left': `${Math.round(modelMenuAnchor.left + modelMenuAnchor.width / 2 - 192 / 2)}px`, 
                                                        '--pod-bottom': `${Math.round(window.innerHeight - modelMenuAnchor.top + 8)}px` 
                                                    } as React.CSSProperties}
                                                >
                                                    {MODELS.map(m => (
                                                        <button
                                                            key={m.id}
                                                            onClick={(e) => { e.stopPropagation(); setImageModel(m.id); setIsModelMenuOpen(false); setIsExpanded(true); }}
                                                            className={`pod-prompt-menu-item-row ${activeImageModel === m.id ? 'active' : ''}`}
                                                        >
                                                            <span>{m.label}</span>
                                                            {activeImageModel === m.id && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                                                        </button>
                                                    ))}
                                                </motion.div>, document.body)
                                            }
                                        </div>
                                    )}

                                    {/* Size Selector */}
                                    {generationMode === 'image' && (
                                        <div className="pod-segmented-control">
                                            {(['1K', '2K', '4K'] as const).map((size) => (
                                                <button
                                                    key={size}
                                                    onClick={() => { if (!sizeDisabled) setImageSize(size); }}
                                                    className={`pod-segment-button ${effectiveSize === size ? 'active' : ''}`}
                                                    disabled={sizeDisabled}
                                                    aria-disabled={sizeDisabled}
                                                >
                                                    <span className={effectiveSize === size && size === '4K' ? 'pod-text-gold-sheen' : ''}>
                                                        {size}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {/* Aspect Ratio Selector */}
                                    <div className="relative" ref={ratioMenuRef}>
                                        <button
                                            ref={ratioButtonRef}
                                            onMouseDown={(e) => e.stopPropagation()}
                                            onClick={(e) => {
                                                const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                                setRatioMenuAnchor({ left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width) });
                                                setIsRatioMenuOpen(!isRatioMenuOpen);
                                            }}
                                            className="pod-prompt-selector"
                                            title="Aspect Ratio"
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="10" rx="2" ry="2" /></svg>
                                            {generationMode === 'image' ? imageAspectRatio : videoAspectRatio}
                                        </button>
                                        {isRatioMenuOpen && ratioMenuAnchor && createPortal(
                                            <motion.div
                                                ref={ratioPortalRef}
                                                initial={{ opacity: 0, y: -4, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                className={`pod-overlay-position fixed z-[10000] bg-[var(--bg-component-solid)] border border-[var(--border-color)] rounded-xl shadow-xl overflow-hidden py-1 ${generationMode === 'image' ? 'grid grid-cols-3 gap-1 p-1' : ''}`}
                                                style={{ 
                                                    '--pod-left': `${Math.round(ratioMenuAnchor.left + ratioMenuAnchor.width / 2 - (generationMode === 'image' ? 240 : 96) / 2)}px`, 
                                                    '--pod-bottom': `${Math.round(window.innerHeight - ratioMenuAnchor.top + 8)}px`,
                                                    width: generationMode === 'image' ? 240 : 96 
                                                } as React.CSSProperties}
                                            >
                                                {generationMode === 'image' ? (
                                                    ASPECT_RATIOS.map(r => (
                                                        <button
                                                            key={r.id}
                                                            onClick={() => { setImageAspectRatio(r.id); setIsRatioMenuOpen(false); setIsExpanded(true); blockCollapseUntilRef.current = Date.now() + 800; requestAnimationFrame(() => { textareaRef.current?.focus(); }); }}
                                                             className={`w-full px-1 py-1.5 text-center text-xs hover:bg-[var(--border-color)] rounded-md transition-colors ${imageAspectRatio === r.id ? 'bg-[var(--border-color)] text-[var(--brand-primary)] font-medium' : 'text-[var(--text-primary)]'}`}
                                                         >
                                                             {r.label}
                                                         </button>
                                                     ))
                                                 ) : (
                                                    ['16:9', '9:16'].map(r => (
                                                        <button
                                                            key={r}
                                                            onClick={() => { setVideoAspectRatio(r as '16:9' | '9:16'); setIsRatioMenuOpen(false); setIsExpanded(true); blockCollapseUntilRef.current = Date.now() + 800; requestAnimationFrame(() => { textareaRef.current?.focus(); }); }}
                                                             className={`w-full px-3 py-1.5 text-left text-xs hover:bg-[var(--border-color)] transition-colors ${videoAspectRatio === r ? 'text-[var(--brand-primary)] font-medium' : 'text-[var(--text-primary)]'}`}
                                                         >
                                                             {r}
                                                         </button>
                                                     ))
                                                 )}
                                            </motion.div>, document.body)
                                        }
                                    </div>

                                    {/* Generate Button */}
                                    <button
                                        onClick={onGenerate}
                                        disabled={isLoading || !prompt.trim()}
                                        className="h-9 px-5 rounded-xl font-bold text-sm transition-all active:scale-[0.98] shadow-lg shadow-black/20 whitespace-nowrap pod-generate-button flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isLoading ? (
                                            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        ) : (
                                            t('promptBar.generate')
                                        )}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
};
