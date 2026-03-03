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
// AUTO-SAVE (debounced subscription)
// ============================================

const AUTO_SAVE_DELAY_MS = 2000; // 2 seconds after last change

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Subscribe to store changes and auto-save to localStorage.
 * Only saves when structural data (nodes, members, loads) changes.
 */
export function initAutoSave(): void {
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
    }
  );
}

// Initialize auto-save immediately when this module is imported
initAutoSave();
