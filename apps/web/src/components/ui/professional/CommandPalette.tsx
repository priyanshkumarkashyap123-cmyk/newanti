/**
 * CommandPalette.tsx - VS Code Style Command Palette (STAAD.Pro/SkyCiv Style)
 * 
 * Professional command palette with:
 * - Fuzzy search across all commands
 * - Keyboard shortcut display
 * - Category grouping
 * - Recent commands
 * - File search mode
 * - Symbol search mode
 * - Action execution
 */

import { FC, useState, useCallback, useEffect, useRef, useMemo, memo, createContext, useContext, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Command, Hash, AtSign, ChevronRight, File, FileText, Code,
  Settings, Play, Zap, Box, Circle, Layers, ArrowDown, Anchor,
  Grid, Eye, RotateCw, Save, FolderOpen, Download, Upload, Printer,
  Undo, Redo, Copy, Clipboard, Trash2, Edit3, Move, FlipHorizontal,
  Activity, Shield, Clock, Star, Terminal, Keyboard, Moon, Sun
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

export type CommandCategory = 
  | 'file' | 'edit' | 'view' | 'geometry' | 'loads' | 'analysis'
  | 'results' | 'design' | 'tools' | 'settings' | 'help' | 'recent';

export interface PaletteCommand {
  id: string;
  label: string;
  description?: string;
  category: CommandCategory;
  icon?: React.ElementType;
  shortcut?: string;
  keywords?: string[];
  action?: () => void;
  disabled?: boolean;
}

export interface PaletteFile {
  id: string;
  name: string;
  path: string;
  type: 'project' | 'section' | 'template';
  modified?: Date;
}

export interface PaletteSymbol {
  id: string;
  name: string;
  type: 'node' | 'member' | 'plate' | 'load' | 'support' | 'section' | 'material';
  location?: string;
}

type PaletteMode = 'command' | 'file' | 'symbol' | 'goto';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands?: PaletteCommand[];
  files?: PaletteFile[];
  symbols?: PaletteSymbol[];
  recentCommands?: string[];
  onCommandExecute?: (commandId: string) => void;
  onFileOpen?: (file: PaletteFile) => void;
  onSymbolSelect?: (symbol: PaletteSymbol) => void;
  onGotoLine?: (line: number) => void;
}

interface CommandPaletteContextValue {
  open: (mode?: PaletteMode) => void;
  close: () => void;
  isOpen: boolean;
}

// ============================================
// CONTEXT
// ============================================

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export const useCommandPalette = () => {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error('useCommandPalette must be used within a CommandPaletteProvider');
  }
  return context;
};

// ============================================
// DEFAULT COMMANDS
// ============================================

const DEFAULT_COMMANDS: PaletteCommand[] = [
  // File
  { id: 'file.new', label: 'New Project', category: 'file', icon: FileText, shortcut: 'Ctrl+N' },
  { id: 'file.open', label: 'Open Project', category: 'file', icon: FolderOpen, shortcut: 'Ctrl+O' },
  { id: 'file.save', label: 'Save', category: 'file', icon: Save, shortcut: 'Ctrl+S' },
  { id: 'file.saveAs', label: 'Save As...', category: 'file', icon: Save, shortcut: 'Ctrl+Shift+S' },
  { id: 'file.export', label: 'Export', category: 'file', icon: Download },
  { id: 'file.import', label: 'Import', category: 'file', icon: Upload },
  { id: 'file.print', label: 'Print', category: 'file', icon: Printer, shortcut: 'Ctrl+P' },

  // Edit
  { id: 'edit.undo', label: 'Undo', category: 'edit', icon: Undo, shortcut: 'Ctrl+Z' },
  { id: 'edit.redo', label: 'Redo', category: 'edit', icon: Redo, shortcut: 'Ctrl+Y' },
  { id: 'edit.copy', label: 'Copy', category: 'edit', icon: Copy, shortcut: 'Ctrl+C' },
  { id: 'edit.paste', label: 'Paste', category: 'edit', icon: Clipboard, shortcut: 'Ctrl+V' },
  { id: 'edit.delete', label: 'Delete', category: 'edit', icon: Trash2, shortcut: 'Del' },
  { id: 'edit.selectAll', label: 'Select All', category: 'edit', shortcut: 'Ctrl+A' },

  // View
  { id: 'view.front', label: 'Front View', category: 'view', icon: Eye, shortcut: '1' },
  { id: 'view.top', label: 'Top View', category: 'view', icon: Eye, shortcut: '2' },
  { id: 'view.right', label: 'Right View', category: 'view', icon: Eye, shortcut: '3' },
  { id: 'view.isometric', label: 'Isometric View', category: 'view', icon: Box, shortcut: '0' },
  { id: 'view.fitAll', label: 'Fit All', category: 'view', icon: Grid, shortcut: 'F' },
  { id: 'view.zoomIn', label: 'Zoom In', category: 'view', shortcut: 'Ctrl++' },
  { id: 'view.zoomOut', label: 'Zoom Out', category: 'view', shortcut: 'Ctrl+-' },

  // Geometry
  { id: 'geometry.node', label: 'Create Node', category: 'geometry', icon: Circle, shortcut: 'N', keywords: ['add', 'point', 'joint'] },
  { id: 'geometry.beam', label: 'Create Beam', category: 'geometry', icon: Layers, shortcut: 'B', keywords: ['member', 'element', 'line'] },
  { id: 'geometry.column', label: 'Create Column', category: 'geometry', shortcut: 'C' },
  { id: 'geometry.plate', label: 'Create Plate', category: 'geometry', icon: Box, shortcut: 'P', keywords: ['shell', 'slab'] },
  { id: 'geometry.move', label: 'Move', category: 'geometry', icon: Move, shortcut: 'M' },
  { id: 'geometry.rotate', label: 'Rotate', category: 'geometry', icon: RotateCw, shortcut: 'R' },
  { id: 'geometry.mirror', label: 'Mirror', category: 'geometry', icon: FlipHorizontal },

  // Loads
  { id: 'loads.nodal', label: 'Add Nodal Load', category: 'loads', icon: ArrowDown, keywords: ['point', 'force'] },
  { id: 'loads.member', label: 'Add Member Load', category: 'loads', icon: ArrowDown, keywords: ['distributed', 'udl'] },
  { id: 'loads.selfWeight', label: 'Self Weight', category: 'loads', icon: ArrowDown },
  { id: 'loads.area', label: 'Area Load', category: 'loads', keywords: ['floor', 'pressure'] },

  // Analysis
  { id: 'analysis.run', label: 'Run Analysis', category: 'analysis', icon: Play, shortcut: 'F5', keywords: ['solve', 'calculate'] },
  { id: 'analysis.pdelta', label: 'P-Delta Analysis', category: 'analysis', icon: Activity },
  { id: 'analysis.buckling', label: 'Buckling Analysis', category: 'analysis', icon: Activity },
  { id: 'analysis.modal', label: 'Modal Analysis', category: 'analysis', icon: Activity },

  // Design
  { id: 'design.steelCheck', label: 'Steel Design Check', category: 'design', icon: Shield },
  { id: 'design.concreteCheck', label: 'Concrete Design Check', category: 'design', icon: Shield },
  { id: 'design.optimizeSections', label: 'Optimize Sections', category: 'design', icon: Zap },

  // Tools
  { id: 'tools.merge', label: 'Merge Nodes', category: 'tools' },
  { id: 'tools.renumber', label: 'Renumber', category: 'tools' },
  { id: 'tools.units', label: 'Unit Settings', category: 'tools', icon: Settings },
  { id: 'tools.preferences', label: 'Preferences', category: 'tools', icon: Settings },

  // Settings
  { id: 'settings.theme', label: 'Toggle Theme', category: 'settings', icon: Moon, shortcut: 'Ctrl+Shift+T' },
  { id: 'settings.shortcuts', label: 'Keyboard Shortcuts', category: 'settings', icon: Keyboard },
];

// ============================================
// CATEGORY ICONS & COLORS
// ============================================

const CATEGORY_CONFIG: Record<CommandCategory, { icon: React.ElementType; color: string; label: string }> = {
  file: { icon: FileText, color: 'text-blue-400', label: 'File' },
  edit: { icon: Edit3, color: 'text-amber-400', label: 'Edit' },
  view: { icon: Eye, color: 'text-cyan-400', label: 'View' },
  geometry: { icon: Box, color: 'text-emerald-400', label: 'Geometry' },
  loads: { icon: ArrowDown, color: 'text-red-400', label: 'Loads' },
  analysis: { icon: Activity, color: 'text-purple-400', label: 'Analysis' },
  results: { icon: Zap, color: 'text-orange-400', label: 'Results' },
  design: { icon: Shield, color: 'text-pink-400', label: 'Design' },
  tools: { icon: Settings, color: 'text-teal-400', label: 'Tools' },
  settings: { icon: Settings, color: 'text-zinc-400', label: 'Settings' },
  help: { icon: Command, color: 'text-indigo-400', label: 'Help' },
  recent: { icon: Clock, color: 'text-zinc-500', label: 'Recent' },
};

// ============================================
// SEARCH INPUT
// ============================================

const SearchInput: FC<{
  value: string;
  onChange: (value: string) => void;
  mode: PaletteMode;
  onModeChange: (mode: PaletteMode) => void;
  placeholder?: string;
}> = memo(({ value, onChange, mode, onModeChange, placeholder }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [mode]);

  // Handle mode prefix
  useEffect(() => {
    if (value.startsWith('>')) {
      onModeChange('command');
      onChange(value.slice(1));
    } else if (value.startsWith('@')) {
      onModeChange('symbol');
      onChange(value.slice(1));
    } else if (value.startsWith(':')) {
      onModeChange('goto');
      onChange(value.slice(1));
    }
  }, [value, onChange, onModeChange]);

  const getModeIcon = () => {
    switch (mode) {
      case 'command': return <ChevronRight className="w-4 h-4 text-blue-400" />;
      case 'file': return <File className="w-4 h-4 text-amber-400" />;
      case 'symbol': return <AtSign className="w-4 h-4 text-emerald-400" />;
      case 'goto': return <Hash className="w-4 h-4 text-purple-400" />;
    }
  };

  const getPlaceholder = () => {
    switch (mode) {
      case 'command': return 'Type a command...';
      case 'file': return 'Search files...';
      case 'symbol': return 'Search symbols (@)...';
      case 'goto': return 'Go to line (:)...';
    }
  };

  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-700">
      {getModeIcon()}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || getPlaceholder()}
        className="flex-1 bg-transparent text-sm text-zinc-200 placeholder-zinc-500 outline-none"
        autoFocus
      />
      <div className="flex items-center gap-1 text-[10px] text-zinc-500">
        <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded">↑↓</kbd>
        <span>navigate</span>
        <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded ml-2">Enter</kbd>
        <span>select</span>
      </div>
    </div>
  );
});

SearchInput.displayName = 'SearchInput';

// ============================================
// COMMAND ITEM
// ============================================

const CommandItem: FC<{
  command: PaletteCommand;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}> = memo(({ command, isSelected, onClick, onMouseEnter }) => {
  const Icon = command.icon || CATEGORY_CONFIG[command.category].icon;
  const categoryConfig = CATEGORY_CONFIG[command.category];

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors
        ${isSelected ? 'bg-blue-500/20' : 'hover:bg-zinc-800/50'}
        ${command.disabled ? 'opacity-40 cursor-not-allowed' : ''}
      `}
      onClick={() => !command.disabled && onClick()}
      onMouseEnter={onMouseEnter}
    >
      <Icon className={`w-4 h-4 ${categoryConfig.color}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-zinc-200 truncate">{command.label}</div>
        {command.description && (
          <div className="text-xs text-zinc-500 truncate">{command.description}</div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${categoryConfig.color} bg-zinc-800`}>
          {categoryConfig.label}
        </span>
        {command.shortcut && (
          <kbd className="px-1.5 py-0.5 text-[10px] bg-zinc-700 text-zinc-300 rounded">
            {command.shortcut}
          </kbd>
        )}
      </div>
    </div>
  );
});

CommandItem.displayName = 'CommandItem';

// ============================================
// FILE ITEM
// ============================================

const FileItem: FC<{
  file: PaletteFile;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}> = memo(({ file, isSelected, onClick, onMouseEnter }) => {
  const Icon = useMemo(() => {
    switch (file.type) {
      case 'project': return FileText;
      case 'section': return Layers;
      case 'template': return Grid;
      default: return File;
    }
  }, [file.type]);

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors
        ${isSelected ? 'bg-blue-500/20' : 'hover:bg-zinc-800/50'}
      `}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      <Icon className="w-4 h-4 text-amber-400" />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-zinc-200 truncate">{file.name}</div>
        <div className="text-xs text-zinc-500 truncate">{file.path}</div>
      </div>
      {file.modified && (
        <span className="text-[10px] text-zinc-600">
          {file.modified.toLocaleDateString()}
        </span>
      )}
    </div>
  );
});

FileItem.displayName = 'FileItem';

// ============================================
// SYMBOL ITEM
// ============================================

const SymbolItem: FC<{
  symbol: PaletteSymbol;
  isSelected: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}> = memo(({ symbol, isSelected, onClick, onMouseEnter }) => {
  const Icon = useMemo(() => {
    switch (symbol.type) {
      case 'node': return Circle;
      case 'member': return Layers;
      case 'plate': return Box;
      case 'load': return ArrowDown;
      case 'support': return Anchor;
      case 'section': return Grid;
      case 'material': return Settings;
      default: return Code;
    }
  }, [symbol.type]);

  const typeColors: Record<string, string> = {
    node: 'text-emerald-400',
    member: 'text-blue-400',
    plate: 'text-purple-400',
    load: 'text-red-400',
    support: 'text-orange-400',
    section: 'text-cyan-400',
    material: 'text-teal-400',
  };

  return (
    <div
      className={`
        flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors
        ${isSelected ? 'bg-blue-500/20' : 'hover:bg-zinc-800/50'}
      `}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      <Icon className={`w-4 h-4 ${typeColors[symbol.type] || 'text-zinc-400'}`} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-zinc-200 truncate">{symbol.name}</div>
        {symbol.location && (
          <div className="text-xs text-zinc-500 truncate">{symbol.location}</div>
        )}
      </div>
      <span className={`text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 ${typeColors[symbol.type] || 'text-zinc-400'}`}>
        {symbol.type}
      </span>
    </div>
  );
});

SymbolItem.displayName = 'SymbolItem';

// ============================================
// FUZZY SEARCH
// ============================================

function fuzzyMatch(text: string, query: string): { match: boolean; score: number } {
  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();
  
  if (!query) return { match: true, score: 0 };
  if (textLower === queryLower) return { match: true, score: 100 };
  if (textLower.startsWith(queryLower)) return { match: true, score: 90 };
  if (textLower.includes(queryLower)) return { match: true, score: 70 };
  
  // Fuzzy character matching
  let queryIndex = 0;
  let score = 0;
  
  for (let i = 0; i < text.length && queryIndex < query.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      score += 10;
      queryIndex++;
    }
  }
  
  return { match: queryIndex === query.length, score };
}

// ============================================
// MAIN COMMAND PALETTE COMPONENT
// ============================================

export const CommandPalette: FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  commands = DEFAULT_COMMANDS,
  files = [],
  symbols = [],
  recentCommands = [],
  onCommandExecute,
  onFileOpen,
  onSymbolSelect,
  onGotoLine
}) => {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<PaletteMode>('command');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      queueMicrotask(() => {
        setQuery('');
        setSelectedIndex(0);
        setMode('command');
      });
    }
  }, [isOpen]);

  // Filter results based on mode and query
  const filteredResults = useMemo(() => {
    switch (mode) {
      case 'command': {
        let results = commands;
        
        // Prioritize recent commands
        if (!query && recentCommands.length > 0) {
          const recent = recentCommands
            .map(id => commands.find(c => c.id === id))
            .filter(Boolean) as PaletteCommand[];
          
          const others = commands.filter(c => !recentCommands.includes(c.id));
          results = [...recent, ...others];
        }
        
        if (query) {
          results = commands
            .map(cmd => {
              const labelMatch = fuzzyMatch(cmd.label, query);
              const keywordMatch = cmd.keywords?.some(k => 
                fuzzyMatch(k, query).match
              );
              
              return {
                command: cmd,
                score: keywordMatch ? labelMatch.score + 20 : labelMatch.score,
                match: labelMatch.match || keywordMatch
              };
            })
            .filter(r => r.match)
            .sort((a, b) => b.score - a.score)
            .map(r => r.command);
        }
        
        return results;
      }
      
      case 'file': {
        if (!query) return files;
        return files
          .map(file => ({
            file,
            ...fuzzyMatch(file.name, query)
          }))
          .filter(r => r.match)
          .sort((a, b) => b.score - a.score)
          .map(r => r.file);
      }
      
      case 'symbol': {
        if (!query) return symbols;
        return symbols
          .map(symbol => ({
            symbol,
            ...fuzzyMatch(symbol.name, query)
          }))
          .filter(r => r.match)
          .sort((a, b) => b.score - a.score)
          .map(r => r.symbol);
      }
      
      case 'goto': {
        return [];
      }
      
      default:
        return [];
    }
  }, [mode, query, commands, files, symbols, recentCommands]);

  const handleSelect = useCallback((item: any) => {
    switch (mode) {
      case 'command':
        (item as PaletteCommand).action?.();
        onCommandExecute?.(item.id);
        break;
      case 'file':
        onFileOpen?.(item as PaletteFile);
        break;
      case 'symbol':
        onSymbolSelect?.(item as PaletteSymbol);
        break;
    }
    onClose();
  }, [mode, onCommandExecute, onFileOpen, onSymbolSelect, onClose]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(i => Math.min(i + 1, filteredResults.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(i => Math.max(i - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (mode === 'goto') {
            const line = parseInt(query);
            if (!isNaN(line)) {
              onGotoLine?.(line);
              onClose();
            }
          } else {
            const selected = filteredResults[selectedIndex];
            if (selected) {
              handleSelect(selected);
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredResults, mode, query, onClose, onGotoLine, handleSelect]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      selectedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Reset selection when query changes
  useEffect(() => {
    queueMicrotask(() => setSelectedIndex(0));
  }, [query]);

  // Group commands by category (only for command mode)
  const groupedCommands = useMemo(() => {
    if (mode !== 'command' || query) return null;
    
    const groups: Record<string, PaletteCommand[]> = {};
    filteredResults.forEach((cmd: any) => {
      const category = cmd.category;
      if (!groups[category]) groups[category] = [];
      groups[category].push(cmd);
    });
    return groups;
  }, [mode, query, filteredResults]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          className="w-[600px] max-h-[60vh] bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Input */}
          <SearchInput
            value={query}
            onChange={setQuery}
            mode={mode}
            onModeChange={setMode}
          />

          {/* Mode Tabs */}
          <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
            {[
              { mode: 'command' as PaletteMode, label: 'Commands', prefix: '>' },
              { mode: 'file' as PaletteMode, label: 'Files', prefix: '' },
              { mode: 'symbol' as PaletteMode, label: 'Symbols', prefix: '@' },
              { mode: 'goto' as PaletteMode, label: 'Go to Line', prefix: ':' },
            ].map(tab => (
              <button
                key={tab.mode}
                onClick={() => {
                  setMode(tab.mode);
                  setQuery('');
                }}
                className={`
                  px-2 py-1 text-xs rounded transition-colors
                  ${mode === tab.mode 
                    ? 'bg-blue-500/20 text-blue-300' 
                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                  }
                `}
              >
                {tab.prefix && <span className="text-zinc-600 mr-1">{tab.prefix}</span>}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Results List */}
          <div ref={listRef} className="overflow-y-auto max-h-[calc(60vh-120px)]">
            {mode === 'goto' ? (
              <div className="px-4 py-8 text-center text-zinc-500">
                <Hash className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Type a line number to navigate</p>
                {query && !isNaN(parseInt(query)) && (
                  <p className="mt-2 text-zinc-400">
                    Press <kbd className="px-1.5 py-0.5 bg-zinc-800 rounded text-xs">Enter</kbd> to go to line {query}
                  </p>
                )}
              </div>
            ) : filteredResults.length === 0 ? (
              <div className="px-4 py-8 text-center text-zinc-500">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No results found</p>
              </div>
            ) : mode === 'command' ? (
              query ? (
                // Flat list when searching
                (filteredResults as PaletteCommand[]).map((cmd, index) => (
                  <CommandItem
                    key={cmd.id}
                    command={cmd}
                    isSelected={index === selectedIndex}
                    onClick={() => handleSelect(cmd)}
                    onMouseEnter={() => setSelectedIndex(index)}
                  />
                ))
              ) : (
                // Grouped list when not searching
                Object.entries(groupedCommands || {}).map(([category, cmds]) => {
                  const config = CATEGORY_CONFIG[category as CommandCategory];
                  const CategoryIcon = config.icon;
                  
                  return (
                    <div key={category}>
                      <div className="flex items-center gap-2 px-4 py-1.5 bg-zinc-800/50 sticky top-0">
                        <CategoryIcon className={`w-3.5 h-3.5 ${config.color}`} />
                        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
                          {config.label}
                        </span>
                      </div>
                      {cmds.map((cmd) => {
                        const globalIndex = (filteredResults as PaletteCommand[]).indexOf(cmd);
                        return (
                          <CommandItem
                            key={cmd.id}
                            command={cmd}
                            isSelected={globalIndex === selectedIndex}
                            onClick={() => handleSelect(cmd)}
                            onMouseEnter={() => setSelectedIndex(globalIndex)}
                          />
                        );
                      })}
                    </div>
                  );
                })
              )
            ) : mode === 'file' ? (
              (filteredResults as PaletteFile[]).map((file, index) => (
                <FileItem
                  key={file.id}
                  file={file}
                  isSelected={index === selectedIndex}
                  onClick={() => handleSelect(file)}
                  onMouseEnter={() => setSelectedIndex(index)}
                />
              ))
            ) : mode === 'symbol' ? (
              (filteredResults as PaletteSymbol[]).map((symbol, index) => (
                <SymbolItem
                  key={symbol.id}
                  symbol={symbol}
                  isSelected={index === selectedIndex}
                  onClick={() => handleSelect(symbol)}
                  onMouseEnter={() => setSelectedIndex(index)}
                />
              ))
            ) : null}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-zinc-800 bg-zinc-900/50 flex items-center justify-between text-[10px] text-zinc-600">
            <div className="flex items-center gap-4">
              <span>
                <kbd className="px-1 py-0.5 bg-zinc-800 rounded">Ctrl</kbd>+
                <kbd className="px-1 py-0.5 bg-zinc-800 rounded">K</kbd> Quick search
              </span>
              <span>
                <kbd className="px-1 py-0.5 bg-zinc-800 rounded">Ctrl</kbd>+
                <kbd className="px-1 py-0.5 bg-zinc-800 rounded">P</kbd> Command palette
              </span>
            </div>
            <span>{filteredResults.length} results</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ============================================
// COMMAND PALETTE PROVIDER
// ============================================

export const CommandPaletteProvider: FC<{
  children: ReactNode;
  commands?: PaletteCommand[];
  files?: PaletteFile[];
  symbols?: PaletteSymbol[];
  onCommandExecute?: (commandId: string) => void;
  onFileOpen?: (file: PaletteFile) => void;
  onSymbolSelect?: (symbol: PaletteSymbol) => void;
  onGotoLine?: (line: number) => void;
}> = ({
  children,
  commands,
  files,
  symbols,
  onCommandExecute,
  onFileOpen,
  onSymbolSelect,
  onGotoLine
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [initialMode, setInitialMode] = useState<PaletteMode>('command');

  const open = useCallback((mode: PaletteMode = 'command') => {
    setInitialMode(mode);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  // Global keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        open('command');
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        open('command');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <CommandPaletteContext.Provider value={{ open, close, isOpen }}>
      {children}
      <CommandPalette
        isOpen={isOpen}
        onClose={close}
        commands={commands}
        files={files}
        symbols={symbols}
        onCommandExecute={onCommandExecute}
        onFileOpen={onFileOpen}
        onSymbolSelect={onSymbolSelect}
        onGotoLine={onGotoLine}
      />
    </CommandPaletteContext.Provider>
  );
};

export default CommandPalette;
