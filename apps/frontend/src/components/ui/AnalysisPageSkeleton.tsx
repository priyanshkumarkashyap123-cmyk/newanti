/**
 * AnalysisPageSkeleton — Suspense fallback for analysis route chunks.
 * 
 * Shows a structural-analysis-themed loading skeleton with:
 *  - A header bar placeholder
 *  - Panel layout matching a typical analysis UI (sidebar + canvas + results)
 */
import { memo } from 'react';

export const AnalysisPageSkeleton = memo(function AnalysisPageSkeleton() {
  return (
    <div
      className="min-h-screen bg-[#0b1326]"
      role="status"
      aria-label="Loading analysis module"
    >
      <div className="animate-pulse">
        {/* Top toolbar */}
      <div className="h-14 bg-[#131b2e] border-b border-[#1a2333] flex items-center gap-3 px-4">
        <div className="h-8 w-36 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="flex-1" />
        <div className="h-8 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
        <div className="h-8 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
      </div>

      <div className="flex h-[calc(100vh-3.5rem)]">
        {/* Left parameters panel */}
        <div className="w-72 border-r border-[#1a2333] bg-[#131b2e] p-4 space-y-4">
          <div className="h-5 w-28 bg-slate-200 dark:bg-slate-700 rounded" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3.5 w-20 bg-slate-200 dark:bg-slate-700 rounded" />
              <div className="h-9 w-full bg-slate-100 dark:bg-slate-750 rounded border border-[#1a2333]" />
            </div>
          ))}
          <div className="h-10 w-full bg-blue-200 dark:bg-blue-900/40 rounded mt-6" />
        </div>

        {/* Center visualization */}
        <div className="flex-1 flex items-center justify-center bg-slate-100 dark:bg-slate-850">
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-xl bg-slate-200 dark:bg-slate-700" />
            <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded" />
          </div>
        </div>

        {/* Right results panel */}
        <div className="w-80 border-l border-[#1a2333] bg-[#131b2e] p-4 space-y-4">
          <div className="h-5 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 w-full bg-slate-100 dark:bg-slate-750 rounded border border-[#1a2333]" />
          ))}
        </div>
      </div>
      </div>

      <span className="sr-only">Loading analysis module…</span>
    </div>
  );
});

export default AnalysisPageSkeleton;
