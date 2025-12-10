import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { translations } from '@/i18n/translations';
import type { UserEffect } from '@/types';
import { Panel, IconButton, MenuItem } from '../../ui';

interface QuickPromptsProps {
    t: (key: string, ...args: unknown[]) => unknown;
    language: 'en' | 'ZH';
    setPrompt: (prompt: string) => void;
    disabled: boolean;
    userEffects: UserEffect[];
    onDeleteUserEffect: (id: string) => void;
    className?: string;
}

export const QuickPrompts: React.FC<QuickPromptsProps> = ({ t, language, setPrompt, disabled, userEffects, onDeleteUserEffect, className }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const [anchor, setAnchor] = useState<{ left: number; top: number; width: number } | null>(null);

    const handleSelect = (value: string) => {
        if (value) {
            setPrompt(value);
        }
        setIsMenuOpen(false);
    };
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            const inButton = buttonRef.current?.contains(target) ?? false;
            const inMenu = menuRef.current?.contains(target) ?? false;
            const inWrapper = wrapperRef.current?.contains(target) ?? false;
            if (!(inButton || inMenu || inWrapper)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    const builtInPrompts = (language === 'ZH' ? translations.ZH.quickPrompts : translations.en.quickPrompts) as { name: string; value: string }[];

    return (
        <div className="relative" ref={wrapperRef}>
            <IconButton
                ref={buttonRef}
                onClick={(e) => {
                    const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                    setAnchor({ left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width) });
                    setIsMenuOpen(prev => !prev);
                }}
                disabled={disabled}
                aria-label={t('quickPromptsAriaLabel') as string}
                title={t('quickPromptsAriaLabel') as string}
                noHoverHighlight
                className={`quick-prompts-button flex-shrink-0 flex items-center justify-center ${className || 'w-11 h-11'}`}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2.69l.13.04a7.9 7.9 0 0 1 5.92 6.61 8.27 8.27 0 0 1-1.77 6.13A8.52 8.52 0 0 1 12 21.31a8.52 8.52 0 0 1-4.28-5.83 8.27 8.27 0 0 1-1.77-6.13A7.9 7.9 0 0 1 11.87 2.73L12 2.69zM12 22v-1.16"/><path d="M9 19h6"/></svg>
            </IconButton>
            {isMenuOpen && anchor && createPortal(
                <div
                    ref={menuRef}
                    className="pod-overlay-position fixed z-[10000] w-80"
                    style={{ '--pod-left': `${Math.round(anchor.left + anchor.width / 2 - 320 / 2)}px`, '--pod-bottom': `${Math.round(window.innerHeight - anchor.top + 8)}px` } as React.CSSProperties}
                >
                    <Panel className="pod-menu-panel max-h-96 overflow-y-auto pod-scrollbar-y">
                        <h4 className="pod-menu-header">{t('myEffects.title')}</h4>
                        {userEffects.length > 0 ? (
                            userEffects.map((effect) => (
                                <div key={effect.id} className="group flex items-center justify-between p-2 pod-list-item text-sm">
                                    <button onClick={() => handleSelect(effect.value)} className="flex-grow text-left truncate">
                                        {effect.name}
                                    </button>
                                    <IconButton
                                        onClick={() => onDeleteUserEffect(effect.id)}
                                        title={t('myEffects.deleteEffectTooltip') as string}
                                        className="ml-2 opacity-0 group-hover:opacity-100 flex-shrink-0 text-[var(--color-red-400)]"
                                    >
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                    </IconButton>
                                </div>
                            ))
                        ) : (
                            <p className="px-2 pb-2 text-xs text-[var(--text-secondary)]">{t('myEffects.noEffects')}</p>
                        )}
                        <div className="my-2 -mx-2 border-t border-[var(--border-color)]"></div>
                        {builtInPrompts.map((item, index) => (
                            <MenuItem 
                                key={index} 
                                onClick={() => handleSelect(item.value)}
                                className="block w-full text-left"
                            >
                                {item.name}
                            </MenuItem>
                        ))}
                    </Panel>
                </div>,
                document.body
            )}
        </div>
    );
};
