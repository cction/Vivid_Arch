import React from 'react';
import type { JSX } from 'react';

interface BottomBarProps {
    t: (key: string) => string;
    onFitToWindow: () => void;
}

const MinimalButton: React.FC<{
    label: string;
    icon: JSX.Element;
    onClick: () => void;
}> = ({ label, icon, onClick }) => (
    <button
        onClick={onClick}
        aria-label={label}
        title={label}
        className="p-2 rounded-full text-zinc-500 hover:text-[#A78BFA] dark:text-zinc-400 dark:hover:text-[#A78BFA] hover:bg-zinc-500/10 transition-all duration-200 active:scale-95 active:text-[var(--brand-primary)]"
    >
        {icon}
    </button>
);

export const BottomBar: React.FC<BottomBarProps> = ({
    t,
    onFitToWindow,
}) => {
    const handleRefreshView = () => {
        window.location.reload();
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-1 p-1 rounded-full transition-all duration-500 opacity-30 hover:opacity-100 hover:bg-zinc-500/5 backdrop-blur-[0px] hover:backdrop-blur-[1px]">
            <MinimalButton
                label={t('toolbar.fitToWindow')}
                onClick={onFitToWindow}
                icon={
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 9 3 3 9 3"></polyline>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <polyline points="21 15 21 21 15 21"></polyline>
                        <polyline points="9 21 3 21 3 15"></polyline>
                        <line x1="9" y1="9" x2="15" y2="9"></line>
                        <line x1="9" y1="15" x2="15" y2="15"></line>
                    </svg>
                }
            />
            <MinimalButton
                label={t('toolbar.refreshView')}
                onClick={handleRefreshView}
                icon={
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                        <path d="M3 3v5h5"></path>
                    </svg>
                }
            />
        </div>
    );
};
