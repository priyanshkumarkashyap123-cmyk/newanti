/**
 * ============================================================================
 * DATA PERSISTENCE LAYER
 * ============================================================================
 * 
 * Industry-standard data persistence for structural engineering projects:
 * - Local storage with encryption option
 * - IndexedDB for large datasets
 * - Auto-save with debouncing
 * - Version migration support
 * - Compression for large models
 * 
 * Addresses: "Database Integration - Everything is in-memory only. Refresh = data loss"
 * 
 * @version 1.0.0
 */

import { useState, useCallback, useEffect, useRef } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface StorageOptions {
  key: string;
  storage?: 'local' | 'session' | 'indexeddb';
  encrypt?: boolean;
  compress?: boolean;
  version?: number;
  migrate?: (oldData: unknown, oldVersion: number, newVersion: number) => unknown;
  debounceMs?: number;
  onError?: (error: Error) => void;
}

export interface UsePersistedStateReturn<T> {
  value: T;
  setValue: (value: T | ((prev: T) => T)) => void;
  isLoading: boolean;
  isSaving: boolean;
  error: Error | null;
  clear: () => void;
  refresh: () => Promise<void>;
}

interface StorageMetadata {
  version: number;
  savedAt: number;
  compressed: boolean;
}

interface StoredData<T> {
  data: T;
  meta: StorageMetadata;
}

// ============================================================================
// COMPRESSION UTILITIES
// ============================================================================

/**
 * Simple LZ-based compression for JSON strings
 */
function compress(str: string): string {
  if (typeof window === 'undefined' || !window.btoa) return str;
  
  try {
    // Simple run-length encoding for repeated patterns
    let compressed = '';
    let i = 0;
    while (i < str.length) {
      let count = 1;
      while (i + count < str.length && str[i] === str[i + count] && count < 255) {
        count++;
      }
      if (count > 3) {
        compressed += `\x00${String.fromCharCode(count)}${str[i]}`;
        i += count;
      } else {
        compressed += str[i];
        i++;
      }
    }
    
    return btoa(compressed);
  } catch {
    return str;
  }
}

function decompress(str: string): string {
  if (typeof window === 'undefined' || !window.atob) return str;
  
  try {
    const decoded = atob(str);
    let decompressed = '';
    let i = 0;
    
    while (i < decoded.length) {
      if (decoded[i] === '\x00' && i + 2 < decoded.length) {
        const count = decoded.charCodeAt(i + 1);
        const char = decoded[i + 2];
        decompressed += char.repeat(count);
        i += 3;
      } else {
        decompressed += decoded[i];
        i++;
      }
    }
    
    return decompressed;
  } catch {
    return str;
  }
}

// ============================================================================
// ENCRYPTION UTILITIES (Simple XOR - for obfuscation, not security)
// ============================================================================

const ENCRYPTION_KEY = 'beamlab-storage-key-2026';

function encrypt(str: string): string {
  let result = '';
  for (let i = 0; i < str.length; i++) {
    result += String.fromCharCode(
      str.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length)
    );
  }
  return btoa(result);
}

function decrypt(str: string): string {
  try {
    const decoded = atob(str);
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      result += String.fromCharCode(
        decoded.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length)
      );
    }
    return result;
  } catch {
    return str;
  }
}

// ============================================================================
// STORAGE ADAPTERS
// ============================================================================

interface StorageAdapter {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

class LocalStorageAdapter implements StorageAdapter {
  async get<T>(key: string): Promise<T | null> {
    if (typeof window === 'undefined') return null;
    const item = localStorage.getItem(key);
    if (!item) return null;
    try {
      return JSON.parse(item) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
  }

  async remove(key: string): Promise<void> {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(key);
  }

  async clear(): Promise<void> {
    if (typeof window === 'undefined') return;
    localStorage.clear();
  }
}

class SessionStorageAdapter implements StorageAdapter {
  async get<T>(key: string): Promise<T | null> {
    if (typeof window === 'undefined') return null;
    const item = sessionStorage.getItem(key);
    if (!item) return null;
    try {
      return JSON.parse(item) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem(key, JSON.stringify(value));
  }

  async remove(key: string): Promise<void> {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem(key);
  }

  async clear(): Promise<void> {
    if (typeof window === 'undefined') return;
    sessionStorage.clear();
  }
}

class IndexedDBAdapter implements StorageAdapter {
  private dbName = 'beamlab-persistence';
  private storeName = 'data';
  private db: IDBDatabase | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      
      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'key' });
        }
      };
    });
  }

  async get<T>(key: string): Promise<T | null> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : null);
      };
    });
  }

  async set<T>(key: string, value: T): Promise<void> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put({ key, value });
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async remove(key: string): Promise<void> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async clear(): Promise<void> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }
}

function getAdapter(type: 'local' | 'session' | 'indexeddb'): StorageAdapter {
  switch (type) {
    case 'session':
      return new SessionStorageAdapter();
    case 'indexeddb':
      return new IndexedDBAdapter();
    default:
      return new LocalStorageAdapter();
  }
}

// ============================================================================
// MAIN HOOK: usePersistedState
// ============================================================================

export function usePersistedState<T>(
  initialValue: T,
  options: StorageOptions
): UsePersistedStateReturn<T> {
  const {
    key,
    storage = 'local',
    encrypt: shouldEncrypt = false,
    compress: shouldCompress = false,
    version = 1,
    migrate,
    debounceMs = 500,
    onError,
  } = options;

  const [value, setValueInternal] = useState<T>(initialValue);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const adapterRef = useRef<StorageAdapter>(getAdapter(storage));
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingValueRef = useRef<T | null>(null);

  // Load initial value
  useEffect(() => {
    const loadValue = async () => {
      try {
        setIsLoading(true);
        const rawData = await adapterRef.current.get<string | StoredData<T>>(key);
        
        if (rawData === null) {
          setValueInternal(initialValue);
          return;
        }

        // Handle legacy data (plain value without metadata)
        if (typeof rawData === 'string' || !('meta' in (rawData as object))) {
          let parsed: T;
          if (typeof rawData === 'string') {
            let str = rawData;
            if (shouldEncrypt) str = decrypt(str);
            if (shouldCompress) str = decompress(str);
            parsed = JSON.parse(str);
          } else {
            parsed = rawData as unknown as T;
          }
          setValueInternal(parsed);
          return;
        }

        const stored = rawData as StoredData<T>;
        let data = stored.data;

        // Run migration if version changed
        if (stored.meta.version < version && migrate) {
          data = migrate(data, stored.meta.version, version) as T;
        }

        setValueInternal(data);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
        setValueInternal(initialValue);
      } finally {
        setIsLoading(false);
      }
    };

    loadValue();
  }, [key]);

  // Save value (debounced)
  const saveValue = useCallback(async (newValue: T) => {
    try {
      setIsSaving(true);
      
      const stored: StoredData<T> = {
        data: newValue,
        meta: {
          version,
          savedAt: Date.now(),
          compressed: shouldCompress,
        },
      };

      let toStore: string | StoredData<T> = stored;
      
      if (shouldCompress || shouldEncrypt) {
        let str = JSON.stringify(stored.data);
        if (shouldCompress) str = compress(str);
        if (shouldEncrypt) str = encrypt(str);
        toStore = str;
      }

      await adapterRef.current.set(key, toStore);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    } finally {
      setIsSaving(false);
    }
  }, [key, version, shouldCompress, shouldEncrypt, onError]);

  // Set value with debouncing
  const setValue = useCallback((newValue: T | ((prev: T) => T)) => {
    setValueInternal((prev) => {
      const nextValue = typeof newValue === 'function' 
        ? (newValue as (prev: T) => T)(prev) 
        : newValue;
      
      pendingValueRef.current = nextValue;
      
      // Clear existing debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      
      // Schedule save
      debounceRef.current = setTimeout(() => {
        if (pendingValueRef.current !== null) {
          saveValue(pendingValueRef.current);
          pendingValueRef.current = null;
        }
      }, debounceMs);
      
      return nextValue;
    });
  }, [saveValue, debounceMs]);

  // Clear stored value
  const clear = useCallback(async () => {
    try {
      await adapterRef.current.remove(key);
      setValueInternal(initialValue);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    }
  }, [key, initialValue, onError]);

  // Refresh from storage
  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const rawData = await adapterRef.current.get<StoredData<T>>(key);
      if (rawData && 'data' in rawData) {
        setValueInternal(rawData.data);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [key, onError]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        // Save pending value immediately
        if (pendingValueRef.current !== null) {
          saveValue(pendingValueRef.current);
        }
      }
    };
  }, [saveValue]);

  return {
    value,
    setValue,
    isLoading,
    isSaving,
    error,
    clear,
    refresh,
  };
}

// ============================================================================
// PROJECT PERSISTENCE
// ============================================================================

export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  data: unknown;
}

export interface ProjectListItem {
  id: string;
  name: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface UseProjectPersistenceReturn {
  projects: ProjectListItem[];
  currentProject: Project | null;
  isLoading: boolean;
  error: Error | null;
  
  createProject: (name: string, description?: string, data?: unknown) => Promise<string>;
  openProject: (id: string) => Promise<void>;
  saveProject: (data: unknown) => Promise<void>;
  renameProject: (id: string, name: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  duplicateProject: (id: string, newName?: string) => Promise<string>;
  exportProject: (id: string) => Promise<string>;
  importProject: (jsonString: string) => Promise<string>;
  closeProject: () => void;
}

export function useProjectPersistence(): UseProjectPersistenceReturn {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const adapter = useRef(new IndexedDBAdapter());

  // Load project list
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const list = await adapter.current.get<ProjectListItem[]>('project-list');
        setProjects(list || []);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsLoading(false);
      }
    };
    loadProjects();
  }, []);

  // Create project
  const createProject = useCallback(async (
    name: string, 
    description?: string, 
    data?: unknown
  ): Promise<string> => {
    const id = `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Date.now();
    
    const project: Project = {
      id,
      name,
      description,
      createdAt: now,
      updatedAt: now,
      data: data || {},
    };

    const listItem: ProjectListItem = {
      id,
      name,
      description,
      createdAt: now,
      updatedAt: now,
    };

    await adapter.current.set(`project-${id}`, project);
    
    const newList = [...projects, listItem];
    await adapter.current.set('project-list', newList);
    setProjects(newList);
    
    setCurrentProject(project);
    return id;
  }, [projects]);

  // Open project
  const openProject = useCallback(async (id: string): Promise<void> => {
    setIsLoading(true);
    try {
      const project = await adapter.current.get<Project>(`project-${id}`);
      if (!project) {
        throw new Error(`Project ${id} not found`);
      }
      setCurrentProject(project);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save current project
  const saveProject = useCallback(async (data: unknown): Promise<void> => {
    if (!currentProject) {
      throw new Error('No project is open');
    }

    const updated: Project = {
      ...currentProject,
      data,
      updatedAt: Date.now(),
    };

    await adapter.current.set(`project-${currentProject.id}`, updated);
    setCurrentProject(updated);

    // Update list
    const newList = projects.map((p) =>
      p.id === currentProject.id ? { ...p, updatedAt: updated.updatedAt } : p
    );
    await adapter.current.set('project-list', newList);
    setProjects(newList);
  }, [currentProject, projects]);

  // Rename project
  const renameProject = useCallback(async (id: string, name: string): Promise<void> => {
    const project = await adapter.current.get<Project>(`project-${id}`);
    if (!project) throw new Error(`Project ${id} not found`);

    const updated = { ...project, name, updatedAt: Date.now() };
    await adapter.current.set(`project-${id}`, updated);

    const newList = projects.map((p) =>
      p.id === id ? { ...p, name, updatedAt: updated.updatedAt } : p
    );
    await adapter.current.set('project-list', newList);
    setProjects(newList);

    if (currentProject?.id === id) {
      setCurrentProject(updated);
    }
  }, [projects, currentProject]);

  // Delete project
  const deleteProject = useCallback(async (id: string): Promise<void> => {
    await adapter.current.remove(`project-${id}`);
    
    const newList = projects.filter((p) => p.id !== id);
    await adapter.current.set('project-list', newList);
    setProjects(newList);

    if (currentProject?.id === id) {
      setCurrentProject(null);
    }
  }, [projects, currentProject]);

  // Duplicate project
  const duplicateProject = useCallback(async (id: string, newName?: string): Promise<string> => {
    const original = await adapter.current.get<Project>(`project-${id}`);
    if (!original) throw new Error(`Project ${id} not found`);

    return createProject(
      newName || `${original.name} (Copy)`,
      original.description,
      original.data
    );
  }, [createProject]);

  // Export project
  const exportProject = useCallback(async (id: string): Promise<string> => {
    const project = await adapter.current.get<Project>(`project-${id}`);
    if (!project) throw new Error(`Project ${id} not found`);
    return JSON.stringify(project, null, 2);
  }, []);

  // Import project
  const importProject = useCallback(async (jsonString: string): Promise<string> => {
    const imported = JSON.parse(jsonString) as Project;
    return createProject(
      imported.name,
      imported.description,
      imported.data
    );
  }, [createProject]);

  // Close project
  const closeProject = useCallback(() => {
    setCurrentProject(null);
  }, []);

  return {
    projects,
    currentProject,
    isLoading,
    error,
    createProject,
    openProject,
    saveProject,
    renameProject,
    deleteProject,
    duplicateProject,
    exportProject,
    importProject,
    closeProject,
  };
}

// ============================================================================
// AUTO-SAVE HOOK
// ============================================================================

export interface UseAutoSaveOptions {
  data: unknown;
  projectId?: string;
  intervalMs?: number;
  onSave?: () => void;
  onError?: (error: Error) => void;
  enabled?: boolean;
}

export function useAutoSave(options: UseAutoSaveOptions) {
  const {
    data,
    projectId,
    intervalMs = 30000, // 30 seconds default
    onSave,
    onError,
    enabled = true,
  } = options;

  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const dataRef = useRef(data);
  const adapter = useRef(new IndexedDBAdapter());

  // Keep ref updated
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Auto-save interval
  useEffect(() => {
    if (!enabled || !projectId) return;

    const save = async () => {
      try {
        setIsSaving(true);
        const project = await adapter.current.get<Project>(`project-${projectId}`);
        if (project) {
          const updated = {
            ...project,
            data: dataRef.current,
            updatedAt: Date.now(),
          };
          await adapter.current.set(`project-${projectId}`, updated);
          setLastSaved(new Date());
          onSave?.();
        }
      } catch (err) {
        onError?.(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setIsSaving(false);
      }
    };

    const interval = setInterval(save, intervalMs);
    return () => clearInterval(interval);
  }, [enabled, projectId, intervalMs, onSave, onError]);

  return {
    lastSaved,
    isSaving,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  usePersistedState,
  useProjectPersistence,
  useAutoSave,
};
