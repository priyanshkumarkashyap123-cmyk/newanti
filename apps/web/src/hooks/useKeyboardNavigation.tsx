/**
 * ============================================================================
 * KEYBOARD NAVIGATION SYSTEM
 * ============================================================================
 * 
 * Industry-standard keyboard navigation for complex components:
 * - Focus management
 * - Arrow key navigation
 * - Roving tabindex
 * - Composite widget patterns (grids, trees, menus)
 * - Modal focus trapping
 * - Skip links
 * - Shortcut discovery (help dialogs)
 * 
 * Addresses: "Keyboard navigation incomplete in ModernModeler"
 * 
 * @version 1.0.0
 */

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  createContext,
  useContext,
  ReactNode,
  KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { announce } from '@/utils/accessibility';

// ============================================================================
// TYPES
// ============================================================================

export interface KeyBinding {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  description: string;
  action: () => void;
  scope?: string;
  enabled?: boolean;
}

export type NavigationDirection = 'up' | 'down' | 'left' | 'right' | 'home' | 'end';

export interface FocusableItem {
  id: string;
  element?: HTMLElement | null;
  disabled?: boolean;
  group?: string;
}

// ============================================================================
// ROVING TABINDEX HOOK
// ============================================================================

export interface UseRovingTabIndexOptions {
  items: FocusableItem[];
  orientation?: 'horizontal' | 'vertical' | 'both';
  loop?: boolean;
  onSelect?: (id: string) => void;
  onFocusChange?: (id: string) => void;
  initialFocusId?: string;
}

export interface UseRovingTabIndexReturn {
  focusedId: string | null;
  setFocusedId: (id: string) => void;
  getTabIndex: (id: string) => 0 | -1;
  handleKeyDown: (e: ReactKeyboardEvent | KeyboardEvent) => void;
  focusItem: (id: string) => void;
  focusFirst: () => void;
  focusLast: () => void;
  focusNext: () => void;
  focusPrevious: () => void;
}

export function useRovingTabIndex(options: UseRovingTabIndexOptions): UseRovingTabIndexReturn {
  const {
    items,
    orientation = 'vertical',
    loop = true,
    onSelect,
    onFocusChange,
    initialFocusId,
  } = options;

  const enabledItems = items.filter((item) => !item.disabled);
  const [focusedId, setFocusedIdState] = useState<string | null>(
    initialFocusId || enabledItems[0]?.id || null
  );

  const setFocusedId = useCallback(
    (id: string) => {
      setFocusedIdState(id);
      onFocusChange?.(id);
    },
    [onFocusChange]
  );

  const focusItem = useCallback(
    (id: string) => {
      const item = items.find((i) => i.id === id);
      if (item?.element && !item.disabled) {
        item.element.focus();
        setFocusedId(id);
      }
    },
    [items, setFocusedId]
  );

  const getCurrentIndex = useCallback(() => {
    return enabledItems.findIndex((item) => item.id === focusedId);
  }, [enabledItems, focusedId]);

  const focusFirst = useCallback(() => {
    if (enabledItems.length > 0) {
      focusItem(enabledItems[0].id);
    }
  }, [enabledItems, focusItem]);

  const focusLast = useCallback(() => {
    if (enabledItems.length > 0) {
      focusItem(enabledItems[enabledItems.length - 1].id);
    }
  }, [enabledItems, focusItem]);

  const focusNext = useCallback(() => {
    const currentIndex = getCurrentIndex();
    if (currentIndex === -1) {
      focusFirst();
      return;
    }

    let nextIndex = currentIndex + 1;
    if (nextIndex >= enabledItems.length) {
      nextIndex = loop ? 0 : enabledItems.length - 1;
    }
    focusItem(enabledItems[nextIndex].id);
  }, [getCurrentIndex, enabledItems, loop, focusFirst, focusItem]);

  const focusPrevious = useCallback(() => {
    const currentIndex = getCurrentIndex();
    if (currentIndex === -1) {
      focusLast();
      return;
    }

    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      prevIndex = loop ? enabledItems.length - 1 : 0;
    }
    focusItem(enabledItems[prevIndex].id);
  }, [getCurrentIndex, enabledItems, loop, focusLast, focusItem]);

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent | KeyboardEvent) => {
      const isVertical = orientation === 'vertical' || orientation === 'both';
      const isHorizontal = orientation === 'horizontal' || orientation === 'both';

      switch (e.key) {
        case 'ArrowDown':
          if (isVertical) {
            e.preventDefault();
            focusNext();
          }
          break;
        case 'ArrowUp':
          if (isVertical) {
            e.preventDefault();
            focusPrevious();
          }
          break;
        case 'ArrowRight':
          if (isHorizontal) {
            e.preventDefault();
            focusNext();
          }
          break;
        case 'ArrowLeft':
          if (isHorizontal) {
            e.preventDefault();
            focusPrevious();
          }
          break;
        case 'Home':
          e.preventDefault();
          focusFirst();
          break;
        case 'End':
          e.preventDefault();
          focusLast();
          break;
        case 'Enter':
        case ' ':
          if (focusedId) {
            e.preventDefault();
            onSelect?.(focusedId);
          }
          break;
      }
    },
    [orientation, focusNext, focusPrevious, focusFirst, focusLast, focusedId, onSelect]
  );

  const getTabIndex = useCallback(
    (id: string): 0 | -1 => {
      return id === focusedId ? 0 : -1;
    },
    [focusedId]
  );

  return {
    focusedId,
    setFocusedId,
    getTabIndex,
    handleKeyDown,
    focusItem,
    focusFirst,
    focusLast,
    focusNext,
    focusPrevious,
  };
}

// ============================================================================
// GRID NAVIGATION HOOK
// ============================================================================

export interface GridCell {
  row: number;
  col: number;
  id: string;
  disabled?: boolean;
  element?: HTMLElement | null;
}

export interface UseGridNavigationOptions {
  cells: GridCell[];
  rows: number;
  cols: number;
  loop?: boolean;
  onSelect?: (cell: GridCell) => void;
  onFocusChange?: (cell: GridCell) => void;
}

export interface UseGridNavigationReturn {
  focusedCell: GridCell | null;
  setFocusedCell: (cell: GridCell) => void;
  getTabIndex: (row: number, col: number) => 0 | -1;
  handleKeyDown: (e: ReactKeyboardEvent | KeyboardEvent) => void;
  focusCell: (row: number, col: number) => void;
}

export function useGridNavigation(options: UseGridNavigationOptions): UseGridNavigationReturn {
  const { cells, rows, cols, loop = false, onSelect, onFocusChange } = options;

  const [focusedCell, setFocusedCellState] = useState<GridCell | null>(
    cells.find((c) => c.row === 0 && c.col === 0) || null
  );

  const findCell = useCallback(
    (row: number, col: number): GridCell | undefined => {
      return cells.find((c) => c.row === row && c.col === col && !c.disabled);
    },
    [cells]
  );

  const setFocusedCell = useCallback(
    (cell: GridCell) => {
      setFocusedCellState(cell);
      onFocusChange?.(cell);
      cell.element?.focus();
    },
    [onFocusChange]
  );

  const focusCell = useCallback(
    (row: number, col: number) => {
      const cell = findCell(row, col);
      if (cell) {
        setFocusedCell(cell);
      }
    },
    [findCell, setFocusedCell]
  );

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent | KeyboardEvent) => {
      if (!focusedCell) return;

      let nextRow = focusedCell.row;
      let nextCol = focusedCell.col;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          nextRow = focusedCell.row - 1;
          if (nextRow < 0) nextRow = loop ? rows - 1 : 0;
          break;
        case 'ArrowDown':
          e.preventDefault();
          nextRow = focusedCell.row + 1;
          if (nextRow >= rows) nextRow = loop ? 0 : rows - 1;
          break;
        case 'ArrowLeft':
          e.preventDefault();
          nextCol = focusedCell.col - 1;
          if (nextCol < 0) nextCol = loop ? cols - 1 : 0;
          break;
        case 'ArrowRight':
          e.preventDefault();
          nextCol = focusedCell.col + 1;
          if (nextCol >= cols) nextCol = loop ? 0 : cols - 1;
          break;
        case 'Home':
          e.preventDefault();
          if (e.ctrlKey) {
            nextRow = 0;
          }
          nextCol = 0;
          break;
        case 'End':
          e.preventDefault();
          if (e.ctrlKey) {
            nextRow = rows - 1;
          }
          nextCol = cols - 1;
          break;
        case 'PageUp':
          e.preventDefault();
          nextRow = 0;
          break;
        case 'PageDown':
          e.preventDefault();
          nextRow = rows - 1;
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          onSelect?.(focusedCell);
          return;
        default:
          return;
      }

      focusCell(nextRow, nextCol);
    },
    [focusedCell, rows, cols, loop, onSelect, focusCell]
  );

  const getTabIndex = useCallback(
    (row: number, col: number): 0 | -1 => {
      return focusedCell?.row === row && focusedCell?.col === col ? 0 : -1;
    },
    [focusedCell]
  );

  return {
    focusedCell,
    setFocusedCell,
    getTabIndex,
    handleKeyDown,
    focusCell,
  };
}

// ============================================================================
// KEYBOARD SHORTCUTS MANAGER
// ============================================================================

export interface UseKeyboardShortcutsOptions {
  bindings: KeyBinding[];
  scope?: string;
  enabled?: boolean;
}

export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions): void {
  const { bindings, scope, enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      for (const binding of bindings) {
        if (binding.enabled === false) continue;
        if (scope && binding.scope && binding.scope !== scope) continue;

        const keyMatch = e.key.toLowerCase() === binding.key.toLowerCase();
        const ctrlMatch = binding.ctrl ? (e.ctrlKey || e.metaKey) : !(e.ctrlKey || e.metaKey);
        const shiftMatch = binding.shift ? e.shiftKey : !e.shiftKey;
        const altMatch = binding.alt ? e.altKey : !e.altKey;
        const metaMatch = binding.meta ? e.metaKey : true; // Meta is optional

        if (keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch) {
          e.preventDefault();
          binding.action();
          announce(binding.description, 'polite');
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [bindings, scope, enabled]);
}

// ============================================================================
// KEYBOARD SHORTCUTS CONTEXT
// ============================================================================

interface ShortcutsContextValue {
  bindings: KeyBinding[];
  registerBinding: (binding: KeyBinding) => void;
  unregisterBinding: (key: string) => void;
  setScope: (scope: string | null) => void;
  currentScope: string | null;
  showHelp: () => void;
  hideHelp: () => void;
  isHelpVisible: boolean;
}

const ShortcutsContext = createContext<ShortcutsContextValue | null>(null);

export function ShortcutsProvider({ children }: { children: ReactNode }) {
  const [bindings, setBindings] = useState<KeyBinding[]>([]);
  const [currentScope, setScope] = useState<string | null>(null);
  const [isHelpVisible, setIsHelpVisible] = useState(false);

  const registerBinding = useCallback((binding: KeyBinding) => {
    setBindings((prev) => {
      // Replace existing binding with same key
      const filtered = prev.filter((b) => 
        !(b.key === binding.key && 
          b.ctrl === binding.ctrl && 
          b.shift === binding.shift && 
          b.alt === binding.alt)
      );
      return [...filtered, binding];
    });
  }, []);

  const unregisterBinding = useCallback((key: string) => {
    setBindings((prev) => prev.filter((b) => b.key !== key));
  }, []);

  const showHelp = useCallback(() => {
    setIsHelpVisible(true);
    announce('Keyboard shortcuts help opened', 'polite');
  }, []);

  const hideHelp = useCallback(() => {
    setIsHelpVisible(false);
  }, []);

  // Global shortcut for help
  useKeyboardShortcuts({
    bindings: [
      {
        key: '?',
        shift: true,
        description: 'Show keyboard shortcuts',
        action: showHelp,
      },
      {
        key: 'Escape',
        description: 'Close help dialog',
        action: hideHelp,
        enabled: isHelpVisible,
      },
    ],
  });

  const value: ShortcutsContextValue = {
    bindings,
    registerBinding,
    unregisterBinding,
    setScope,
    currentScope,
    showHelp,
    hideHelp,
    isHelpVisible,
  };

  return (
    <ShortcutsContext.Provider value={value}>
      {children}
    </ShortcutsContext.Provider>
  );
}

export function useShortcuts(): ShortcutsContextValue {
  const context = useContext(ShortcutsContext);
  if (!context) {
    throw new Error('useShortcuts must be used within ShortcutsProvider');
  }
  return context;
}

// ============================================================================
// FOCUS TRAP HOOK
// ============================================================================

export interface UseFocusTrapOptions {
  enabled?: boolean;
  returnFocusOnDeactivate?: boolean;
  initialFocus?: string | HTMLElement | (() => HTMLElement | null);
  onEscape?: () => void;
}

export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement>,
  options: UseFocusTrapOptions = {}
): void {
  const {
    enabled = true,
    returnFocusOnDeactivate = true,
    initialFocus,
    onEscape,
  } = options;

  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;
    previouslyFocusedRef.current = document.activeElement as HTMLElement;

    // Set initial focus
    const setInitialFocus = () => {
      if (typeof initialFocus === 'string') {
        const element = container.querySelector<HTMLElement>(initialFocus);
        element?.focus();
      } else if (typeof initialFocus === 'function') {
        initialFocus()?.focus();
      } else if (initialFocus instanceof HTMLElement) {
        initialFocus.focus();
      } else {
        // Focus first focusable element
        const focusable = getFocusableElements(container);
        focusable[0]?.focus();
      }
    };

    setInitialFocus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onEscape) {
        e.preventDefault();
        onEscape();
        return;
      }

      if (e.key !== 'Tab') return;

      const focusable = getFocusableElements(container);
      if (focusable.length === 0) return;

      const firstFocusable = focusable[0];
      const lastFocusable = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      
      if (returnFocusOnDeactivate && previouslyFocusedRef.current) {
        previouslyFocusedRef.current.focus();
      }
    };
  }, [enabled, containerRef, initialFocus, onEscape, returnFocusOnDeactivate]);
}

// ============================================================================
// CANVAS KEYBOARD NAVIGATION HOOK
// ============================================================================

export interface CanvasObject {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: string;
  selectable?: boolean;
}

export interface UseCanvasNavigationOptions {
  objects: CanvasObject[];
  gridSnap?: number;
  onSelect?: (object: CanvasObject) => void;
  onMove?: (object: CanvasObject, dx: number, dy: number) => void;
  onDelete?: (object: CanvasObject) => void;
  onDuplicate?: (object: CanvasObject) => void;
}

export interface UseCanvasNavigationReturn {
  selectedObject: CanvasObject | null;
  setSelectedObject: (object: CanvasObject | null) => void;
  handleKeyDown: (e: ReactKeyboardEvent | KeyboardEvent) => void;
  selectNext: () => void;
  selectPrevious: () => void;
  selectNearest: (direction: NavigationDirection) => void;
}

export function useCanvasNavigation(options: UseCanvasNavigationOptions): UseCanvasNavigationReturn {
  const { objects, gridSnap = 10, onSelect, onMove, onDelete, onDuplicate } = options;

  const selectableObjects = objects.filter((obj) => obj.selectable !== false);
  const [selectedObject, setSelectedObjectState] = useState<CanvasObject | null>(null);

  const setSelectedObject = useCallback(
    (object: CanvasObject | null) => {
      setSelectedObjectState(object);
      if (object) {
        onSelect?.(object);
        announce(`Selected ${object.type} at position ${object.x}, ${object.y}`, 'polite');
      }
    },
    [onSelect]
  );

  const getObjectIndex = useCallback(() => {
    if (!selectedObject) return -1;
    return selectableObjects.findIndex((obj) => obj.id === selectedObject.id);
  }, [selectedObject, selectableObjects]);

  const selectNext = useCallback(() => {
    const currentIndex = getObjectIndex();
    const nextIndex = (currentIndex + 1) % selectableObjects.length;
    setSelectedObject(selectableObjects[nextIndex] || null);
  }, [getObjectIndex, selectableObjects, setSelectedObject]);

  const selectPrevious = useCallback(() => {
    const currentIndex = getObjectIndex();
    const prevIndex = currentIndex <= 0 ? selectableObjects.length - 1 : currentIndex - 1;
    setSelectedObject(selectableObjects[prevIndex] || null);
  }, [getObjectIndex, selectableObjects, setSelectedObject]);

  const selectNearest = useCallback(
    (direction: NavigationDirection) => {
      if (!selectedObject) {
        setSelectedObject(selectableObjects[0] || null);
        return;
      }

      const candidates = selectableObjects.filter((obj) => {
        if (obj.id === selectedObject.id) return false;
        
        switch (direction) {
          case 'up':
            return obj.y < selectedObject.y;
          case 'down':
            return obj.y > selectedObject.y;
          case 'left':
            return obj.x < selectedObject.x;
          case 'right':
            return obj.x > selectedObject.x;
          default:
            return false;
        }
      });

      if (candidates.length === 0) return;

      // Find nearest by distance
      const nearest = candidates.reduce((prev, curr) => {
        const prevDist = Math.hypot(prev.x - selectedObject.x, prev.y - selectedObject.y);
        const currDist = Math.hypot(curr.x - selectedObject.x, curr.y - selectedObject.y);
        return currDist < prevDist ? curr : prev;
      });

      setSelectedObject(nearest);
    },
    [selectedObject, selectableObjects, setSelectedObject]
  );

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent | KeyboardEvent) => {
      if (!selectedObject && e.key !== 'Tab') {
        // Select first object if none selected and navigation key pressed
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          e.preventDefault();
          setSelectedObject(selectableObjects[0] || null);
        }
        return;
      }

      switch (e.key) {
        case 'Tab':
          e.preventDefault();
          if (e.shiftKey) {
            selectPrevious();
          } else {
            selectNext();
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (e.shiftKey && selectedObject) {
            onMove?.(selectedObject, 0, -gridSnap);
          } else {
            selectNearest('up');
          }
          break;

        case 'ArrowDown':
          e.preventDefault();
          if (e.shiftKey && selectedObject) {
            onMove?.(selectedObject, 0, gridSnap);
          } else {
            selectNearest('down');
          }
          break;

        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey && selectedObject) {
            onMove?.(selectedObject, -gridSnap, 0);
          } else {
            selectNearest('left');
          }
          break;

        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey && selectedObject) {
            onMove?.(selectedObject, gridSnap, 0);
          } else {
            selectNearest('right');
          }
          break;

        case 'Delete':
        case 'Backspace':
          e.preventDefault();
          if (selectedObject) {
            onDelete?.(selectedObject);
            selectNext();
          }
          break;

        case 'd':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (selectedObject) {
              onDuplicate?.(selectedObject);
            }
          }
          break;

        case 'Escape':
          e.preventDefault();
          setSelectedObject(null);
          announce('Selection cleared', 'polite');
          break;
      }
    },
    [
      selectedObject,
      selectableObjects,
      gridSnap,
      selectNext,
      selectPrevious,
      selectNearest,
      onMove,
      onDelete,
      onDuplicate,
      setSelectedObject,
    ]
  );

  return {
    selectedObject,
    setSelectedObject,
    handleKeyDown,
    selectNext,
    selectPrevious,
    selectNearest,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(', ');

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
  return Array.from(elements).filter((el) => {
    // Filter out hidden elements
    return (
      el.offsetParent !== null &&
      getComputedStyle(el).visibility !== 'hidden'
    );
  });
}

/**
 * Format keyboard shortcut for display
 */
export function formatShortcut(binding: Partial<KeyBinding>): string {
  const parts: string[] = [];
  
  if (binding.ctrl) parts.push('⌘');
  if (binding.shift) parts.push('⇧');
  if (binding.alt) parts.push('⌥');
  
  const key = binding.key?.toUpperCase() || '';
  if (key === ' ') {
    parts.push('Space');
  } else {
    parts.push(key);
  }
  
  return parts.join('');
}

export default {
  useRovingTabIndex,
  useGridNavigation,
  useKeyboardShortcuts,
  useFocusTrap,
  useCanvasNavigation,
  ShortcutsProvider,
  useShortcuts,
  formatShortcut,
};
