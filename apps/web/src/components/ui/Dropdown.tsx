/**
 * Dropdown Component
 * 
 * A comprehensive dropdown system with:
 * - Click and hover triggers
 * - Multiple placements
 * - Keyboard navigation
 * - Nested menus
 * - Search/filter support
 * - Multi-select support
 */

'use client';

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  createContext,
  useContext,
  forwardRef,
  ReactNode,
  KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Check, Search } from 'lucide-react';
import { cn } from '../../lib/utils';

// ============================================================================
// TYPES
// ============================================================================

export type DropdownPlacement =
  | 'bottom-start'
  | 'bottom'
  | 'bottom-end'
  | 'top-start'
  | 'top'
  | 'top-end'
  | 'left-start'
  | 'left'
  | 'left-end'
  | 'right-start'
  | 'right'
  | 'right-end';

export interface DropdownItem {
  id: string;
  label: string;
  icon?: React.ElementType;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  description?: string;
  children?: DropdownItem[];
  onClick?: () => void;
}

export interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  placement?: DropdownPlacement;
  width?: number | 'auto' | 'trigger';
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
  multiSelect?: boolean;
  selectedIds?: string[];
  onSelect?: (id: string) => void;
  onMultiSelect?: (ids: string[]) => void;
  className?: string;
  menuClassName?: string;
  disabled?: boolean;
}

interface DropdownContextValue {
  closeMenu: () => void;
  selectedIds: string[];
  multiSelect: boolean;
  onSelect: (id: string) => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const DropdownContext = createContext<DropdownContextValue | null>(null);

const useDropdownContext = () => {
  const context = useContext(DropdownContext);
  if (!context) {
    throw new Error('DropdownContext must be used within Dropdown');
  }
  return context;
};

// ============================================================================
// DROPDOWN COMPONENT
// ============================================================================

export const Dropdown = forwardRef<HTMLDivElement, DropdownProps>(
  (
    {
      trigger,
      items,
      placement = 'bottom-start',
      width = 'auto',
      searchable = false,
      searchPlaceholder = 'Search...',
      emptyText = 'No results found',
      multiSelect = false,
      selectedIds = [],
      onSelect,
      onMultiSelect,
      className,
      menuClassName,
      disabled = false,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [internalSelectedIds, setInternalSelectedIds] = useState<string[]>(selectedIds);
    const [triggerWidth, setTriggerWidth] = useState<number>(0);

    const triggerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const effectiveSelectedIds = multiSelect ? selectedIds : internalSelectedIds;

    // Filter items based on search
    const filteredItems = searchable
      ? items.filter(
          (item) =>
            item.label.toLowerCase().includes(search.toLowerCase()) ||
            item.description?.toLowerCase().includes(search.toLowerCase())
        )
      : items;

    // Calculate position
    const calculatePosition = useCallback(() => {
      if (!triggerRef.current) return;

      const rect = triggerRef.current.getBoundingClientRect();
      const menuHeight = 300; // Approximate max height
      const menuWidth = width === 'trigger' ? rect.width : (width === 'auto' ? 200 : width);
      
      // Store trigger width in state for render-time access
      if (width === 'trigger') {
        setTriggerWidth(rect.width);
      }
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      let top = 0;
      let left = 0;

      // Vertical positioning
      if (placement.startsWith('bottom')) {
        top = rect.bottom + 4;
        if (top + menuHeight > viewportHeight) {
          top = rect.top - menuHeight - 4;
        }
      } else if (placement.startsWith('top')) {
        top = rect.top - menuHeight - 4;
        if (top < 0) {
          top = rect.bottom + 4;
        }
      } else {
        top = rect.top;
      }

      // Horizontal positioning
      if (placement.includes('start') || placement === 'bottom' || placement === 'top') {
        left = rect.left;
      } else if (placement.includes('end')) {
        left = rect.right - menuWidth;
      } else if (placement.startsWith('left')) {
        left = rect.left - menuWidth - 4;
      } else if (placement.startsWith('right')) {
        left = rect.right + 4;
      }

      // Boundary checks
      if (left < 8) left = 8;
      if (left + menuWidth > viewportWidth - 8) {
        left = viewportWidth - menuWidth - 8;
      }

      setPosition({ top, left });
    }, [placement, width]);

    // Handle selection
    const handleSelect = useCallback(
      (id: string) => {
        if (multiSelect) {
          const newIds = effectiveSelectedIds.includes(id)
            ? effectiveSelectedIds.filter((i) => i !== id)
            : [...effectiveSelectedIds, id];
          onMultiSelect?.(newIds);
        } else {
          setInternalSelectedIds([id]);
          onSelect?.(id);
          setIsOpen(false);
        }
      },
      [multiSelect, effectiveSelectedIds, onSelect, onMultiSelect]
    );

    // Keyboard navigation
    const handleKeyDown = useCallback(
      (e: KeyboardEvent) => {
        if (!isOpen) {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault();
            setIsOpen(true);
          }
          return;
        }

        switch (e.key) {
          case 'Escape':
            e.preventDefault();
            setIsOpen(false);
            break;
          case 'ArrowDown':
            e.preventDefault();
            setFocusedIndex((prev) =>
              prev < filteredItems.length - 1 ? prev + 1 : 0
            );
            break;
          case 'ArrowUp':
            e.preventDefault();
            setFocusedIndex((prev) =>
              prev > 0 ? prev - 1 : filteredItems.length - 1
            );
            break;
          case 'Enter':
          case ' ':
            e.preventDefault();
            if (focusedIndex >= 0 && !filteredItems[focusedIndex].disabled) {
              handleSelect(filteredItems[focusedIndex].id);
            }
            break;
          case 'Tab':
            setIsOpen(false);
            break;
        }
      },
      [isOpen, focusedIndex, filteredItems, handleSelect]
    );

    // Click outside handler
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (
          triggerRef.current &&
          !triggerRef.current.contains(e.target as Node) &&
          menuRef.current &&
          !menuRef.current.contains(e.target as Node)
        ) {
          setIsOpen(false);
        }
      };

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
      }
      return undefined;
    }, [isOpen]);

    // Calculate position when opening
    useEffect(() => {
      if (isOpen) {
        calculatePosition();
        if (searchable && searchInputRef.current) {
          searchInputRef.current.focus();
        }
      } else {
        queueMicrotask(() => {
          setSearch('');
          setFocusedIndex(-1);
        });
      }
    }, [isOpen, calculatePosition, searchable]);

    // Recalculate on scroll/resize
    useEffect(() => {
      if (isOpen) {
        window.addEventListener('scroll', calculatePosition, true);
        window.addEventListener('resize', calculatePosition);
        return () => {
          window.removeEventListener('scroll', calculatePosition, true);
          window.removeEventListener('resize', calculatePosition);
        };
      }
      return undefined;
    }, [isOpen, calculatePosition]);

    return (
      <DropdownContext.Provider
        value={{
          closeMenu: () => setIsOpen(false),
          selectedIds: effectiveSelectedIds,
          multiSelect,
          onSelect: handleSelect,
        }}
      >
        <div ref={ref} className={cn('relative inline-block', className)}>
          {/* Trigger */}
          <div
            ref={triggerRef}
            onClick={() => !disabled && setIsOpen(!isOpen)}
            onKeyDown={handleKeyDown}
            tabIndex={disabled ? -1 : 0}
            role="button"
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-disabled={disabled}
            className={cn(
              'cursor-pointer',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {trigger}
          </div>

          {/* Menu */}
          {typeof document !== 'undefined' &&
            createPortal(
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    ref={menuRef}
                    initial={{ opacity: 0, scale: 0.95, y: -4 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -4 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      position: 'fixed',
                      top: position.top,
                      left: position.left,
                      width: width === 'trigger' ? triggerWidth : width === 'auto' ? 'auto' : width,
                      minWidth: 180,
                      zIndex: 9999,
                    }}
                    className={cn(
                      'py-1 rounded-lg shadow-xl',
                      'bg-slate-800 border border-slate-700',
                      'max-h-80 overflow-y-auto',
                      menuClassName
                    )}
                    role="listbox"
                    onKeyDown={handleKeyDown}
                  >
                    {/* Search */}
                    {searchable && (
                      <div className="px-2 pb-2 pt-1 border-b border-slate-700">
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            ref={searchInputRef}
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder={searchPlaceholder}
                            className={cn(
                              'w-full pl-8 pr-3 py-1.5 text-sm rounded-md',
                              'bg-slate-900 border border-slate-700 text-white',
                              'placeholder:text-slate-400',
                              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                            )}
                          />
                        </div>
                      </div>
                    )}

                    {/* Items */}
                    {filteredItems.length > 0 ? (
                      filteredItems.map((item, index) => (
                        <DropdownMenuItem
                          key={item.id}
                          item={item}
                          focused={index === focusedIndex}
                          onMouseEnter={() => setFocusedIndex(index)}
                        />
                      ))
                    ) : (
                      <div className="px-3 py-6 text-center text-sm text-slate-400">
                        {emptyText}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>,
              document.body
            )}
        </div>
      </DropdownContext.Provider>
    );
  }
);

Dropdown.displayName = 'Dropdown';

// ============================================================================
// DROPDOWN MENU ITEM
// ============================================================================

interface DropdownMenuItemProps {
  item: DropdownItem;
  focused: boolean;
  onMouseEnter: () => void;
}

const DropdownMenuItem: React.FC<DropdownMenuItemProps> = ({
  item,
  focused,
  onMouseEnter,
}) => {
  const { closeMenu, selectedIds, multiSelect, onSelect } = useDropdownContext();
  const [showSubmenu, setShowSubmenu] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);

  const Icon = item.icon;
  const isSelected = selectedIds.includes(item.id);
  const hasChildren = item.children && item.children.length > 0;

  const handleClick = () => {
    if (item.disabled) return;

    if (hasChildren) {
      setShowSubmenu(!showSubmenu);
      return;
    }

    if (item.onClick) {
      item.onClick();
      closeMenu();
    } else {
      onSelect(item.id);
    }
  };

  return (
    <div className="relative" ref={itemRef}>
      <div
        onClick={handleClick}
        onMouseEnter={() => {
          onMouseEnter();
          if (hasChildren) setShowSubmenu(true);
        }}
        onMouseLeave={() => hasChildren && setShowSubmenu(false)}
        role="option"
        aria-selected={isSelected}
        aria-disabled={item.disabled}
        className={cn(
          'flex items-center gap-2 px-3 py-2 mx-1 rounded-md cursor-pointer',
          'text-sm transition-colors',
          focused && 'bg-slate-700',
          isSelected && !multiSelect && 'text-blue-400',
          item.disabled && 'opacity-50 cursor-not-allowed',
          item.danger && 'text-red-400 hover:bg-red-500/10'
        )}
      >
        {/* Checkbox for multi-select */}
        {multiSelect && (
          <span
            className={cn(
              'flex items-center justify-center w-4 h-4 rounded border',
              isSelected
                ? 'bg-blue-600 border-blue-600'
                : 'border-slate-500'
            )}
          >
            {isSelected && <Check className="w-3 h-3 text-white" />}
          </span>
        )}

        {/* Icon */}
        {Icon && (
          <Icon
            className={cn(
              'w-4 h-4 flex-shrink-0',
              item.danger ? 'text-red-400' : 'text-slate-400'
            )}
          />
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <span className="truncate">{item.label}</span>
            {item.shortcut && (
              <span className="ml-2 text-xs text-slate-400">{item.shortcut}</span>
            )}
          </div>
          {item.description && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">
              {item.description}
            </p>
          )}
        </div>

        {/* Submenu indicator */}
        {hasChildren && (
          <ChevronRight className="w-4 h-4 text-slate-400" />
        )}
      </div>

      {/* Submenu */}
      {hasChildren && showSubmenu && (
        <motion.div
          initial={{ opacity: 0, x: -4 }}
          animate={{ opacity: 1, x: 0 }}
          className={cn(
            'absolute left-full top-0 ml-1 py-1 rounded-lg shadow-xl',
            'bg-slate-800 border border-slate-700',
            'min-w-40'
          )}
        >
          {item.children?.map((child) => (
            <DropdownMenuItem
              key={child.id}
              item={child}
              focused={false}
              onMouseEnter={() => {}}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
};

// ============================================================================
// DROPDOWN TRIGGER BUTTON
// ============================================================================

interface DropdownTriggerButtonProps {
  children: ReactNode;
  isOpen?: boolean;
  className?: string;
}

export const DropdownTriggerButton = forwardRef<HTMLButtonElement, DropdownTriggerButtonProps>(
  ({ children, isOpen, className }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg',
          'bg-slate-800 border border-slate-700 text-white',
          'hover:bg-slate-700 transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-blue-500',
          className
        )}
      >
        {children}
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="w-4 h-4 text-slate-400" />
        </motion.span>
      </button>
    );
  }
);

DropdownTriggerButton.displayName = 'DropdownTriggerButton';

// ============================================================================
// DROPDOWN DIVIDER
// ============================================================================

export const DropdownDivider: React.FC = () => (
  <div className="h-px my-1 bg-slate-700" />
);

// ============================================================================
// DROPDOWN LABEL
// ============================================================================

interface DropdownLabelProps {
  children: ReactNode;
  className?: string;
}

export const DropdownLabel: React.FC<DropdownLabelProps> = ({
  children,
  className,
}) => (
  <div
    className={cn(
      'px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400',
      className
    )}
  >
    {children}
  </div>
);

export default Dropdown;
