import * as React from "react";
import { cn } from "../../lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'interactive' | 'outlined';
}

const variantClasses: Record<NonNullable<CardProps['variant']>, string> = {
  default: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
  elevated: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-lg shadow-black/20',
  interactive: 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-blue-500/30 hover:bg-slate-100/80 dark:hover:bg-slate-700/80 hover:shadow-md hover:-translate-y-0.5 cursor-pointer active:translate-y-0 active:shadow-sm',
  outlined: 'bg-transparent border-slate-200 dark:border-slate-700',
};

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', role, tabIndex, ...props }, ref) => {
    // Interactive cards should behave like buttons when no explicit role is set
    const isInteractive = variant === 'interactive';
    const resolvedRole = role ?? (isInteractive ? 'button' : undefined);
    const resolvedTabIndex = tabIndex ?? (isInteractive ? 0 : undefined);

    return (
      <div
        ref={ref}
        role={resolvedRole}
        tabIndex={resolvedTabIndex}
        className={cn(
          'rounded-xl border text-slate-800 dark:text-slate-100 transition-all duration-200',
          variantClasses[variant],
          className
        )}
        {...props}
      />
    );
  }
);
Card.displayName = "Card";

const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 p-5 border-b border-slate-200 dark:border-slate-800', className)}
    {...props}
  />
));
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight text-slate-900 dark:text-white', className)}
    {...props}
  />
));
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-slate-500 dark:text-slate-400', className)}
    {...props}
  />
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('p-5', className)} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center gap-3 p-5 pt-0', className)}
    {...props}
  />
));
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
