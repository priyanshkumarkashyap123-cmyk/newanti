/**
 * ============================================================================
 * RESPONSIVE LAYOUT COMPONENTS
 * ============================================================================
 * 
 * Industry-standard responsive layout components:
 * - Container with max-width constraints
 * - Grid system with responsive columns
 * - Stack (vertical/horizontal spacing)
 * - Responsive show/hide
 * - Sidebar layouts
 * - Dashboard layouts
 * - Split panes
 * 
 * @version 1.0.0
 */

import React, { ReactNode, forwardRef, HTMLAttributes } from 'react';
import { useViewport, useBreakpointUp, Breakpoint, BREAKPOINTS } from '@/hooks/useResponsive';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

// ============================================================================
// CONTAINER
// ============================================================================

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  /** Maximum width constraint */
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full' | 'none';
  /** Add horizontal padding */
  padded?: boolean;
  /** Center the container */
  centered?: boolean;
  children: ReactNode;
}

const maxWidthClasses = {
  sm: 'max-w-screen-sm',
  md: 'max-w-screen-md',
  lg: 'max-w-screen-lg',
  xl: 'max-w-screen-xl',
  '2xl': 'max-w-screen-2xl',
  full: 'max-w-full',
  none: '',
};

export const Container = forwardRef<HTMLDivElement, ContainerProps>(
  ({ maxWidth = 'xl', padded = true, centered = true, className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          w-full
          ${maxWidthClasses[maxWidth]}
          ${padded ? 'px-4 sm:px-6 lg:px-8' : ''}
          ${centered ? 'mx-auto' : ''}
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Container.displayName = 'Container';

// ============================================================================
// RESPONSIVE GRID
// ============================================================================

export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  /** Number of columns at each breakpoint */
  cols?: Partial<Record<Breakpoint, number>>;
  /** Gap between items */
  gap?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12;
  /** Row gap (if different from column gap) */
  rowGap?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12;
  /** Items alignment */
  alignItems?: 'start' | 'center' | 'end' | 'stretch';
  children: ReactNode;
}

export const Grid = forwardRef<HTMLDivElement, GridProps>(
  ({ cols = { xs: 1, sm: 2, lg: 3 }, gap = 4, rowGap, alignItems, className = '', children, ...props }, ref) => {
    // Build responsive column classes
    const colClasses = Object.entries(cols)
      .map(([bp, count]) => {
        const prefix = bp === 'xs' ? '' : `${bp}:`;
        return `${prefix}grid-cols-${count}`;
      })
      .join(' ');

    const alignClass = alignItems ? `items-${alignItems}` : '';
    const gapClass = `gap-${gap}`;
    const rowGapClass = rowGap !== undefined ? `gap-y-${rowGap}` : '';

    return (
      <div
        ref={ref}
        className={`grid ${colClasses} ${gapClass} ${rowGapClass} ${alignClass} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Grid.displayName = 'Grid';

// ============================================================================
// GRID ITEM
// ============================================================================

export interface GridItemProps extends HTMLAttributes<HTMLDivElement> {
  /** Column span at each breakpoint */
  span?: Partial<Record<Breakpoint, number>>;
  /** Column start position */
  start?: number;
  children: ReactNode;
}

export const GridItem = forwardRef<HTMLDivElement, GridItemProps>(
  ({ span, start, className = '', children, ...props }, ref) => {
    const spanClasses = span
      ? Object.entries(span)
          .map(([bp, count]) => {
            const prefix = bp === 'xs' ? '' : `${bp}:`;
            return `${prefix}col-span-${count}`;
          })
          .join(' ')
      : '';

    const startClass = start ? `col-start-${start}` : '';

    return (
      <div
        ref={ref}
        className={`${spanClasses} ${startClass} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GridItem.displayName = 'GridItem';

// ============================================================================
// STACK (Flex with spacing)
// ============================================================================

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  /** Stack direction */
  direction?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  /** Responsive direction */
  responsiveDirection?: Partial<Record<Breakpoint, 'row' | 'column'>>;
  /** Gap between items */
  gap?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12;
  /** Alignment on main axis */
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  /** Alignment on cross axis */
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  /** Allow wrapping */
  wrap?: boolean;
  /** Make full width */
  fullWidth?: boolean;
  /** Add dividers between items */
  dividers?: boolean;
  children: ReactNode;
}

export const Stack = forwardRef<HTMLDivElement, StackProps>(
  (
    {
      direction = 'column',
      responsiveDirection,
      gap = 4,
      justify,
      align,
      wrap = false,
      fullWidth = false,
      dividers = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const directionClass = responsiveDirection
      ? Object.entries(responsiveDirection)
          .map(([bp, dir]) => {
            const prefix = bp === 'xs' ? '' : `${bp}:`;
            return `${prefix}flex-${dir}`;
          })
          .join(' ')
      : `flex-${direction}`;

    const justifyClass = justify ? `justify-${justify}` : '';
    const alignClass = align ? `items-${align}` : '';
    const wrapClass = wrap ? 'flex-wrap' : '';
    const widthClass = fullWidth ? 'w-full' : '';
    const dividerClass = dividers ? 'divide-y divide-zinc-300 dark:divide-zinc-700' : '';

    return (
      <div
        ref={ref}
        className={`
          flex ${directionClass} gap-${gap}
          ${justifyClass} ${alignClass} ${wrapClass}
          ${widthClass} ${dividerClass}
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Stack.displayName = 'Stack';

// ============================================================================
// RESPONSIVE SHOW/HIDE
// ============================================================================

export interface ShowProps {
  /** Show above this breakpoint */
  above?: Breakpoint;
  /** Show below this breakpoint */
  below?: Breakpoint;
  /** Show only at this breakpoint */
  at?: Breakpoint;
  children: ReactNode;
}

export const Show: React.FC<ShowProps> = ({ above, below, at, children }) => {
  const { breakpoint, width } = useViewport();

  let shouldShow = true;

  if (above) {
    shouldShow = width >= BREAKPOINTS[above];
  }

  if (below) {
    shouldShow = width < BREAKPOINTS[below];
  }

  if (at) {
    const breakpointOrder: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
    const currentIndex = breakpointOrder.indexOf(breakpoint);
    const targetIndex = breakpointOrder.indexOf(at);
    shouldShow = currentIndex === targetIndex;
  }

  return shouldShow ? <>{children}</> : null;
};

export interface HideProps {
  /** Hide above this breakpoint */
  above?: Breakpoint;
  /** Hide below this breakpoint */
  below?: Breakpoint;
  children: ReactNode;
}

export const Hide: React.FC<HideProps> = ({ above, below, children }) => {
  const { width } = useViewport();

  let shouldHide = false;

  if (above) {
    shouldHide = width >= BREAKPOINTS[above];
  }

  if (below) {
    shouldHide = width < BREAKPOINTS[below];
  }

  return shouldHide ? null : <>{children}</>;
};

// ============================================================================
// SIDEBAR LAYOUT
// ============================================================================

export interface SidebarLayoutProps {
  /** Sidebar content */
  sidebar: ReactNode;
  /** Main content */
  children: ReactNode;
  /** Sidebar position */
  sidebarPosition?: 'left' | 'right';
  /** Sidebar width */
  sidebarWidth?: string | number;
  /** Collapse sidebar on mobile */
  collapsible?: boolean;
  /** Is sidebar collapsed */
  isCollapsed?: boolean;
  /** Callback when collapse state changes */
  onCollapsedChange?: (collapsed: boolean) => void;
  className?: string;
}

export const SidebarLayout: React.FC<SidebarLayoutProps> = ({
  sidebar,
  children,
  sidebarPosition = 'left',
  sidebarWidth = 280,
  collapsible = true,
  isCollapsed = false,
  onCollapsedChange,
  className = '',
}) => {
  const { isMobile } = useViewport();

  const sidebarStyle = {
    width: typeof sidebarWidth === 'number' ? `${sidebarWidth}px` : sidebarWidth,
    minWidth: typeof sidebarWidth === 'number' ? `${sidebarWidth}px` : sidebarWidth,
  };

  const shouldCollapse = collapsible && (isMobile || isCollapsed);

  return (
    <div className={`flex min-h-screen ${className}`}>
      {/* Sidebar */}
      {sidebarPosition === 'left' && (
        <aside
          className={`
            bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800
            transition-all duration-300
            ${shouldCollapse ? 'w-0 overflow-hidden' : ''}
          `}
          style={shouldCollapse ? { width: 0, minWidth: 0 } : sidebarStyle}
        >
          {sidebar}
        </aside>
      )}

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-auto">
        {children}
      </main>

      {/* Right sidebar */}
      {sidebarPosition === 'right' && (
        <aside
          className={`
            bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800
            transition-all duration-300
            ${shouldCollapse ? 'w-0 overflow-hidden' : ''}
          `}
          style={shouldCollapse ? { width: 0, minWidth: 0 } : sidebarStyle}
        >
          {sidebar}
        </aside>
      )}

      {/* Mobile sidebar dialog */}
      <Dialog open={isMobile && !isCollapsed} onOpenChange={(open) => !open && onCollapsedChange?.(true)}>
        <DialogContent className="max-w-xs h-[80vh] p-0 overflow-auto">
          <DialogHeader className="sr-only">
            <DialogTitle>Navigation Menu</DialogTitle>
          </DialogHeader>
          {sidebar}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ============================================================================
// DASHBOARD LAYOUT
// ============================================================================

export interface DashboardLayoutProps {
  /** Header content */
  header?: ReactNode;
  /** Sidebar content */
  sidebar?: ReactNode;
  /** Footer content */
  footer?: ReactNode;
  /** Main content */
  children: ReactNode;
  /** Sidebar width */
  sidebarWidth?: number;
  /** Header height */
  headerHeight?: number;
  className?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  header,
  sidebar,
  footer,
  children,
  sidebarWidth = 256,
  headerHeight = 64,
  className = '',
}) => {
  const { isMobile } = useViewport();

  return (
    <div className={`min-h-screen bg-white dark:bg-zinc-950 ${className}`}>
      {/* Header */}
      {header && (
        <header
          className="fixed top-0 left-0 right-0 z-30 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800"
          style={{ height: headerHeight }}
        >
          {header}
        </header>
      )}

      <div
        className="flex"
        style={{ paddingTop: header ? headerHeight : 0 }}
      >
        {/* Sidebar */}
        {sidebar && !isMobile && (
          <aside
            className="fixed left-0 bottom-0 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 overflow-y-auto"
            style={{
              top: header ? headerHeight : 0,
              width: sidebarWidth,
            }}
          >
            {sidebar}
          </aside>
        )}

        {/* Main content */}
        <main
          className="flex-1 min-h-screen"
          style={{
            marginLeft: sidebar && !isMobile ? sidebarWidth : 0,
            paddingBottom: footer ? 64 : 0,
          }}
        >
          {children}
        </main>
      </div>

      {/* Footer */}
      {footer && (
        <footer
          className="fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800"
          style={{ marginLeft: sidebar && !isMobile ? sidebarWidth : 0 }}
        >
          {footer}
        </footer>
      )}
    </div>
  );
};

// ============================================================================
// SPLIT PANE
// ============================================================================

export interface SplitPaneProps {
  /** Left/top content */
  first: ReactNode;
  /** Right/bottom content */
  second: ReactNode;
  /** Split direction */
  direction?: 'horizontal' | 'vertical';
  /** Initial size of first pane (percentage or pixels) */
  defaultSize?: number | string;
  /** Minimum size of first pane */
  minSize?: number;
  /** Maximum size of first pane */
  maxSize?: number;
  /** Allow resizing */
  resizable?: boolean;
  /** Collapse first pane on mobile */
  collapseOnMobile?: boolean;
  className?: string;
}

export const SplitPane: React.FC<SplitPaneProps> = ({
  first,
  second,
  direction = 'horizontal',
  defaultSize = '50%',
  minSize = 100,
  maxSize,
  resizable = true,
  collapseOnMobile = true,
  className = '',
}) => {
  const { isMobile } = useViewport();
  const [size, setSize] = React.useState(defaultSize);
  const [isDragging, setIsDragging] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const isHorizontal = direction === 'horizontal';
  const shouldStack = collapseOnMobile && isMobile;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!resizable) return;
    e.preventDefault();
    setIsDragging(true);
  };

  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const position = isHorizontal
        ? e.clientX - rect.left
        : e.clientY - rect.top;
      const containerSize = isHorizontal ? rect.width : rect.height;
      
      let newSize = Math.max(minSize, position);
      if (maxSize) {
        newSize = Math.min(maxSize, newSize);
      }
      newSize = Math.min(containerSize - minSize, newSize);

      setSize(newSize);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isHorizontal, minSize, maxSize]);

  if (shouldStack) {
    return (
      <div className={`flex flex-col h-full ${className}`}>
        <div className="flex-1 min-h-0 overflow-auto">{first}</div>
        <div className="flex-1 min-h-0 overflow-auto">{second}</div>
      </div>
    );
  }

  const sizeValue = typeof size === 'number' ? `${size}px` : size;

  return (
    <div
      ref={containerRef}
      className={`
        flex ${isHorizontal ? 'flex-row' : 'flex-col'}
        h-full ${className}
        ${isDragging ? 'select-none' : ''}
      `}
    >
      {/* First pane */}
      <div
        className="overflow-auto"
        style={{
          [isHorizontal ? 'width' : 'height']: sizeValue,
          flexShrink: 0,
        }}
      >
        {first}
      </div>

      {/* Resizer */}
      {resizable && (
        <div
          className={`
            flex-shrink-0 bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-500 transition-colors
            ${isHorizontal ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize'}
            ${isDragging ? 'bg-blue-500' : ''}
          `}
          onMouseDown={handleMouseDown}
          role="separator"
          aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
        />
      )}

      {/* Second pane */}
      <div className="flex-1 min-w-0 min-h-0 overflow-auto">
        {second}
      </div>
    </div>
  );
};

// ============================================================================
// ASPECT RATIO BOX
// ============================================================================

export interface AspectRatioProps {
  /** Aspect ratio (width/height) */
  ratio?: number;
  /** Common aspect ratios */
  preset?: '1:1' | '4:3' | '16:9' | '21:9';
  children: ReactNode;
  className?: string;
}

export const AspectRatio: React.FC<AspectRatioProps> = ({
  ratio,
  preset,
  children,
  className = '',
}) => {
  const presetRatios = {
    '1:1': 1,
    '4:3': 4 / 3,
    '16:9': 16 / 9,
    '21:9': 21 / 9,
  };

  const aspectRatio = ratio ?? (preset ? presetRatios[preset] : 16 / 9);
  const paddingBottom = `${(1 / aspectRatio) * 100}%`;

  return (
    <div
      className={`relative w-full ${className}`}
      style={{ paddingBottom }}
    >
      <div className="absolute inset-0">
        {children}
      </div>
    </div>
  );
};

// ============================================================================
// CENTER
// ============================================================================

export interface CenterProps extends HTMLAttributes<HTMLDivElement> {
  /** Inline (horizontal only) */
  inline?: boolean;
  children: ReactNode;
}

export const Center = forwardRef<HTMLDivElement, CenterProps>(
  ({ inline = false, className = '', children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          ${inline ? 'inline-flex' : 'flex'}
          items-center justify-center
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Center.displayName = 'Center';

// ============================================================================
// SPACER
// ============================================================================

export interface SpacerProps {
  /** Size in spacing units (4px each) */
  size?: number;
  /** Responsive sizes */
  responsive?: Partial<Record<Breakpoint, number>>;
  /** Direction */
  axis?: 'horizontal' | 'vertical' | 'both';
}

export const Spacer: React.FC<SpacerProps> = ({
  size = 4,
  responsive,
  axis = 'both',
}) => {
  const isLg = useBreakpointUp('lg');
  const isMd = useBreakpointUp('md');
  const breakpoint = isLg ? 'lg' : isMd ? 'md' : 'sm';
  const responsiveSize = responsive?.[breakpoint] ?? size;
  const pixels = responsiveSize * 4;

  const style: React.CSSProperties = {
    width: axis === 'horizontal' || axis === 'both' ? pixels : undefined,
    height: axis === 'vertical' || axis === 'both' ? pixels : undefined,
    flexShrink: 0,
  };

  return <div style={style} aria-hidden="true" />;
};

export default {
  Container,
  Grid,
  GridItem,
  Stack,
  Show,
  Hide,
  SidebarLayout,
  DashboardLayout,
  SplitPane,
  AspectRatio,
  Center,
  Spacer,
};
