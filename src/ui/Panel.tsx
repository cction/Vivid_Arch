import React from 'react';

type PanelVariant = 'default' | 'brand-gradient' | 'transparent' | 'black' | 'pill';
export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
  className?: string;
  elevated?: boolean;
  variant?: PanelVariant;
  rounded?: boolean;
  style?: React.CSSProperties;
}

export function Panel({ elevated, variant = 'default', rounded = false, className, children, ...rest }: PanelProps) {
  const variantClass =
    variant === 'brand-gradient' ? 'pod-panel pod-panel-brand-gradient' :
    variant === 'transparent' ? 'pod-panel pod-panel-transparent' :
    variant === 'black' ? 'pod-panel pod-panel-black' :
    variant === 'pill' ? 'pod-panel pod-panel-pill' :
    'pod-panel';
  const classes = [
    variantClass,
    elevated ? 'pod-toolbar-elevated' : '',
    rounded ? 'pod-panel-rounded-xl' : '',
    className || ''
  ].filter(Boolean).join(' ');
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
