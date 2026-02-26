/**
 * Virtual Scrolling
 * Industry-standard virtualization for large datasets
 * 
 * Features:
 * - Windowed rendering for performance
 * - Variable height items
 * - Horizontal and vertical scrolling
 * - Scroll to item functionality
 * - Dynamic item measurement
 */

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from 'react';

// ============================================================================
// Types
// ============================================================================

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number | ((item: T, index: number) => number);
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
  overscan?: number;
  className?: string;
  style?: React.CSSProperties;
  onScroll?: (scrollTop: number) => void;
  onEndReached?: () => void;
  endReachedThreshold?: number;
  getItemKey?: (item: T, index: number) => string | number;
}

interface VirtualListRef {
  scrollToIndex: (index: number, align?: 'start' | 'center' | 'end') => void;
  scrollToOffset: (offset: number) => void;
}

interface VirtualGridProps<T> {
  items: T[];
  columnCount: number;
  itemHeight: number;
  itemWidth?: number;
  renderItem: (item: T, index: number, style: React.CSSProperties) => React.ReactNode;
  overscan?: number;
  className?: string;
  gap?: number;
  getItemKey?: (item: T, index: number) => string | number;
}

// ============================================================================
// Helpers
// ============================================================================

function useResizeObserver<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  callback: (entry: ResizeObserverEntry) => void
) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        callback(entries[0]);
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, callback]);
}

// ============================================================================
// Virtual List Component
// ============================================================================

function VirtualListInner<T>(
  {
    items,
    itemHeight,
    renderItem,
    overscan = 3,
    className = '',
    style,
    onScroll,
    onEndReached,
    endReachedThreshold = 200,
    getItemKey,
  }: VirtualListProps<T>,
  ref: React.Ref<VirtualListRef>
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const endReachedCalledRef = useRef(false);

  // Calculate item heights for variable height items
  const getHeight = useCallback(
    (item: T, index: number) => {
      if (typeof itemHeight === 'function') {
        return itemHeight(item, index);
      }
      return itemHeight;
    },
    [itemHeight]
  );

  // Calculate cumulative heights for variable height items
  const { totalHeight, itemPositions } = useMemo(() => {
    let total = 0;
    const positions: number[] = [];

    for (let i = 0; i < items.length; i++) {
      positions.push(total);
      total += getHeight(items[i], i);
    }

    return { totalHeight: total, itemPositions: positions };
  }, [items, getHeight]);

  // Find visible range using binary search
  const { startIndex, endIndex } = useMemo(() => {
    if (items.length === 0) {
      return { startIndex: 0, endIndex: 0 };
    }

    // Binary search for start index
    let low = 0;
    let high = items.length - 1;
    
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (itemPositions[mid] + getHeight(items[mid], mid) < scrollTop) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }
    
    const start = Math.max(0, low - overscan);

    // Find end index
    let end = start;
    const bottom = scrollTop + containerHeight;
    
    while (end < items.length && itemPositions[end] < bottom) {
      end++;
    }
    
    return {
      startIndex: start,
      endIndex: Math.min(items.length, end + overscan),
    };
  }, [items, itemPositions, scrollTop, containerHeight, overscan, getHeight]);

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    onScroll?.(newScrollTop);

    // Check for end reached
    if (onEndReached) {
      const distanceFromEnd = totalHeight - newScrollTop - containerHeight;
      if (distanceFromEnd <= endReachedThreshold && !endReachedCalledRef.current) {
        endReachedCalledRef.current = true;
        onEndReached();
      } else if (distanceFromEnd > endReachedThreshold) {
        endReachedCalledRef.current = false;
      }
    }
  }, [onScroll, onEndReached, totalHeight, containerHeight, endReachedThreshold]);

  // Resize observer
  useResizeObserver(containerRef, (entry) => {
    setContainerHeight(entry.contentRect.height);
  });

  // Imperative methods
  useImperativeHandle(ref, () => ({
    scrollToIndex: (index: number, align: 'start' | 'center' | 'end' = 'start') => {
      if (!containerRef.current || index < 0 || index >= items.length) return;

      const itemTop = itemPositions[index];
      const height = getHeight(items[index], index);

      let offset = itemTop;
      if (align === 'center') {
        offset = itemTop - containerHeight / 2 + height / 2;
      } else if (align === 'end') {
        offset = itemTop - containerHeight + height;
      }

      containerRef.current.scrollTop = Math.max(0, offset);
    },
    scrollToOffset: (offset: number) => {
      if (containerRef.current) {
        containerRef.current.scrollTop = offset;
      }
    },
  }), [items, itemPositions, getHeight, containerHeight]);

  // Render visible items
  const visibleItems = useMemo(() => {
    const rendered = [];

    for (let i = startIndex; i < endIndex; i++) {
      const item = items[i];
      const height = getHeight(item, i);
      const top = itemPositions[i];

      const itemStyle: React.CSSProperties = {
        position: 'absolute',
        top,
        left: 0,
        right: 0,
        height,
      };

      const key = getItemKey ? getItemKey(item, i) : i;

      rendered.push(
        <div key={key} style={itemStyle}>
          {renderItem(item, i, itemStyle)}
        </div>
      );
    }

    return rendered;
  }, [items, startIndex, endIndex, getHeight, itemPositions, renderItem, getItemKey]);

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ ...style, position: 'relative' }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems}
      </div>
    </div>
  );
}

export const VirtualList = forwardRef(VirtualListInner) as <T>(
  props: VirtualListProps<T> & { ref?: React.Ref<VirtualListRef> }
) => React.ReactElement;

// ============================================================================
// Virtual Grid Component
// ============================================================================

export function VirtualGrid<T>({
  items,
  columnCount,
  itemHeight,
  itemWidth,
  renderItem,
  overscan = 2,
  className = '',
  gap = 0,
  getItemKey,
}: VirtualGridProps<T>): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const rowCount = Math.ceil(items.length / columnCount);
  const rowHeight = itemHeight + gap;
  const totalHeight = rowCount * rowHeight;

  // Calculate visible rows
  const { startRow, endRow } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const visibleRows = Math.ceil(containerSize.height / rowHeight);
    const end = Math.min(rowCount, start + visibleRows + overscan * 2);
    return { startRow: start, endRow: end };
  }, [scrollTop, rowHeight, containerSize.height, rowCount, overscan]);

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Resize observer
  useResizeObserver(containerRef, (entry) => {
    setContainerSize({
      width: entry.contentRect.width,
      height: entry.contentRect.height,
    });
  });

  // Calculate item width
  const calculatedItemWidth = itemWidth ?? 
    (containerSize.width - gap * (columnCount - 1)) / columnCount;

  // Render visible items
  const visibleItems = useMemo(() => {
    const rendered = [];

    for (let row = startRow; row < endRow; row++) {
      for (let col = 0; col < columnCount; col++) {
        const index = row * columnCount + col;
        if (index >= items.length) break;

        const item = items[index];
        const top = row * rowHeight;
        const left = col * (calculatedItemWidth + gap);

        const itemStyle: React.CSSProperties = {
          position: 'absolute',
          top,
          left,
          width: calculatedItemWidth,
          height: itemHeight,
        };

        const key = getItemKey ? getItemKey(item, index) : index;

        rendered.push(
          <div key={key} style={itemStyle}>
            {renderItem(item, index, itemStyle)}
          </div>
        );
      }
    }

    return rendered;
  }, [
    items,
    startRow,
    endRow,
    columnCount,
    rowHeight,
    calculatedItemWidth,
    gap,
    itemHeight,
    renderItem,
    getItemKey,
  ]);

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{ position: 'relative' }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems}
      </div>
    </div>
  );
}

// ============================================================================
// Virtual Table Component
// ============================================================================

interface Column<T> {
  key: string;
  header: React.ReactNode;
  width?: number | string;
  render: (item: T, index: number) => React.ReactNode;
}

interface VirtualTableProps<T> {
  items: T[];
  columns: Column<T>[];
  rowHeight?: number;
  headerHeight?: number;
  overscan?: number;
  className?: string;
  getRowKey?: (item: T, index: number) => string | number;
  onRowClick?: (item: T, index: number) => void;
  selectedIndex?: number;
}

export function VirtualTable<T>({
  items,
  columns,
  rowHeight = 48,
  headerHeight = 48,
  overscan = 5,
  className = '',
  getRowKey,
  onRowClick,
  selectedIndex,
}: VirtualTableProps<T>): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  const totalHeight = items.length * rowHeight;

  // Calculate visible range
  const { startIndex, endIndex } = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / rowHeight);
    const end = Math.min(items.length, start + visibleCount + overscan * 2);
    return { startIndex: start, endIndex: end };
  }, [scrollTop, rowHeight, containerHeight, items.length, overscan]);

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Resize observer
  useResizeObserver(containerRef, (entry) => {
    setContainerHeight(entry.contentRect.height - headerHeight);
  });

  // Render visible rows
  const visibleRows = useMemo(() => {
    const rendered = [];

    for (let i = startIndex; i < endIndex; i++) {
      const item = items[i];
      const top = i * rowHeight;
      const key = getRowKey ? getRowKey(item, i) : i;
      const isSelected = selectedIndex === i;

      rendered.push(
        <div
          key={key}
          className={`flex border-b border-gray-200 dark:border-gray-700 ${
            isSelected
              ? 'bg-blue-50 dark:bg-blue-900/20'
              : 'hover:bg-gray-50 dark:hover:bg-gray-800'
          } ${onRowClick ? 'cursor-pointer' : ''}`}
          style={{
            position: 'absolute',
            top,
            left: 0,
            right: 0,
            height: rowHeight,
          }}
          onClick={() => onRowClick?.(item, i)}
        >
          {columns.map((column) => (
            <div
              key={column.key}
              className="flex items-center px-4"
              style={{ width: column.width ?? 'auto', flex: column.width ? 'none' : 1 }}
            >
              {column.render(item, i)}
            </div>
          ))}
        </div>
      );
    }

    return rendered;
  }, [items, startIndex, endIndex, rowHeight, columns, getRowKey, selectedIndex, onRowClick]);

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Header */}
      <div
        className="flex bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700"
        style={{ height: headerHeight }}
      >
        {columns.map((column) => (
          <div
            key={column.key}
            className="flex items-center px-4 font-semibold text-sm text-gray-700 dark:text-gray-300"
            style={{ width: column.width ?? 'auto', flex: column.width ? 'none' : 1 }}
          >
            {column.header}
          </div>
        ))}
      </div>

      {/* Body */}
      <div
        ref={containerRef}
        className="flex-1 overflow-auto"
        onScroll={handleScroll}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          {visibleRows}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Infinite Scroll Hook
// ============================================================================

interface UseInfiniteScrollOptions {
  hasMore: boolean;
  isLoading: boolean;
  onLoadMore: () => void;
  threshold?: number;
}

export function useInfiniteScroll({
  hasMore,
  isLoading,
  onLoadMore,
  threshold = 200,
}: UseInfiniteScrollOptions) {
  const observerRef = useRef<IntersectionObserver | null>(null);

  const lastElementRef = useCallback(
    (node: HTMLElement | null) => {
      if (isLoading) return;

      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      if (!hasMore) return;

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            onLoadMore();
          }
        },
        { rootMargin: `${threshold}px` }
      );

      if (node) {
        observerRef.current.observe(node);
      }
    },
    [isLoading, hasMore, onLoadMore, threshold]
  );

  return { lastElementRef };
}
