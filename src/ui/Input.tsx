import React, { forwardRef } from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  className?: string;
  variant?: 'default' | 'filled' | 'outline';
  inputSize?: 'sm' | 'md' | 'lg';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, variant = 'default', inputSize = 'md', ...rest }, ref) {
  const sizeClass = {
    sm: 'pod-input-sm',
    md: 'pod-input-md',
    lg: 'h-12 text-lg'
  }[inputSize];

  // const variantClass = {
  //   default: 'pod-input',
  //   filled: 'pod-input bg-gray-800 border-gray-700',
  //   outline: 'pod-input bg-transparent'
  // }[variant];

  // If variant is not default, we might need to override pod-input styles via className or utility classes
  // For now, let's just use pod-input and size classes, and allow className to override.
  
  const classes = [
    'pod-input', 
    sizeClass, 
    variant === 'filled' ? 'bg-[#1f2937] border-[#374151]' : '', // Manual approximation of bg-gray-800/border-gray-700 if Tailwind not available in CSS modules
    className || ''
  ].filter(Boolean).join(' ');

  return <input ref={ref} className={classes} {...rest} />;
});
