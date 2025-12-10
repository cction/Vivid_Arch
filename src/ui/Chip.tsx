import React, { forwardRef } from 'react';

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  className?: string;
  active?: boolean;
}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip({ active, className, children, ...rest }, ref) {
  const classes = [
    'pod-chip',
    active ? 'active' : '',
    className || ''
  ].filter(Boolean).join(' ');
  return (
    <button ref={ref} className={classes} {...rest}>
      {children}
    </button>
  );
});
