/**
 * Logo Component - Centralized Branding
 * 
 * Provides consistent logo usage across the application with:
 * - Automatic dark mode switching
 * - Multiple variants (full, icon, wordmark)
 * - Responsive sizing
 * - Brand name image support
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
  /** Custom text label (fallback if brand image fails) */
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
    image: 'w-6 h-6',
    brandName: 'h-4',
    text: 'text-sm',
    container: 'gap-2'
  },
  sm: {
    image: 'w-8 h-8',
    brandName: 'h-5',
    text: 'text-base',
    container: 'gap-2'
  },
  md: {
    image: 'w-10 h-10',
    brandName: 'h-6',
    text: 'text-lg',
    container: 'gap-3'
  },
  lg: {
    image: 'w-12 h-12',
    brandName: 'h-8',
    text: 'text-xl',
    container: 'gap-3'
  },
  xl: {
    image: 'w-16 h-16',
    brandName: 'h-10',
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

  const getLogoSrc = () => '/branding/logo.png';
  const getDarkLogoSrc = () => '/branding/logo-dark.png';

  const LogoImage = () => (
    <div
      className={cn(
        'relative rounded-lg overflow-hidden flex-shrink-0 shadow-sm',
        sizeClasses.image,
        clickable && 'group-hover:shadow-md transition-shadow'
      )}
    >
      {/* Light mode logo */}
      <img
        src={getLogoSrc()}
        alt="BeamLab Logo"
        className="w-full h-full object-contain dark:hidden"
      />
      {/* Dark mode logo */}
      <img
        src={getDarkLogoSrc()}
        alt="BeamLab Logo"
        className="w-full h-full object-contain hidden dark:block"
      />
    </div>
  );

  const BrandName = () => (
    <div className={cn('flex-shrink-0', sizeClasses.brandName)}>
      {/* Light mode brand name */}
      <img
        src="/branding/brandname.png"
        alt={label}
        className={cn('h-full w-auto object-contain dark:hidden', sizeClasses.brandName)}
      />
      {/* Dark mode brand name */}
      <img
        src="/branding/brandname-dark.png"
        alt={label}
        className={cn('h-full w-auto object-contain hidden dark:block', sizeClasses.brandName)}
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
      {variant !== 'wordmark' && <LogoImage />}
      {(showLabel || variant === 'wordmark' || variant === 'full') && <BrandName />}
    </div>
  );

  if (!clickable) {
    return content;
  }

  if (onClick) {
    return (
      <button
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
export const LogoIcon: FC<Omit<LogoProps, 'variant'>> = (props) => (
  <Logo variant="icon" showLabel={false} {...props} />
);

/**
 * LogoWordmark - Shorthand for wordmark variant (brand name only, no icon)
 */
export const LogoWordmark: FC<Omit<LogoProps, 'variant'>> = (props) => (
  <Logo variant="wordmark" {...props} />
);

/**
 * LogoFull - Shorthand for full logo with icon + brand name
 */
export const LogoFull: FC<Omit<LogoProps, 'variant' | 'showLabel'>> = (props) => (
  <Logo variant="full" showLabel {...props} />
);
