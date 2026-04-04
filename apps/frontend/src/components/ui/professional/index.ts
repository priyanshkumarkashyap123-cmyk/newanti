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

// Layout & Navigation (keep only DockablePanel surface used elsewhere)
export { DockablePanel } from './DockablePanel';

// Ribbon / toolbars
export { default as ProfessionalRibbon } from './ProfessionalRibbon';
export { QuickAccessToolbar } from './QuickAccessToolbar';
export { StatusBar } from './StatusBar';

// Core interactions
export { CommandPalette } from './CommandPalette';
