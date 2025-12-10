import React from 'react';

export interface DialogProps {
  open: boolean;
  onClose?: () => void;
  children?: React.ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, children, className }: DialogProps) {
  if (!open) return null;
  return (
    <div className="pod-dialog-overlay" onClick={onClose}>
      <div className={["pod-panel", className || ''].filter(Boolean).join(' ')} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

