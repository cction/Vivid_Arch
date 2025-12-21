import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'generate';
  size?: 'xs' | 'sm' | 'md';
  isLoading?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  ['aria-label']?: string;
  title?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export function Button({ variant = 'primary', size = 'md', isLoading = false, className, children, disabled, ...rest }: ButtonProps) {
  let base = 'pod-primary-button';
  if (variant === 'secondary') base = 'pod-btn-secondary';
  else if (variant === 'ghost') base = 'pod-btn-ghost';
  else if (variant === 'outline') base = 'pod-btn-outline';
  else if (variant === 'danger') base = 'pod-btn-danger';
  else if (variant === 'generate') base = 'pod-generate-button';

  const sizeClass = size === 'xs' ? 'pod-btn-xs' : size === 'sm' ? 'pod-btn-sm' : 'pod-btn-md';
  const classes = [base, sizeClass, className || ''].filter(Boolean).join(' ');
  return (
    <button className={classes} disabled={disabled || isLoading} {...rest}>
      {isLoading && (
        <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {children}
    </button>
  );
}
