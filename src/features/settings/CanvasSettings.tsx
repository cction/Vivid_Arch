import React from 'react';
import { Panel, IconButton, Button } from '@/ui';
import { fetchUserSelf } from '@/services/httpClient';
import type { WheelAction } from '@/types';

interface CanvasSettingsProps {
    isOpen: boolean;
    onClose: () => void;
    canvasBackgroundColor: string;
    onCanvasBackgroundColorChange: (color: string) => void;
    language: 'en' | 'ZH';
    setLanguage: (lang: 'en' | 'ZH') => void;
    uiTheme: { color: string; opacity: number };
    setUiTheme: (theme: { color: string; opacity: number }) => void;
    buttonTheme: { color: string; opacity: number };
    setButtonTheme: (theme: { color: string; opacity: number }) => void;
    wheelAction: WheelAction;
    setWheelAction: (action: WheelAction) => void;
    t: (key: string) => string;
    apiKey: string;
    setApiKey: (key: string) => void;
    apiProvider: 'WHATAI' | 'Grsai';
    setApiProvider: (p: 'WHATAI' | 'Grsai') => void;
    grsaiApiKey: string;
    setGrsaiApiKey: (key: string) => void;
    systemToken: string;
    setSystemToken: (key: string) => void;
    userId: string;
    setUserId: (id: string) => void;
}


export const CanvasSettings: React.FC<CanvasSettingsProps> = ({
    isOpen,
    onClose,
    canvasBackgroundColor,
    onCanvasBackgroundColorChange,
    language,
    setLanguage,
    uiTheme,
    setUiTheme,
    buttonTheme,
    setButtonTheme,
    wheelAction,
    setWheelAction,
    t,
    apiKey,
    setApiKey,
    apiProvider,
    setApiProvider,
    grsaiApiKey,
    setGrsaiApiKey,
    systemToken,
    setSystemToken,
    userId,
    setUserId
}) => {
    void uiTheme; void setUiTheme; void buttonTheme; void setButtonTheme;


    const [balanceData, setBalanceData] = React.useState<{ quota: number; used: number } | null>(null);
    const [balanceLoading, setBalanceLoading] = React.useState<boolean>(false);

    const handleCheckBalance = async () => {
        setBalanceLoading(true);
        setBalanceData(null);
        try {
            if (!userId || !systemToken) {
                setBalanceData(null);
                setBalanceLoading(false);
                return;
}
            const result = await fetchUserSelf(userId, systemToken);
            const quota = result?.data?.quota ?? 0;
            const used = result?.data?.used_quota ?? 0;
            setBalanceData({ quota, used });
        } catch {
            setBalanceData(null);
        } finally {
            setBalanceLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={onClose}
        >
            <Panel className="relative flex flex-col w-80 max-w-[90vw] max-h-[85vh] overflow-hidden shadow-2xl">
                <div onClick={(e: React.MouseEvent<HTMLDivElement>) => { e.stopPropagation(); }}>
                    {/* Header */}
                    <div className="flex-shrink-0 px-4 py-3 flex justify-between items-center border-b border-[var(--border-color)] bg-[var(--bg-panel)] z-10">
                        <h3 className="text-base font-semibold text-[var(--text-heading)]">{t('settings.title')}</h3>
                        <IconButton onClick={onClose} aria-label={t('settings.close')}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </IconButton>
                    </div>

                    {/* Content */}
                    <div className="flex-grow overflow-y-auto p-4 space-y-4 pod-scrollbar">

                        {/* Preferences */}
                        <div className="grid grid-cols-2 gap-4">
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
                                        value={canvasBackgroundColor && canvasBackgroundColor.startsWith('#') ? canvasBackgroundColor : '#0F0D13'}
                                        onChange={(e) => onCanvasBackgroundColorChange(e.target.value)}
                                        className="h-5 w-8 rounded cursor-pointer border-none bg-transparent p-0"
                                    />
                                    <span className="text-[10px] text-[var(--text-secondary)] font-mono flex-1 text-center uppercase">
                                        {canvasBackgroundColor && canvasBackgroundColor.startsWith('#') ? canvasBackgroundColor : 'DEFAULT'}
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

                        

                        {/* Appearance */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-[var(--text-heading)]">{t('settings.backgroundColor')}</label>
                            <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-[var(--bg-input)] border border-[var(--border-color)]">
                                <input
                                    type="color"
                                    value={canvasBackgroundColor}
                                    onChange={(e) => onCanvasBackgroundColorChange(e.target.value)}
                                    className="h-5 w-5 rounded cursor-pointer border-none bg-transparent p-0"
                                />
                                <span className="text-xs text-[var(--text-secondary)] font-mono flex-1">{canvasBackgroundColor.toUpperCase()}</span>
                            </div>
                        </div>



                        <div className="pod-separator"></div>

                        {/* API & Account */}
                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-[var(--text-heading)]">{t('settings.apiProvider')}</label>
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
                                <div className="flex gap-2">
                                    <input
                                        type="password"
                                        value={apiProvider === 'Grsai' ? grsaiApiKey : apiKey}
                                        onChange={(e) => {
                                            const v = (e.target as HTMLInputElement).value;
                                            if (apiProvider === 'Grsai') setGrsaiApiKey(v); else setApiKey(v);
                                        }}
                                        placeholder={apiProvider === 'Grsai' ? (language === 'ZH' ? '代理B API Key' : 'Proxy B API Key') : (language === 'ZH' ? '代理A API Key' : 'Proxy A API Key')}
                                        className="pod-input pod-input-sm flex-1 text-xs"
                                    />
                                    <Button onClick={onClose} size="sm" className="h-8 px-3 text-xs whitespace-nowrap">{t('settings.apiKeySave')}</Button>
                                </div>
                            </div>

                            <details className="group">
                                <summary className="text-xs text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)] select-none flex items-center gap-1 outline-none">
                                    <svg className="w-3 h-3 transition-transform group-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 18l6-6-6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                    {language === 'ZH' ? '高级设置 (Token / ID)' : 'Advanced (Token / ID)'}
                                </summary>
                                <div className="mt-3 space-y-3 pl-2 border-l-2 border-[var(--border-color)]">
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] text-[var(--text-secondary)]">{t('settings.systemToken')}</label>
                                        <input
                                            type="password"
                                            value={systemToken}
                                            onChange={(e) => setSystemToken((e.target as HTMLInputElement).value)}
                                            placeholder={language === 'ZH' ? '系统 Token（可选）' : 'System Token (optional)'}
                                            className="pod-input pod-input-sm w-full text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-[10px] text-[var(--text-secondary)]">{t('settings.userId')}</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={userId}
                                                onChange={(e) => setUserId((e.target as HTMLInputElement).value)}
                                                placeholder={language === 'ZH' ? '用户 ID' : 'User ID'}
                                                className="pod-input pod-input-sm flex-1 text-xs"
                                            />
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={handleCheckBalance}
                                                disabled={balanceLoading}
                                                className="h-8 px-2 text-xs min-w-[60px]"
                                            >
                                                {balanceLoading ? '...' : (language === 'ZH' ? '查余额' : 'Check')}
                                            </Button>
                                        </div>
                                        {balanceData && (
                                            <div className="mt-1 flex flex-col gap-1 text-[10px] text-[var(--text-secondary)] bg-[var(--bg-input)] p-2 rounded">
                                                <div className="flex justify-between">
                                                    <span>{t('settings.siteBalancePrefix')}</span>
                                                    <span className="font-mono text-[var(--text-primary)]">{new Intl.NumberFormat(language === 'ZH' ? 'zh-CN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(balanceData.quota / 500000)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span>{t('settings.siteUsedPrefix')}</span>
                                                    <span className="font-mono text-[var(--text-primary)]">{new Intl.NumberFormat(language === 'ZH' ? 'zh-CN' : 'en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(balanceData.used / 500000)}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </details>
                        </div>
                    </div>
                </div>
            </Panel>
        </div>
    );
};
