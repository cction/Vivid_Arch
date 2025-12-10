import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'xs' | 'sm' | 'md';
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  ['aria-label']?: string;
  title?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export function Button({ variant = 'primary', size = 'md', className, children, ...rest }: ButtonProps) {
  let base = 'pod-primary-button';
  if (variant === 'secondary') base = 'pod-btn-secondary';
  else if (variant === 'ghost') base = 'pod-btn-ghost';
  else if (variant === 'outline') base = 'pod-btn-outline';

  const sizeClass = size === 'xs' ? 'pod-btn-xs' : size === 'sm' ? 'pod-btn-sm' : 'pod-btn-md';
  const classes = [base, sizeClass, className || ''].filter(Boolean).join(' ');
  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
