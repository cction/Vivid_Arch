import React from 'react';

export interface ToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
  elevated?: boolean;
  softGradient?: boolean;
  style?: React.CSSProperties;
}

export function Toolbar({ elevated, softGradient, className, children, ...rest }: ToolbarProps) {
  const classes = [
    'pod-toolbar',
    elevated ? 'pod-toolbar-elevated' : '',
    softGradient ? 'pod-bar-soft-gradient' : '',
    className || ''
  ].filter(Boolean).join(' ');
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
