
/**
 * ProjectService - Manage User Projects
 */

import { fetchJson, postJson } from '../utils/fetchUtils';
import { API_CONFIG } from '../config/env';

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
            console.error('[ProjectService] listProjects failed:', error);
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
            console.error('[ProjectService] getProject failed:', error);
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
            const response = await fetch(`${API_BASE_URL}/api/project`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(project)
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                // Handle envelope error: { error: { code, message } }
                const errMsg = typeof err.error === 'object' ? err.error?.message : err.error;
                throw new Error(errMsg || 'Failed to create project');
            }

            const data = await response.json();
            // Unwrap API envelope: { success, data: { project }, requestId, ts }
            const payload = data?.data ?? data;
            return payload.project;
        } catch (error) {
            console.error('[ProjectService] createProject failed:', error);
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
            const response = await fetch(`${API_BASE_URL}/api/project/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updates)
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                const errMsg = typeof err.error === 'object' ? err.error?.message : err.error;
                throw new Error(errMsg || 'Failed to update project');
            }

            const data = await response.json();
            // Unwrap API envelope: { success, data: { project }, requestId, ts }
            const payload = data?.data ?? data;
            return payload.project;
        } catch (error) {
            console.error('[ProjectService] updateProject failed:', error);
            throw error instanceof Error ? error : new Error('Failed to update project');
        }
    },

    /**
     * Delete a project
     */
    async deleteProject(id: string, token: string): Promise<void> {
        try {
            const response = await fetch(`${API_BASE_URL}/api/project/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to delete project');
            }
        } catch (error) {
            console.error('[ProjectService] deleteProject failed:', error);
            throw error instanceof Error ? error : new Error('Failed to delete project');
        }
    }
};
