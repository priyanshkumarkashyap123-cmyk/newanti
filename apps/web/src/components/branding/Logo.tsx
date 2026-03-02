/**
 * Logo Component - Centralized Branding
 * 
 * Provides consistent logo usage across the application with:
 * - Automatic dark mode switching (colored icon or dark/white monochrome)
 * - Multiple variants (full, icon, wordmark)
 * - Responsive sizing
 * - SVG-based brand assets
 * - Proper accessibility
 */

import { FC } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';

export type LogoVariant = 'full' | 'icon' | 'wordmark';
export type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface LogoProps {
  /** Logo variant to display */
  variant?: LogoVariant;
  /** Size preset */
  size?: LogoSize;
  /** Custom className */
  className?: string;
  /** Whether to show the brand name next to icon */
  showLabel?: boolean;
  /** Custom text label (fallback alt text) */
  label?: string;
  /** Link destination (default: '/') */
  href?: string;
  /** onClick handler */
  onClick?: () => void;
  /** Whether logo is clickable */
  clickable?: boolean;
}

const SIZE_CLASSES = {
  xs: {
    icon: 'w-6 h-6',
    wordmark: 'h-5',
    text: 'text-sm',
    container: 'gap-2'
  },
  sm: {
    icon: 'w-8 h-8',
    wordmark: 'h-6',
    text: 'text-base',
    container: 'gap-2'
  },
  md: {
    icon: 'w-10 h-10',
    wordmark: 'h-7',
    text: 'text-lg',
    container: 'gap-3'
  },
  lg: {
    icon: 'w-12 h-12',
    wordmark: 'h-9',
    text: 'text-xl',
    container: 'gap-3'
  },
  xl: {
    icon: 'w-16 h-16',
    wordmark: 'h-12',
    text: 'text-2xl',
    container: 'gap-4'
  }
};

export const Logo: FC<LogoProps> = ({
  variant = 'full',
  size = 'md',
  className = '',
  showLabel = false,
  label = 'BeamLab',
  href = '/',
  onClick,
  clickable = true
}) => {
  const sizeClasses = SIZE_CLASSES[size];

  const LogoIcon = () => (
    <div className={cn('relative flex-shrink-0', sizeClasses.icon)}>
      {/* Colored icon — works on both light and dark backgrounds */}
      <img
        src="/branding/beamlab_icon_colored.svg"
        alt="BeamLab"
        className="w-full h-full object-contain"
      />
    </div>
  );

  const Wordmark = () => (
    <div className={cn('flex-shrink-0', sizeClasses.wordmark)}>
      <img
        src="/branding/beamlab_wordmark.svg"
        alt={label}
        className={cn('h-full w-auto object-contain', sizeClasses.wordmark)}
      />
    </div>
  );

  const content = (
    <div
      className={cn(
        'flex items-center',
        sizeClasses.container,
        clickable && 'group',
        className
      )}
    >
      {variant !== 'wordmark' && <LogoIcon />}
      {(showLabel || variant === 'wordmark' || variant === 'full') && <Wordmark />}
    </div>
  );

  if (!clickable) {
    return content;
  }

  if (onClick) {
    return (
      <button type="button"
        onClick={onClick}
        className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
        aria-label={label}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      to={href}
      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-lg"
      aria-label={`${label} - Home`}
    >
      {content}
    </Link>
  );
};

/**
 * LogoIcon - Shorthand for icon-only variant
 */
export const LogoIconOnly: FC<Omit<LogoProps, 'variant'>> = (props) => (
  <Logo variant="icon" showLabel={false} {...props} />
);

/**
 * LogoWordmark - Shorthand for wordmark variant (brand name only, no icon)
 */
export const LogoWordmark: FC<Omit<LogoProps, 'variant'>> = (props) => (
  <Logo variant="wordmark" {...props} />
);

/**
 * LogoFull - Shorthand for full logo with icon + wordmark
 */
export const LogoFull: FC<Omit<LogoProps, 'variant' | 'showLabel'>> = (props) => (
  <Logo variant="full" showLabel {...props} />
);
