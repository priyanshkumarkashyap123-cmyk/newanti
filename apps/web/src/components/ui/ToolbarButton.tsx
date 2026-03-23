/**
 * ToolbarButton - Unified Toolbar Button Component
 * 
 * Standardized button for all toolbars (ModelingToolbar, Toolbar, etc.)
 * Replaces duplicate ToolBtn and ToolButton implementations
 */

import { FC, memo } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ToolbarButtonProps {
  /** Lucide icon component */
  icon: LucideIcon;
  /** Button label text */
  label: string;
  /** Click handler */
  onClick: () => void;
  /** Whether button is in active/pressed state */
  isActive?: boolean;
  /** Whether button is disabled */
  disabled?: boolean;
  /** Visual variant */
  variant?: 'default' | 'primary' | 'success' | 'purple' | 'danger';
  /** Keyboard shortcut (displayed as hint) */
  shortcut?: string;
  /** Whether to show label text (hide for icon-only) */
  showLabel?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export const ToolbarButton: FC<ToolbarButtonProps> = memo(({
  icon: Icon,
  label,
  onClick,
  isActive = false,
  disabled = false,
  variant = 'default',
  shortcut,
  showLabel = true,
  className,
}) => {
  // Variant styles
  const variantClasses = {
    default: isActive
      ? 'bg-blue-600/20 text-blue-300 border-blue-500/40 shadow-sm shadow-blue-500/10'
      : 'bg-[#131b2e] text-slate-600 dark:text-slate-300 border-[#1a2333] hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white',
    primary: isActive
      ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/30'
      : 'bg-blue-600 text-white border-blue-500 hover:bg-blue-500 hover:shadow-md hover:shadow-blue-500/30',
    success: 'bg-emerald-600 text-white border-emerald-500 hover:bg-emerald-500 shadow-sm shadow-emerald-600/20 hover:shadow-md hover:shadow-emerald-500/30',
    purple: isActive
      ? 'bg-purple-600/30 text-purple-300 border-purple-500/50 shadow-sm shadow-purple-500/10'
      : 'bg-purple-600 text-white border-purple-500 hover:bg-purple-500',
    danger: 'bg-red-600 text-white border-red-500 hover:bg-red-500',
  };

  const tooltipText = shortcut ? `${label} (${shortcut})` : label;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={tooltipText}
      aria-label={tooltipText}
      aria-pressed={isActive}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg',
        'text-xs font-medium tracking-wide border transition-all duration-150',
        'active:scale-[0.97] select-none',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        variantClasses[variant],
        className
      )}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
      {showLabel && <span className="whitespace-nowrap">{label}</span>}
      {showLabel && shortcut && (
        <span className="text-[10px] text-[#869ab8] ml-auto" aria-hidden="true">
          {shortcut}
        </span>
      )}
    </button>
  );
});

ToolbarButton.displayName = 'ToolbarButton';

/**
 * ToolbarSeparator - Visual separator between toolbar sections
 */
export const ToolbarSeparator: FC<{ className?: string }> = memo(({ className }) => (
  <div
    className={cn(
      'w-px h-7 bg-slate-200 dark:bg-slate-700 mx-0.5 flex-shrink-0',
      className
    )}
    aria-hidden="true"
  />
));

ToolbarSeparator.displayName = 'ToolbarSeparator';
