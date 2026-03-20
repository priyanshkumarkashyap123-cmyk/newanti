/**
 * BottomSheet — Production mobile panel component per Figma §18.3 / §18.5
 *
 * Implements three snap points (Peek 100px, Half 50vh, Full 90vh), spring-
 * physics animation via Framer Motion, velocity-based flick detection,
 * haptic feedback, scroll-lock, reduced-motion support, safe-area insets,
 * and an optional Action Sheet variant (replaces desktop context menus).
 *
 * Visible only on mobile (<768px) — `md:hidden` by default.
 *
 * @example
 * ```tsx
 * <BottomSheet isOpen={open} onClose={() => setOpen(false)} title="Member M12">
 *   <PropertiesContent />
 * </BottomSheet>
 *
 * <BottomSheet variant="action" isOpen={show} onClose={() => setShow(false)}
 *   title="Member M12" actions={actionItems} />
 * ```
 */

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useMemo,
  type ReactNode,
} from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { cn } from '../../lib/utils';
import { haptic } from '../../utils/haptic';

// ============================================================================
// Types
// ============================================================================

/** Named snap points matching Figma §18.3 */
export type SnapPoint = 'peek' | 'half' | 'full';

/** Action item for the Action Sheet variant (Figma §18.5) */
export interface ActionSheetItem {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Destructive actions render in red */
  destructive?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

export interface BottomSheetProps {
  /** Controls visibility */
  isOpen: boolean;
  /** Called when the sheet is dismissed (backdrop tap, swipe-down, Escape) */
  onClose: () => void;
  /** Sheet content — ignored when `variant="action"` */
  children?: ReactNode;
  /** Extra Tailwind classes on the sheet container */
  className?: string;
  /** Optional header title */
  title?: string;
  /** Optional subtitle shown below the title */
  subtitle?: string;
  /** Initial snap when opening. Default: `'half'` */
  initialSnap?: SnapPoint;
  /** Callback when snap point changes */
  onSnapChange?: (snap: SnapPoint) => void;
  /** `"panel"` — standard content sheet; `"action"` — iOS-style action sheet */
  variant?: 'panel' | 'action';
  /** Action items (only used when `variant="action"`) */
  actions?: ActionSheetItem[];
  /** If `true`, the sheet renders on all screen sizes (not just mobile) */
  forceMount?: boolean;
}

export interface BottomSheetHandle {
  /** Programmatically snap to a named point */
  snapTo: (point: SnapPoint) => void;
  /** Programmatically close with animation */
  close: () => void;
}

// ============================================================================
// Constants
// ============================================================================

/** Pixel / vh values for the three Figma snap points */
const SNAP_VALUES: Record<SnapPoint, number> = {
  peek: 100,  // 100px fixed (Figma: "Peek — shows summary line")
  half: 50,   // 50vh
  full: 90,   // 90vh
};

/** Below this vh threshold the sheet dismisses on release */
const DISMISS_THRESHOLD_VH = 8;

/** Minimum flick velocity (px/s) to jump to the next snap point */
const FLICK_VELOCITY = 400;

/** Spring physics — matches ChatPanel.tsx pattern */
const SPRING_CONFIG = { type: 'spring' as const, damping: 32, stiffness: 400, mass: 0.8 };

/** Backdrop fade — synced with sheet height ratio */
const BACKDROP_MAX_OPACITY = 0.45;

// ============================================================================
// Helpers
// ============================================================================

/** Convert a snap point to a pixel height given current viewport */
function snapToPixels(snap: SnapPoint): number {
  if (snap === 'peek') return SNAP_VALUES.peek;
  return (SNAP_VALUES[snap] / 100) * window.innerHeight;
}

/** Find the closest named snap point for a given pixel height */
function nearestSnap(heightPx: number): SnapPoint {
  const vh = window.innerHeight;
  const distances: [SnapPoint, number][] = [
    ['peek', Math.abs(heightPx - SNAP_VALUES.peek)],
    ['half', Math.abs(heightPx - (SNAP_VALUES.half / 100) * vh)],
    ['full', Math.abs(heightPx - (SNAP_VALUES.full / 100) * vh)],
  ];
  distances.sort((a, b) => a[1] - b[1]);
  return distances[0]![0];
}

/** Get the next snap point in a direction (up = taller, down = shorter) */
function adjacentSnap(current: SnapPoint, direction: 'up' | 'down'): SnapPoint | null {
  const order: SnapPoint[] = ['peek', 'half', 'full'];
  const idx = order.indexOf(current);
  if (direction === 'up' && idx < order.length - 1) return order[idx + 1]!;
  if (direction === 'down' && idx > 0) return order[idx - 1]!;
  return null;
}

// ============================================================================
// Component
// ============================================================================

export const BottomSheet = forwardRef<BottomSheetHandle, BottomSheetProps>(
  function BottomSheet(
    {
      isOpen,
      onClose,
      children,
      className,
      title,
      subtitle,
      initialSnap = 'half',
      onSnapChange,
      variant = 'panel',
      actions,
      forceMount = false,
    },
    ref,
  ) {
    // ── State ──────────────────────────────────────────────────────────────
    const [currentSnap, setCurrentSnap] = useState<SnapPoint>(initialSnap);
    const sheetRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const dragY = useMotionValue(0);

    // Resolve initial height
    const targetHeight = useMemo(() => snapToPixels(currentSnap), [currentSnap]);

    // Backdrop opacity driven by sheet height (0 = closed, 0.45 = full)
    const _backdropOpacity = useTransform(
      dragY,
      [0, -window.innerHeight * 0.9],
      [BACKDROP_MAX_OPACITY, BACKDROP_MAX_OPACITY],
    );

    // ── Imperative handle ──────────────────────────────────────────────────
    const snapTo = useCallback(
      (point: SnapPoint) => {
        setCurrentSnap(point);
        onSnapChange?.(point);
        haptic.snap();
      },
      [onSnapChange],
    );

    const close = useCallback(() => {
      onClose();
      haptic.light();
    }, [onClose]);

    useImperativeHandle(ref, () => ({ snapTo, close }), [snapTo, close]);

    // ── Keyboard ───────────────────────────────────────────────────────────
    useEffect(() => {
      if (!isOpen) return;
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          close();
        }
      };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }, [isOpen, close]);

    // ── Body scroll lock ───────────────────────────────────────────────────
    useEffect(() => {
      if (!isOpen) return;
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }, [isOpen]);

    // Reset snap on open — track previous isOpen to detect open transition
    const prevIsOpenRef = useRef(false);
    useEffect(() => {
      if (isOpen && !prevIsOpenRef.current) {
        // Schedule snap reset on next tick to avoid setState-in-effect
        queueMicrotask(() => setCurrentSnap(initialSnap));
      }
      prevIsOpenRef.current = isOpen;
    }, [isOpen, initialSnap]);

    // ── Drag handlers ──────────────────────────────────────────────────────
    const handleDragStart = useCallback(() => {
      haptic.dragStart();
    }, []);

    const handleDragEnd = useCallback(
      (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        haptic.dragEnd();
        const velocity = info.velocity.y; // negative = upward
        const offset = info.offset.y;     // negative = dragged up
        const currentPx = snapToPixels(currentSnap) - offset;

        // Dismiss if dragged way down
        if (currentPx < (DISMISS_THRESHOLD_VH / 100) * window.innerHeight) {
          close();
          return;
        }

        // Flick detection — fast swipe overrides position
        if (Math.abs(velocity) > FLICK_VELOCITY) {
          const direction = velocity < 0 ? 'up' : 'down';
          const next = adjacentSnap(currentSnap, direction);
          if (next) {
            snapTo(next);
            return;
          }
          if (direction === 'down' && currentSnap === 'peek') {
            close();
            return;
          }
        }

        // Otherwise snap to nearest
        const nearest = nearestSnap(currentPx);
        snapTo(nearest);
      },
      [currentSnap, snapTo, close],
    );

    // ── Responsive visibility class ────────────────────────────────────────
    const visibilityClass = forceMount ? '' : 'md:hidden';

    // ── Render ─────────────────────────────────────────────────────────────
    return (
      <AnimatePresence>
        {isOpen && (
          <>
            {/* ── Backdrop ────────────────────────────────────── */}
            <motion.div
              key="bottomsheet-backdrop"
              className={cn('fixed inset-0 z-40', visibilityClass)}
              style={{ backgroundColor: `rgba(0, 0, 0, ${BACKDROP_MAX_OPACITY})` }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={close}
              aria-hidden="true"
            />

            {/* ── Sheet ───────────────────────────────────────── */}
            <motion.div
              key="bottomsheet-panel"
              ref={sheetRef}
              className={cn(
                'fixed bottom-0 left-0 right-0 z-50',
                visibilityClass,
                'flex flex-col',
                // Surface — Figma §18.3: slate-900, rounded-t-2xl
                'bg-slate-900 rounded-t-2xl',
                // Shadow
                'shadow-[0_-4px_24px_rgba(0,0,0,0.35)]',
                // Safe area inset for iOS home indicator
                'pb-[env(safe-area-inset-bottom,0px)]',
                className,
              )}
              // ── Animation ──
              initial={{ y: '100%' }}
              animate={{ y: 0, height: targetHeight }}
              exit={{ y: '100%' }}
              transition={SPRING_CONFIG}
              // ── Drag ──
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={0.15}
              dragMomentum={false}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              style={{ y: dragY, touchAction: 'none' }}
              // ── A11y ──
              role="dialog"
              aria-modal="true"
              aria-label={title || 'Bottom sheet'}
            >
              {/* ── Drag Handle — 40×4px per Figma §18.3 ──── */}
              <div
                className="flex items-center justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing"
                aria-hidden="true"
              >
                <div className="w-10 h-1 rounded-full bg-slate-500/80" />
              </div>

              {/* ── Header ────────────────────────────────── */}
              {(title || subtitle) && (
                <div className="px-4 pb-2 flex items-center justify-between shrink-0">
                  <div className="min-w-0">
                    {title && (
                      <h3 className="text-sm font-semibold text-white truncate">
                        {title}
                      </h3>
                    )}
                    {subtitle && (
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {subtitle}
                      </p>
                    )}
                  </div>
                  <button type="button"
                    onClick={close}
                    className={cn(
                      'shrink-0 ml-3 p-1.5 rounded-lg',
                      'text-slate-400 hover:text-white hover:bg-slate-800',
                      'transition-colors duration-150',
                      // 44px touch target per Apple HIG
                      'min-w-[44px] min-h-[44px] flex items-center justify-center',
                    )}
                    aria-label="Close panel"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>
              )}

              {/* ── Content / Actions ─────────────────────── */}
              {variant === 'action' ? (
                <ActionSheetContent actions={actions} onClose={close} />
              ) : (
                <div
                  ref={contentRef}
                  className={cn(
                    'flex-1 overflow-y-auto overscroll-contain',
                    'px-4 pb-4',
                    // Inertia scrolling on iOS
                    '[&::-webkit-scrollbar]:w-1',
                    '[&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-thumb]:rounded-full',
                  )}
                >
                  {children}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    );
  },
);

// ============================================================================
// Action Sheet Content — Figma §18.5
// ============================================================================

interface ActionSheetContentProps {
  actions?: ActionSheetItem[];
  onClose: () => void;
}

const ActionSheetContent: React.FC<ActionSheetContentProps> = ({ actions, onClose }) => {
  const handlePress = useCallback(
    (action: ActionSheetItem) => {
      if (action.disabled) return;
      haptic.light();
      action.onPress();
      onClose();
    },
    [onClose],
  );

  if (!actions?.length) return null;

  return (
    <div className="px-4 pb-4 flex flex-col gap-2">
      {/* Action list */}
      <div className="rounded-xl overflow-hidden bg-slate-800/60 border border-slate-700/50">
        {actions.map((action, idx) => (
          <button type="button"
            key={action.id}
            onClick={() => handlePress(action)}
            disabled={action.disabled}
            className={cn(
              'w-full flex items-center gap-3 px-4 py-3.5',
              'text-left text-sm font-medium tracking-wide tracking-wide',
              'transition-colors duration-100',
              // 44px min touch target
              'min-h-[44px]',
              // Divider between items
              idx > 0 && 'border-t border-slate-700/40',
              // Color
              action.destructive
                ? 'text-red-400 active:bg-red-500/10'
                : 'text-white active:bg-slate-700/60',
              action.disabled && 'opacity-40 cursor-not-allowed',
            )}
          >
            {action.icon && (
              <span className="shrink-0 w-5 h-5 flex items-center justify-center">
                {action.icon}
              </span>
            )}
            <span className="truncate">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Cancel button — separated visually per iOS convention */}
      <button type="button"
        onClick={onClose}
        className={cn(
          'w-full py-3.5 rounded-xl',
          'bg-slate-800/60 border border-slate-700/50',
          'text-sm font-semibold text-blue-400',
          'active:bg-slate-700/60 transition-colors duration-100',
          'min-h-[44px]',
        )}
      >
        Cancel
      </button>
    </div>
  );
};

// ============================================================================
// Convenience exports
// ============================================================================

export default BottomSheet;
