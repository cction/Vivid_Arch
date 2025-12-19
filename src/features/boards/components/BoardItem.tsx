import React, { useState, useRef, useEffect, forwardRef, memo } from 'react';
import type { Board } from '@/types';
import { IconButton, Panel, MenuItem, Input } from '../../../ui';
import { BoardThumbnail } from './BoardThumbnail';

type BoardItemProps = {
  board: Board;
  isActive: boolean;
  thumbnail: string;
  onClick: () => void;
  onRename: (name: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  dataBoardId: string;
};

export const BoardItem = forwardRef<HTMLDivElement, BoardItemProps>(function BoardItem({ board, isActive, thumbnail: _thumbnail, onClick, onRename, onDuplicate, onDelete, dataBoardId }, ref) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(board.name);
  const [menuOpen, setMenuOpen] = useState(false);
  void _thumbnail;
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBlur = () => {
    setIsEditing(false);
    if (name.trim() === '') {
      setName(board.name);
    } else if (name.trim() !== board.name) {
      onRename(name.trim());
    }
  };

  const handleMenuAction = (action: 'rename' | 'duplicate' | 'delete') => {
    setMenuOpen(false);
    switch (action) {
      case 'rename':
        setName(board.name);
        setIsEditing(true);
        break;
      case 'duplicate':
        onDuplicate();
        break;
      case 'delete':
        if (window.confirm(`Are you sure you want to delete "${board.name}"?`)) {
          onDelete();
        }
        break;
    }
  };

  return (
    <div
      ref={ref}
      data-boardid={dataBoardId}
      onClick={onClick}
      className={`group relative p-2 pod-list-item cursor-pointer ${isActive ? 'selected' : ''}`}
    >
      <div className={`aspect-[3/2] w-full rounded-md mb-2 overflow-hidden border-2 ${isActive ? 'border-[var(--text-accent)]' : 'border-transparent'}`}>
        <BoardThumbnail board={board} />
      </div>
      <div className="flex items-center justify-between">
        {isEditing ? (
          <Input
            ref={inputRef as React.Ref<HTMLInputElement>}
            type="text"
            value={name}
            onChange={(e) => setName((e.target as HTMLInputElement).value)}
            onBlur={handleBlur}
            onKeyDown={(e) => e.key === 'Enter' && handleBlur()}
            inputSize="sm"
            className="w-full bg-transparent"
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span
            className="text-sm truncate"
            onDoubleClick={() => { setName(board.name); setIsEditing(true); }}
          >
            {board.name}
          </span>
        )}
        <div className="relative" ref={menuRef}>
          <IconButton onClick={(e) => { e.stopPropagation(); setMenuOpen(p => !p); }} className="opacity-0 group-hover:opacity-100">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="12" cy="19" r="2"/></svg>
          </IconButton>
          {menuOpen && (
            <Panel className="absolute right-0 bottom-full mb-1 z-10 w-32 py-1 text-sm">
              <MenuItem onClick={() => handleMenuAction('rename')} className="block w-full text-left">Rename</MenuItem>
              <MenuItem onClick={() => handleMenuAction('duplicate')} className="block w-full text-left">Duplicate</MenuItem>
              <div className="pod-separator my-1"></div>
              <MenuItem onClick={() => handleMenuAction('delete')} className="block w-full text-left text-[#ff6b6b]">Delete</MenuItem>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
});

export const MemoBoardItem = memo(BoardItem);
BoardItem.displayName = 'BoardItem';
MemoBoardItem.displayName = 'MemoBoardItem';
