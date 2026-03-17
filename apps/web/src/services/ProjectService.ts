
/**
 * ProjectService - Manage User Projects
 */

import { fetchJson, postJson, fetchWithTimeout } from '../utils/fetchUtils';
import { API_CONFIG } from '../config/env';
import { logger } from '../lib/logging/logger';

export interface Project {
    _id: string;
    id?: string; // For compatibility
    name: string;
    description?: string;
    thumbnail?: string;
    data: any; // Structural model data
    updatedAt: string;
    createdAt: string;
    isPublic: boolean;
    isFavorited?: boolean;
    deletedAt?: string | null;
}

const API_BASE_URL = API_CONFIG.baseUrl;

export const ProjectService = {
    /**
     * List all projects for current user
     */
    async listProjects(token: string): Promise<Project[]> {
        try {
            const result = await fetchJson<{ projects: Project[] }>(`${API_BASE_URL}/api/project`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                timeout: 10000
            });

            return result.projects || [];
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
    async getProject(id: string, token: string): Promise<Project> {
        try {
            const result = await fetchJson<{ project: Project }>(`${API_BASE_URL}/api/project/${id}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                timeout: 10000
            });

            return result.project;
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
        project: { name: string; description?: string; data: any; thumbnail?: string },
        token: string
    ): Promise<Project> {
        try {
            const payload = await postJson<{ project: Project }>(
                `${API_BASE_URL}/api/project`,
                project,
                {
                    authToken: token,
                    withCsrf: true,
                    timeout: 10000,
                },
            );

            return payload.project;
        } catch (error) {
            logger.error('[ProjectService] createProject failed', { error: error instanceof Error ? error.message : String(error) });
            throw error instanceof Error ? error : new Error('Failed to create project');
        }
    },

    /**
     * Update an existing project
     */
    async updateProject(
        id: string,
        updates: { name?: string; description?: string; data?: any; thumbnail?: string },
        token: string
    ): Promise<Project> {
        try {
            const payload = await fetchJson<{ project: Project }>(`${API_BASE_URL}/api/project/${id}`, {
                method: 'PUT',
                body: JSON.stringify(updates),
                authToken: token,
                withCsrf: true,
                timeout: 10000,
            });

            return payload.project;
        } catch (error) {
            logger.error('[ProjectService] updateProject failed', { error: error instanceof Error ? error.message : String(error) });
            throw error instanceof Error ? error : new Error('Failed to update project');
        }
    },

    /**
     * Delete a project (soft-delete: sets deletedAt)
     */
    async deleteProject(id: string, token: string): Promise<void> {
        try {
            const response = await fetchWithTimeout<unknown>(`${API_BASE_URL}/api/project/${id}`, {
                method: 'DELETE',
                authToken: token,
                withCsrf: true,
                timeout: 10000,
            });

            if (!response.success) {
                throw new Error(response.error || 'Failed to delete project');
            }
        } catch (error) {
            logger.error('[ProjectService] deleteProject failed', { error: error instanceof Error ? error.message : String(error) });
            throw error instanceof Error ? error : new Error('Failed to delete project');
        }
    },

    /**
     * Permanently delete a soft-deleted project from trash
     */
    async permanentlyDeleteProject(id: string, token: string): Promise<void> {
        try {
            const response = await fetchWithTimeout<unknown>(`${API_BASE_URL}/api/project/${id}/permanent`, {
                method: 'DELETE',
                authToken: token,
                withCsrf: true,
                timeout: 10000,
            });

            if (!response.success) {
                throw new Error(response.error || 'Failed to permanently delete project');
            }
        } catch (error) {
            logger.error('[ProjectService] permanentlyDeleteProject failed', { error: error instanceof Error ? error.message : String(error) });
            throw error instanceof Error ? error : new Error('Failed to permanently delete project');
        }
    },

    /**
     * Toggle isFavorited on a project
     */
    async toggleFavorite(id: string, token: string): Promise<{ isFavorited: boolean }> {
        try {
            const result = await fetchJson<{ data: { isFavorited: boolean } }>(`${API_BASE_URL}/api/project/${id}/favorite`, {
                method: 'PATCH',
                authToken: token,
                withCsrf: true,
                timeout: 10000,
            });
            return { isFavorited: result.data?.isFavorited ?? false };
        } catch (error) {
            logger.error('[ProjectService] toggleFavorite failed', { error: error instanceof Error ? error.message : String(error) });
            throw error instanceof Error ? error : new Error('Failed to toggle favorite');
        }
    },

    /**
     * List favorited projects
     */
    async listFavoriteProjects(token: string): Promise<Project[]> {
        try {
            const result = await fetchJson<{ projects: Project[] }>(`${API_BASE_URL}/api/project?favorited=true`, {
                headers: { 'Authorization': `Bearer ${token}` },
                timeout: 10000,
            });
            return result.projects || [];
        } catch (error) {
            logger.error('[ProjectService] listFavoriteProjects failed', { error: error instanceof Error ? error.message : String(error) });
            throw error instanceof Error ? error : new Error('Failed to load favorites');
        }
    },

    /**
     * List soft-deleted projects (trash)
     */
    async listDeletedProjects(token: string): Promise<Project[]> {
        try {
            const result = await fetchJson<{ projects: Project[] }>(`${API_BASE_URL}/api/project?deleted=true`, {
                headers: { 'Authorization': `Bearer ${token}` },
                timeout: 10000,
            });
            return result.projects || [];
        } catch (error) {
            logger.error('[ProjectService] listDeletedProjects failed', { error: error instanceof Error ? error.message : String(error) });
            throw error instanceof Error ? error : new Error('Failed to load trash');
        }
    },
};
