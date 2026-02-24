import { cn } from '../../lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> { }

/**
 * Base Skeleton component with shimmer animation
 */
export function Skeleton({ className, ...props }: SkeletonProps) {
    return (
        <div
            className={cn(
                "animate-pulse rounded-md bg-slate-800/50",
                className
            )}
            {...props}
        />
    );
}

/**
 * Skeleton for text lines (paragraph content)
 */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
    return (
        <div className={cn("space-y-2", className)}>
            {Array.from({ length: lines }).map((_, i) => (
                <Skeleton
                    key={i}
                    className={cn(
                        "h-4",
                        i === lines - 1 ? "w-3/4" : "w-full" // Last line shorter
                    )}
                />
            ))}
        </div>
    );
}

/**
 * Skeleton for card layouts
 */
export function SkeletonCard({ className }: { className?: string }) {
    return (
        <div className={cn("rounded-lg border border-slate-700 p-4 space-y-4", className)}>
            <div className="flex items-center space-x-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                </div>
            </div>
            <SkeletonText lines={2} />
        </div>
    );
}

/**
 * Skeleton for table rows
 */
export function SkeletonTable({ rows = 5, cols = 4, className }: { rows?: number; cols?: number; className?: string }) {
    return (
        <div className={cn("space-y-2", className)}>
            {/* Header */}
            <div className="flex gap-4 pb-2 border-b border-slate-700">
                {Array.from({ length: cols }).map((_, i) => (
                    <Skeleton key={i} className="h-4 flex-1" />
                ))}
            </div>
            {/* Rows */}
            {Array.from({ length: rows }).map((_, rowIdx) => (
                <div key={rowIdx} className="flex gap-4 py-2">
                    {Array.from({ length: cols }).map((_, colIdx) => (
                        <Skeleton key={colIdx} className="h-4 flex-1" />
                    ))}
                </div>
            ))}
        </div>
    );
}

/**
 * Skeleton for analysis results panel
 */
export function SkeletonAnalysisResults({ className }: { className?: string }) {
    return (
        <div className={cn("space-y-4", className)} role="status" aria-label="Loading analysis results">
            {/* Header */}
            <div className="flex justify-between items-center">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-8 w-24 rounded" />
            </div>
            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="p-3 rounded-lg border border-slate-700">
                        <Skeleton className="h-3 w-20 mb-2" />
                        <Skeleton className="h-6 w-16" />
                    </div>
                ))}
            </div>
            {/* Chart placeholder */}
            <Skeleton className="h-48 w-full rounded-lg" />
            <span className="sr-only">Loading analysis results, please wait...</span>
        </div>
    );
}

/**
 * Skeleton for toolbar/ribbon
 */
export function SkeletonToolbar({ className }: { className?: string }) {
    return (
        <div className={cn("flex items-center gap-2 p-2", className)} role="status" aria-label="Loading toolbar">
            {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-10 rounded-lg" />
            ))}
            <div className="h-8 w-px bg-slate-700 mx-2" />
            {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={`group2-${i}`} className="h-10 w-10 rounded-lg" />
            ))}
            <span className="sr-only">Loading toolbar, please wait...</span>
        </div>
    );
}

/**
 * Skeleton for sidebar navigation
 */
export function SkeletonSidebar({ className }: { className?: string }) {
    return (
        <div className={cn("w-64 p-4 space-y-4", className)} role="status" aria-label="Loading sidebar">
            {/* Logo area */}
            <div className="flex items-center gap-3 mb-6">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <Skeleton className="h-5 w-24" />
            </div>
            {/* Navigation items */}
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-5 w-5 rounded" />
                    <Skeleton className="h-4 flex-1" />
                </div>
            ))}
            <div className="h-px bg-slate-700 my-4" />
            {Array.from({ length: 3 }).map((_, i) => (
                <div key={`section2-${i}`} className="flex items-center gap-3">
                    <Skeleton className="h-5 w-5 rounded" />
                    <Skeleton className="h-4 flex-1" />
                </div>
            ))}
            <span className="sr-only">Loading sidebar, please wait...</span>
        </div>
    );
}

/**
 * Skeleton for project card (matches UnifiedDashboard ProjectCard)
 */
export function SkeletonProjectCard({ className }: { className?: string }) {
    return (
        <div className={cn("bg-slate-900 border border-slate-800 rounded-xl p-4", className)} role="status" aria-label="Loading project">
            {/* Thumbnail */}
            <Skeleton className="aspect-video w-full rounded-lg mb-3" />
            {/* Title */}
            <Skeleton className="h-5 w-3/4 mb-2" />
            {/* Meta */}
            <div className="flex items-center gap-2 mb-3">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-3 w-14" />
            </div>
            {/* Tags */}
            <div className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <span className="sr-only">Loading project, please wait...</span>
        </div>
    );
}

/**
 * Skeleton for form fields
 */
export function SkeletonForm({ fields = 4, className }: { fields?: number; className?: string }) {
    return (
        <div className={cn("space-y-6", className)} role="status" aria-label="Loading form">
            {Array.from({ length: fields }).map((_, i) => (
                <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-11 w-full rounded-lg" />
                </div>
            ))}
            {/* Submit button */}
            <Skeleton className="h-11 w-full rounded-lg mt-4" />
            <span className="sr-only">Loading form, please wait...</span>
        </div>
    );
}
