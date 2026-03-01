/**
 * Slider Component - Range Slider
 * Based on Radix UI Slider primitive
 *
 * Enhancements per Figma §2.8 & §21:
 *   - Hover scale on thumb
 *   - Active/drag scale-up on thumb
 *   - Visible focus ring
 *   - Better track contrast in dark mode
 *   - Optional value tooltip (shows live value on hover/drag)
 *   - Size variants (sm / default / lg)
 */

import * as React from 'react';
import * as SliderPrimitive from '@radix-ui/react-slider';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

/* ------------------------------------------------------------------ */
/*  Track size variants                                                */
/* ------------------------------------------------------------------ */

const trackVariants = cva(
    'relative w-full grow overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700',
    {
        variants: {
            size: {
                sm: 'h-1',
                default: 'h-1.5',
                lg: 'h-2',
            },
        },
        defaultVariants: { size: 'default' },
    }
);

const thumbVariants = cva(
    [
        'block rounded-full border-2 border-blue-500 bg-white shadow-md',
        'ring-offset-white dark:ring-offset-slate-950',
        'transition-transform duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        'hover:scale-110',
        'active:scale-[1.15]',
    ].join(' '),
    {
        variants: {
            size: {
                sm: 'h-3.5 w-3.5',
                default: 'h-4 w-4',
                lg: 'h-5 w-5',
            },
        },
        defaultVariants: { size: 'default' },
    }
);

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface SliderProps
    extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>,
        VariantProps<typeof trackVariants> {
    /** Show a floating tooltip with the current value */
    showTooltip?: boolean;
    /** Format the tooltip value – default: String(value) */
    formatValue?: (value: number) => string;
}

const Slider = React.forwardRef<
    React.ElementRef<typeof SliderPrimitive.Root>,
    SliderProps
>(({ className, size, showTooltip = false, formatValue, ...props }, ref) => {
    const [hovering, setHovering] = React.useState(false);
    const [dragging, setDragging] = React.useState(false);

    const currentValue = props.value ?? props.defaultValue ?? [0];
    const visible = showTooltip && (hovering || dragging);

    return (
        <SliderPrimitive.Root
            ref={ref}
            className={cn(
                'group relative flex w-full touch-none select-none items-center',
                className
            )}
            onPointerDown={() => {
                setDragging(true);
                const handleUp = () => {
                    setDragging(false);
                    window.removeEventListener('pointerup', handleUp);
                };
                window.addEventListener('pointerup', handleUp);
            }}
            onMouseEnter={() => setHovering(true)}
            onMouseLeave={() => setHovering(false)}
            {...props}
        >
            <SliderPrimitive.Track className={cn(trackVariants({ size }))}>
                <SliderPrimitive.Range className="absolute h-full bg-blue-500 dark:bg-blue-400" />
            </SliderPrimitive.Track>

            {(Array.isArray(currentValue) ? currentValue : [currentValue]).map((val, i) => (
                <SliderPrimitive.Thumb key={i} className={cn(thumbVariants({ size }))}>
                    {visible && (
                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 rounded bg-slate-900 dark:bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-white dark:text-slate-900 whitespace-nowrap pointer-events-none animate-in fade-in-0 zoom-in-95 duration-100">
                            {formatValue ? formatValue(val) : String(val)}
                        </span>
                    )}
                </SliderPrimitive.Thumb>
            ))}
        </SliderPrimitive.Root>
    );
});
Slider.displayName = SliderPrimitive.Root.displayName;

export { Slider, trackVariants, thumbVariants };
