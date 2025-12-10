import React from 'react';

export type PodPanelVariant = 'default' | 'brand-gradient' | 'transparent' | 'black' | 'pill';

interface PodPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: PodPanelVariant;
  rounded?: boolean; // Toggle standard vs rounded-xl
}

export const PodPanel: React.FC<PodPanelProps> = ({
  children,
  variant = 'default',
  rounded = false,
  className = '',
  ...props
}) => {
  const getVariantClass = () => {
    switch (variant) {
      case 'default':
        return 'pod-panel';
      case 'brand-gradient':
        return 'pod-panel pod-panel-brand-gradient';
      case 'transparent':
        return 'pod-panel pod-panel-transparent';
      case 'black':
        return 'pod-panel pod-panel-black';
      case 'pill':
        return 'pod-panel pod-panel-pill';
      default:
        return 'pod-panel';
    }
  };

  const baseClasses = [
    getVariantClass(),
    rounded ? 'pod-panel-rounded-xl' : '',
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
