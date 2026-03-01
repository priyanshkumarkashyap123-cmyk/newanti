/**
 * BottomSheet — Mobile panel component per Figma §18.3
 * 
 * Displays panels as a draggable bottom sheet on mobile (<768px).
 * Features a drag handle, snap points at 25%/50%/90%, and smooth animations.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { cn } from '../../lib/utils';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  title?: string;
  /** Initial snap point as percentage of viewport height */
  initialSnap?: 25 | 50 | 90;
}

const SNAP_POINTS = [0.25, 0.5, 0.9];
const DRAG_THRESHOLD = 50; // px to trigger snap change

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  children,
  className = '',
  title,
  initialSnap = 50,
}) => {
  const [height, setHeight] = useState(initialSnap);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startHeight = useRef(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  const snapToNearest = useCallback((currentPercent: number) => {
    // If dragged below 15%, close
    if (currentPercent < 15) {
      onClose();
      return;
    }
    // Find nearest snap point
    let nearest = SNAP_POINTS[0]!;
    let minDist = Math.abs(currentPercent / 100 - nearest);
    for (const snap of SNAP_POINTS) {
      const dist = Math.abs(currentPercent / 100 - snap);
      if (dist < minDist) {
        minDist = dist;
        nearest = snap;
      }
    }
    setHeight(nearest * 100);
  }, [onClose]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setIsDragging(true);
    startY.current = e.touches[0]!.clientY;
    startHeight.current = height;
  }, [height]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return;
    const deltaY = startY.current - e.touches[0]!.clientY;
    const deltaPercent = (deltaY / window.innerHeight) * 100;
    const newHeight = Math.max(10, Math.min(95, startHeight.current + deltaPercent));
    setHeight(newHeight);
  }, [isDragging]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    snapToNearest(height);
  }, [height, snapToNearest]);

  // Close on escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 md:hidden',
          'bg-slate-900 rounded-t-2xl shadow-2xl',
          'flex flex-col',
          isDragging ? '' : 'transition-[height] duration-300 ease-out',
          className,
        )}
        style={{ height: `${height}vh` }}
        role="dialog"
        aria-modal="true"
        aria-label={title || 'Panel'}
      >
        {/* Drag Handle — 40×4px per Figma §18.3 */}
        <div
          className="flex items-center justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1 bg-slate-500 rounded-full" />
        </div>

        {/* Title */}
        {title && (
          <div className="px-4 pb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-white rounded transition-colors"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
          {children}
        </div>
      </div>
    </>
  );
};
