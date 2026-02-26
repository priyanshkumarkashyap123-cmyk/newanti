/**
 * KeyboardShortcutsOverlay.tsx — Professional Keyboard Shortcuts Reference
 * 
 * Triggered by pressing ? or F1 — displays all available shortcuts
 * in a professional overlay similar to STAAD Pro / VS Code.
 */

import { FC, memo, useEffect, useState } from 'react';
import { X, Keyboard, Search } from 'lucide-react';

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; description: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: 'General',
    shortcuts: [
      { keys: ['Ctrl', 'Z'], description: 'Undo' },
      { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo' },
      { keys: ['Ctrl', 'S'], description: 'Save project' },
      { keys: ['Ctrl', 'O'], description: 'Open project' },
      { keys: ['Ctrl', 'N'], description: 'New project' },
      { keys: ['Delete'], description: 'Delete selection' },
      { keys: ['Esc'], description: 'Cancel / Deselect all' },
      { keys: ['Ctrl', 'P'], description: 'Command palette' },
    ],
  },
  {
    title: 'Selection',
    shortcuts: [
      { keys: ['Ctrl', 'A'], description: 'Select all' },
      { keys: ['Shift', 'Click'], description: 'Add to selection' },
      { keys: ['1'], description: 'Select nodes mode' },
      { keys: ['2'], description: 'Select members mode' },
      { keys: ['3'], description: 'Box select mode' },
    ],
  },
  {
    title: 'Modeling',
    shortcuts: [
      { keys: ['N'], description: 'Add node tool' },
      { keys: ['M'], description: 'Add member tool' },
      { keys: ['S'], description: 'Add support' },
      { keys: ['L'], description: 'Add load' },
      { keys: ['P'], description: 'Add plate element' },
      { keys: ['G'], description: 'Toggle grid' },
      { keys: ['Ctrl', 'D'], description: 'Duplicate selection' },
    ],
  },
  {
    title: 'View',
    shortcuts: [
      { keys: ['F'], description: 'Fit view to model' },
      { keys: ['Home'], description: 'Reset view' },
      { keys: ['Numpad 1'], description: 'Front view (XY)' },
      { keys: ['Numpad 3'], description: 'Side view (YZ)' },
      { keys: ['Numpad 7'], description: 'Top view (XZ)' },
      { keys: ['Numpad 0'], description: '3D perspective view' },
      { keys: ['Scroll'], description: 'Zoom in/out' },
      { keys: ['Middle drag'], description: 'Pan view' },
      { keys: ['Right drag'], description: 'Orbit view' },
    ],
  },
  {
    title: 'Analysis',
    shortcuts: [
      { keys: ['F5'], description: 'Run analysis' },
      { keys: ['Ctrl', 'R'], description: 'Run analysis' },
      { keys: ['F6'], description: 'View results' },
      { keys: ['Ctrl', 'E'], description: 'Export results' },
    ],
  },
];

interface KeyboardShortcutsOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsOverlay: FC<KeyboardShortcutsOverlayProps> = memo(({ isOpen, onClose }) => {
  const [filter, setFilter] = useState('');

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filteredGroups = filter
    ? SHORTCUT_GROUPS.map(group => ({
        ...group,
        shortcuts: group.shortcuts.filter(s =>
          s.description.toLowerCase().includes(filter.toLowerCase()) ||
          s.keys.join(' ').toLowerCase().includes(filter.toLowerCase())
        ),
      })).filter(group => group.shortcuts.length > 0)
    : SHORTCUT_GROUPS;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-slate-950 border border-slate-700/60 rounded-xl shadow-2xl w-[640px] max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Keyboard className="w-5 h-5 text-blue-400" />
            <h2 className="text-sm font-semibold text-slate-200">Keyboard Shortcuts</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300 p-1 rounded transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-2.5 border-b border-slate-800/60">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search shortcuts..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/60 text-slate-200 text-xs pl-8 pr-3 py-2 rounded-md
                         focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 outline-none transition-colors placeholder-slate-600"
              autoFocus
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto eng-scroll px-5 py-3">
          <div className="columns-2 gap-6">
            {filteredGroups.map((group) => (
              <div key={group.title} className="break-inside-avoid mb-4">
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">{group.title}</h3>
                <div className="space-y-1">
                  {group.shortcuts.map(({ keys, description }) => (
                    <div key={description} className="flex items-center justify-between py-1 group">
                      <span className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors">{description}</span>
                      <div className="flex items-center gap-0.5 ml-3">
                        {keys.map((key, i) => (
                          <span key={i}>
                            <kbd className="inline-block min-w-[20px] text-center bg-slate-800 border border-slate-700/80 text-slate-300 
                                          text-[10px] font-mono px-1.5 py-0.5 rounded shadow-sm shadow-black/20">
                              {key}
                            </kbd>
                            {i < keys.length - 1 && <span className="text-slate-700 mx-0.5 text-[10px]">+</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {filteredGroups.length === 0 && (
            <div className="text-center text-slate-500 text-sm py-8">
              No shortcuts match "{filter}"
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-slate-800/60 flex items-center justify-between">
          <span className="text-[10px] text-slate-600">Press <kbd className="bg-slate-800 px-1 py-0.5 rounded text-slate-400 text-[9px] font-mono">?</kbd> to toggle</span>
          <span className="text-[10px] text-slate-600">BeamLab PRO</span>
        </div>
      </div>
    </div>
  );
});
KeyboardShortcutsOverlay.displayName = 'KeyboardShortcutsOverlay';

export default KeyboardShortcutsOverlay;
