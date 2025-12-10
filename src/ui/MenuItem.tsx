import React from 'react';

export interface MenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  key?: React.Key;
  style?: React.CSSProperties;
}

export function MenuItem({ className, children, ...rest }: MenuItemProps) {
  const classes = ['pod-menu-item', className || ''].filter(Boolean).join(' ');
  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  );
}
