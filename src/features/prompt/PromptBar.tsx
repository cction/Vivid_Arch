import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { QuickPrompts } from './QuickPrompts';
import { Chip, IconButton, Textarea } from '../../ui';
import type { UserEffect, GenerationMode } from '@/types';
import { getWeatherPresetById } from '@/i18n/translations';

const BASE_URL = ((import.meta as unknown as { env?: { BASE_URL?: string } })?.env?.BASE_URL) || '/';
const withBase = (p: string) => {
    const normalized = p.startsWith('/') ? p.slice(1) : p;
    return `${BASE_URL}${normalized}`;
};
const BANANA_ICON_SRC = withBase('logo/AIVA.svg');

export interface PromptBarProps {
    t: (key: string, ...args: unknown[]) => string;
    language: 'en' | 'ZH';
    prompt: string;
    setPrompt: (prompt: string) => void;
    selectedWeatherId: string | null;
    onRemoveWeatherId: () => void;
    onGenerate: () => void;
    onCancelGenerate: () => void;
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
    onBananaClick?: () => void;
    mode?: 'floating' | 'static';
    className?: string;
    forceExpanded?: boolean;
    noBorderRadius?: boolean;
    noBorder?: boolean;
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

type PromptInputWithPrefixTagProps = {
    language: 'en' | 'ZH';
    prompt: string;
    setPrompt: (prompt: string) => void;
    selectedWeatherId: string | null;
    onRemoveWeatherId: () => void;
    onGenerate: () => void;
    isLoading: boolean;
    placeholder: string;
    textareaPadding: string;
    currentMaxHeight: number;
    textareaRef: React.RefObject<HTMLTextAreaElement>;
    space3: number;
    space4: number;
};

function PromptInputWithPrefixTag({
    language,
    prompt,
    setPrompt,
    selectedWeatherId,
    onRemoveWeatherId,
    onGenerate,
    isLoading,
    placeholder,
    textareaPadding,
    currentMaxHeight,
    textareaRef,
    space3,
    space4,
}: PromptInputWithPrefixTagProps) {
    const chipMeasureRef = useRef<HTMLDivElement>(null);
    const [chipIndentPx, setChipIndentPx] = useState(0);
    const preset = selectedWeatherId ? getWeatherPresetById(language, selectedWeatherId) : null;
    const presetLabel = preset?.name || selectedWeatherId || '';

    useEffect(() => {
        if (!selectedWeatherId) return;
        const node = chipMeasureRef.current;
        if (!node) return;
        let raf = 0;
        const measure = () => {
            const rect = node.getBoundingClientRect();
            const next = Math.ceil(rect.width + 8);
            setChipIndentPx((prev) => (prev === next ? prev : next));
        };
        const schedule = () => {
            if (raf) cancelAnimationFrame(raf);
            raf = requestAnimationFrame(measure);
        };
        schedule();
        const ro = new ResizeObserver(() => schedule());
        ro.observe(node);
        window.addEventListener('resize', schedule, { passive: true });
        return () => {
            ro.disconnect();
            window.removeEventListener('resize', schedule);
            if (raf) cancelAnimationFrame(raf);
        };
    }, [selectedWeatherId, language]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if ((e.key === 'Backspace' || e.key === 'Delete') && selectedWeatherId && !isLoading) {
            if (e.ctrlKey || e.altKey || e.metaKey) return;
            const native = e.nativeEvent as unknown as { isComposing?: boolean };
            if (native?.isComposing) return;
            const target = e.currentTarget;
            if (target.selectionStart === 0 && target.selectionEnd === 0) {
                e.preventDefault();
                onRemoveWeatherId();
                requestAnimationFrame(() => {
                    const el = textareaRef.current;
                    el?.focus();
                    try {
                        el?.setSelectionRange(0, 0);
                    } catch {
                        void 0;
                    }
                });
                return;
            }
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!isLoading && (prompt.trim() || selectedWeatherId)) {
                onGenerate();
            }
        }
    };

    return (
        <>
            {selectedWeatherId && (
                <div
                    ref={chipMeasureRef}
                    className="absolute z-10 select-none"
                    style={{ left: `${space3}px`, top: `${space4}px` }}
                >
                    <Chip
                        disabled={isLoading}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                            onRemoveWeatherId();
                            textareaRef.current?.focus();
                        }}
                        className="!min-h-0 !h-[20px] !text-xs !leading-none !px-2 !py-0 !rounded-md !font-medium flex items-center justify-center !bg-neutral-200 dark:!bg-neutral-700 hover:!bg-neutral-300 dark:hover:!bg-neutral-600 !text-neutral-600 dark:!text-neutral-300 !border-0 transition-colors"
                        title={presetLabel}
                    >
                        {presetLabel}
                    </Chip>
                </div>
            )}
            <Textarea
                ref={textareaRef}
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt((e.target as HTMLTextAreaElement).value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="pod-prompt-textarea pod-scrollbar-y"
                style={{
                    '--pod-textarea-padding': textareaPadding,
                    maxHeight: `${currentMaxHeight}px`,
                    textIndent: selectedWeatherId ? `${chipIndentPx}px` : undefined,
                } as React.CSSProperties}
                disabled={isLoading}
                autoFocus
            />
        </>
    );
}

export const PromptBar: React.FC<PromptBarProps> = ({
    t,
    language,
    prompt,
    setPrompt,
    onRemoveWeatherId,
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
    apiProvider,
    onCancelGenerate,
    onBananaClick,
    mode,
    forceExpanded,
    className,
    noBorderRadius,
    noBorder,
    selectedWeatherId
}) => {
    const [isExpanded, setIsExpanded] = useState(forceExpanded || false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);

    const handleGenerateClick = () => {
        if (isLoading) {
            onCancelGenerate();
        } else if (prompt.trim() || selectedWeatherId) {
            onGenerate();
        }
    };
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
    const [isPromptCollapsed, setIsPromptCollapsed] = useState(false);
    const [showCollapseButton, setShowCollapseButton] = useState(false);
    

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
        if ((prompt.trim().length > 0 || selectedWeatherId) && !isExpanded) {
            const id = setTimeout(() => setIsExpanded(true), 0);
            return () => clearTimeout(id);
        }
    }, [prompt, selectedWeatherId, isExpanded]);

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
            if (prompt.trim().length === 0 && !selectedWeatherId && !(inWrapper || inModelButton || inModelPortal || inRatioButton || inRatioPortal) && now >= blockCollapseUntilRef.current) {
                setIsExpanded(false);
            }
        };
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [prompt, selectedWeatherId]);

    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        let raf = requestAnimationFrame(() => {
            el.style.height = 'auto';
            const sh = el.scrollHeight;
            // 5 lines threshold estimation:
            // 3 lines = 104px (approx 24px/line + 32px padding)
            // 5 lines = 5 * 24 + 32 = 152px
            const threshold = 152;
            const canCollapse = sh > threshold;
            if (showCollapseButton !== canCollapse) {
                setShowCollapseButton(canCollapse);
            }

            const mh = (isPromptCollapsed && canCollapse) ? 104 : maxTextareaHeight;
            el.style.height = `${Math.min(sh, mh)}px`;
            el.style.overflowY = sh > mh ? 'auto' : 'hidden';
        });
        return () => cancelAnimationFrame(raf);
    }, [prompt, maxTextareaHeight, isPromptCollapsed, showCollapseButton]);

    

    const getPlaceholderText = () => {
        if (!isSelectionActive) {
            return generationMode === 'video' ? t('promptBar.placeholderDefaultVideo') : t('promptBar.placeholderDefault');
        }
        if (selectedElementCount === 1) {
            return t('promptBar.placeholderSingle');
        }
        return t('promptBar.placeholderMultiple', selectedElementCount);
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

    const MODELS = apiProvider === 'Grsai'
        ? [
            { id: 'nano-banana-fast', label: 'Standard_B', short: 'Std_B' },
            { id: 'nano-banana-pro-cl', label: 'Professional_B', short: 'Pro_B' },
          ]
        : [
            { id: 'nano-banana', label: 'Standard_A', short: 'Std_A' },
            { id: 'nano-banana-2', label: 'Professional_A', short: 'Pro_A' },
          ];
    const activeModelLabel = MODELS.find(m => m.id === activeImageModel)?.label || activeImageModel || 'Model';
    const sizeAllowed = activeImageModel === 'nano-banana-2' || activeImageModel === 'nano-banana-pro' || activeImageModel === 'nano-banana-pro-cl';
    const effectiveSize = sizeAllowed ? imageSize : '1K';
    const sizeDisabled = !sizeAllowed;

    const space3 = readTokenPx('--space-3', 12);
    const space4 = readTokenPx('--space-4', 16);
    const space10 = readTokenPx('--space-10', 40);
    const textareaPadding = (() => {
        const right = (prompt.trim() && !isLoading) ? space10 * 4.25 : space10 * 3.25;
        return `${space4}px ${Math.round(right)}px ${space4}px ${space3}px`;
    })();

    const currentMaxHeight = isPromptCollapsed ? 104 : maxTextareaHeight;
    const isPromptEmpty = !prompt.trim() && !selectedWeatherId;
    const isGenerating = isLoading;

    const containerClasses = mode === 'static'
        ? `w-full flex justify-center ${className || ''}`
        : `absolute bottom-6 left-1/2 -translate-x-1/2 z-[100] flex justify-center ${className || ''}`;

    return (
        <div ref={containerRef} className={containerClasses}>
            <motion.div
                ref={wrapperRef}
                initial={false}
                animate={{
                    width: isExpanded ? (mode === 'static' ? '100%' : expandedWidth) : 180,
                    height: isExpanded ? contentHeight : 56,
                    borderRadius: noBorderRadius ? 0 : (isExpanded ? 24 : 999)
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
                className={`relative overflow-hidden ${noBorder ? '' : 'pod-prompt-bar'}`}
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
                                    <button
                                        onClick={() => onBananaClick?.()}
                                        disabled={isLoading || !onBananaClick}
                                        aria-label="Open workspace"
                                        title="Open workspace"
                                        className="pod-banana-trigger"
                                        style={{ height: 40, width: 40 }}
                                    >
                                        <img
                                            src={BANANA_ICON_SRC}
                                            width={40}
                                            height={40}
                                            alt="aiva"
                                            className="block"
                                            onError={(e) => {
                                                const t = e.currentTarget;
                                                t.onerror = null;
                                                t.src = BANANA_ICON_SRC;
                                            }}
                                        />
                                    </button>
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
                            style={{ width: mode === 'static' ? '100%' : expandedWidth }}
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
                                    
                                    {showCollapseButton && (
                                    <IconButton
                                        onClick={() => setIsPromptCollapsed(v => !v)}
                                        title={language === 'ZH' ? (isPromptCollapsed ? '展开提示词框' : '折叠提示词框') : (isPromptCollapsed ? 'Expand prompt bar' : 'Collapse prompt bar')}
                                        noHoverHighlight
                                        className="pod-circle-button !w-5 !h-5 !p-0 !border-0 !bg-transparent hover:!bg-transparent text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 !-ml-1"
                                    >
                                        {isPromptCollapsed ? (
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
                                        ) : (
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
                                        )}
                                    </IconButton>
                                    )}
                                </div>

                                <PromptInputWithPrefixTag
                                    language={language}
                                    prompt={prompt}
                                    setPrompt={setPrompt}
                                    selectedWeatherId={selectedWeatherId}
                                    onRemoveWeatherId={onRemoveWeatherId}
                                    onGenerate={onGenerate}
                                    isLoading={isLoading}
                                    placeholder={getPlaceholderText()}
                                    textareaPadding={textareaPadding}
                                    currentMaxHeight={currentMaxHeight}
                                    textareaRef={textareaRef}
                                    space3={space3}
                                    space4={space4}
                                />
                            </div>

                            {/* Footer: Controls Row */}
                            <div className="flex items-center justify-between pt-1">
                                {/* Left: Banana Button */}
                                <div className="relative">
                                    <button
                                        onClick={() => onBananaClick?.()}
                                        disabled={isLoading || !onBananaClick}
                                        aria-label="Open workspace"
                                        title="Open workspace"
                                        className="pod-banana-trigger"
                                        style={{ height: 36, width: 36 }}
                                    >
                                        <img
                                            src={BANANA_ICON_SRC}
                                            width={36}
                                            height={36}
                                            alt="aiva"
                                            className="block"
                                            onError={(e) => {
                                                const t = e.currentTarget;
                                                t.onerror = null;
                                                t.src = BANANA_ICON_SRC;
                                            }}
                                        />
                                    </button>
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

                                    <button
                                        onClick={handleGenerateClick}
                                        disabled={!isLoading && isPromptEmpty}
                                        className="h-9 w-24 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-black/20 pod-generate-button flex items-center justify-center text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                                        aria-label={isGenerating ? t('promptBar.cancel') : t('promptBar.generate')}
                                        title={isGenerating ? t('promptBar.cancel') : t('promptBar.generate')}
                                    >
                                        {isGenerating ? (
                                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="8" />
                                                <rect x="9.5" y="9.5" width="5" height="5" rx="0.6" fill="currentColor" />
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
