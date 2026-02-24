/**
 * Professional UI Components - STAAD.Pro/SkyCiv Style
 * 
 * Complete set of enterprise-grade UI components for
 * professional structural engineering applications.
 * 
 * Components included:
 * - DockablePanel: Multi-panel docking system (STAAD-style)
 * - ProfessionalRibbon: Tabbed ribbon toolbar
 * - QuickAccessToolbar: Top quick access bar
 * - StatusBar: Bottom status bar with analysis info
 * - ViewCube: 3D view navigation cube
 * - ModelTreeView: Hierarchical model tree
 * - ContextMenu: Right-click context menus
 * - CommandPalette: Quick command search (Ctrl+P)
 * - PropertyInspector: Advanced property editor
 */

// Layout & Navigation
export { DockablePanel, DockProvider, useDockContext, DockContainer, PanelTabBar, FloatingPanel } from './DockablePanel';
export type { PanelConfig, DockPosition, PanelState, DockState } from './DockablePanel';

export { default as ProfessionalRibbon } from './ProfessionalRibbon';

export { QuickAccessToolbar } from './QuickAccessToolbar';

export { StatusBar, ExtendedStatusBar } from './StatusBar';

// 3D Navigation
export { ViewCube, MiniViewCube } from './ViewCube';
export type { ViewOrientation } from './ViewCube';

// Tree & Data Views
export { ModelTreeView, createStructuralModelTree } from './ModelTreeView';
export type { TreeNode, NodeType } from './ModelTreeView';

// Property Inspector
export { 
  PropertyInspector, 
  createNodePropertyGroups,
  createMemberPropertyGroups 
} from './PropertyInspector';
export type { 
  Property, 
  PropertyGroup, 
  PropertyType, 
  SelectionInfo 
} from './PropertyInspector';

// Menus & Dialogs
export { 
  ContextMenu, 
  ContextMenuProvider, 
  useContextMenu,
  NODE_CONTEXT_MENU,
  MEMBER_CONTEXT_MENU,
  CANVAS_CONTEXT_MENU
} from './ContextMenu';
export type { MenuItem, MenuItemType, ContextMenuPosition } from './ContextMenu';

export { 
  CommandPalette, 
  CommandPaletteProvider, 
  useCommandPalette 
} from './CommandPalette';
export type { 
  PaletteCommand, 
  PaletteFile, 
  PaletteSymbol, 
  CommandCategory 
} from './CommandPalette';
