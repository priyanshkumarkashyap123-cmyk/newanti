/**
 * AnalysisSkeleton - Animated placeholder cards shown while analysis is running
 */

import { Skeleton } from './Skeleton';
import type { AnalysisProgressStep } from '../../hooks/useAnalysis';

interface AnalysisSkeletonProps {
    steps?: AnalysisProgressStep[];
}

const SkeletonBar = ({ width = 'w-full', height = 'h-4' }: { width?: string; height?: string }) => (
    <Skeleton className={`${width} ${height} rounded`} />
);

export const AnalysisSkeleton = ({ steps = [] }: AnalysisSkeletonProps) => {
    const latestStep = steps[steps.length - 1];
    const percent = latestStep?.percent ?? 0;

    return (
        <div className="space-y-4 p-4" aria-busy="true" aria-label="Analysis in progress">
            {/* Progress bar */}
            <div className="space-y-1">
                <div className="flex justify-between text-xs text-[#869ab8]">
                    <span>{latestStep?.step ?? 'Initialising solver...'}</span>
                    <span>{percent}%</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                        className="h-1.5 rounded-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${percent}%` }}
                    />
                </div>
            </div>

            {/* Progress step list */}
            {steps.length > 0 && (
                <ul className="space-y-1 text-xs text-[#869ab8]">
                    {steps.map((s, i) => (
                        <li key={i} className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                            {s.step}
                        </li>
                    ))}
                </ul>
            )}

            {/* Placeholder cards */}
            <div className="grid grid-cols-2 gap-3">
                {[...Array(4)].map((_, i) => (
                    <div key={i} className="rounded-lg border border-[#1a2333] p-3 space-y-2">
                        <SkeletonBar width="w-1/2" height="h-3" />
                        <SkeletonBar height="h-6" />
                        <SkeletonBar width="w-3/4" height="h-3" />
                    </div>
                ))}
            </div>

            <div className="rounded-lg border border-[#1a2333] p-3 space-y-2">
                <SkeletonBar width="w-1/3" height="h-3" />
                {[...Array(5)].map((_, i) => (
                    <SkeletonBar key={i} height="h-3" />
                ))}
            </div>
        </div>
    );
};

export default AnalysisSkeleton;
