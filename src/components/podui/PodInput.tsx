import React, { forwardRef } from 'react';

export type PodInputSize = 'sm' | 'md';

interface PodInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  size?: PodInputSize;
  hasError?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const PodInput = forwardRef<HTMLInputElement, PodInputProps>(
  ({ size = 'md', hasError = false, leftIcon, rightIcon, className = '', ...props }, ref) => {
    const getSizeClass = () => {
      switch (size) {
        case 'sm':
          return 'pod-input-sm';
        case 'md':
          return 'pod-input-md';
        default:
          return 'pod-input-md';
      }
    };

    const baseClasses = [
      'pod-input',
      getSizeClass(),
      'w-full', // Default to full width
      hasError ? 'border-red-500 focus:border-red-500' : '',
      leftIcon ? 'pl-9' : '',
      rightIcon ? 'pr-9' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className="relative w-full">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            {leftIcon}
          </div>
        )}
        <input ref={ref} className={baseClasses} {...props} />
        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            {rightIcon}
          </div>
        )}
      </div>
    );
  }
);

PodInput.displayName = 'PodInput';
