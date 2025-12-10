import React from 'react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  children?: React.ReactNode;
  className?: string;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLSelectElement>;
  ['aria-label']?: string;
  title?: string;
}

export function Select({ className, children, ...rest }: SelectProps) {
  const classes = ['pod-select', className || ''].filter(Boolean).join(' ');
  return (
    <select className={classes} {...rest}>
      {children}
    </select>
  );
}
