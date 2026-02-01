/**
 * Avatar Component
 * 
 * A comprehensive avatar system with:
 * - Image support with fallbacks
 * - Initials generation
 * - Status indicators
 * - Size variants
 * - Avatar groups
 * - Presence indicators
 */

'use client';

import React, { useState, forwardRef, ReactNode } from 'react';
import { motion } from 'framer-motion';
import { User, Check, Clock, AlertCircle, Minus } from 'lucide-react';
import { cn } from '../../lib/utils';

// ============================================================================
// TYPES
// ============================================================================

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
export type AvatarStatus = 'online' | 'offline' | 'away' | 'busy' | 'dnd';
export type AvatarShape = 'circle' | 'rounded' | 'square';

export interface AvatarProps {
  src?: string;
  alt?: string;
  name?: string;
  size?: AvatarSize;
  shape?: AvatarShape;
  status?: AvatarStatus;
  showStatus?: boolean;
  className?: string;
  fallback?: ReactNode;
  onClick?: () => void;
  ring?: boolean;
  ringColor?: 'blue' | 'green' | 'yellow' | 'red' | 'gray';
}

export interface AvatarGroupProps {
  avatars: Array<Pick<AvatarProps, 'src' | 'alt' | 'name' | 'status'>>;
  max?: number;
  size?: AvatarSize;
  shape?: AvatarShape;
  className?: string;
  onMoreClick?: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const sizeConfig: Record<AvatarSize, { container: string; text: string; status: string }> = {
  xs: { container: 'w-6 h-6', text: 'text-[10px]', status: 'w-2 h-2 border' },
  sm: { container: 'w-8 h-8', text: 'text-xs', status: 'w-2.5 h-2.5 border' },
  md: { container: 'w-10 h-10', text: 'text-sm', status: 'w-3 h-3 border-2' },
  lg: { container: 'w-12 h-12', text: 'text-base', status: 'w-3.5 h-3.5 border-2' },
  xl: { container: 'w-16 h-16', text: 'text-lg', status: 'w-4 h-4 border-2' },
  '2xl': { container: 'w-20 h-20', text: 'text-xl', status: 'w-5 h-5 border-2' },
};

const shapeConfig: Record<AvatarShape, string> = {
  circle: 'rounded-full',
  rounded: 'rounded-lg',
  square: 'rounded-none',
};

const statusColors: Record<AvatarStatus, string> = {
  online: 'bg-emerald-500',
  offline: 'bg-slate-500',
  away: 'bg-amber-500',
  busy: 'bg-red-500',
  dnd: 'bg-red-600',
};

const ringColors: Record<string, string> = {
  blue: 'ring-blue-500',
  green: 'ring-emerald-500',
  yellow: 'ring-amber-500',
  red: 'ring-red-500',
  gray: 'ring-slate-400',
};

// Generate background color from name
const getColorFromName = (name: string): string => {
  const colors = [
    'bg-blue-600',
    'bg-purple-600',
    'bg-emerald-600',
    'bg-amber-600',
    'bg-rose-600',
    'bg-cyan-600',
    'bg-indigo-600',
    'bg-teal-600',
    'bg-orange-600',
    'bg-pink-600',
  ];
  
  const hash = name
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  return colors[hash % colors.length];
};

// Generate initials from name
const getInitials = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// ============================================================================
// AVATAR COMPONENT
// ============================================================================

export const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  (
    {
      src,
      alt,
      name,
      size = 'md',
      shape = 'circle',
      status,
      showStatus = true,
      className,
      fallback,
      onClick,
      ring = false,
      ringColor = 'blue',
    },
    ref
  ) => {
    const [imageError, setImageError] = useState(false);
    const config = sizeConfig[size];
    const shapeClass = shapeConfig[shape];
    const statusClass = status ? statusColors[status] : '';
    const bgColor = name ? getColorFromName(name) : 'bg-slate-600';
    const initials = name ? getInitials(name) : '';

    const showImage = src && !imageError;
    const showInitials = !showImage && name;
    const showFallback = !showImage && !showInitials;

    return (
      <div
        ref={ref}
        className={cn(
          'relative inline-flex items-center justify-center flex-shrink-0',
          config.container,
          shapeClass,
          ring && `ring-2 ring-offset-2 ring-offset-slate-900 ${ringColors[ringColor]}`,
          onClick && 'cursor-pointer hover:opacity-90 transition-opacity',
          className
        )}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      >
        {/* Image */}
        {showImage && (
          <img
            src={src}
            alt={alt || name || 'Avatar'}
            className={cn('w-full h-full object-cover', shapeClass)}
            onError={() => setImageError(true)}
          />
        )}

        {/* Initials */}
        {showInitials && (
          <div
            className={cn(
              'w-full h-full flex items-center justify-center text-white font-medium',
              config.text,
              shapeClass,
              bgColor
            )}
          >
            {initials}
          </div>
        )}

        {/* Fallback */}
        {showFallback && (
          <div
            className={cn(
              'w-full h-full flex items-center justify-center bg-slate-600 text-slate-300',
              shapeClass
            )}
          >
            {fallback || <User className={cn(size === 'xs' ? 'w-3 h-3' : 'w-1/2 h-1/2')} />}
          </div>
        )}

        {/* Status Indicator */}
        {status && showStatus && (
          <span
            className={cn(
              'absolute bottom-0 right-0 block border-slate-900',
              'rounded-full',
              config.status,
              statusClass
            )}
          />
        )}
      </div>
    );
  }
);

Avatar.displayName = 'Avatar';

// ============================================================================
// AVATAR WITH BADGE
// ============================================================================

interface AvatarWithBadgeProps extends AvatarProps {
  badge?: ReactNode;
  badgePosition?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  badgeClassName?: string;
}

export const AvatarWithBadge: React.FC<AvatarWithBadgeProps> = ({
  badge,
  badgePosition = 'top-right',
  badgeClassName,
  ...avatarProps
}) => {
  const positionClasses: Record<string, string> = {
    'top-right': '-top-1 -right-1',
    'top-left': '-top-1 -left-1',
    'bottom-right': '-bottom-1 -right-1',
    'bottom-left': '-bottom-1 -left-1',
  };

  return (
    <div className="relative inline-block">
      <Avatar {...avatarProps} showStatus={false} />
      {badge && (
        <span
          className={cn(
            'absolute flex items-center justify-center',
            'min-w-5 h-5 px-1 rounded-full',
            'bg-blue-600 text-white text-xs font-medium',
            'border-2 border-slate-900',
            positionClasses[badgePosition],
            badgeClassName
          )}
        >
          {badge}
        </span>
      )}
    </div>
  );
};

// ============================================================================
// AVATAR GROUP
// ============================================================================

export const AvatarGroup: React.FC<AvatarGroupProps> = ({
  avatars,
  max = 4,
  size = 'md',
  shape = 'circle',
  className,
  onMoreClick,
}) => {
  const visibleAvatars = avatars.slice(0, max);
  const remainingCount = avatars.length - max;

  return (
    <div className={cn('flex -space-x-2', className)}>
      {visibleAvatars.map((avatar, index) => (
        <Avatar
          key={index}
          src={avatar.src}
          alt={avatar.alt}
          name={avatar.name}
          status={avatar.status}
          size={size}
          shape={shape}
          ring
          ringColor="gray"
          className="hover:z-10 transition-transform hover:scale-110"
        />
      ))}
      {remainingCount > 0 && (
        <button
          onClick={onMoreClick}
          className={cn(
            'relative flex items-center justify-center',
            'bg-slate-700 text-slate-200 font-medium',
            'ring-2 ring-slate-900',
            'hover:bg-slate-600 transition-colors',
            sizeConfig[size].container,
            sizeConfig[size].text,
            shapeConfig[shape]
          )}
        >
          +{remainingCount}
        </button>
      )}
    </div>
  );
};

// ============================================================================
// PRESENCE AVATAR
// ============================================================================

interface PresenceAvatarProps extends AvatarProps {
  presence: 'active' | 'idle' | 'offline';
  lastSeen?: Date;
}

export const PresenceAvatar: React.FC<PresenceAvatarProps> = ({
  presence,
  lastSeen,
  ...avatarProps
}) => {
  const presenceIcons = {
    active: <Check className="w-2 h-2 text-white" />,
    idle: <Clock className="w-2 h-2 text-slate-900" />,
    offline: <Minus className="w-2 h-2 text-white" />,
  };

  const presenceColors = {
    active: 'bg-emerald-500',
    idle: 'bg-amber-400',
    offline: 'bg-slate-500',
  };

  return (
    <div className="relative inline-block">
      <Avatar {...avatarProps} showStatus={false} />
      <span
        className={cn(
          'absolute bottom-0 right-0 flex items-center justify-center',
          'w-4 h-4 rounded-full border-2 border-slate-900',
          presenceColors[presence]
        )}
        title={
          presence === 'offline' && lastSeen
            ? `Last seen ${lastSeen.toLocaleDateString()}`
            : presence
        }
      >
        {presenceIcons[presence]}
      </span>
    </div>
  );
};

// ============================================================================
// VERIFIED AVATAR
// ============================================================================

interface VerifiedAvatarProps extends AvatarProps {
  verified?: boolean;
  verifiedColor?: 'blue' | 'green' | 'gold';
}

export const VerifiedAvatar: React.FC<VerifiedAvatarProps> = ({
  verified = true,
  verifiedColor = 'blue',
  ...avatarProps
}) => {
  const colors = {
    blue: 'text-blue-500',
    green: 'text-emerald-500',
    gold: 'text-amber-500',
  };

  return (
    <div className="relative inline-block">
      <Avatar {...avatarProps} />
      {verified && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className={cn(
            'absolute -bottom-0.5 -right-0.5 flex items-center justify-center',
            'w-5 h-5 bg-slate-900 rounded-full',
            colors[verifiedColor]
          )}
        >
          <svg
            className="w-4 h-4"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        </motion.span>
      )}
    </div>
  );
};

// ============================================================================
// AVATAR STACK
// ============================================================================

interface AvatarStackProps {
  avatars: Array<Pick<AvatarProps, 'src' | 'alt' | 'name'>>;
  size?: AvatarSize;
  direction?: 'left' | 'right';
  className?: string;
}

export const AvatarStack: React.FC<AvatarStackProps> = ({
  avatars,
  size = 'md',
  direction = 'right',
  className,
}) => {
  return (
    <div
      className={cn(
        'flex',
        direction === 'right' ? '-space-x-3' : 'flex-row-reverse space-x-reverse -space-x-3',
        className
      )}
    >
      {avatars.map((avatar, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, x: direction === 'right' ? -10 : 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          style={{ zIndex: avatars.length - index }}
          className="hover:z-50 transition-transform hover:scale-105"
        >
          <Avatar
            src={avatar.src}
            alt={avatar.alt}
            name={avatar.name}
            size={size}
            className="ring-2 ring-slate-900"
          />
        </motion.div>
      ))}
    </div>
  );
};

export default Avatar;
