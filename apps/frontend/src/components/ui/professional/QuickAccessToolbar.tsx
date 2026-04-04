/**
 * QuickAccessToolbar.tsx - Top Quick Access Toolbar (STAAD.Pro/SkyCiv Style)
 * 
 * Professional quick access bar with:
 * - Customizable quick tools
 * - Dropdown menus
 * - Search/command bar
 * - Recent files
 * - Account/settings access
 * - Breadcrumb navigation
 * - Tab switching (File, Edit, View, etc.)
 */

import React from 'react';
import { FC, useState, useCallback, useRef, useEffect, memo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Save, Undo, Redo, FileText, FolderOpen, Download, Upload, Printer,
  Settings, HelpCircle, User, ChevronDown, Search, Command, Home,
  ChevronRight, Clock, Star, StarOff, MoreHorizontal, Pin, PinOff,
  Moon, Sun, Maximize2, Minimize2, X, Minus, Square, Layout,
  Keyboard, Bell, BellOff, Cloud, CloudOff, Wifi, WifiOff
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface QuickTool {
  id: string;
  label: string;
  icon: React.ElementType;
  shortcut?: string;
  disabled?: boolean;
  badge?: string | number;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  onClick?: () => void;
}

interface RecentFile {
  id: string;
  name: string;
  path: string;
  timestamp: Date;
  pinned?: boolean;
}

interface BreadcrumbItem {
  id: string;
  label: string;
  icon?: React.ElementType;
  onClick?: () => void;
}

interface QuickAccessToolbarProps {
  // Quick tools
  tools?: QuickTool[];
  onToolClick?: (toolId: string) => void;
  
  // Project info
  projectName?: string;
  projectPath?: string;
  hasUnsavedChanges?: boolean;
  
  // Recent files
  recentFiles?: RecentFile[];
  onRecentFileClick?: (file: RecentFile) => void;
  onTogglePinned?: (fileId: string) => void;
  
  // Breadcrumbs
  breadcrumbs?: BreadcrumbItem[];
  
  // Search
  onSearch?: (query: string) => void;
  onCommandPalette?: () => void;
  
  // Account
  userName?: string;
  userAvatar?: string;
  isOnline?: boolean;
  
  // Settings
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
  notificationsEnabled?: boolean;
  onToggleNotifications?: () => void;
  
  // Window controls (for desktop app)
  showWindowControls?: boolean;
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
  isMaximized?: boolean;
}

// ============================================
// DEFAULT QUICK TOOLS
// ============================================

const DEFAULT_TOOLS: QuickTool[] = [
  { id: 'save', label: 'Save', icon: Save, shortcut: 'Ctrl+S' },
  { id: 'undo', label: 'Undo', icon: Undo, shortcut: 'Ctrl+Z' },
  { id: 'redo', label: 'Redo', icon: Redo, shortcut: 'Ctrl+Y' },
];

// ============================================
// QUICK TOOL BUTTON
// ============================================

const QuickToolButton: FC<{
  tool: QuickTool;
  onClick: () => void;
}> = memo(({ tool, onClick }) => {
  const Icon = tool.icon;
  
  const variantClasses = {
    default: 'text-slate-500 hover:text-[#dae2fd] hover:bg-slate-200/50 dark:hover:bg-slate-700/50',
    primary: 'text-blue-400 hover:text-blue-300 hover:bg-blue-500/20',
    success: 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20',
    warning: 'text-amber-400 hover:text-amber-300 hover:bg-amber-500/20',
    danger: 'text-red-400 hover:text-red-300 hover:bg-red-500/20',
  };

  return (
    <button type="button"
      onClick={onClick}
      disabled={tool.disabled}
      className={`
        relative p-1.5 rounded transition-colors
        ${tool.disabled ? 'opacity-40 cursor-not-allowed' : variantClasses[tool.variant || 'default']}
      `}
      title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
    >
      <Icon className="w-4 h-4" />
      {tool.badge !== undefined && (
        <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 text-[9px] font-bold bg-red-500 text-white rounded-full flex items-center justify-center">
          {tool.badge}
        </span>
      )}
    </button>
  );
});

QuickToolButton.displayName = 'QuickToolButton';

// ============================================
// SEARCH BAR
// ============================================

const SearchBar: FC<{
  onSearch?: (query: string) => void;
  onCommandPalette?: () => void;
}> = memo(({ onSearch, onCommandPalette }) => {
  const [isFocused, setIsFocused] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query) {
      onSearch?.(query);
    }
  };

  // Keyboard shortcut for command palette
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        onCommandPalette?.();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [onCommandPalette]);

  return (
    <div className={`
      relative flex items-center gap-2 px-2 py-1 rounded-md transition-all
      ${isFocused 
        ? 'bg-[#131b2e] ring-1 ring-blue-500 w-64' 
        : 'bg-slate-100/50 dark:bg-slate-800/50 w-48 hover:bg-slate-200 dark:hover:bg-slate-800'
      }
    `}>
      <Search className="w-3.5 h-3.5 text-[#869ab8] flex-shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={handleKeyDown}
        placeholder="Search or type a command..."
        className="flex-1 bg-transparent text-xs text-slate-600 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 outline-none"
      />
      <kbd className="hidden sm:flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] text-[#869ab8] bg-slate-200 dark:bg-slate-700 rounded">
        <Command className="w-2.5 h-2.5" />K
      </kbd>
    </div>
  );
});

SearchBar.displayName = 'SearchBar';

// ============================================
// RECENT FILES DROPDOWN
// ============================================

const RecentFilesDropdown: FC<{
  files: RecentFile[];
  onFileClick: (file: RecentFile) => void;
  onTogglePinned: (fileId: string) => void;
}> = memo(({ files, onFileClick, onTogglePinned }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const pinnedFiles = files.filter(f => f.pinned);
  const recentFiles = files.filter(f => !f.pinned).slice(0, 5);

  return (
    <div className="relative" ref={dropdownRef}>
      <button type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded transition-colors"
      >
        <Clock className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Recent</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full left-0 mt-1 w-72 bg-[#0b1326] border border-[#1a2333] rounded-lg shadow-xl overflow-hidden z-50"
          >
            {/* Pinned Files */}
            {pinnedFiles.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-[10px] font-semibold text-[#869ab8] uppercase tracking-wider bg-slate-100/50 dark:bg-slate-800/50">
                  <Pin className="w-3 h-3 inline mr-1" />
                  Pinned
                </div>
                {pinnedFiles.map(file => (
                  <FileListItem
                    key={file.id}
                    file={file}
                    onClick={() => {
                      onFileClick(file);
                      setIsOpen(false);
                    }}
                    onTogglePinned={() => onTogglePinned(file.id)}
                  />
                ))}
              </>
            )}

            {/* Recent Files */}
            <div className="px-3 py-1.5 text-[10px] font-semibold text-[#869ab8] uppercase tracking-wider bg-slate-100/50 dark:bg-slate-800/50">
              <Clock className="w-3 h-3 inline mr-1" />
              Recent
            </div>
            {recentFiles.length > 0 ? (
              recentFiles.map(file => (
                <FileListItem
                  key={file.id}
                  file={file}
                  onClick={() => {
                    onFileClick(file);
                    setIsOpen(false);
                  }}
                  onTogglePinned={() => onTogglePinned(file.id)}
                />
              ))
            ) : (
              <div className="px-3 py-4 text-xs text-[#869ab8] text-center">
                No recent files
              </div>
            )}

            {/* Footer */}
            <div className="px-3 py-2 border-t border-[#1a2333] flex justify-between">
              <button type="button" className="text-xs text-blue-400 hover:text-blue-300">
                Open File...
              </button>
              <button type="button" className="text-xs text-[#869ab8] hover:text-slate-400">
                Clear Recent
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

RecentFilesDropdown.displayName = 'RecentFilesDropdown';

// ============================================
// FILE LIST ITEM
// ============================================

const FileListItem: FC<{
  file: RecentFile;
  onClick: () => void;
  onTogglePinned: () => void;
}> = memo(({ file, onClick, onTogglePinned }) => {
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Just now';
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 cursor-pointer group">
      <FileText className="w-4 h-4 text-[#869ab8] flex-shrink-0" />
      <div className="flex-1 min-w-0" onClick={onClick}>
        <div className="text-xs text-slate-600 dark:text-slate-300 truncate">{file.name}</div>
        <div className="text-[10px] text-[#869ab8] truncate">{file.path}</div>
      </div>
      <span className="text-[10px] text-slate-500">{formatTime(file.timestamp)}</span>
      <button type="button"
        onClick={(e) => {
          e.stopPropagation();
          onTogglePinned();
        }}
        className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
          file.pinned ? 'text-amber-400' : 'text-[#869ab8] hover:text-slate-600 dark:hover:text-slate-300'
        }`}
      >
        {file.pinned ? <Star className="w-3 h-3 fill-current" /> : <StarOff className="w-3 h-3" />}
      </button>
    </div>
  );
});

FileListItem.displayName = 'FileListItem';

// ============================================
// BREADCRUMB NAVIGATION
// ============================================

const Breadcrumbs: FC<{
  items: BreadcrumbItem[];
}> = memo(({ items }) => (
  <div className="flex items-center gap-1 text-xs">
    {items.map((item, index) => {
      const Icon = item.icon;
      const isLast = index === items.length - 1;

      return (
        <div key={item.id} className="flex items-center">
          <button type="button"
            onClick={item.onClick}
            className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors ${
              isLast 
                ? 'text-slate-700 dark:text-slate-200' 
                : 'text-[#869ab8] hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
            }`}
          >
            {Icon && <Icon className="w-3 h-3" />}
            <span>{item.label}</span>
          </button>
          {!isLast && <ChevronRight className="w-3 h-3 text-slate-500" />}
        </div>
      );
    })}
  </div>
));

Breadcrumbs.displayName = 'Breadcrumbs';

// ============================================
// USER MENU
// ============================================

const UserMenu: FC<{
  userName?: string;
  userAvatar?: string;
  isOnline?: boolean;
}> = memo(({ userName, userAvatar, isOnline = true }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
      >
        <div className="relative">
          {userAvatar ? (
            <img src={userAvatar} alt={userName} className="w-6 h-6 rounded-full" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <User className="w-3.5 h-3.5 text-white" />
            </div>
          )}
          <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
            isOnline ? 'bg-emerald-400' : 'bg-slate-500'
          }`} />
        </div>
        {userName && <span className="text-xs text-slate-600 dark:text-slate-300 hidden lg:block">{userName}</span>}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full right-0 mt-1 w-56 bg-[#0b1326] border border-[#1a2333] rounded-lg shadow-xl overflow-hidden z-50"
          >
            <div className="px-4 py-3 border-b border-[#1a2333]">
              <div className="text-sm font-medium tracking-wide text-slate-700 dark:text-slate-200">{userName || 'Guest'}</div>
              <div className="text-xs text-[#869ab8]">Free Plan</div>
            </div>
            <div className="py-1">
              <button type="button" className="w-full flex items-center gap-2 px-4 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800">
                <User className="w-4 h-4 text-[#869ab8]" />
                Account Settings
              </button>
              <button type="button" className="w-full flex items-center gap-2 px-4 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800">
                <Keyboard className="w-4 h-4 text-[#869ab8]" />
                Keyboard Shortcuts
              </button>
              <button type="button" className="w-full flex items-center gap-2 px-4 py-2 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800">
                <HelpCircle className="w-4 h-4 text-[#869ab8]" />
                Help & Support
              </button>
            </div>
            <div className="py-1 border-t border-[#1a2333]">
              <button type="button" className="w-full flex items-center gap-2 px-4 py-2 text-xs text-red-400 hover:bg-red-500/10">
                Sign Out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

UserMenu.displayName = 'UserMenu';

// ============================================
// WINDOW CONTROLS
// ============================================

const WindowControls: FC<{
  onMinimize?: () => void;
  onMaximize?: () => void;
  onClose?: () => void;
  isMaximized?: boolean;
}> = memo(({ onMinimize, onMaximize, onClose, isMaximized }) => (
  <div className="flex items-center ml-2 -mr-1">
    <button type="button"
      onClick={onMinimize}
      className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
    >
      <Minus className="w-3.5 h-3.5" />
    </button>
    <button type="button"
      onClick={onMaximize}
      className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
    >
      {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
    </button>
    <button type="button"
      onClick={onClose}
      className="p-2 text-[#869ab8] hover:text-white hover:bg-red-500"
    >
      <X className="w-3.5 h-3.5" />
    </button>
  </div>
));

WindowControls.displayName = 'WindowControls';

// ============================================
// MAIN QUICK ACCESS TOOLBAR
// ============================================

export const QuickAccessToolbar: FC<QuickAccessToolbarProps> = ({
  tools = DEFAULT_TOOLS,
  onToolClick,
  projectName,
  projectPath,
  hasUnsavedChanges = false,
  recentFiles = [],
  onRecentFileClick,
  onTogglePinned,
  breadcrumbs = [],
  onSearch,
  onCommandPalette,
  userName,
  userAvatar,
  isOnline = true,
  isDarkMode = true,
  onToggleDarkMode,
  notificationsEnabled = true,
  onToggleNotifications,
  showWindowControls = false,
  onMinimize,
  onMaximize,
  onClose,
  isMaximized = false
}) => {
  return (
    <div className="h-10 bg-[#0b1326] border-b border-[#1a2333] flex items-center justify-between px-2 select-none app-region-drag">
      {/* Left Section */}
      <div className="flex items-center gap-2 app-region-no-drag">
        {/* Logo/Home */}
        <button type="button" className="p-1.5 rounded hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors">
          <Home className="w-4 h-4 text-blue-400" />
        </button>

        <div className="h-5 w-px bg-[#131b2e]" />

        {/* Quick Tools */}
        <div className="flex items-center gap-0.5">
          {tools.map(tool => (
            <QuickToolButton
              key={tool.id}
              tool={tool}
              onClick={() => {
                tool.onClick?.();
                onToolClick?.(tool.id);
              }}
            />
          ))}
        </div>

        <div className="h-5 w-px bg-[#131b2e]" />

        {/* Recent Files */}
        {recentFiles.length > 0 && onRecentFileClick && onTogglePinned && (
          <RecentFilesDropdown
            files={recentFiles}
            onFileClick={onRecentFileClick}
            onTogglePinned={onTogglePinned}
          />
        )}

        {/* Breadcrumbs */}
        {breadcrumbs.length > 0 && (
          <>
            <div className="h-5 w-px bg-[#131b2e]" />
            <Breadcrumbs items={breadcrumbs} />
          </>
        )}
      </div>

      {/* Center Section - Project Name */}
      <div className="flex items-center gap-2">
        {projectName && (
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#869ab8]" />
            <span className="text-xs text-slate-600 dark:text-slate-300 font-medium tracking-wide">
              {projectName}
              {hasUnsavedChanges && <span className="text-amber-400 ml-1">•</span>}
            </span>
          </div>
        )}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2 app-region-no-drag">
        {/* Search */}
        <SearchBar onSearch={onSearch} onCommandPalette={onCommandPalette} />

        <div className="h-5 w-px bg-[#131b2e]" />

        {/* Settings Toggles */}
        <div className="flex items-center gap-1">
          {/* Dark Mode */}
          <button type="button"
            onClick={onToggleDarkMode}
            className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 rounded transition-colors"
            title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
          >
            {isDarkMode ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>

          {/* Notifications */}
          <button type="button"
            onClick={onToggleNotifications}
            className={`p-1.5 rounded transition-colors ${
              notificationsEnabled 
                ? 'text-slate-500 hover:text-slate-700 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50' 
                : 'text-slate-500'
            }`}
            title={notificationsEnabled ? 'Disable Notifications' : 'Enable Notifications'}
          >
            {notificationsEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
          </button>

          {/* Online Status */}
          <div className={`p-1.5 ${isOnline ? 'text-emerald-400' : 'text-slate-500'}`} title={isOnline ? 'Online' : 'Offline'}>
            {isOnline ? <Cloud className="w-4 h-4" /> : <CloudOff className="w-4 h-4" />}
          </div>
        </div>

        <div className="h-5 w-px bg-[#131b2e]" />

        {/* User Menu */}
        <UserMenu userName={userName} userAvatar={userAvatar} isOnline={isOnline} />

        {/* Window Controls (Desktop) */}
        {showWindowControls && (
          <WindowControls
            onMinimize={onMinimize}
            onMaximize={onMaximize}
            onClose={onClose}
            isMaximized={isMaximized}
          />
        )}
      </div>
    </div>
  );
};

export default QuickAccessToolbar;
