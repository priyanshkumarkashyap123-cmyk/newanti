/**
 * Tabs Component - Tab Navigation
 * Based on Radix UI Tabs primitive
 * 
 * Variants per Figma §2.8:
 *   pill:     Rounded bg pill (default, current behavior)
 *   line:     Underline indicator, transparent bg
 *   enclosed: Card-style with colored top border
 * 
 * Sizes per Figma §2.8:
 *   sm:      28px
 *   default: 32px
 *   lg:      40px
 */

import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const Tabs = TabsPrimitive.Root;

/* ------------------------------------------------------------------ */
/*  TabsList variants                                                 */
/* ------------------------------------------------------------------ */

const tabsListVariants = cva(
    'inline-flex items-center justify-center text-[#869ab8]',
    {
        variants: {
            variant: {
                pill: 'rounded-lg bg-[#131b2e] p-1 gap-0.5',
                line: 'border-b border-[#1a2333] gap-0',
                enclosed: 'bg-transparent gap-0',
            },
            size: {
                sm: 'h-7',
                default: 'h-8',
                lg: 'h-10',
            },
        },
        defaultVariants: {
            variant: 'pill',
            size: 'default',
        },
    }
);

interface TabsListProps
    extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>,
        VariantProps<typeof tabsListVariants> {}

const TabsList = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.List>,
    TabsListProps
>(({ className, variant, size, ...props }, ref) => (
    <TabsPrimitive.List
        ref={ref}
        className={cn(tabsListVariants({ variant, size }), className)}
        data-variant={variant ?? 'pill'}
        {...props}
    />
));
TabsList.displayName = TabsPrimitive.List.displayName;

/* ------------------------------------------------------------------ */
/*  TabsTrigger variants                                              */
/* ------------------------------------------------------------------ */

const tabsTriggerVariants = cva(
    [
        'inline-flex items-center justify-center whitespace-nowrap px-3 py-1 text-sm font-medium tracking-wide',
        'ring-offset-white dark:ring-offset-slate-950',
        'transition-all duration-200 ease-in-out',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
    ].join(' '),
    {
        variants: {
            variant: {
                pill: [
                    'rounded-md',
                    'data-[state=active]:bg-white dark:data-[state=active]:bg-slate-950',
                    'data-[state=active]:text-slate-950 dark:data-[state=active]:text-slate-50',
                    'data-[state=active]:shadow',
                ].join(' '),
                line: [
                    'rounded-none border-b-2 border-transparent -mb-px',
                    'data-[state=active]:border-blue-500 data-[state=active]:text-blue-500',
                    'hover:text-slate-700 dark:hover:text-slate-200',
                ].join(' '),
                enclosed: [
                    'rounded-t-md border border-transparent -mb-px',
                    'data-[state=active]:bg-white dark:data-[state=active]:bg-slate-900',
                    'data-[state=active]:border-slate-200 dark:data-[state=active]:border-slate-700',
                    'data-[state=active]:border-b-white dark:data-[state=active]:border-b-slate-900',
                    'data-[state=active]:border-t-2 data-[state=active]:border-t-blue-500',
                    'data-[state=active]:text-slate-900 dark:data-[state=active]:text-white',
                ].join(' '),
            },
        },
        defaultVariants: {
            variant: 'pill',
        },
    }
);

interface TabsTriggerProps
    extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>,
        VariantProps<typeof tabsTriggerVariants> {}

const TabsTrigger = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.Trigger>,
    TabsTriggerProps
>(({ className, variant, ...props }, ref) => (
    <TabsPrimitive.Trigger
        ref={ref}
        className={cn(tabsTriggerVariants({ variant }), className)}
        {...props}
    />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

/* ------------------------------------------------------------------ */
/*  TabsContent                                                       */
/* ------------------------------------------------------------------ */

const TabsContent = React.forwardRef<
    React.ElementRef<typeof TabsPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
    <TabsPrimitive.Content
        ref={ref}
        className={cn(
            'mt-2 ring-offset-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 dark:ring-offset-slate-950',
            className
        )}
        {...props}
    />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants, tabsTriggerVariants };
