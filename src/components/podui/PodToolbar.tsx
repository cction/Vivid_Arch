import React from 'react';

export type PodToolbarVariant = 'default' | 'elevated';

interface PodToolbarProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: PodToolbarVariant;
}

export const PodToolbar: React.FC<PodToolbarProps> = ({
  children,
  variant = 'default',
  className = '',
  ...props
}) => {
  const baseClasses = [
    variant === 'elevated' ? 'pod-toolbar-elevated' : 'pod-toolbar',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={baseClasses} {...props}>
      {children}
    </div>
  );
};
