import React from 'react';
import { Panel, IconButton, Button } from '@/ui';
import type { WheelAction } from '@/types';
import { UpdatePanel, type VersionUpdate } from './UpdatePanel';
import updateFeed from '@/config/updateFeed.json';

interface CanvasSettingsProps {
    isOpen: boolean;
    onClose: () => void;
    canvasBackgroundColor: string;
    onCanvasBackgroundColorChange: (color: string) => void;
    language: 'en' | 'ZH';
    setLanguage: (lang: 'en' | 'ZH') => void;
    wheelAction: WheelAction;
    setWheelAction: (action: WheelAction) => void;
    t: (key: string) => string;
    apiKey: string;
    setApiKey: (key: string) => void;
    apiProvider: 'WHATAI' | 'Grsai';
    setApiProvider: (p: 'WHATAI' | 'Grsai') => void;
    grsaiApiKey: string;
    setGrsaiApiKey: (key: string) => void;
    isKeyInputLocked: boolean;
}


export const CanvasSettings: React.FC<CanvasSettingsProps> = ({
    isOpen,
    onClose,
    canvasBackgroundColor,
    onCanvasBackgroundColorChange,
    language,
    setLanguage,
    wheelAction,
    setWheelAction,
    t,
    apiKey,
    setApiKey,
    apiProvider,
    setApiProvider,
    grsaiApiKey,
    setGrsaiApiKey,
    isKeyInputLocked,
}) => {
    const DEFAULT_CANVAS_BG = '#0F0D13';
    const isValidHexColor = (v: string) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v);
    const resolvedCanvasBackgroundColor = isValidHexColor(canvasBackgroundColor) ? canvasBackgroundColor : DEFAULT_CANVAS_BG;

    if (!isOpen) return null;

        return (
        <div
            className="fixed inset-0 z-[20000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={onClose}
        >
            <Panel className="relative flex flex-col w-[720px] max-w-[95vw] max-h-[85vh] overflow-hidden shadow-2xl">
                <div onClick={(e: React.MouseEvent<HTMLDivElement>) => { e.stopPropagation(); }} className="flex flex-col h-full">
                    {/* Header */}
                    <div className="flex-shrink-0 px-4 py-3 flex justify-between items-center border-b border-[var(--border-color)] bg-[var(--bg-panel)] z-10">
                        <h3 className="text-base font-semibold text-[var(--text-heading)]">{t('settings.title')}</h3>
                        <IconButton onClick={onClose} aria-label={t('settings.close')}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </IconButton>
                    </div>

                    {/* Main Body: Left (Settings) + Right (Updates) */}
                    <div className="flex-grow flex overflow-hidden">
                        {/* Left: Original Settings (Single Column) */}
                        <div className="w-[200px] flex-shrink-0 overflow-y-auto p-3 space-y-4 pod-scrollbar border-r border-[var(--border-color)]">

                        {/* Preferences */}
                        <div className="flex flex-col gap-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-[var(--text-heading)]">{t('settings.language')}</label>
                                <div className="flex p-0.5 rounded-md bg-[var(--bg-input)] border border-[var(--border-color)]">
                                    <button
                                        onClick={() => setLanguage('en')}
                                        className={`flex-1 text-xs h-6 rounded-sm transition-colors ${language === 'en' ? 'bg-[var(--text-accent)] text-[var(--bg-page)] font-medium' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                    >
                                        EN
                                    </button>
                                    <button
                                        onClick={() => setLanguage('ZH')}
                                        className={`flex-1 text-xs h-6 rounded-sm transition-colors ${language === 'ZH' ? 'bg-[var(--text-accent)] text-[var(--bg-page)] font-medium' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                    >
                                        中
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-[var(--text-heading)]">{t('settings.backgroundColor')}</label>
                                <div className="flex items-center gap-2 p-0.5 rounded-md bg-[var(--bg-input)] border border-[var(--border-color)]">
                                    <input
                                        type="color"
                                        value={resolvedCanvasBackgroundColor}
                                        onChange={(e) => onCanvasBackgroundColorChange(e.target.value)}
                                        className="h-5 w-8 rounded cursor-pointer border-none bg-transparent p-0"
                                    />
                                    <span className="text-[10px] text-[var(--text-secondary)] font-mono flex-1 text-center uppercase">
                                        {resolvedCanvasBackgroundColor.toUpperCase()}
                                    </span>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-[var(--text-heading)]">{t('settings.mouseWheel')}</label>
                                <div className="flex p-0.5 rounded-md bg-[var(--bg-input)] border border-[var(--border-color)]">
                                    <button
                                        onClick={() => setWheelAction('zoom')}
                                        className={`flex-1 text-xs h-6 rounded-sm transition-colors ${wheelAction === 'zoom' ? 'bg-[var(--text-accent)] text-[var(--bg-page)] font-medium' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                    >
                                        {t('settings.zoom')}
                                    </button>
                                    <button
                                        onClick={() => setWheelAction('pan')}
                                        className={`flex-1 text-xs h-6 rounded-sm transition-colors ${wheelAction === 'pan' ? 'bg-[var(--text-accent)] text-[var(--bg-page)] font-medium' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                    >
                                        {t('settings.scroll')}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="pod-separator"></div>

                        {/* API & Account */}
                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <div className="flex p-0.5 rounded-md bg-[var(--bg-input)] border border-[var(--border-color)]">
                                    <button
                                        onClick={() => setApiProvider('WHATAI')}
                                        className={`flex-1 text-xs h-6 rounded-sm transition-colors ${apiProvider === 'WHATAI' ? 'bg-[var(--text-accent)] text-[var(--bg-page)] font-medium' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                    >
                                        {language === 'ZH' ? '代理A' : 'Proxy A'}
                                    </button>
                                    <button
                                        onClick={() => setApiProvider('Grsai')}
                                        className={`flex-1 text-xs h-6 rounded-sm transition-colors ${apiProvider === 'Grsai' ? 'bg-[var(--text-accent)] text-[var(--bg-page)] font-medium' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}
                                    >
                                        {language === 'ZH' ? '代理B' : 'Proxy B'}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-[var(--text-heading)]">{t('settings.apiKey')}</label>
                                <div className="flex flex-col gap-1.5 items-end">
                                    <input
                                        type="password"
                                        disabled={isKeyInputLocked}
                                        value={apiProvider === 'Grsai' ? grsaiApiKey : apiKey}
                                        onChange={(e) => {
                                            if (isKeyInputLocked) return;
                                            const v = (e.target as HTMLInputElement).value;
                                            if (apiProvider === 'Grsai') setGrsaiApiKey(v); else setApiKey(v);
                                        }}
                                        readOnly={isKeyInputLocked}
                                        placeholder={apiProvider === 'Grsai' ? (language === 'ZH' ? '代理B 令牌' : 'Proxy B Token') : (language === 'ZH' ? '代理A 令牌' : 'Proxy A Token')}
                                        className="pod-input pod-input-sm w-full text-xs"
                                    />
                                    <Button onClick={onClose} size="sm" className="h-6 px-3 text-xs w-auto rounded-md" disabled={isKeyInputLocked}>{t('settings.apiKeySave')}</Button>
                                </div>
                            </div>
                        </div>
                        </div>

                        {/* Right: Update Panel (Desktop only) */}
                        <div className="flex-1 hidden md:block py-3 pr-3 h-full overflow-hidden">
                            <UpdatePanel
                                updates={updateFeed as VersionUpdate[]}
                                t={t}
                            />
                        </div>
                    </div>
                </div>
            </Panel>
        </div>
    );
};
