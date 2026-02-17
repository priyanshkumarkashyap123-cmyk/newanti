/**
 * Tabs & Navigation Components
 * Animated tabs, breadcrumbs, pagination, and steppers
 */

import { FC, ReactNode, useState, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, MoreHorizontal, Check, Circle } from 'lucide-react';

// ============================================
// Tabs Component
// ============================================

interface Tab {
    id: string;
    label: string;
    icon?: ReactNode;
    disabled?: boolean;
    badge?: string | number;
}

interface TabsProps {
    tabs: Tab[];
    activeTab: string;
    onTabChange: (tabId: string) => void;
    variant?: 'default' | 'pills' | 'underline';
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export const Tabs: FC<TabsProps> = ({
    tabs,
    activeTab,
    onTabChange,
    variant = 'default',
    size = 'md',
    className = '',
}) => {
    const sizeClasses = {
        sm: 'text-sm py-2 px-3',
        md: 'text-sm py-2.5 px-4',
        lg: 'text-base py-3 px-5',
    };

    const variantStyles = {
        default: {
            container: 'bg-slate-800/50 p-1 rounded-xl',
            tab: 'rounded-lg',
            active: 'bg-slate-700 text-white shadow',
            inactive: 'text-slate-400 hover:text-white',
        },
        pills: {
            container: 'gap-2',
            tab: 'rounded-full',
            active: 'bg-blue-600 text-white',
            inactive: 'text-slate-400 hover:bg-slate-800 hover:text-white',
        },
        underline: {
            container: 'border-b border-slate-700',
            tab: '',
            active: 'text-white border-b-2 border-blue-500 -mb-px',
            inactive: 'text-slate-400 hover:text-white',
        },
    };

    const styles = variantStyles[variant];

    return (
        <div className={`flex ${styles.container} ${className}`}>
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => !tab.disabled && onTabChange(tab.id)}
                    disabled={tab.disabled}
                    className={`
                        flex items-center gap-2 font-medium transition-all relative
                        ${sizeClasses[size]}
                        ${styles.tab}
                        ${activeTab === tab.id ? styles.active : styles.inactive}
                        ${tab.disabled ? 'opacity-40 cursor-not-allowed' : ''}
                    `}
                >
                    {tab.icon}
                    {tab.label}
                    {tab.badge !== undefined && (
                        <span className={`
                            px-1.5 py-0.5 text-xs rounded-full
                            ${activeTab === tab.id ? 'bg-white/20' : 'bg-slate-700'}
                        `}>
                            {tab.badge}
                        </span>
                    )}
                    {variant === 'default' && activeTab === tab.id && (
                        <motion.div
                            layoutId="activeTab"
                            className="absolute inset-0 bg-slate-700 rounded-lg -z-10"
                            transition={{ type: 'spring', duration: 0.3 }}
                        />
                    )}
                </button>
            ))}
        </div>
    );
};

// ============================================
// Tab Panel
// ============================================

interface TabPanelProps {
    children: ReactNode;
    isActive: boolean;
    className?: string;
}

export const TabPanel: FC<TabPanelProps> = ({ children, isActive, className = '' }) => (
    <AnimatePresence mode="wait">
        {isActive && (
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className={className}
            >
                {children}
            </motion.div>
        )}
    </AnimatePresence>
);

// ============================================
// Breadcrumbs
// ============================================

interface BreadcrumbItem {
    label: string;
    href?: string;
    onClick?: () => void;
}

interface BreadcrumbsProps {
    items: BreadcrumbItem[];
    separator?: ReactNode;
    className?: string;
}

export const Breadcrumbs: FC<BreadcrumbsProps> = ({
    items,
    separator = <ChevronRight className="w-4 h-4" />,
    className = '',
}) => (
    <nav className={`flex items-center gap-2 text-sm ${className}`}>
        {items.map((item, index) => {
            const isLast = index === items.length - 1;

            return (
                <div key={item.label} className="flex items-center gap-2">
                    {item.href || item.onClick ? (
                        <button
                            onClick={item.onClick}
                            className={`
                                hover:text-white transition-colors
                                ${isLast ? 'text-white font-medium' : 'text-slate-400'}
                            `}
                        >
                            {item.label}
                        </button>
                    ) : (
                        <span className={isLast ? 'text-white font-medium' : 'text-slate-400'}>
                            {item.label}
                        </span>
                    )}
                    {!isLast && (
                        <span className="text-slate-500">{separator}</span>
                    )}
                </div>
            );
        })}
    </nav>
);

// ============================================
// Pagination
// ============================================

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    showPageNumbers?: boolean;
    siblingCount?: number;
    className?: string;
}

export const Pagination: FC<PaginationProps> = ({
    currentPage,
    totalPages,
    onPageChange,
    showPageNumbers = true,
    siblingCount = 1,
    className = '',
}) => {
    const getPageNumbers = () => {
        const pages: (number | 'ellipsis')[] = [];

        // Always show first page
        pages.push(1);

        // Calculate range around current page
        const start = Math.max(2, currentPage - siblingCount);
        const end = Math.min(totalPages - 1, currentPage + siblingCount);

        // Add ellipsis if needed
        if (start > 2) pages.push('ellipsis');

        // Add middle pages
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }

        // Add ellipsis if needed
        if (end < totalPages - 1) pages.push('ellipsis');

        // Always show last page if more than 1 page
        if (totalPages > 1) pages.push(totalPages);

        return pages;
    };

    const pages = getPageNumbers();

    return (
        <nav className={`flex items-center gap-1 ${className}`}>
            {/* Previous */}
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
                <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Page Numbers */}
            {showPageNumbers && pages.map((page, index) => (
                page === 'ellipsis' ? (
                    <span key={`ellipsis-${index}`} className="px-3 text-slate-400">
                        <MoreHorizontal className="w-4 h-4" />
                    </span>
                ) : (
                    <motion.button
                        key={page}
                        onClick={() => onPageChange(page)}
                        whileTap={{ scale: 0.95 }}
                        className={`
                            w-10 h-10 rounded-lg font-medium transition-colors
                            ${currentPage === page
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800'
                            }
                        `}
                    >
                        {page}
                    </motion.button>
                )
            ))}

            {/* Next */}
            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
                <ChevronRight className="w-5 h-5" />
            </button>
        </nav>
    );
};

// ============================================
// Stepper
// ============================================

interface Step {
    id: string;
    label: string;
    description?: string;
}

interface StepperProps {
    steps: Step[];
    currentStep: number;
    onStepClick?: (stepIndex: number) => void;
    variant?: 'horizontal' | 'vertical';
    className?: string;
}

export const Stepper: FC<StepperProps> = ({
    steps,
    currentStep,
    onStepClick,
    variant = 'horizontal',
    className = '',
}) => {
    if (variant === 'vertical') {
        return (
            <div className={`space-y-4 ${className}`}>
                {steps.map((step, index) => {
                    const isCompleted = index < currentStep;
                    const isCurrent = index === currentStep;

                    return (
                        <div
                            key={step.id}
                            className="flex gap-4"
                            onClick={() => onStepClick?.(index)}
                        >
                            {/* Connector + Circle */}
                            <div className="flex flex-col items-center">
                                <motion.div
                                    initial={false}
                                    animate={{
                                        backgroundColor: isCompleted || isCurrent ? '#3b82f6' : '#334155',
                                    }}
                                    className={`
                                        w-8 h-8 rounded-full flex items-center justify-center
                                        ${onStepClick ? 'cursor-pointer' : ''}
                                    `}
                                >
                                    {isCompleted ? (
                                        <Check className="w-4 h-4 text-white" />
                                    ) : (
                                        <span className={`text-sm font-medium ${isCurrent ? 'text-white' : 'text-slate-400'}`}>
                                            {index + 1}
                                        </span>
                                    )}
                                </motion.div>
                                {index < steps.length - 1 && (
                                    <div className={`w-0.5 h-12 mt-2 ${isCompleted ? 'bg-blue-500' : 'bg-slate-700'}`} />
                                )}
                            </div>

                            {/* Content */}
                            <div className="pt-1">
                                <p className={`font-medium ${isCurrent ? 'text-white' : 'text-slate-400'}`}>
                                    {step.label}
                                </p>
                                {step.description && (
                                    <p className="text-sm text-slate-400 mt-0.5">{step.description}</p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    }

    // Horizontal variant
    return (
        <div className={`flex items-center ${className}`}>
            {steps.map((step, index) => {
                const isCompleted = index < currentStep;
                const isCurrent = index === currentStep;

                return (
                    <div key={step.id} className="flex items-center">
                        <div
                            onClick={() => onStepClick?.(index)}
                            className={`flex items-center gap-3 ${onStepClick ? 'cursor-pointer' : ''}`}
                        >
                            <motion.div
                                initial={false}
                                animate={{
                                    backgroundColor: isCompleted || isCurrent ? '#3b82f6' : '#334155',
                                    scale: isCurrent ? 1.1 : 1,
                                }}
                                className="w-8 h-8 rounded-full flex items-center justify-center"
                            >
                                {isCompleted ? (
                                    <Check className="w-4 h-4 text-white" />
                                ) : (
                                    <span className={`text-sm font-medium ${isCurrent ? 'text-white' : 'text-slate-400'}`}>
                                        {index + 1}
                                    </span>
                                )}
                            </motion.div>
                            <div className="hidden sm:block">
                                <p className={`text-sm font-medium ${isCurrent ? 'text-white' : 'text-slate-400'}`}>
                                    {step.label}
                                </p>
                            </div>
                        </div>

                        {/* Connector */}
                        {index < steps.length - 1 && (
                            <div className={`w-12 h-0.5 mx-4 ${isCompleted ? 'bg-blue-500' : 'bg-slate-700'}`} />
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// ============================================
// Segmented Control
// ============================================

interface SegmentedControlProps {
    options: Array<{ value: string; label: string; icon?: ReactNode }>;
    value: string;
    onChange: (value: string) => void;
    size?: 'sm' | 'md' | 'lg';
    className?: string;
}

export const SegmentedControl: FC<SegmentedControlProps> = ({
    options,
    value,
    onChange,
    size = 'md',
    className = '',
}) => {
    const sizeClasses = {
        sm: 'py-1.5 px-3 text-sm',
        md: 'py-2 px-4 text-sm',
        lg: 'py-2.5 px-5 text-base',
    };

    return (
        <div className={`inline-flex bg-slate-800 p-1 rounded-lg ${className}`}>
            {options.map((option) => (
                <button
                    key={option.value}
                    onClick={() => onChange(option.value)}
                    className={`
                        relative flex items-center gap-2 font-medium rounded-md transition-colors
                        ${sizeClasses[size]}
                        ${value === option.value ? 'text-white' : 'text-slate-400 hover:text-white'}
                    `}
                >
                    {option.icon}
                    {option.label}
                    {value === option.value && (
                        <motion.div
                            layoutId="segmentedActive"
                            className="absolute inset-0 bg-slate-600 rounded-md -z-10"
                            transition={{ type: 'spring', duration: 0.3 }}
                        />
                    )}
                </button>
            ))}
        </div>
    );
};

export default {
    Tabs,
    TabPanel,
    Breadcrumbs,
    Pagination,
    Stepper,
    SegmentedControl,
};
