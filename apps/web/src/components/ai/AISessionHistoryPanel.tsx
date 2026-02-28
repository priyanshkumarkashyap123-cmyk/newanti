/**
 * AISessionHistoryPanel.tsx - Session History UI
 * 
 * Shows all past AI sessions with:
 * - Session list with timestamps and summaries
 * - Search/filter functionality
 * - Resume session / load history
 * - Export sessions
 * - Delete sessions
 */

import { FC, useState, useMemo, useCallback } from 'react';
import {
  Clock,
  Search,
  Trash2,
  Download,
  MessageCircle,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Edit3,
  Wand2,
  ArrowLeft,
  X,
  Calendar,
  MoreVertical,
  Tag
} from 'lucide-react';
import { useAISessionStore, AISession, AIMessage } from '../../store/aiSessionStore';

// ============================================
// TYPES
// ============================================

interface SessionHistoryPanelProps {
  onResumeSession?: (sessionId: string) => void;
  onClose?: () => void;
}

// ============================================
// HELPER
// ============================================

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getMessageTypeIcon(type?: string) {
  switch (type) {
    case 'generate': return <Wand2 className="w-3 h-3 text-purple-400" />;
    case 'modify': return <Edit3 className="w-3 h-3 text-green-400" />;
    case 'chat': return <MessageCircle className="w-3 h-3 text-blue-400" />;
    default: return <Sparkles className="w-3 h-3 text-zinc-500 dark:text-zinc-400" />;
  }
}

// ============================================
// SESSION CARD
// ============================================

const SessionCard: FC<{
  session: AISession;
  isExpanded: boolean;
  onToggle: () => void;
  onResume: () => void;
  onDelete: () => void;
  onExport: () => void;
}> = ({ session, isExpanded, onToggle, onResume, onDelete, onExport }) => {
  const [showMenu, setShowMenu] = useState(false);

  const messageTypes = useMemo(() => {
    const types = new Set<string>();
    session.messages.forEach(m => {
      if (m.type) types.add(m.type);
    });
    return Array.from(types);
  }, [session.messages]);

  const userMsgCount = session.messages.filter(m => m.role === 'user').length;

  return (
    <div className="bg-zinc-100/50 dark:bg-zinc-800/50 border border-zinc-200/50 dark:border-zinc-700/50 rounded-lg overflow-hidden hover:border-zinc-600/50 transition-colors">
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-zinc-700/30 transition-colors"
        onClick={onToggle}
      >
        {isExpanded
          ? <ChevronDown className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 flex-shrink-0" />
          : <ChevronRight className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 flex-shrink-0" />
        }

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200 truncate">
              {session.name}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-zinc-500 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />
              {timeAgo(session.updatedAt)}
            </span>
            <span className="text-[10px] text-zinc-500">
              {userMsgCount} msg{userMsgCount !== 1 ? 's' : ''}
            </span>
            {/* Type badges */}
            <div className="flex gap-1">
              {messageTypes.map(type => (
                <span key={type} className="flex items-center">
                  {getMessageTypeIcon(type)}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 relative" onClick={e => e.stopPropagation()}>
          <button
            onClick={onResume}
            className="px-2 py-1 text-[10px] bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors"
            title="Resume session"
          >
            Resume
          </button>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 rounded hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 transition-colors"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-1 z-20 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg shadow-xl py-1 min-w-[120px]">
              <button
                onClick={() => { onExport(); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                <Download className="w-3 h-3" /> Export
              </button>
              <button
                onClick={() => { onDelete(); setShowMenu(false); }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-3 h-3" /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Expanded Message Preview */}
      {isExpanded && (
        <div className="border-t border-zinc-200/50 dark:border-zinc-700/50 px-3 py-2 space-y-1.5 max-h-48 overflow-y-auto">
          {session.messages.length === 0 ? (
            <p className="text-[10px] text-zinc-500 italic">Empty session</p>
          ) : (
            session.messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 text-[10px] ${msg.role === 'user' ? 'text-zinc-600 dark:text-zinc-300' : 'text-zinc-500 dark:text-zinc-400'}`}
              >
                <span className="flex-shrink-0 mt-0.5">
                  {msg.role === 'user' ? '👤' : '🤖'}
                </span>
                <div className="min-w-0">
                  <span className="flex items-center gap-1 mb-0.5">
                    {getMessageTypeIcon(msg.type)}
                    <span className="text-zinc-500">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </span>
                  <p className="break-words line-clamp-2">
                    {msg.content}
                  </p>
                  {msg.metadata?.structureType && (
                    <span className="text-purple-400 text-[9px]">
                      → {msg.metadata.structureType} ({msg.metadata.nodesGenerated} nodes)
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tags */}
      {session.tags.length > 0 && (
        <div className="flex gap-1 px-3 pb-2">
          {session.tags.map(tag => (
            <span
              key={tag}
              className="flex items-center gap-0.5 px-1.5 py-0.5 bg-zinc-200/50 dark:bg-zinc-700/50 rounded text-[9px] text-zinc-500 dark:text-zinc-400"
            >
              <Tag className="w-2 h-2" />
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const AISessionHistoryPanel: FC<SessionHistoryPanelProps> = ({
  onResumeSession,
  onClose,
}) => {
  const sessions = useAISessionStore(s => s.sessions);
  const deleteSession = useAISessionStore(s => s.deleteSession);
  const exportSession = useAISessionStore(s => s.exportSession);
  const clearAllSessions = useAISessionStore(s => s.clearAllSessions);
  const setActiveSession = useAISessionStore(s => s.setActiveSession);

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'generate' | 'modify' | 'chat'>('all');

  // Filtered and sorted sessions
  const filteredSessions = useMemo(() => {
    let result = [...sessions];

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.messages.some(m => m.content.toLowerCase().includes(q))
      );
    }

    // Type filter
    if (filterType !== 'all') {
      result = result.filter(s =>
        s.messages.some(m => m.type === filterType)
      );
    }

    // Sort by most recent
    result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return result;
  }, [sessions, searchQuery, filterType]);

  // Group sessions by date
  const groupedSessions = useMemo(() => {
    const groups: { label: string; sessions: AISession[] }[] = [];
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todaySessions: AISession[] = [];
    const yesterdaySessions: AISession[] = [];
    const olderSessions: AISession[] = [];

    for (const session of filteredSessions) {
      const date = new Date(session.updatedAt);
      if (date.toDateString() === today.toDateString()) {
        todaySessions.push(session);
      } else if (date.toDateString() === yesterday.toDateString()) {
        yesterdaySessions.push(session);
      } else {
        olderSessions.push(session);
      }
    }

    if (todaySessions.length > 0) groups.push({ label: 'Today', sessions: todaySessions });
    if (yesterdaySessions.length > 0) groups.push({ label: 'Yesterday', sessions: yesterdaySessions });
    if (olderSessions.length > 0) groups.push({ label: 'Older', sessions: olderSessions });

    return groups;
  }, [filteredSessions]);

  const handleResume = useCallback((sessionId: string) => {
    setActiveSession(sessionId);
    onResumeSession?.(sessionId);
  }, [setActiveSession, onResumeSession]);

  const handleExport = useCallback((sessionId: string) => {
    const content = exportSession(sessionId);
    if (!content) return;

    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-session-${sessionId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportSession]);

  const handleDelete = useCallback((sessionId: string) => {
    if (window.confirm('Delete this session? This cannot be undone.')) {
      deleteSession(sessionId);
    }
  }, [deleteSession]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-zinc-900">
      {/* Header */}
      <div className="px-3 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onClose && (
              <button onClick={onClose} aria-label="Close" title="Close" className="p-1 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 rounded transition-colors">
                <ArrowLeft className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
              </button>
            )}
            <Clock className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Session History</h3>
            <span className="text-[10px] text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
              {sessions.length}
            </span>
          </div>
          {sessions.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Clear ALL session history?')) {
                  clearAllSessions();
                }
              }}
              className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Search */}
        <div className="mt-2 relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sessions..."
            className="w-full pl-8 pr-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-zinc-700 dark:text-zinc-200 placeholder-zinc-400 dark:placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X className="w-3 h-3 text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300" />
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mt-2">
          {(['all', 'generate', 'modify', 'chat'] as const).map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`flex items-center gap-1 px-2 py-1 text-[10px] rounded transition-colors ${
                filterType === type
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50'
              }`}
            >
              {type === 'all' && 'All'}
              {type === 'generate' && <><Wand2 className="w-2.5 h-2.5" /> Generate</>}
              {type === 'modify' && <><Edit3 className="w-2.5 h-2.5" /> Modify</>}
              {type === 'chat' && <><MessageCircle className="w-2.5 h-2.5" /> Chat</>}
            </button>
          ))}
        </div>
      </div>

      {/* Session List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {filteredSessions.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">
              {searchQuery ? 'No sessions match your search' : 'No sessions yet'}
            </p>
            <p className="text-xs text-zinc-500">
              {searchQuery ? 'Try a different search term' : 'Your AI conversations will appear here'}
            </p>
          </div>
        ) : (
          groupedSessions.map(group => (
            <div key={group.label}>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-3 h-3 text-zinc-500" />
                <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
                  {group.label}
                </span>
                <div className="flex-1 h-px bg-zinc-100 dark:bg-zinc-800" />
              </div>
              <div className="space-y-2">
                {group.sessions.map(session => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    isExpanded={expandedId === session.id}
                    onToggle={() => setExpandedId(expandedId === session.id ? null : session.id)}
                    onResume={() => handleResume(session.id)}
                    onDelete={() => handleDelete(session.id)}
                    onExport={() => handleExport(session.id)}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AISessionHistoryPanel;
