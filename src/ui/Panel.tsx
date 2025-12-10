import React from 'react';

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
  elevated?: boolean;
  style?: React.CSSProperties;
}

export function Panel({ elevated, className, children, ...rest }: PanelProps) {
  const classes = [
    'pod-panel',
    elevated ? 'pod-toolbar-elevated' : '',
    className || ''
  ].filter(Boolean).join(' ');
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
