/**
 * Alert Component - Notification Banners
 *
 * Variants: default, destructive, success, warning, info
 * Uses the project's slate palette with proper dark mode support.
 */

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"

const alertVariants = cva(
  [
    "relative w-full rounded-lg border p-4 text-sm transition-colors duration-200",
    "[&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4",
  ].join(" "),
  {
    variants: {
      variant: {
        default:
          "bg-[#131b2e] border-[#1a2333] text-slate-900 dark:text-slate-100 [&>svg]:text-slate-600 dark:[&>svg]:text-slate-400",
        destructive:
          "bg-red-50 dark:bg-red-950/30 border-[#1a2333]/50 text-red-800 dark:text-red-300 [&>svg]:text-red-500 dark:[&>svg]:text-red-400",
        success:
          "bg-green-50 dark:bg-green-950/30 border-[#1a2333]/50 text-green-800 dark:text-green-300 [&>svg]:text-green-500 dark:[&>svg]:text-green-400",
        warning:
          "bg-amber-50 dark:bg-amber-950/30 border-[#1a2333]/50 text-amber-800 dark:text-amber-300 [&>svg]:text-amber-500 dark:[&>svg]:text-amber-400",
        info:
          "bg-blue-50 dark:bg-blue-950/30 border-[#1a2333]/50 text-blue-800 dark:text-blue-300 [&>svg]:text-blue-500 dark:[&>svg]:text-blue-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    role="alert"
    className={cn(alertVariants({ variant }), className)}
    {...props}
  />
))
Alert.displayName = "Alert"

const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
AlertTitle.displayName = "AlertTitle"

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm opacity-90 [&_p]:leading-relaxed", className)}
    {...props}
  />
))
AlertDescription.displayName = "AlertDescription"

export { Alert, AlertTitle, AlertDescription, alertVariants }
