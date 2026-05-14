import React from 'react';

interface ScrollableProps {
  children: React.ReactNode;
  direction?: 'vertical' | 'horizontal' | 'both';
  className?: string;
  style?: React.CSSProperties;
  id?: string;
}

/**
 * Scrollable — Modern polished scrollbar wrapper
 *
 * Features:
 * - Thin 6px track with rounded pill thumb
 * - Subtle when idle, visible on hover
 * - Smooth color transitions
 * - VS Code theme aware via CSS variables
 * - Cross-browser (WebKit + Firefox)
 * - Optional vertical/horizontal/both scroll directions
 */
export const Scrollable: React.FC<ScrollableProps> = ({
  children,
  direction = 'vertical',
  className = '',
  style,
  id,
}) => {
  const overflowClass = {
    vertical: 'overflow-y-auto overflow-x-hidden',
    horizontal: 'overflow-x-auto overflow-y-hidden',
    both: 'overflow-auto',
  }[direction];

  return (
    <div
      id={id}
      className={`scrollable-modern ${overflowClass} ${className}`}
      style={style}
    >
      {children}
    </div>
  );
};
