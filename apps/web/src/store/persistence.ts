/**
 * persistence.ts — Local storage & session persistence utilities.
 * Extracted from model.ts to reduce file size.
 *
 * These are standalone functions that operate on useModelStore externally.
 * The store-internal persistence (hydrateProjectData, persistAnalysisResults)
 * remains in model.ts to avoid circular imports.
 */
import { logger } from '../lib/logging/logger';
import { useModelStore } from './model';
import type {
  SavedProjectData,
  ProjectInfo,
  AnalysisResults,
} from './modelTypes';
import {
  serializeModel,
  deserializeModel,
  BEAMLAB_FILE,
  type SerializableModel,
} from '../core/BinaryModelSerializer';

// ============================================
// LOCAL STORAGE PERSISTENCE
// ============================================

const STORAGE_KEY = "beamlab_project";

/**
 * Save current project to localStorage
 */
export const saveProjectToStorage = (): boolean => {
  try {
    const state = useModelStore.getState();
    const projectData: SavedProjectData = {
      projectInfo: state.projectInfo,
      nodes: Array.from(state.nodes.entries()),
      members: Array.from(state.members.entries()),
      loads: state.loads || [],
      memberLoads: state.memberLoads || [],
      loadCases: state.loadCases || [],
      loadCombinations: state.loadCombinations || [],
      plates: Array.from(state.plates.entries()),
      floorLoads: state.floorLoads || [],
      savedAt: new Date().toISOString(),
    };

    // Validate data before saving
    if (projectData.nodes.length === 0) {
      logger.warn('Attempting to save empty project');
    }

    const jsonString = JSON.stringify(projectData);

    // Check approximate size (localStorage typically 5-10MB limit)
    if (jsonString.length > 5 * 1024 * 1024) {
      logger.error('Project too large to save locally');
      return false;
    }

    try {
      localStorage.setItem(STORAGE_KEY, jsonString);
    } catch (quotaError) {
      if (
        quotaError instanceof DOMException &&
        (quotaError as DOMException).code === 22
      ) {
        logger.error('localStorage quota exceeded - clear some projects');
        return false;
      }
      throw quotaError;
    }

    return true;
  } catch (e) {
    logger.error('Failed to save project', { error: e });
    return false;
  }
};

/**
 * Load project from localStorage
 */
export const loadProjectFromStorage = (): boolean => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;

    // Validate JSON before parsing
    let data: SavedProjectData;
    try {
      data = JSON.parse(stored);
    } catch {
      logger.error('Corrupted localStorage data, clearing');
      localStorage.removeItem(STORAGE_KEY);
      return false;
    }

    // Use the store's loadProject action which delegates to hydrateProjectData
    return useModelStore.getState().loadProject(data);
  } catch (e) {
    logger.error('Failed to load project', { error: e });
    return false;
  }
};

// ============================================================
// Analysis Results Session Persistence
// ============================================================
const ANALYSIS_SESSION_KEY = "beamlab_analysis_results";

/**
 * Restore analysis results from sessionStorage.
 * Called by pages that need results (e.g. Design Hub) when the
 * in-memory store is empty (page was refreshed / hard-navigated).
 */
export function hydrateAnalysisResults(): AnalysisResults | null {
  try {
    const raw = sessionStorage.getItem(ANALYSIS_SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    const results: AnalysisResults = {
      displacements: new Map(data.displacements ?? []),
      reactions: new Map(data.reactions ?? []),
      memberForces: new Map(data.memberForces ?? []),
      plateResults: data.plateResults,
      equilibriumCheck: data.equilibriumCheck,
      conditionNumber: data.conditionNumber,
      stats: data.stats,
    };
    if (data.completed !== undefined) {
      results.completed = data.completed;
    }
    if (data.timestamp !== undefined) {
      results.timestamp = data.timestamp;
    }
    return results;
  } catch (e) {
    logger.warn('Could not restore analysis results', { error: e });
    return null;
  }
}

/**
 * Check if a saved project exists
 */
export const hasSavedProject = (): boolean => {
  return localStorage.getItem(STORAGE_KEY) !== null;
};

/**
 * Get saved project metadata without loading it
 */
export const getSavedProjectInfo = (): {
  name: string;
  savedAt: string;
} | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const data: SavedProjectData = JSON.parse(stored);
    return {
      name: data.projectInfo.name,
      savedAt: data.savedAt,
    };
  } catch {
    return null;
  }
};

/**
 * Clear saved project from localStorage
 */
export const clearSavedProject = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};

// ============================================
// BINARY (.beamlab) FILE PERSISTENCE
// ============================================

/**
 * Export the current model as a .beamlab binary file (5-10× smaller than JSON).
 * Triggers a browser download.
 */
export function downloadProjectBinary(filename?: string): boolean {
  try {
    const state = useModelStore.getState();
    // Cast needed: domain types (Restraints, Plate etc.) have strict interfaces
    // that don't satisfy Record<string, unknown>, but are structurally compatible.
    const model = {
      projectInfo: state.projectInfo,
      nodes: state.nodes,
      members: state.members,
      loads: state.loads,
      memberLoads: state.memberLoads,
      plates: state.plates,
      loadCases: state.loadCases,
      loadCombinations: state.loadCombinations,
      settings: state.settings,
    } as unknown as SerializableModel;

    const buffer = serializeModel(model);
    const blob = new Blob([buffer], { type: BEAMLAB_FILE.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `${state.projectInfo.name || 'project'}${BEAMLAB_FILE.extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    logger.info(`Binary export: ${(buffer.byteLength / 1024).toFixed(1)} KB`);
    return true;
  } catch (e) {
    logger.error('Failed to export binary project', { error: e });
    return false;
  }
}

/**
 * Import a .beamlab binary file and load it into the store.
 * @param file - File object from <input type="file"> or drag-drop
 */
export async function loadProjectBinary(file: File): Promise<boolean> {
  try {
    const buffer = await file.arrayBuffer();
    const data = deserializeModel(buffer);

    // Cast: DeserializedModel uses generic Record types, SavedProjectData uses strict domain types.
    // They're structurally identical at runtime (same shape), just different TS type constraints.
    const projectData = {
      projectInfo: data.projectInfo,
      nodes: data.nodes,
      members: data.members,
      loads: data.loads,
      memberLoads: data.memberLoads,
      plates: data.plates,
      loadCases: data.loadCases,
      loadCombinations: data.loadCombinations,
      floorLoads: [],
      savedAt: data.savedAt,
    } as unknown as SavedProjectData;

    const success = useModelStore.getState().loadProject(projectData);
    if (success) {
      logger.info(`Binary import: ${data.nodes.length} nodes, ${data.members.length} members from ${(buffer.byteLength / 1024).toFixed(1)} KB`);
    }
    return success;
  } catch (e) {
    logger.error('Failed to import binary project', { error: e });
    return false;
  }
}

/**
 * Save to IndexedDB as binary instead of localStorage JSON.
 * Avoids the 5MB localStorage limit — IndexedDB can store hundreds of MB.
 */
export async function saveProjectToIndexedDB(): Promise<boolean> {
  try {
    const state = useModelStore.getState();
    const model = {
      projectInfo: state.projectInfo,
      nodes: state.nodes,
      members: state.members,
      loads: state.loads,
      memberLoads: state.memberLoads,
      plates: state.plates,
      loadCases: state.loadCases,
      loadCombinations: state.loadCombinations,
      settings: state.settings,
    } as unknown as SerializableModel;

    const buffer = serializeModel(model);

    return new Promise((resolve) => {
      const request = indexedDB.open('beamlab_projects', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects');
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('projects', 'readwrite');
        const store = tx.objectStore('projects');
        store.put(buffer, 'current');
        tx.oncomplete = () => { resolve(true); db.close(); };
        tx.onerror = () => { resolve(false); db.close(); };
      };
      request.onerror = () => resolve(false);
    });
  } catch (e) {
    logger.error('Failed to save to IndexedDB', { error: e });
    return false;
  }
}

/**
 * Load project from IndexedDB binary store.
 */
export async function loadProjectFromIndexedDB(): Promise<boolean> {
  try {
    return new Promise((resolve) => {
      const request = indexedDB.open('beamlab_projects', 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('projects')) {
          db.createObjectStore('projects');
        }
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('projects', 'readonly');
        const store = tx.objectStore('projects');
        const getReq = store.get('current');
        getReq.onsuccess = () => {
          const buffer = getReq.result as ArrayBuffer | undefined;
          if (!buffer) { resolve(false); db.close(); return; }
          try {
            const data = deserializeModel(buffer);
            const projectData = {
              projectInfo: data.projectInfo,
              nodes: data.nodes,
              members: data.members,
              loads: data.loads,
              memberLoads: data.memberLoads,
              plates: data.plates,
              loadCases: data.loadCases,
              loadCombinations: data.loadCombinations,
              floorLoads: [],
              savedAt: data.savedAt,
            } as unknown as SavedProjectData;
            resolve(useModelStore.getState().loadProject(projectData));
          } catch {
            resolve(false);
          }
          db.close();
        };
        getReq.onerror = () => { resolve(false); db.close(); };
      };
      request.onerror = () => resolve(false);
    });
  } catch (e) {
    logger.error('Failed to load from IndexedDB', { error: e });
    return false;
  }
}

// ============================================
// CLOUD SYNC (optional, for signed-in users)
// ============================================

const CLOUD_SYNC_DELAY_MS = 30_000; // 30 seconds after last change
let cloudSyncTimer: ReturnType<typeof setTimeout> | null = null;
let activeCloudProjectId: string | null = null;

/**
 * Save the current project to the backend API.
 * Requires authentication — silently no-ops if not signed in.
 */
export async function syncProjectToCloud(): Promise<boolean> {
  try {
    // Dynamic import to avoid circular deps with auth
    const { API_CONFIG } = await import('../config/env');
    const token = localStorage.getItem('beamlab_last_token');
    if (!token) return false; // Not signed in — skip cloud sync

    const state = useModelStore.getState();
    const projectData: SavedProjectData = {
      projectInfo: state.projectInfo,
      nodes: Array.from(state.nodes.entries()),
      members: Array.from(state.members.entries()),
      loads: state.loads || [],
      memberLoads: state.memberLoads || [],
      loadCases: state.loadCases || [],
      loadCombinations: state.loadCombinations || [],
      plates: Array.from(state.plates.entries()),
      floorLoads: state.floorLoads || [],
      savedAt: new Date().toISOString(),
    };

    const url = activeCloudProjectId
      ? `${API_CONFIG.baseUrl}/api/projects/${activeCloudProjectId}`
      : `${API_CONFIG.baseUrl}/api/projects`;
    const method = activeCloudProjectId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: state.projectInfo.name || 'Untitled Project',
        description: state.projectInfo.description || '',
        data: projectData,
      }),
    });

    if (!res.ok) return false;

    const body = await res.json();
    if (!activeCloudProjectId && body.project?._id) {
      activeCloudProjectId = body.project._id;
    }

    logger.info('Project synced to cloud');
    return true;
  } catch {
    return false; // Network error — will retry on next change
  }
}

/**
 * Set the active cloud project ID (e.g., when loading a project from the cloud).
 */
export function setCloudProjectId(id: string | null): void {
  activeCloudProjectId = id;
}

/**
 * Initialize debounced cloud sync alongside local auto-save.
 * Only activates for signed-in users.
 */
function scheduleCloudSync(): void {
  if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
  cloudSyncTimer = setTimeout(() => {
    syncProjectToCloud().catch(() => { /* silent */ });
  }, CLOUD_SYNC_DELAY_MS);
}

// ============================================
// AUTO-SAVE (debounced subscription)
// ============================================

const AUTO_SAVE_DELAY_MS = 2000; // 2 seconds after last change

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Subscribe to store changes and auto-save to localStorage.
 * Only saves when structural data (nodes, members, loads) changes.
 */
export function initAutoSave(): void {
  if (typeof useModelStore?.subscribe !== 'function') {
    return;
  }

  useModelStore.subscribe(
    (state, prevState) => {
      // Only auto-save when structural data changes (not UI state or analysis results)
      const structuralChanged =
        state.nodes !== prevState.nodes ||
        state.members !== prevState.members ||
        state.loads !== prevState.loads ||
        state.memberLoads !== prevState.memberLoads ||
        state.projectInfo !== prevState.projectInfo;

      if (!structuralChanged) return;

      // Debounce: clear previous timer and set a new one
      if (autoSaveTimer) clearTimeout(autoSaveTimer);
      autoSaveTimer = setTimeout(() => {
        try {
          saveProjectToStorage();
        } catch {
          // Silently fail — user can still manually save
        }
      }, AUTO_SAVE_DELAY_MS);

      // Schedule cloud sync (longer debounce, no-ops if not signed in)
      scheduleCloudSync();
    }
  );
}

// Defer auto-save initialization to avoid circular-import race condition.
// persistence.ts imports useModelStore from model.ts, but model.ts re-exports
// from persistence.ts — so when persistence.ts executes at import time,
// useModelStore has not yet been assigned.  A queueMicrotask ensures both
// modules have finished initialising before we call .subscribe().
queueMicrotask(() => {
  initAutoSave();
});
