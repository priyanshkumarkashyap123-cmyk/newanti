
/**
 * ProjectService - Manage User Projects with Database Backend
 */

import { fetchJson, postJson, fetchWithTimeout } from '../utils/fetchUtils';
import { API_CONFIG } from '../config/env';
import { logger } from '../lib/logging/logger';

export interface Project {
    id: number; // Database ID
    _id?: string; // Legacy alias used by older dashboard components
    user_id: string; // Clerk user ID
    name: string;
    description?: string;
    project_data: any; // Structural model data (renamed from 'data')
    data?: any; // Legacy alias used by older dashboard components
    thumbnail?: string;
    created_at: string; // ISO timestamp
    updated_at: string; // ISO timestamp
    createdAt?: string; // Legacy alias used by older dashboard components
    updatedAt?: string; // Legacy alias used by older dashboard components
    deletedAt?: string;
    isFavorite?: boolean;
    isPublic?: boolean;
}

const API_BASE_URL = API_CONFIG.baseUrl;
const FAVORITES_STORAGE_KEY = 'beamlab_project_favorites';
const TRASH_STORAGE_KEY = 'beamlab_project_trash';

function toProjectId(id: string | number): number {
    if (typeof id === 'number') return id;
    const parsed = Number.parseInt(id, 10);
    if (Number.isNaN(parsed)) {
        throw new Error(`Invalid project id: ${id}`);
    }
    return parsed;
}

function readStorageJson<T>(key: string, fallback: T): T {
    if (typeof window === 'undefined') return fallback;
    try {
        const raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) as T : fallback;
    } catch {
        return fallback;
    }
}

function writeStorageJson<T>(key: string, value: T): void {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Ignore storage failures in restricted environments.
    }
}

function normalizeProject(project: any): Project {
    const idValue = project?.id ?? project?._id ?? project?.project_id ?? project?.projectId ?? 0;
    const numericId = typeof idValue === 'number' ? idValue : Number.parseInt(String(idValue), 10) || 0;
    const projectData = project?.project_data ?? project?.data ?? {};
    const createdAt = project?.created_at ?? project?.createdAt ?? new Date().toISOString();
    const updatedAt = project?.updated_at ?? project?.updatedAt ?? createdAt;

    return {
        id: numericId,
        _id: String(idValue ?? numericId),
        user_id: project?.user_id ?? project?.userId ?? '',
        name: project?.name ?? 'Untitled Project',
        description: project?.description ?? '',
        project_data: projectData,
        data: projectData,
        created_at: createdAt,
        updated_at: updatedAt,
        createdAt,
        updatedAt,
        deletedAt: project?.deletedAt,
        isFavorite: project?.isFavorite,
        isPublic: project?.isPublic,
    };
}

function getFavoriteProjectsFromStorage(): Project[] {
    return readStorageJson<Project[]>(FAVORITES_STORAGE_KEY, []).map(normalizeProject);
}

function setFavoriteProjectsInStorage(projects: Project[]): void {
    writeStorageJson(FAVORITES_STORAGE_KEY, projects.map(normalizeProject));
}

function getTrashProjectsFromStorage(): Project[] {
    return readStorageJson<Project[]>(TRASH_STORAGE_KEY, []).map(normalizeProject);
}

function setTrashProjectsInStorage(projects: Project[]): void {
    writeStorageJson(TRASH_STORAGE_KEY, projects.map(normalizeProject));
}

export const ProjectService = {
    /**
     * List all projects for current user (max 5)
     */
    async listProjects(token: string, userId?: string): Promise<Project[]> {
        try {
            if (!userId) {
                logger.warn('[ProjectService] listProjects called without userId');
                return [];
            }
            const result = await fetchJson<Project[]>(`${API_BASE_URL}/api/db/projects/user/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                timeout: 10000
            });

            return (result || []).map(normalizeProject);
        } catch (error) {
            logger.error('[ProjectService] listProjects failed', { error: error instanceof Error ? error.message : String(error) });
            throw new Error(
                error instanceof Error ? error.message : 'Failed to load projects. Please check your network connection.'
            );
        }
    },

    /**
     * Get specific project details
     */
    async getProject(id: number | string, token: string): Promise<Project> {
        try {
            const result = await fetchJson<Project>(`${API_BASE_URL}/api/db/projects/${toProjectId(id)}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                timeout: 10000
            });

            return normalizeProject(result);
        } catch (error) {
            logger.error('[ProjectService] getProject failed', { error: error instanceof Error ? error.message : String(error) });
            throw new Error(
                error instanceof Error ? error.message : 'Failed to load project. Please check your network connection.'
            );
        }
    },

    /**
     * Create a new project
     */
    async createProject(
        project: { user_id: string; name: string; description?: string; project_data?: any; data?: any },
        token: string
    ): Promise<Project> {
        try {
            const projectData = project.project_data ?? project.data ?? {};
            const payload = await postJson<Project>(
                `${API_BASE_URL}/api/db/projects`,
                {
                    ...project,
                    project_data: projectData,
                },
                {
                    authToken: token,
                    withCsrf: true,
                    timeout: 10000,
                },
            );

            return normalizeProject(payload);
        } catch (error) {
            logger.error('[ProjectService] createProject failed', { error: error instanceof Error ? error.message : String(error) });
            throw error instanceof Error ? error : new Error('Failed to create project');
        }
    },

    /**
     * Update an existing project
     */
    async updateProject(
        id: number | string,
        updates: { name?: string; description?: string; project_data?: any; data?: any },
        token: string
    ): Promise<Project> {
        try {
            const projectData = updates.project_data ?? updates.data;
            const payload = await fetchJson<Project>(`${API_BASE_URL}/api/db/projects/${id}`, {
                method: 'PUT',
                body: JSON.stringify({
                    ...updates,
                    ...(projectData !== undefined ? { project_data: projectData } : {}),
                }),
                authToken: token,
                withCsrf: true,
                timeout: 10000,
            });

            return normalizeProject(payload);
        } catch (error) {
            logger.error('[ProjectService] updateProject failed', { error: error instanceof Error ? error.message : String(error) });
            throw error instanceof Error ? error : new Error('Failed to update project');
        }
    },

    /**
     * Delete a project
     */
    async deleteProject(id: number | string, token: string): Promise<void> {
        try {
            const projectId = toProjectId(id);
            const existingProject = await this.getProject(projectId, token).catch(() => null);
            const response = await fetchWithTimeout<unknown>(`${API_BASE_URL}/api/db/projects/${projectId}`, {
                method: 'DELETE',
                authToken: token,
                withCsrf: true,
                timeout: 10000,
            });

            if (!response.success) {
                throw new Error(response.error || 'Failed to delete project');
            }

            if (existingProject) {
                const trashProjects = getTrashProjectsFromStorage();
                if (!trashProjects.some((project) => project._id === existingProject._id)) {
                    setTrashProjectsInStorage([
                        ...trashProjects,
                        { ...existingProject, deletedAt: new Date().toISOString() },
                    ]);
                }
            }
        } catch (error) {
            logger.error('[ProjectService] deleteProject failed', { error: error instanceof Error ? error.message : String(error) });
            throw error instanceof Error ? error : new Error('Failed to delete project');
        }
    },

    async listFavoriteProjects(_token: string): Promise<Project[]> {
        return getFavoriteProjectsFromStorage();
    },

    async listDeletedProjects(_token: string): Promise<Project[]> {
        return getTrashProjectsFromStorage();
    },

    async toggleFavorite(projectId: number | string, token: string): Promise<void> {
        try {
            const project = await this.getProject(projectId, token).catch(() => null);
            if (!project) return;

            const favorites = getFavoriteProjectsFromStorage();
            const exists = favorites.some((item) => item._id === project._id);
            const nextFavorites = exists
                ? favorites.filter((item) => item._id !== project._id)
                : [...favorites, { ...project, isFavorite: true }];
            setFavoriteProjectsInStorage(nextFavorites);
        } catch (error) {
            logger.error('[ProjectService] toggleFavorite failed', { error: error instanceof Error ? error.message : String(error) });
            throw error instanceof Error ? error : new Error('Failed to toggle favorite');
        }
    },

    async permanentlyDeleteProject(projectId: number | string, token: string): Promise<void> {
        try {
            const numericProjectId = toProjectId(projectId);
            const response = await fetchWithTimeout<unknown>(`${API_BASE_URL}/api/db/projects/${numericProjectId}`, {
                method: 'DELETE',
                authToken: token,
                withCsrf: true,
                timeout: 10000,
            });

            if (!response.success && response.error) {
                throw new Error(response.error);
            }

            setTrashProjectsInStorage(
                getTrashProjectsFromStorage().filter((project) => project._id !== String(projectId)),
            );
            setFavoriteProjectsInStorage(
                getFavoriteProjectsFromStorage().filter((project) => project._id !== String(projectId)),
            );
        } catch (error) {
            logger.error('[ProjectService] permanentlyDeleteProject failed', { error: error instanceof Error ? error.message : String(error) });
            throw error instanceof Error ? error : new Error('Failed to permanently delete project');
        }
    },
};
