/**
 * ContextMenu.tsx - Professional Right-Click Context Menu System (STAAD.Pro/SkyCiv Style)
 * 
 * Enterprise-grade context menu with:
 * - Nested submenus
 * - Keyboard shortcuts display
 * - Icons for menu items
 * - Dividers and grouping
 * - Disabled state support
 * - Checkbox and radio items
 * - Danger zone styling
 * - Search within menu
 * - Custom renderers
 */

import React from 'react';
import { FC, useState, useEffect, useRef, useCallback, createContext, useContext, ReactNode, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, ChevronRight, Circle, Copy, Clipboard, Trash2, Edit3, Eye, EyeOff,
  Lock, Unlock, Layers, Move, RotateCw, FlipHorizontal, Plus, Minus,
  Settings, Info, AlertTriangle, Zap, Download, Upload
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

export type MenuItemType = 'item' | 'checkbox' | 'radio' | 'submenu' | 'divider' | 'header' | 'custom';

export interface MenuItem {
  id: string;
  type?: MenuItemType;
  label?: string;
  icon?: React.ElementType;
  shortcut?: string;
  disabled?: boolean;
  checked?: boolean;
  radioGroup?: string;
  danger?: boolean;
  children?: MenuItem[];
  action?: () => void;
  render?: () => ReactNode;
}

export interface ContextMenuPosition {
  x: number;
  y: number;
}

interface ContextMenuProps {
  items: MenuItem[];
  position: ContextMenuPosition;
  onClose: () => void;
  onAction?: (itemId: string) => void;
  width?: number;
  maxHeight?: number;
}

interface ContextMenuContextValue {
  showMenu: (items: MenuItem[], position: ContextMenuPosition, onAction?: (id: string) => void) => void;
  hideMenu: () => void;
}

// ============================================
// CONTEXT
// ============================================

const ContextMenuContext = createContext<ContextMenuContextValue | null>(null);

export const useContextMenu = () => {
  const context = useContext(ContextMenuContext);
  if (!context) {
    throw new Error('useContextMenu must be used within a ContextMenuProvider');
  }
  return context;
};

// ============================================
// MENU ITEM COMPONENT
// ============================================

interface MenuItemComponentProps {
  item: MenuItem;
  onAction: (id: string) => void;
  onClose: () => void;
  onSubmenuOpen: (id: string, rect: DOMRect) => void;
  openSubmenuId?: string;
  radioSelections: Record<string, string>;
  onRadioChange: (group: string, id: string) => void;
}

const MenuItemComponent: FC<MenuItemComponentProps> = memo(({
  item,
  onAction,
  onClose,
  onSubmenuOpen,
  openSubmenuId,
  radioSelections,
  onRadioChange
}) => {
  const itemRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Handle submenu hover
  useEffect(() => {
    if (item.type === 'submenu' && isHovered && itemRef.current) {
      const rect = itemRef.current.getBoundingClientRect();
      onSubmenuOpen(item.id, rect);
    }
  }, [isHovered, item.id, item.type, onSubmenuOpen]);

  // Divider
  if (item.type === 'divider') {
    return <div className="h-px bg-zinc-200 dark:bg-zinc-700 my-1 mx-2" />;
  }

  // Header
  if (item.type === 'header') {
    return (
      <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
        {item.label}
      </div>
    );
  }

  // Custom render
  if (item.type === 'custom' && item.render) {
    return <div className="px-2 py-1">{item.render()}</div>;
  }

  const Icon = item.icon;
  const hasSubmenu = item.type === 'submenu' && item.children && item.children.length > 0;
  const isCheckbox = item.type === 'checkbox';
  const isRadio = item.type === 'radio';
  const isChecked = isCheckbox ? item.checked : isRadio ? radioSelections[item.radioGroup!] === item.id : false;

  const handleClick = () => {
    if (item.disabled) return;
    
    if (hasSubmenu) return; // Submenu handled by hover
    
    if (isRadio && item.radioGroup) {
      onRadioChange(item.radioGroup, item.id);
    }
    
    if (item.action) {
      item.action();
    }
    
    onAction(item.id);
    
    if (!isCheckbox && !isRadio) {
      onClose();
    }
  };

  return (
    <div
      ref={itemRef}
      className={`
        flex items-center gap-2 px-3 py-1.5 mx-1 rounded cursor-pointer transition-colors
        ${item.disabled
          ? 'opacity-40 cursor-not-allowed'
          : item.danger
            ? 'hover:bg-red-500/20 text-red-400'
            : 'hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 text-zinc-200'
        }
        ${openSubmenuId === item.id ? 'bg-zinc-200/50 dark:bg-zinc-700/50' : ''}
      `}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Checkbox/Radio Indicator */}
      {(isCheckbox || isRadio) && (
        <div className="w-4 h-4 flex items-center justify-center">
          {isChecked && (
            isCheckbox 
              ? <Check className="w-3 h-3 text-blue-400" />
              : <Circle className="w-2 h-2 fill-blue-400 text-blue-400" />
          )}
        </div>
      )}

      {/* Icon */}
      {Icon && !isCheckbox && !isRadio && (
        <Icon className={`w-4 h-4 flex-shrink-0 ${item.danger ? 'text-red-400' : 'text-zinc-500 dark:text-zinc-400'}`} />
      )}

      {/* Label */}
      <span className="flex-1 text-xs truncate">
        {item.label}
      </span>

      {/* Shortcut */}
      {item.shortcut && (
        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 ml-4">
          {item.shortcut}
        </span>
      )}

      {/* Submenu Arrow */}
      {hasSubmenu && (
        <ChevronRight className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />
      )}
    </div>
  );
});

MenuItemComponent.displayName = 'MenuItemComponent';

// ============================================
// SUBMENU COMPONENT
// ============================================

interface SubmenuProps {
  items: MenuItem[];
  parentRect: DOMRect;
  onAction: (id: string) => void;
  onClose: () => void;
  radioSelections: Record<string, string>;
  onRadioChange: (group: string, id: string) => void;
}

const Submenu: FC<SubmenuProps> = ({
  items,
  parentRect,
  onAction,
  onClose,
  radioSelections,
  onRadioChange
}) => {
  const [openSubmenuId, setOpenSubmenuId] = useState<string>();
  const [submenuRect, setSubmenuRect] = useState<DOMRect>();
  const menuRef = useRef<HTMLDivElement>(null);

  // Position submenu
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let x = parentRect.right + 2;
      let y = parentRect.top;

      // Flip horizontally if needed
      if (x + menuRect.width > viewportWidth) {
        x = parentRect.left - menuRect.width - 2;
      }

      // Adjust vertically if needed
      if (y + menuRect.height > viewportHeight) {
        y = viewportHeight - menuRect.height - 8;
      }

      queueMicrotask(() => setPosition({ x, y }));
    }
  }, [parentRect]);

  const handleSubmenuOpen = useCallback((id: string, rect: DOMRect) => {
    setOpenSubmenuId(id);
    setSubmenuRect(rect);
  }, []);

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -4 }}
      transition={{ duration: 0.1 }}
      className="fixed z-[10001] min-w-[180px] py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl"
      style={{
        left: position.x,
        top: position.y
      }}
    >
      {items.map((item, index) => (
        <MenuItemComponent
          key={item.id || index}
          item={item}
          onAction={onAction}
          onClose={onClose}
          onSubmenuOpen={handleSubmenuOpen}
          openSubmenuId={openSubmenuId}
          radioSelections={radioSelections}
          onRadioChange={onRadioChange}
        />
      ))}

      {/* Nested Submenu */}
      <AnimatePresence>
        {openSubmenuId && submenuRect && (
          (() => {
            const submenuItem = items.find(i => i.id === openSubmenuId);
            if (submenuItem?.children) {
              return (
                <Submenu
                  items={submenuItem.children}
                  parentRect={submenuRect}
                  onAction={onAction}
                  onClose={onClose}
                  radioSelections={radioSelections}
                  onRadioChange={onRadioChange}
                />
              );
            }
            return null;
          })()
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ============================================
// MAIN CONTEXT MENU COMPONENT
// ============================================

export const ContextMenu: FC<ContextMenuProps> = ({
  items,
  position,
  onClose,
  onAction,
  width = 200,
  maxHeight = 400
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const [openSubmenuId, setOpenSubmenuId] = useState<string>();
  const [submenuRect, setSubmenuRect] = useState<DOMRect>();
  const [radioSelections, setRadioSelections] = useState<Record<string, string>>(() => {
    // Initialize radio selections from items
    const selections: Record<string, string> = {};
    const processItems = (menuItems: MenuItem[]) => {
      menuItems.forEach(item => {
        if (item.type === 'radio' && item.radioGroup && item.checked) {
          selections[item.radioGroup] = item.id;
        }
        if (item.children) {
          processItems(item.children);
        }
      });
    };
    processItems(items);
    return selections;
  });

  // Adjust position to stay within viewport
  useEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let x = position.x;
      let y = position.y;

      if (x + menuRect.width > viewportWidth) {
        x = viewportWidth - menuRect.width - 8;
      }
      if (y + menuRect.height > viewportHeight) {
        y = viewportHeight - menuRect.height - 8;
      }

      queueMicrotask(() => setAdjustedPosition({ x: Math.max(8, x), y: Math.max(8, y) }));
    }
  }, [position]);

  // Close on escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleSubmenuOpen = useCallback((id: string, rect: DOMRect) => {
    setOpenSubmenuId(id);
    setSubmenuRect(rect);
  }, []);

  const handleAction = useCallback((id: string) => {
    onAction?.(id);
  }, [onAction]);

  const handleRadioChange = useCallback((group: string, id: string) => {
    setRadioSelections(prev => ({ ...prev, [group]: id }));
  }, []);

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.1 }}
      className="fixed z-[10000] py-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl overflow-hidden"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        width,
        maxHeight
      }}
      onMouseLeave={() => setOpenSubmenuId(undefined)}
    >
      <div className="overflow-y-auto" style={{ maxHeight: maxHeight - 8 }}>
        {items.map((item, index) => (
          <MenuItemComponent
            key={item.id || index}
            item={item}
            onAction={handleAction}
            onClose={onClose}
            onSubmenuOpen={handleSubmenuOpen}
            openSubmenuId={openSubmenuId}
            radioSelections={radioSelections}
            onRadioChange={handleRadioChange}
          />
        ))}
      </div>

      {/* Submenu */}
      <AnimatePresence>
        {openSubmenuId && submenuRect && (
          (() => {
            const submenuItem = items.find(i => i.id === openSubmenuId);
            if (submenuItem?.children) {
              return (
                <Submenu
                  items={submenuItem.children}
                  parentRect={submenuRect}
                  onAction={handleAction}
                  onClose={onClose}
                  radioSelections={radioSelections}
                  onRadioChange={handleRadioChange}
                />
              );
            }
            return null;
          })()
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ============================================
// CONTEXT MENU PROVIDER
// ============================================

interface ProviderState {
  isOpen: boolean;
  items: MenuItem[];
  position: ContextMenuPosition;
  onAction?: (id: string) => void;
}

export const ContextMenuProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<ProviderState>({
    isOpen: false,
    items: [],
    position: { x: 0, y: 0 }
  });

  const showMenu = useCallback((items: MenuItem[], position: ContextMenuPosition, onAction?: (id: string) => void) => {
    setState({
      isOpen: true,
      items,
      position,
      onAction
    });
  }, []);

  const hideMenu = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }));
  }, []);

  return (
    <ContextMenuContext.Provider value={{ showMenu, hideMenu }}>
      {children}
      <AnimatePresence>
        {state.isOpen && (
          <ContextMenu
            items={state.items}
            position={state.position}
            onClose={hideMenu}
            onAction={state.onAction}
          />
        )}
      </AnimatePresence>
    </ContextMenuContext.Provider>
  );
};

// ============================================
// PRESET MENU DEFINITIONS
// ============================================

export const NODE_CONTEXT_MENU: MenuItem[] = [
  { id: 'edit', label: 'Edit Node...', icon: Edit3, shortcut: 'Enter' },
  { id: 'duplicate', label: 'Duplicate', icon: Copy, shortcut: 'Ctrl+D' },
  { type: 'divider', id: 'div1' },
  { id: 'add-support', label: 'Add Support', icon: Lock },
  { id: 'add-load', label: 'Add Load', icon: Zap },
  { type: 'divider', id: 'div2' },
  {
    id: 'transform',
    type: 'submenu',
    label: 'Transform',
    icon: Move,
    children: [
      { id: 'move', label: 'Move...', icon: Move, shortcut: 'M' },
      { id: 'rotate', label: 'Rotate...', icon: RotateCw, shortcut: 'R' },
      { id: 'mirror', label: 'Mirror...', icon: FlipHorizontal },
    ]
  },
  { type: 'divider', id: 'div3' },
  { id: 'delete', label: 'Delete', icon: Trash2, shortcut: 'Del', danger: true }
];

export const MEMBER_CONTEXT_MENU: MenuItem[] = [
  { id: 'edit', label: 'Edit Member...', icon: Edit3, shortcut: 'Enter' },
  { id: 'properties', label: 'Properties', icon: Settings },
  { type: 'divider', id: 'div1' },
  { id: 'assign-section', label: 'Assign Section...', icon: Layers },
  { id: 'assign-material', label: 'Assign Material...' },
  { id: 'add-load', label: 'Add Member Load', icon: Zap },
  { type: 'divider', id: 'div2' },
  {
    id: 'releases',
    type: 'submenu',
    label: 'Member Releases',
    children: [
      { id: 'release-start', type: 'checkbox', label: 'Release Start' },
      { id: 'release-end', type: 'checkbox', label: 'Release End' },
      { type: 'divider', id: 'div-rel' },
      { id: 'release-all', label: 'Configure Releases...' }
    ]
  },
  {
    id: 'offsets',
    type: 'submenu',
    label: 'Member Offsets',
    children: [
      { id: 'offset-start', label: 'Start Offset...' },
      { id: 'offset-end', label: 'End Offset...' },
    ]
  },
  { type: 'divider', id: 'div3' },
  { id: 'split', label: 'Split Member', icon: Minus },
  { id: 'merge', label: 'Merge Members', icon: Plus },
  { type: 'divider', id: 'div4' },
  { id: 'duplicate', label: 'Duplicate', icon: Copy, shortcut: 'Ctrl+D' },
  { id: 'delete', label: 'Delete', icon: Trash2, shortcut: 'Del', danger: true }
];

export const CANVAS_CONTEXT_MENU: MenuItem[] = [
  { id: 'paste', label: 'Paste', icon: Clipboard, shortcut: 'Ctrl+V' },
  { type: 'divider', id: 'div1' },
  {
    id: 'create',
    type: 'submenu',
    label: 'Create',
    icon: Plus,
    children: [
      { id: 'create-node', label: 'Node', shortcut: 'N' },
      { id: 'create-beam', label: 'Beam', shortcut: 'B' },
      { id: 'create-plate', label: 'Plate', shortcut: 'P' },
    ]
  },
  { type: 'divider', id: 'div2' },
  {
    id: 'view',
    type: 'submenu',
    label: 'View',
    icon: Eye,
    children: [
      { id: 'view-front', label: 'Front View', shortcut: '1' },
      { id: 'view-back', label: 'Back View' },
      { id: 'view-top', label: 'Top View', shortcut: '2' },
      { id: 'view-bottom', label: 'Bottom View' },
      { id: 'view-left', label: 'Left View' },
      { id: 'view-right', label: 'Right View', shortcut: '3' },
      { type: 'divider', id: 'view-div' },
      { id: 'view-iso', label: 'Isometric', shortcut: '0' },
      { id: 'view-fit', label: 'Fit All', shortcut: 'F' },
    ]
  },
  { type: 'divider', id: 'div3' },
  {
    id: 'display',
    type: 'submenu',
    label: 'Display Options',
    children: [
      { id: 'show-grid', type: 'checkbox', label: 'Show Grid', checked: true },
      { id: 'show-axes', type: 'checkbox', label: 'Show Axes', checked: true },
      { id: 'show-labels', type: 'checkbox', label: 'Show Labels', checked: true },
      { type: 'divider', id: 'disp-div' },
      { type: 'header', id: 'render-header', label: 'Render Mode' },
      { id: 'render-wire', type: 'radio', radioGroup: 'render', label: 'Wireframe' },
      { id: 'render-solid', type: 'radio', radioGroup: 'render', label: 'Solid', checked: true },
      { id: 'render-section', type: 'radio', radioGroup: 'render', label: 'Section Profile' },
    ]
  },
  { type: 'divider', id: 'div4' },
  { id: 'select-all', label: 'Select All', shortcut: 'Ctrl+A' },
];

export default ContextMenu;
