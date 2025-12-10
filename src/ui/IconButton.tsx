import React, { forwardRef } from 'react';

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  className?: string;
  active?: boolean;
  noHoverHighlight?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  ['aria-label']?: string;
  title?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton({ active, noHoverHighlight, className, children, ...rest }, ref) {
  const classes = [
    'pod-icon-button',
    active ? 'active' : '',
    noHoverHighlight ? 'no-hover-highlight' : '',
    className || ''
  ].filter(Boolean).join(' ');
  return (
    <button ref={ref} className={classes} {...rest}>
      {children}
    </button>
  );
});
