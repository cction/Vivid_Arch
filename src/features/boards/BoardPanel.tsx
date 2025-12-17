import React from 'react';
import type { Board } from '@/types';
import { IconButton } from '../../ui';
import { BoardGrid } from './components/BoardGrid';

interface BoardPanelProps {
    isOpen: boolean;
    onClose: () => void;
    boards: Board[];
    activeBoardId: string;
    onSwitchBoard: (id: string) => void;
    onAddBoard: () => void;
    onRenameBoard: (id: string, name: string) => void;
    onDuplicateBoard: (id: string) => void;
    onDeleteBoard: (id: string) => void;
    generateBoardThumbnail: (elements: Board['elements']) => string;
}



export const BoardPanel: React.FC<BoardPanelProps> = ({ 
    isOpen, onClose, boards, activeBoardId, onSwitchBoard, onAddBoard, 
    onRenameBoard, onDuplicateBoard, onDeleteBoard, generateBoardThumbnail 
}) => {
    if (!isOpen) return null;

    return (
         <div 
            className="absolute top-4 left-4 z-20 flex flex-col w-[85vw] sm:w-64 md:w-72 lg:w-80 max-w-[400px] h-[calc(100vh-2rem)] pod-panel overflow-hidden"
        >
          <div className="pod-panel-header">
            <h3 className="text-base font-semibold text-[var(--text-heading)]">Boards</h3>
            <div className="flex items-center gap-[var(--space-2)]">
                    <IconButton onClick={onAddBoard} title="New Board" aria-label="New Board">
                         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </IconButton>
                    <IconButton onClick={onClose} aria-label="Close" title="Close">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </IconButton>
                </div>
            </div>
            <div className="flex-grow overflow-y-auto p-[var(--space-2)]">
                <BoardGrid
                    isOpen={isOpen}
                    boards={boards}
                    activeBoardId={activeBoardId}
                    onSwitchBoard={onSwitchBoard}
                    onRenameBoard={onRenameBoard}
                    onDuplicateBoard={onDuplicateBoard}
                    onDeleteBoard={onDeleteBoard}
                    generateBoardThumbnail={generateBoardThumbnail}
                />
            </div>
        </div>
    );
};
