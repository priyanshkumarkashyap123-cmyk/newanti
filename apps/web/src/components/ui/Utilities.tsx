/**
 * Utility UI Components
 * Tooltip, Avatar, Badge, Accordion, Divider
 */

import { FC, ReactNode, useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, User } from 'lucide-react';

// ============================================
// Tooltip Component
// ============================================

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
    content: ReactNode;
    children: ReactNode;
    position?: TooltipPosition;
    delay?: number;
    className?: string;
}

export const Tooltip: FC<TooltipProps> = ({
    content,
    children,
    position = 'top',
    delay = 200,
    className = '',
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const showTooltip = () => {
        timeoutRef.current = setTimeout(() => setIsVisible(true), delay);
    };

    const hideTooltip = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setIsVisible(false);
    };

    const positionClasses = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
        left: 'right-full top-1/2 -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    };

    const arrowClasses = {
        top: 'top-full left-1/2 -translate-x-1/2 border-t-slate-800',
        bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-slate-800',
        left: 'left-full top-1/2 -translate-y-1/2 border-l-slate-800',
        right: 'right-full top-1/2 -translate-y-1/2 border-r-slate-800',
    };

    return (
        <div
            className="relative inline-block"
            onMouseEnter={showTooltip}
            onMouseLeave={hideTooltip}
        >
            {children}
            <AnimatePresence>
                {isVisible && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.15 }}
                        className={`
                            absolute z-[600] px-3 py-2 
                            bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 
                            text-sm text-slate-700 dark:text-slate-200 rounded-lg shadow-xl
                            whitespace-nowrap pointer-events-none
                            ${positionClasses[position]}
                            ${className}
                        `}
                    >
                        {content}
                        <div
                            className={`absolute border-4 border-transparent ${arrowClasses[position]}`}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

// ============================================
// Avatar Component
// ============================================

type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
    src?: string;
    alt?: string;
    name?: string;
    size?: AvatarSize;
    status?: 'online' | 'offline' | 'busy' | 'away';
    className?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-xl',
};

const statusColors = {
    online: 'bg-green-500',
    offline: 'bg-slate-500',
    busy: 'bg-red-500',
    away: 'bg-yellow-500',
};

export const Avatar: FC<AvatarProps> = ({
    src,
    alt,
    name,
    size = 'md',
    status,
    className = '',
}) => {
    const [imageError, setImageError] = useState(false);

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    const colorFromName = (name: string) => {
        const colors = [
            'bg-blue-600', 'bg-green-600', 'bg-purple-600',
            'bg-pink-600', 'bg-indigo-600', 'bg-teal-600'
        ];
        const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return colors[index % colors.length];
    };

    return (
        <div className={`relative inline-block ${className}`}>
            <div className={`
                ${sizeClasses[size]} 
                rounded-full overflow-hidden 
                flex items-center justify-center font-medium
                ${!src || imageError ? (name ? colorFromName(name) : 'bg-slate-200 dark:bg-slate-700') : ''}
            `}>
                {src && !imageError ? (
                    <img
                        src={src}
                        alt={alt || name || 'Avatar'}
                        onError={() => setImageError(true)}
                        className="w-full h-full object-cover"
                    />
                ) : name ? (
                    <span className="text-slate-900 dark:text-white">{getInitials(name)}</span>
                ) : (
                    <User className="w-1/2 h-1/2 text-slate-500 dark:text-slate-400" />
                )}
            </div>

            {status && (
                <span className={`
                    absolute bottom-0 right-0 
                    w-1/4 h-1/4 min-w-[8px] min-h-[8px]
                    rounded-full border-2 border-slate-900
                    ${statusColors[status]}
                `} />
            )}
        </div>
    );
};

// ============================================
// Avatar Group
// ============================================

interface AvatarGroupProps {
    avatars: AvatarProps[];
    max?: number;
    size?: AvatarSize;
    className?: string;
}

export const AvatarGroup: FC<AvatarGroupProps> = ({
    avatars,
    max = 4,
    size = 'md',
    className = '',
}) => {
    const visible = avatars.slice(0, max);
    const remaining = avatars.length - max;

    return (
        <div className={`flex -space-x-2 ${className}`}>
            {visible.map((avatar, index) => (
                <div key={index} className="ring-2 ring-slate-900 rounded-full">
                    <Avatar {...avatar} size={size} />
                </div>
            ))}
            {remaining > 0 && (
                <div className={`
                    ${sizeClasses[size]} 
                    rounded-full bg-slate-200 dark:bg-slate-700 
                    flex items-center justify-center 
                    font-medium text-slate-600 dark:text-slate-300
                    ring-2 ring-slate-900
                `}>
                    +{remaining}
                </div>
            )}
        </div>
    );
};

// ============================================
// Badge Component
// ============================================

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'outline';

interface BadgeProps {
    children: ReactNode;
    variant?: BadgeVariant;
    size?: 'sm' | 'md';
    dot?: boolean;
    className?: string;
}

export const Badge: FC<BadgeProps> = ({
    children,
    variant = 'default',
    size = 'md',
    dot = false,
    className = '',
}) => {
    const variantClasses = {
        default: 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200',
        success: 'bg-green-500/20 text-green-400 border border-green-500/30',
        warning: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
        error: 'bg-red-500/20 text-red-400 border border-red-500/30',
        info: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
        outline: 'border border-slate-600 text-slate-500 dark:text-slate-400',
    };

    const sizeClasses = {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-1 text-xs',
    };

    const dotColors = {
        default: 'bg-slate-400',
        success: 'bg-green-400',
        warning: 'bg-yellow-400',
        error: 'bg-red-400',
        info: 'bg-blue-400',
        outline: 'bg-slate-400',
    };

    return (
        <span className={`
            inline-flex items-center gap-1.5 rounded-full font-medium
            ${variantClasses[variant]}
            ${sizeClasses[size]}
            ${className}
        `}>
            {dot && (
                <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />
            )}
            {children}
        </span>
    );
};

// ============================================
// Accordion Component
// ============================================

interface AccordionItem {
    id: string;
    title: string;
    content: ReactNode;
    icon?: ReactNode;
}

interface AccordionProps {
    items: AccordionItem[];
    allowMultiple?: boolean;
    defaultOpen?: string[];
    className?: string;
}

export const Accordion: FC<AccordionProps> = ({
    items,
    allowMultiple = false,
    defaultOpen = [],
    className = '',
}) => {
    const [openItems, setOpenItems] = useState<string[]>(defaultOpen);

    const toggleItem = (id: string) => {
        if (allowMultiple) {
            setOpenItems(prev =>
                prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
            );
        } else {
            setOpenItems(prev => (prev.includes(id) ? [] : [id]));
        }
    };

    return (
        <div className={`divide-y divide-slate-200 dark:divide-slate-800 ${className}`}>
            {items.map((item) => {
                const isOpen = openItems.includes(item.id);

                return (
                    <div key={item.id}>
                        <button type="button"
                            onClick={() => toggleItem(item.id)}
                            className="w-full flex items-center justify-between py-4 text-left hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                {item.icon && (
                                    <span className="text-slate-500 dark:text-slate-400">{item.icon}</span>
                                )}
                                <span className={`font-medium ${isOpen ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                                    {item.title}
                                </span>
                            </div>
                            <motion.span
                                animate={{ rotate: isOpen ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                                className="text-slate-500 dark:text-slate-400"
                            >
                                <ChevronDown className="w-5 h-5" />
                            </motion.span>
                        </button>

                        <AnimatePresence>
                            {isOpen && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    <div className="pb-4 text-slate-500 dark:text-slate-400">
                                        {item.content}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                );
            })}
        </div>
    );
};

// ============================================
// Divider Component
// ============================================

interface DividerProps {
    label?: string;
    orientation?: 'horizontal' | 'vertical';
    className?: string;
}

export const Divider: FC<DividerProps> = ({
    label,
    orientation = 'horizontal',
    className = '',
}) => {
    if (orientation === 'vertical') {
        return <div className={`w-px h-full bg-slate-200 dark:bg-slate-700 ${className}`} />;
    }

    if (label) {
        return (
            <div className={`flex items-center gap-4 ${className}`}>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">{label}</span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
            </div>
        );
    }

    return <div className={`h-px bg-slate-200 dark:bg-slate-700 ${className}`} />;
};

// ============================================
// Empty State Component
// ============================================

interface EmptyStateProps {
    icon?: ReactNode;
    title: string;
    description?: string;
    action?: ReactNode;
    className?: string;
}

export const EmptyState: FC<EmptyStateProps> = ({
    icon,
    title,
    description,
    action,
    className = '',
}) => (
    <div className={`flex flex-col items-center justify-center py-12 px-6 text-center ${className}`}>
        {icon && (
            <div className="w-16 h-16 mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
                {icon}
            </div>
        )}
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">{title}</h3>
        {description && (
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mb-6">{description}</p>
        )}
        {action}
    </div>
);

export default {
    Tooltip,
    Avatar,
    AvatarGroup,
    Badge,
    Accordion,
    Divider,
    EmptyState,
};
