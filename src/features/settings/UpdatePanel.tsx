import React from 'react';

export interface VersionUpdate {
    version: string;
    date?: string;
    highlights: string[];
}

interface UpdatePanelProps {
    updates: VersionUpdate[];
    language: 'en' | 'ZH';
    t: (key: string) => string;
}

export const UpdatePanel: React.FC<UpdatePanelProps> = ({ updates, t }) => {
    return (
        <div className="flex flex-col h-full pl-4">
            <div className="flex items-center justify-between mb-4 shrink-0">
                <h4 className="text-sm font-semibold text-[var(--text-heading)]">
                    {t('settings.updatePanelTitle')}
                </h4>
                <span className="text-[10px] text-[var(--text-secondary)] px-1.5 py-0.5 rounded bg-[var(--bg-input)]">
                    CHANGELOG
                </span>
            </div>
            
            {updates.length === 0 ? (
                <div className="text-xs text-[var(--text-secondary)] text-center py-8">
                    {t('settings.noUpdates')}
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto pod-scrollbar pr-2 space-y-6">
                    {updates.map((u, idx) => (
                        <div key={u.version} className="relative">
                            {/* Version Header */}
                            <div className="flex items-baseline gap-2 mb-2">
                                <span className="text-sm font-bold text-[var(--text-heading)] font-mono tracking-tight">
                                    {u.version}
                                </span>
                                {u.date && (
                                    <span className="text-[10px] text-[var(--text-tertiary)] opacity-60">
                                        {u.date}
                                    </span>
                                )}
                            </div>

                            {/* Content List */}
                            <ul className="space-y-2 pl-1">
                                {u.highlights.map((h, hIdx) => (
                                    <li key={hIdx} className="text-[11px] leading-relaxed text-[var(--text-secondary)] flex items-start gap-2 relative">
                                        <span className="text-[var(--text-accent)] mt-[5px] w-1 h-1 rounded-full bg-current shrink-0 opacity-60"></span>
                                        <span>{h}</span>
                                    </li>
                                ))}
                            </ul>
                            
                            {/* Divider (except last item) */}
                            {idx !== updates.length - 1 && (
                                <div className="mt-6 border-b border-[var(--border-color)] opacity-50 border-dashed" />
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
