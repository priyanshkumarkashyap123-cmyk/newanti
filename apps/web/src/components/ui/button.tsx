/**
 * Button Component - Multi-variant Button
 * 
 * Compact button with multiple variants for engineering interfaces.
 */

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
    // Base styles
    [
        'inline-flex items-center justify-center gap-1.5',
        'rounded-md text-sm font-medium',
        'transition-colors focus-visible:outline-none focus-visible:ring-2',
        'focus-visible:ring-blue-500 focus-visible:ring-offset-1',
        'disabled:pointer-events-none disabled:opacity-50'
    ].join(' '),
    {
        variants: {
            variant: {
                default: 'bg-blue-600 text-white hover:bg-blue-500',
                destructive: 'bg-red-600 text-white hover:bg-red-500',
                outline: 'border border-zinc-200 dark:border-zinc-700 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300',
                secondary: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700',
                ghost: 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400',
                link: 'text-blue-600 underline-offset-4 hover:underline'
            },
            size: {
                default: 'h-8 px-3 py-1.5',
                sm: 'h-7 px-2 text-xs',
                lg: 'h-9 px-4',
                icon: 'h-8 w-8 p-0'
            }
        },
        defaultVariants: {
            variant: 'default',
            size: 'default'
        }
    }
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : 'button';
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        );
    }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
