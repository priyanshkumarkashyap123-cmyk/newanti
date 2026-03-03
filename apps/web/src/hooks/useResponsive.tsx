/**
 * ============================================================================
 * MOBILE RESPONSIVE UTILITIES
 * ============================================================================
 * 
 * Industry-standard hooks and utilities for responsive design:
 * - Breakpoint detection hooks
 * - Touch device detection
 * - Orientation handling
 * - Safe area insets (for notched devices)
 * - Container queries (simulated)
 * - Responsive values
 * 
 * Addresses: "Mobile responsiveness broken on 60% of pages"
 * 
 * @version 1.0.0
 */

import React from 'react';
import { useState, useEffect, useCallback, useMemo, createContext, useContext, ReactNode, useRef } from 'react';

// ============================================================================
// BREAKPOINT CONFIGURATION
// ============================================================================

export const BREAKPOINTS = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

// ============================================================================
// VIEWPORT HOOK
// ============================================================================

export interface ViewportState {
  width: number;
  height: number;
  breakpoint: Breakpoint;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isLandscape: boolean;
  isPortrait: boolean;
}

export function useViewport(): ViewportState {
  const [viewport, setViewport] = useState<ViewportState>(() => {
    if (typeof window === 'undefined') {
      return {
        width: 1024,
        height: 768,
        breakpoint: 'lg',
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        isLandscape: true,
        isPortrait: false,
      };
    }

    return getViewportState();
  });

  useEffect(() => {
    let rafId: number | null = null;

    const handleResize = () => {
      // Debounce via rAF to avoid rapid re-renders during resize drag
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setViewport(getViewportState());
        rafId = null;
      });
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return viewport;
}

function getViewportState(): ViewportState {
  const width = window.innerWidth;
  const height = window.innerHeight;

  let breakpoint: Breakpoint = 'xs';
  if (width >= BREAKPOINTS['2xl']) breakpoint = '2xl';
  else if (width >= BREAKPOINTS.xl) breakpoint = 'xl';
  else if (width >= BREAKPOINTS.lg) breakpoint = 'lg';
  else if (width >= BREAKPOINTS.md) breakpoint = 'md';
  else if (width >= BREAKPOINTS.sm) breakpoint = 'sm';

  return {
    width,
    height,
    breakpoint,
    isMobile: width < BREAKPOINTS.md,
    isTablet: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
    isDesktop: width >= BREAKPOINTS.lg,
    isLandscape: width > height,
    isPortrait: height >= width,
  };
}

// ============================================================================
// BREAKPOINT HOOK
// ============================================================================

export function useBreakpoint(): Breakpoint {
  return useViewport().breakpoint;
}

export function useBreakpointUp(breakpoint: Breakpoint): boolean {
  const { width } = useViewport();
  return width >= BREAKPOINTS[breakpoint];
}

export function useBreakpointDown(breakpoint: Breakpoint): boolean {
  const { width } = useViewport();
  return width < BREAKPOINTS[breakpoint];
}

export function useBreakpointBetween(start: Breakpoint, end: Breakpoint): boolean {
  const { width } = useViewport();
  return width >= BREAKPOINTS[start] && width < BREAKPOINTS[end];
}

// ============================================================================
// TOUCH DEVICE DETECTION
// ============================================================================

export interface TouchState {
  isTouchDevice: boolean;
  hasMouse: boolean;
  hasCoarsePointer: boolean;
  hasFinePointer: boolean;
}

export function useTouchDevice(): TouchState {
  const [state, setState] = useState<TouchState>(() => {
    if (typeof window === 'undefined') {
      return {
        isTouchDevice: false,
        hasMouse: true,
        hasCoarsePointer: false,
        hasFinePointer: true,
      };
    }

    return detectTouchCapabilities();
  });

  useEffect(() => {
    // Listen to media query changes instead of re-detecting every render
    const hoverQuery = window.matchMedia('(hover: hover)');
    const coarseQuery = window.matchMedia('(pointer: coarse)');
    const fineQuery = window.matchMedia('(pointer: fine)');

    const update = () => {
      setState(detectTouchCapabilities());
    };

    hoverQuery.addEventListener('change', update);
    coarseQuery.addEventListener('change', update);
    fineQuery.addEventListener('change', update);

    return () => {
      hoverQuery.removeEventListener('change', update);
      coarseQuery.removeEventListener('change', update);
      fineQuery.removeEventListener('change', update);
    };
  }, []);

  return state;
}

function detectTouchCapabilities(): TouchState {
  const isTouchDevice =
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0 ||
    // @ts-expect-error - IE/Edge specific
    navigator.msMaxTouchPoints > 0;

  const hasMouse = window.matchMedia('(hover: hover)').matches;
  const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const hasFinePointer = window.matchMedia('(pointer: fine)').matches;

  return {
    isTouchDevice,
    hasMouse,
    hasCoarsePointer,
    hasFinePointer,
  };
}

// ============================================================================
// ORIENTATION HOOK
// ============================================================================

export type Orientation = 'portrait' | 'landscape';

export function useOrientation(): Orientation {
  const [orientation, setOrientation] = useState<Orientation>(() => {
    if (typeof window === 'undefined') return 'landscape';
    return window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
  });

  useEffect(() => {
    let rafId: number | null = null;

    const handleChange = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setOrientation(window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
        rafId = null;
      });
    };

    window.addEventListener('resize', handleChange);
    window.addEventListener('orientationchange', handleChange);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', handleChange);
      window.removeEventListener('orientationchange', handleChange);
    };
  }, []);

  return orientation;
}

// ============================================================================
// SAFE AREA INSETS (for notched devices)
// ============================================================================

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export function useSafeAreaInsets(): SafeAreaInsets {
  const [insets, setInsets] = useState<SafeAreaInsets>({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });

  useEffect(() => {
    const root = document.documentElement;

    const getInsetValue = (property: string): number => {
      const value = getComputedStyle(root).getPropertyValue(property);
      return parseInt(value, 10) || 0;
    };

    const updateInsets = () => {
      setInsets({
        top: getInsetValue('--safe-area-inset-top') || getInsetValue('env(safe-area-inset-top)'),
        right: getInsetValue('--safe-area-inset-right') || getInsetValue('env(safe-area-inset-right)'),
        bottom: getInsetValue('--safe-area-inset-bottom') || getInsetValue('env(safe-area-inset-bottom)'),
        left: getInsetValue('--safe-area-inset-left') || getInsetValue('env(safe-area-inset-left)'),
      });
    };

    // Set CSS variables for safe-area-inset values
    root.style.setProperty('--safe-area-inset-top', 'env(safe-area-inset-top)');
    root.style.setProperty('--safe-area-inset-right', 'env(safe-area-inset-right)');
    root.style.setProperty('--safe-area-inset-bottom', 'env(safe-area-inset-bottom)');
    root.style.setProperty('--safe-area-inset-left', 'env(safe-area-inset-left)');

    updateInsets();

    let rafId: number | null = null;
    const debouncedUpdateInsets = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        updateInsets();
        rafId = null;
      });
    };

    window.addEventListener('resize', debouncedUpdateInsets);
    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', debouncedUpdateInsets);
    };
  }, []);

  return insets;
}

// ============================================================================
// RESPONSIVE VALUE HOOK
// ============================================================================

type ResponsiveValues<T> = Partial<Record<Breakpoint, T>>;

export function useResponsiveValue<T>(values: ResponsiveValues<T>, defaultValue: T): T {
  const breakpoint = useBreakpoint();

  return useMemo(() => {
    // Find the value for the current breakpoint or the closest smaller one
    const breakpointOrder: Breakpoint[] = ['2xl', 'xl', 'lg', 'md', 'sm', 'xs'];
    const currentIndex = breakpointOrder.indexOf(breakpoint);

    for (let i = currentIndex; i < breakpointOrder.length; i++) {
      const bp = breakpointOrder[i];
      if (values[bp] !== undefined) {
        return values[bp]!;
      }
    }

    return defaultValue;
  }, [values, defaultValue, breakpoint]);
}

// ============================================================================
// CONTAINER QUERY HOOK (simulated)
// ============================================================================

export interface ContainerSize {
  width: number;
  height: number;
  breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

export function useContainerSize(ref: React.RefObject<HTMLElement>): ContainerSize {
  const [size, setSize] = useState<ContainerSize>({
    width: 0,
    height: 0,
    breakpoint: 'md',
  });

  useEffect(() => {
    if (!ref.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      const { width, height } = entry.contentRect;
      let breakpoint: ContainerSize['breakpoint'] = 'xs';

      if (width >= 1024) breakpoint = 'xl';
      else if (width >= 768) breakpoint = 'lg';
      else if (width >= 512) breakpoint = 'md';
      else if (width >= 320) breakpoint = 'sm';

      setSize({ width, height, breakpoint });
    });

    resizeObserver.observe(ref.current);

    return () => resizeObserver.disconnect();
  }, [ref]);

  return size;
}

// ============================================================================
// MOBILE MENU HOOK
// ============================================================================

export interface MobileMenuState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export function useMobileMenu(initialOpen = false): MobileMenuState {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const { isMobile } = useViewport();

  // Close menu when switching to desktop
  useEffect(() => {
    if (!isMobile && isOpen) {
      queueMicrotask(() => setIsOpen(false));
    }
  }, [isMobile, isOpen]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  return { isOpen, open, close, toggle };
}

// ============================================================================
// SWIPE GESTURE HOOK
// ============================================================================

export interface SwipeState {
  direction: 'left' | 'right' | 'up' | 'down' | null;
  distance: number;
  velocity: number;
}

export interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
}

export function useSwipeGesture(
  ref: React.RefObject<HTMLElement>,
  handlers: SwipeHandlers
): SwipeState {
  const [swipeState, setSwipeState] = useState<SwipeState>({
    direction: null,
    distance: 0,
    velocity: 0,
  });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let startX = 0;
    let startY = 0;
    let startTime = 0;

    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTime = Date.now();
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const endX = e.changedTouches[0].clientX;
      const endY = e.changedTouches[0].clientY;
      const endTime = Date.now();

      const deltaX = endX - startX;
      const deltaY = endY - startY;
      const deltaTime = endTime - startTime;

      const threshold = handlers.threshold ?? 50;
      const velocity = Math.sqrt(deltaX ** 2 + deltaY ** 2) / deltaTime;

      let direction: SwipeState['direction'] = null;
      let distance = 0;

      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > threshold) {
        direction = deltaX > 0 ? 'right' : 'left';
        distance = Math.abs(deltaX);

        if (direction === 'left') handlers.onSwipeLeft?.();
        if (direction === 'right') handlers.onSwipeRight?.();
      } else if (Math.abs(deltaY) > threshold) {
        direction = deltaY > 0 ? 'down' : 'up';
        distance = Math.abs(deltaY);

        if (direction === 'up') handlers.onSwipeUp?.();
        if (direction === 'down') handlers.onSwipeDown?.();
      }

      setSwipeState({ direction, distance, velocity });
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [ref, handlers]);

  return swipeState;
}

// ============================================================================
// PINCH ZOOM HOOK
// ============================================================================

export interface PinchState {
  scale: number;
  isPinching: boolean;
}

export function usePinchZoom(
  ref: React.RefObject<HTMLElement>,
  options: { minScale?: number; maxScale?: number } = {}
): PinchState {
  const { minScale = 0.5, maxScale = 3 } = options;

  const [state, setState] = useState<PinchState>({
    scale: 1,
    isPinching: false,
  });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let initialDistance = 0;
    let initialScale = 1;

    const getDistance = (touches: TouchList): number => {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.sqrt(dx * dx + dy * dy);
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        initialDistance = getDistance(e.touches);
        initialScale = state.scale;
        setState((prev) => ({ ...prev, isPinching: true }));
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const distance = getDistance(e.touches);
        const scale = Math.min(
          maxScale,
          Math.max(minScale, initialScale * (distance / initialDistance))
        );
        setState((prev) => ({ ...prev, scale }));
      }
    };

    const handleTouchEnd = () => {
      setState((prev) => ({ ...prev, isPinching: false }));
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [ref, minScale, maxScale, state.scale]);

  return state;
}

// ============================================================================
// RESPONSIVE CONTEXT
// ============================================================================

interface ResponsiveContextValue extends ViewportState, TouchState {
  safeAreaInsets: SafeAreaInsets;
}

const ResponsiveContext = createContext<ResponsiveContextValue | null>(null);

export function ResponsiveProvider({ children }: { children: ReactNode }) {
  const viewport = useViewport();
  const touch = useTouchDevice();
  const safeAreaInsets = useSafeAreaInsets();

  // Memoize on primitive values to avoid new-object-reference re-renders
  const value = useMemo(
    () => ({
      ...viewport,
      ...touch,
      safeAreaInsets,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      viewport.width, viewport.height, viewport.breakpoint,
      viewport.isMobile, viewport.isTablet, viewport.isDesktop,
      viewport.isLandscape, viewport.isPortrait,
      touch.isTouchDevice, touch.hasMouse, touch.hasCoarsePointer, touch.hasFinePointer,
      safeAreaInsets.top, safeAreaInsets.right, safeAreaInsets.bottom, safeAreaInsets.left,
    ]
  );

  return (
    <ResponsiveContext.Provider value={value}>
      {children}
    </ResponsiveContext.Provider>
  );
}

export function useResponsive(): ResponsiveContextValue {
  const context = useContext(ResponsiveContext);
  if (!context) {
    throw new Error('useResponsive must be used within ResponsiveProvider');
  }
  return context;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate responsive Tailwind classes
 */
export function responsive<T extends string>(values: Partial<Record<Breakpoint, T>>): string {
  const classes: string[] = [];

  if (values.xs) classes.push(values.xs);
  if (values.sm) classes.push(`sm:${values.sm}`);
  if (values.md) classes.push(`md:${values.md}`);
  if (values.lg) classes.push(`lg:${values.lg}`);
  if (values.xl) classes.push(`xl:${values.xl}`);
  if (values['2xl']) classes.push(`2xl:${values['2xl']}`);

  return classes.join(' ');
}

/**
 * Get CSS variable for safe-area-inset
 */
export function safeArea(side: 'top' | 'right' | 'bottom' | 'left'): string {
  return `env(safe-area-inset-${side}, 0px)`;
}

/**
 * Create mobile-first media query
 */
export function mediaQuery(breakpoint: Breakpoint): string {
  return `@media (min-width: ${BREAKPOINTS[breakpoint]}px)`;
}

export default {
  useViewport,
  useBreakpoint,
  useBreakpointUp,
  useBreakpointDown,
  useBreakpointBetween,
  useTouchDevice,
  useOrientation,
  useSafeAreaInsets,
  useResponsiveValue,
  useContainerSize,
  useMobileMenu,
  useSwipeGesture,
  usePinchZoom,
  ResponsiveProvider,
  useResponsive,
  responsive,
  safeArea,
  mediaQuery,
  BREAKPOINTS,
};
