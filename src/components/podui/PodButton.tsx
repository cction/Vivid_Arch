import React from 'react';

export type PodButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'generate';
export type PodButtonSize = 'xs' | 'sm' | 'md';

interface PodButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: PodButtonVariant;
  size?: PodButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const PodButton: React.FC<PodButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  disabled,
  ...props
}) => {
  const getVariantClass = () => {
    switch (variant) {
      case 'primary':
        return 'pod-primary-button';
      case 'secondary':
        return 'pod-btn-secondary';
      case 'ghost':
        return 'pod-btn-ghost';
      case 'outline':
        return 'pod-btn-outline';
      case 'danger':
        return 'pod-btn-danger'; // Assuming this exists or we map to something else
      case 'generate':
        return 'pod-generate-button';
      default:
        return 'pod-primary-button';
    }
  };

  const getSizeClass = () => {
    switch (size) {
      case 'xs':
        return 'pod-btn-xs';
      case 'sm':
        return 'pod-btn-sm';
      case 'md':
        return 'pod-btn-md';
      default:
        return 'pod-btn-md';
    }
  };

  const baseClasses = [
    getVariantClass(),
    getSizeClass(),
    isLoading ? 'opacity-80 cursor-wait' : '',
    'flex items-center justify-center gap-2', // Utility classes for layout
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={baseClasses} disabled={disabled || isLoading} {...props}>
      {isLoading && (
        <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      )}
      {!isLoading && leftIcon}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
};
