import React, { forwardRef } from 'react';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  children?: React.ReactNode;
  className?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ className, children, ...rest }, ref) {
  const classes = ['pod-textarea', className || ''].filter(Boolean).join(' ');
  return (
    <textarea ref={ref} className={classes} {...rest}>
      {children}
    </textarea>
  );
});
