/**
 * AI Session History Store
 * 
 * Persists all AI chat sessions (Generate, Modify, Chat) to IndexedDB.
 * Users can:
 * - View past sessions with timestamps
 * - Resume/reload sessions
 * - Search through history
 * - Export session logs
 * - Save sessions to cloud
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { API_CONFIG } from '../config/env';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string; // ISO string
  type?: 'generate' | 'modify' | 'chat' | 'error';
  metadata?: {
    structureType?: string;
    nodesGenerated?: number;
    membersGenerated?: number;
    intent?: string;
    confidence?: number;
    modelSnapshot?: any; // snapshot of model state after this message
  };
}

export interface AISession {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  messages: AIMessage[];
  projectId?: string; // Linked project if saved
  cloudId?: string; // Cloud storage ID
  tags: string[];
  summary?: string; // Auto-generated summary
  modelSnapshotOnCreate?: any; // Model state when session started
}

export interface AISessionState {
  // Sessions
  sessions: AISession[];
  activeSessionId: string | null;

  // Actions
  createSession: (name?: string) => string;
  setActiveSession: (sessionId: string | null) => void;
  addMessage: (sessionId: string, message: Omit<AIMessage, 'id' | 'timestamp'>) => void;
  deleteSession: (sessionId: string) => void;
  renameSession: (sessionId: string, name: string) => void;
  clearAllSessions: () => void;
  getActiveSession: () => AISession | null;
  getSessionMessages: (sessionId: string) => AIMessage[];
  searchSessions: (query: string) => AISession[];
  updateSessionSummary: (sessionId: string) => void;
  linkToProject: (sessionId: string, projectId: string) => void;
  exportSession: (sessionId: string) => string;
  tagSession: (sessionId: string, tag: string) => void;
  getRecentSessions: (limit?: number) => AISession[];
  
  // Cloud sync
  syncToCloud: (token: string) => Promise<{ synced: number }>;
  loadFromCloud: (token: string) => Promise<{ loaded: number }>;
}

// ============================================
// HELPERS
// ============================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function generateSessionName(messages?: AIMessage[]): string {
  if (messages && messages.length > 0) {
    const firstUserMsg = messages.find(m => m.role === 'user');
    if (firstUserMsg) {
      return firstUserMsg.content.substring(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '');
    }
  }
  const now = new Date();
  return `Session ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

function generateSummary(messages: AIMessage[]): string {
  const userMessages = messages.filter(m => m.role === 'user');
  const assistantMessages = messages.filter(m => m.role === 'assistant');
  const types = new Set(messages.map(m => m.type).filter(Boolean));
  
  let summary = '';
  
  if (types.has('generate')) {
    const generateMsgs = messages.filter(m => m.type === 'generate' && m.role === 'user');
    if (generateMsgs.length > 0) {
      summary += `Generated: ${generateMsgs.map(m => m.content.substring(0, 30)).join(', ')}. `;
    }
  }
  
  if (types.has('modify')) {
    const modifyCount = messages.filter(m => m.type === 'modify' && m.role === 'user').length;
    summary += `${modifyCount} modification(s). `;
  }
  
  if (types.has('chat')) {
    const chatCount = messages.filter(m => m.type === 'chat' && m.role === 'user').length;
    summary += `${chatCount} chat message(s). `;
  }
  
  summary += `Total: ${userMessages.length} queries, ${assistantMessages.length} responses.`;
  
  return summary;
}

// ============================================
// INDEXED-DB BASED STORAGE (for larger data)
// ============================================

const DB_NAME = 'beamlab-ai-sessions';
const DB_VERSION = 1;
const STORE_NAME = 'sessions';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
        store.createIndex('name', 'name', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveSessionToDB(session: AISession): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(session);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn('[AISessionStore] IndexedDB write failed, using localStorage fallback', e);
  }
}

async function loadAllSessionsFromDB(): Promise<AISession[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.warn('[AISessionStore] IndexedDB read failed', e);
    return [];
  }
}

async function deleteSessionFromDB(sessionId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(sessionId);
  } catch (e) {
    console.warn('[AISessionStore] IndexedDB delete failed', e);
  }
}

// ============================================
// ZUSTAND STORE
// ============================================

export const useAISessionStore = create<AISessionState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,

      createSession: (name?: string) => {
        const id = generateId();
        const now = new Date().toISOString();
        const session: AISession = {
          id,
          name: name || generateSessionName(),
          createdAt: now,
          updatedAt: now,
          messages: [],
          tags: [],
        };

        set(state => ({
          sessions: [session, ...state.sessions],
          activeSessionId: id,
        }));

        // Persist to IndexedDB (async, non-blocking)
        saveSessionToDB(session);

        return id;
      },

      setActiveSession: (sessionId) => {
        set({ activeSessionId: sessionId });
      },

      addMessage: (sessionId, messageData) => {
        const message: AIMessage = {
          id: generateId(),
          timestamp: new Date().toISOString(),
          ...messageData,
        };

        set(state => {
          const sessions = state.sessions.map(s => {
            if (s.id === sessionId) {
              const updated = {
                ...s,
                messages: [...s.messages, message],
                updatedAt: new Date().toISOString(),
              };
              // Auto-rename if first user message
              if (s.messages.length === 0 && message.role === 'user') {
                updated.name = message.content.substring(0, 60) + (message.content.length > 60 ? '...' : '');
              }
              // Persist updated session
              saveSessionToDB(updated);
              return updated;
            }
            return s;
          });
          return { sessions };
        });
      },

      deleteSession: (sessionId) => {
        set(state => ({
          sessions: state.sessions.filter(s => s.id !== sessionId),
          activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
        }));
        deleteSessionFromDB(sessionId);
      },

      renameSession: (sessionId, name) => {
        set(state => ({
          sessions: state.sessions.map(s =>
            s.id === sessionId ? { ...s, name, updatedAt: new Date().toISOString() } : s
          ),
        }));
      },

      clearAllSessions: () => {
        const { sessions } = get();
        sessions.forEach(s => deleteSessionFromDB(s.id));
        set({ sessions: [], activeSessionId: null });
      },

      getActiveSession: () => {
        const { sessions, activeSessionId } = get();
        return sessions.find(s => s.id === activeSessionId) || null;
      },

      getSessionMessages: (sessionId) => {
        const { sessions } = get();
        const session = sessions.find(s => s.id === sessionId);
        return session?.messages || [];
      },

      searchSessions: (query) => {
        const { sessions } = get();
        const lowerQuery = query.toLowerCase();
        return sessions.filter(s =>
          s.name.toLowerCase().includes(lowerQuery) ||
          s.messages.some(m => m.content.toLowerCase().includes(lowerQuery)) ||
          s.tags.some(t => t.toLowerCase().includes(lowerQuery))
        );
      },

      updateSessionSummary: (sessionId) => {
        set(state => ({
          sessions: state.sessions.map(s =>
            s.id === sessionId
              ? { ...s, summary: generateSummary(s.messages) }
              : s
          ),
        }));
      },

      linkToProject: (sessionId, projectId) => {
        set(state => ({
          sessions: state.sessions.map(s =>
            s.id === sessionId ? { ...s, projectId } : s
          ),
        }));
      },

      exportSession: (sessionId) => {
        const { sessions } = get();
        const session = sessions.find(s => s.id === sessionId);
        if (!session) return '';

        let output = `# AI Session: ${session.name}\n`;
        output += `Created: ${new Date(session.createdAt).toLocaleString()}\n`;
        output += `Messages: ${session.messages.length}\n\n`;
        output += '---\n\n';

        for (const msg of session.messages) {
          const time = new Date(msg.timestamp).toLocaleTimeString();
          const role = msg.role === 'user' ? '👤 You' : '🤖 AI';
          output += `**${role}** (${time}):\n${msg.content}\n\n`;
          if (msg.metadata?.structureType) {
            output += `_Structure: ${msg.metadata.structureType}, ${msg.metadata.nodesGenerated} nodes, ${msg.metadata.membersGenerated} members_\n\n`;
          }
        }

        return output;
      },

      tagSession: (sessionId, tag) => {
        set(state => ({
          sessions: state.sessions.map(s => {
            if (s.id === sessionId) {
              const tags = s.tags.includes(tag)
                ? s.tags.filter(t => t !== tag) // toggle off
                : [...s.tags, tag];
              return { ...s, tags };
            }
            return s;
          }),
        }));
      },

      getRecentSessions: (limit = 10) => {
        const { sessions } = get();
        return sessions
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, limit);
      },

      syncToCloud: async (token: string) => {
        const { sessions } = get();
        const unsyncedSessions = sessions.filter(s => !s.cloudId);
        if (unsyncedSessions.length === 0) return { synced: 0 };

        try {
          const response = await fetch(`${API_CONFIG.baseUrl}/api/ai-sessions/sync`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              sessions: unsyncedSessions.map(s => ({
                clientId: s.id,
                name: s.name,
                type: s.messages[0]?.type || 'chat',
                messages: s.messages.map(m => ({
                  role: m.role === 'system' ? 'assistant' : m.role,
                  content: m.content,
                  timestamp: m.timestamp,
                  metadata: m.metadata,
                })),
                projectSnapshot: s.modelSnapshotOnCreate,
              })),
            }),
          });

          if (!response.ok) throw new Error('Sync failed');
          const data = await response.json();

          if (data.success && data.results) {
            // Update sessions with cloud IDs
            set(state => ({
              sessions: state.sessions.map(s => {
                const match = data.results.find((r: { clientId: string; cloudId: string }) => r.clientId === s.id);
                if (match) {
                  const updated = { ...s, cloudId: match.cloudId };
                  saveSessionToDB(updated);
                  return updated;
                }
                return s;
              }),
            }));
          }

          return { synced: data.synced || 0 };
        } catch (error) {
          console.error('[AISessionStore] Cloud sync failed:', error);
          return { synced: 0 };
        }
      },

      loadFromCloud: async (token: string) => {
        try {
          const response = await fetch(`${API_CONFIG.baseUrl}/api/ai-sessions?pageSize=100`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });

          if (!response.ok) throw new Error('Load from cloud failed');
          const data = await response.json();

          if (data.success && data.sessions) {
            const { sessions: localSessions } = get();
            const localCloudIds = new Set(localSessions.map(s => s.cloudId).filter(Boolean));
            
            let loaded = 0;
            const newSessions: AISession[] = [];

            for (const cloudSession of data.sessions) {
              const cloudId = cloudSession._id;
              if (localCloudIds.has(cloudId)) continue; // Already have it

              const session: AISession = {
                id: generateId(),
                name: cloudSession.name,
                createdAt: cloudSession.createdAt,
                updatedAt: cloudSession.updatedAt,
                messages: (cloudSession.messages || []).map((m: { role: string; content: string; timestamp: string; metadata?: Record<string, unknown> }) => ({
                  id: generateId(),
                  role: m.role,
                  content: m.content,
                  timestamp: m.timestamp,
                  type: cloudSession.type as AIMessage['type'],
                  metadata: m.metadata,
                })),
                cloudId,
                tags: ['cloud'],
              };

              newSessions.push(session);
              saveSessionToDB(session);
              loaded++;
            }

            if (newSessions.length > 0) {
              set(state => ({
                sessions: [...newSessions, ...state.sessions],
              }));
            }

            return { loaded };
          }

          return { loaded: 0 };
        } catch (error) {
          console.error('[AISessionStore] Cloud load failed:', error);
          return { loaded: 0 };
        }
      },
    }),
    {
      name: 'beamlab-ai-sessions',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Only persist sessions metadata + last 50 sessions to localStorage
        // Full data goes to IndexedDB
        sessions: state.sessions.slice(0, 50).map(s => ({
          ...s,
          // Limit messages in localStorage to last 20 per session for space
          messages: s.messages.slice(-20),
        })),
        activeSessionId: state.activeSessionId,
      }),
    }
  )
);

// Load full sessions from IndexedDB on startup
loadAllSessionsFromDB().then(dbSessions => {
  if (dbSessions.length > 0) {
    const currentSessions = useAISessionStore.getState().sessions;
    // Merge: prefer IndexedDB data (has full messages)
    const merged = new Map<string, AISession>();
    currentSessions.forEach(s => merged.set(s.id, s));
    dbSessions.forEach(s => merged.set(s.id, s)); // IndexedDB overwrites
    
    const allSessions = Array.from(merged.values())
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 200);
    
    useAISessionStore.setState({ sessions: allSessions });
  }
});

export default useAISessionStore;
