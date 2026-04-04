/**
 * DesignPageSkeleton — Skeleton loader specifically for design pages.
 * Shows a layout that mirrors the actual design page structure
 * (header + sidebar inputs + results area) for instant perceived loading.
 */

import { Skeleton } from './Skeleton';
import { memo } from 'react';

export const DesignPageSkeleton = memo(function DesignPageSkeleton() {
  return (
    <div className="min-h-screen bg-[#0b1326] p-4 md:p-6">
      {/* Page Header */}
      <div className="mb-6">
        <Skeleton className="h-8 w-72 mb-2" />
        <Skeleton className="h-4 w-96" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10 w-28 rounded-lg" />
        ))}
      </div>

      {/* Content Area: Split Panel */}
      <div className="flex gap-4 bg-[#0b1326] rounded-xl border border-[#1a2333] min-h-[600px] overflow-hidden">
        {/* Left: Input Sidebar */}
        <div className="w-[360px] border-r border-[#1a2333] p-4 space-y-4">
          <Skeleton className="h-5 w-24 mb-3" />
          {/* Input groups */}
          {[1, 2, 3].map((group) => (
            <div key={group} className="space-y-2">
              <Skeleton className="h-3 w-20" />
              {[1, 2, 3].map((row) => (
                <div key={row} className="flex items-center gap-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-7 flex-1 rounded" />
                  <Skeleton className="h-3 w-8" />
                </div>
              ))}
            </div>
          ))}
          {/* Button */}
          <Skeleton className="h-9 w-full rounded-lg mt-4" />
        </div>

        {/* Right: Results Area */}
        <div className="flex-1 p-4 space-y-4">
          {/* Result cards */}
          {[1, 2, 3, 4].map((card) => (
            <div
              key={card}
              className="border border-[#1a2333] rounded-lg overflow-hidden"
            >
              <div className="px-4 py-3 bg-[#131b2e] flex justify-between items-center">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-4 rounded" />
              </div>
              <div className="p-4 space-y-2">
                {[1, 2, 3].map((row) => (
                  <div key={row} className="flex justify-between">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

/** Compact skeleton for inline design panels / dialogs */
export const DesignPanelSkeleton = memo(function DesignPanelSkeleton() {
  return (
    <div className="p-4 space-y-4 animate-pulse">
      <div className="flex gap-3 items-center mb-4">
        <Skeleton className="h-9 w-9 rounded-lg" />
        <div>
          <Skeleton className="h-5 w-40 mb-1" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>
      {/* Skeleton form rows */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton className="h-3 w-24 shrink-0" />
          <Skeleton className="h-7 flex-1 rounded" />
        </div>
      ))}
      <Skeleton className="h-9 w-full rounded-lg mt-2" />
    </div>
  );
});

export default DesignPageSkeleton;
