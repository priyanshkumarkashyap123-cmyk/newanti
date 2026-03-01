/**
 * Switch Component - Toggle Switch
 * Based on Radix UI Switch primitive
 * 
 * Sizes per Figma §2.8:
 *   sm:      32×18px, thumb 14px
 *   default: 40×22px, thumb 18px
 *   lg:      48×26px, thumb 22px
 * 
 * Colors: off = slate-600, on = blue-500, thumb = always white
 */

import * as React from 'react';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const switchVariants = cva(
    'peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-blue-500 data-[state=unchecked]:bg-slate-600',
    {
        variants: {
            size: {
                sm: 'h-[18px] w-8',
                default: 'h-[22px] w-10',
                lg: 'h-[26px] w-12',
            },
        },
        defaultVariants: {
            size: 'default',
        },
    }
);

const thumbVariants = cva(
    'pointer-events-none block rounded-full bg-white shadow-lg ring-0 transition-transform duration-200',
    {
        variants: {
            size: {
                sm: 'h-[14px] w-[14px] data-[state=checked]:translate-x-[14px] data-[state=unchecked]:translate-x-0',
                default: 'h-[18px] w-[18px] data-[state=checked]:translate-x-[18px] data-[state=unchecked]:translate-x-0',
                lg: 'h-[22px] w-[22px] data-[state=checked]:translate-x-[22px] data-[state=unchecked]:translate-x-0',
            },
        },
        defaultVariants: {
            size: 'default',
        },
    }
);

interface SwitchProps
    extends React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>,
        VariantProps<typeof switchVariants> {}

const Switch = React.forwardRef<
    React.ElementRef<typeof SwitchPrimitive.Root>,
    SwitchProps
>(({ className, size, ...props }, ref) => (
    <SwitchPrimitive.Root
        className={cn(switchVariants({ size }), className)}
        {...props}
        ref={ref}
    >
        <SwitchPrimitive.Thumb className={cn(thumbVariants({ size }))} />
    </SwitchPrimitive.Root>
));
Switch.displayName = SwitchPrimitive.Root.displayName;

export { Switch, switchVariants };
